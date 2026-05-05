import { db, hasColumn, isSqlServer, sql, sqlQuery } from '../lib/database.js';
import { shouldUseStatusProtheusFilter } from '../lib/documentStatusProtheus.js';
import {
  normalizeOperationCode,
  operationCodeFromId,
  operationId,
  operationLabel,
} from '../lib/operations.js';

function minutesBetween(startedAt, finishedAt = null) {
  if (!startedAt) return null;

  const start = new Date(startedAt).getTime();
  const end = finishedAt ? new Date(finishedAt).getTime() : Date.now();

  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;

  return Math.floor((end - start) / 60_000);
}

export function mapApontamento(row) {
  if (!row) return null;

  const operationCode =
    normalizeOperationCode(row.tipo_operacao) ||
    operationCodeFromId(row.tipo_operacao_id) ||
    '';
  const dataInicio = row.data_inicio || row.data_hora_inicio;
  const dataFim = row.data_fim || row.data_hora_fim || null;
  const operationalStatus = row.appointment_status || row.status_operacional || (dataFim ? 'FINALIZADO' : 'INICIADO');
  const elapsedMinutes =
    row.elapsed_minutes !== undefined && row.elapsed_minutes !== null
      ? Number(row.elapsed_minutes)
      : minutesBetween(dataInicio, dataFim);

  return {
    id: String(row.id),
    user_id: String(row.user_id || row.usuario_id),
    user_name: row.user_name || row.nome_usuario || null,
    username: row.username || row.login || null,
    delegated_by_user_id: row.delegated_by_user_id ? String(row.delegated_by_user_id) : null,
    delegated_by_user_name: row.delegated_by_user_name || null,
    delegated_by_username: row.delegated_by_username || null,
    tipo_operacao: operationCode,
    tipo_operacao_label: operationLabel(operationCode),
    numero_documento: row.numero_documento,
    documento_id: row.documento_id ? String(row.documento_id) : null,
    data_inicio: dataInicio,
    data_fim: dataFim,
    status: operationalStatus,
    document: {
      origin: row.source_table || row.tabela_origem || '',
      type: row.document_type || row.tipo_documento || '',
      partner_name: row.partner_name || row.nome_parceiro || '',
      partner_code: row.partner_code || row.codigo_parceiro || '',
      partner_store: row.partner_store || row.loja_parceiro || '',
      document_date: row.document_date || row.data_documento || '',
      volumes: Number(row.volumes_count || row.volumes || 0),
      skus: Number(row.skus_count || row.skus || 0),
      gross_weight: Number(row.gross_weight || row.peso_bruto || 0),
      net_weight: Number(row.net_weight || row.peso_liquido || 0),
    },
    time_spent_minutes: Number.isFinite(elapsedMinutes) ? elapsedMinutes : minutesBetween(dataInicio, dataFim),
    created_at: row.created_at || row.criado || null,
    updated_at: row.updated_at || row.atualizado || null,
  };
}

const sqliteSelectApontamentosSql = `
  select
    a.*,
    u.name as user_name,
    u.username,
    delegator.name as delegated_by_user_name,
    delegator.username as delegated_by_username,
    d.source_table,
    d.document_type,
    d.partner_name,
    d.partner_code,
    d.partner_store,
    d.document_date,
    d.volumes_count,
    d.skus_count,
    d.gross_weight,
    d.net_weight
  from apontamentos a
  left join users u on u.id = a.user_id
  left join users delegator on delegator.id = a.delegated_by_user_id
  left join documents d on d.document_number = a.numero_documento
`;

const sqlServerSelectApontamentosSql = `
  select
    a.id,
    a.documento_id,
    a.usuario_id,
    a.tipo_operacao_id,
    convert(varchar(19), a.data_hora_inicio, 126) as data_hora_inicio,
    convert(varchar(19), a.data_hora_fim, 126) as data_hora_fim,
    datediff(minute, a.data_hora_inicio, coalesce(a.data_hora_fim, getdate())) as elapsed_minutes,
    a.volumes,
    a.skus,
    convert(varchar(19), a.criado, 126) as criado,
    convert(varchar(19), a.atualizado, 126) as atualizado,
    u.nome as nome_usuario,
    u.login,
    d.tabela_origem,
    d.numero_documento,
    d.tipo_documento,
    d.nome_parceiro,
    d.codigo_parceiro,
    d.loja_parceiro,
    convert(varchar(10), d.data_documento, 23) as data_documento,
    d.peso_bruto,
    d.peso_liquido,
    latest_status.status_novo as appointment_status,
    try_convert(int, json_value(ev.metadados, '$.delegated_by_user_id')) as delegated_by_user_id,
    delegator.nome as delegated_by_user_name,
    delegator.login as delegated_by_username
  from DADOS_BI.dbo.tb_qlog_apontamentos a
  left join dbo.tb_qlog_usuarios u on u.id = a.usuario_id
  left join DADOS_BI.dbo.tb_qlog_documentos d on d.id = a.documento_id
  outer apply (
    select top 1 e.status_novo
    from dbo.tb_qlog_eventos_documento e
    where e.apontamento_id = a.id
      and e.status_novo is not null
    order by e.data_hora_evento desc, e.id desc
  ) latest_status
  outer apply (
    select top 1 e.metadados
    from dbo.tb_qlog_eventos_documento e
    where e.apontamento_id = a.id
      and e.metadados is not null
      and json_value(e.metadados, '$.delegated_by_user_id') is not null
    order by e.data_hora_evento desc
  ) ev
  left join dbo.tb_qlog_usuarios delegator
    on delegator.id = try_convert(int, json_value(ev.metadados, '$.delegated_by_user_id'))
`;

async function findById(id) {
  if (isSqlServer) {
    const result = await sqlQuery(
      `${sqlServerSelectApontamentosSql} where a.id = @id`,
      { id: { type: sql.Int, value: Number(id) } }
    );

    return mapApontamento(result.recordset[0]);
  }

  return mapApontamento(db.prepare(`${sqliteSelectApontamentosSql} where a.id = ?`).get(id));
}

async function insertSqlServerDocumentEvent({
  documentoId,
  apontamentoId,
  usuarioId,
  tipoEventoId,
  statusAntigo = null,
  statusNovo = null,
  metadata,
}) {
  await sqlQuery(
    `
      insert into dbo.tb_qlog_eventos_documento (
        documento_id,
        apontamento_id,
        usuario_id,
        tipo_evento_id,
        status_antigo,
        status_novo,
        data_hora_evento,
        metadados
      )
      values (
        @documentoId,
        @apontamentoId,
        @usuarioId,
        @tipoEventoId,
        @statusAntigo,
        @statusNovo,
        getdate(),
        @metadata
      )
    `,
    {
      documentoId: { type: sql.Int, value: Number(documentoId) },
      apontamentoId: { type: sql.Int, value: apontamentoId ? Number(apontamentoId) : null },
      usuarioId: { type: sql.Int, value: usuarioId ? Number(usuarioId) : null },
      tipoEventoId: { type: sql.Int, value: Number(tipoEventoId) },
      statusAntigo: { type: sql.NVarChar(100), value: statusAntigo },
      statusNovo: { type: sql.NVarChar(100), value: statusNovo },
      metadata: {
        type: sql.NVarChar(sql.MAX),
        value: JSON.stringify(metadata),
      },
    }
  );
}

function insertSqliteDocumentEvent({
  documentoId,
  usuarioId,
  tipoEventoId,
  statusAntigo = null,
  statusNovo = null,
  metadata,
}) {
  db
    .prepare(`
      insert into document_events (document_id, user_id, event_type, old_status, new_status, event_at, metadata)
      values (?, ?, ?, ?, ?, current_timestamp, ?)
    `)
    .run(
      documentoId,
      usuarioId,
      String(tipoEventoId),
      statusAntigo,
      statusNovo,
      JSON.stringify(metadata)
    );
}

const DOCUMENT_EVENT_TYPES = [
  { id: 1, status: 'DISPONIVEL' },
  { id: 2, status: 'INICIADO' },
  { id: 3, status: 'CANCELADO' },
  { id: 4, status: 'FINALIZADO' },
];

const DOCUMENT_EVENT_TYPE_ID = Object.freeze({
  DISPONIVEL: 1,
  INICIADO: 2,
  CANCELADO: 3,
  FINALIZADO: 4,
});

export async function syncSqlServerDocumentEventTypes() {
  if (!isSqlServer) return;

  const columnsResult = await sqlQuery(`
    select lower(name) as name
    from sys.columns
    where object_id = object_id('dbo.tb_qlog_tipos_evento_documento')
  `);
  const columns = new Set(columnsResult.recordset.map((column) => column.name));

  if (!columns.has('id')) return;

  if (columns.has('descricao')) {
    try {
      await sqlQuery(`
        declare @sql nvarchar(max) = N'';

        select @sql = @sql + N'alter table dbo.tb_qlog_tipos_evento_documento drop constraint '
          + quotename(dc.name) + N';'
        from sys.default_constraints dc
        join sys.columns c
          on c.object_id = dc.parent_object_id
         and c.column_id = dc.parent_column_id
        where dc.parent_object_id = object_id('dbo.tb_qlog_tipos_evento_documento')
          and c.name = 'descricao';

        if @sql <> N'' exec sp_executesql @sql;

        alter table dbo.tb_qlog_tipos_evento_documento drop column descricao;
      `);
      columns.delete('descricao');
    } catch (error) {
      console.warn('Nao foi possivel remover dbo.tb_qlog_tipos_evento_documento.descricao:', error.message);
    }
  }

  const statusColumns = ['codigo', 'nome', 'status', 'tipo_evento', 'descricao']
    .filter((column) => columns.has(column));
  const hasActiveColumn = columns.has('ativo');
  const hasCreatedColumn = columns.has('criado');
  const hasUpdatedColumn = columns.has('atualizado');

  await sqlQuery('delete from dbo.tb_qlog_tipos_evento_documento where id not in (1, 2, 3, 4)');

  for (const eventType of DOCUMENT_EVENT_TYPES) {
    const updateAssignments = [
      ...statusColumns.map((column) => `${column} = @status`),
      ...(hasActiveColumn ? ['ativo = 1'] : []),
      ...(hasUpdatedColumn ? ['atualizado = getdate()'] : []),
    ];
    const insertColumns = [
      'id',
      ...statusColumns,
      ...(hasActiveColumn ? ['ativo'] : []),
      ...(hasCreatedColumn ? ['criado'] : []),
      ...(hasUpdatedColumn ? ['atualizado'] : []),
    ];
    const insertValues = [
      '@id',
      ...statusColumns.map(() => '@status'),
      ...(hasActiveColumn ? ['1'] : []),
      ...(hasCreatedColumn ? ['getdate()'] : []),
      ...(hasUpdatedColumn ? ['getdate()'] : []),
    ];
    const updateExistingSql = updateAssignments.length
      ? `
          update dbo.tb_qlog_tipos_evento_documento
          set ${updateAssignments.join(', ')}
          where id = @id
        `
      : 'select 1';

    await sqlQuery(
      `
        if exists (select 1 from dbo.tb_qlog_tipos_evento_documento where id = @id)
        begin
          ${updateExistingSql}
        end
        else
        begin
          insert into dbo.tb_qlog_tipos_evento_documento (${insertColumns.join(', ')})
          values (${insertValues.join(', ')})
        end
      `,
      {
        id: { type: sql.Int, value: eventType.id },
        status: { type: sql.NVarChar(100), value: eventType.status },
      }
    );
  }
}

async function getSqlServerDocumentStatus(documentoId) {
  const result = await sqlQuery(
    `
      select top 1 status
      from (
        select
          status_novo as status,
          data_hora_evento,
          id,
          1 as priority
        from dbo.tb_qlog_eventos_documento
        where documento_id = @documentoId
          and status_novo is not null

        union all

        select
          status,
          atualizado,
          0,
          2
        from DADOS_BI.dbo.tb_qlog_documentos
        where id = @documentoId
      ) status_history
      where status is not null
      order by priority asc, data_hora_evento desc, id desc
    `,
    { documentoId: { type: sql.Int, value: Number(documentoId) } }
  );

  return result.recordset[0]?.status ?? null;
}

async function updateSqlServerDocumentStatus(documentoId, status) {
  await sqlQuery(
    `
      update DADOS_BI.dbo.tb_qlog_documentos
      set status = @status,
          atualizado = getdate()
      where id = @documentoId
    `,
    {
      documentoId: { type: sql.Int, value: Number(documentoId) },
      status: { type: sql.NVarChar(100), value: status },
    }
  );
}

async function updateSqlServerDocumentStatusFromLatestEvent(documentoId) {
  await sqlQuery(
    `
      update d
      set d.status = latest.status_novo,
          d.atualizado = getdate()
      from DADOS_BI.dbo.tb_qlog_documentos d
      cross apply (
        select top 1 e.status_novo
        from dbo.tb_qlog_eventos_documento e
        where e.documento_id = d.id
          and e.status_novo is not null
        order by e.data_hora_evento desc, e.id desc
      ) latest
      where d.id = @documentoId
    `,
    { documentoId: { type: sql.Int, value: Number(documentoId) } }
  );
}

function getSqliteDocumentByAppointment(apontamento) {
  const statusSelect = hasColumn('documents', 'status') ? 'status' : 'null as status';

  return db
    .prepare(`select id, ${statusSelect} from documents where document_number = ? order by id desc limit 1`)
    .get(apontamento.numero_documento);
}

function updateSqliteDocumentStatus(documentoId, status) {
  if (!hasColumn('documents', 'status')) return;

  db
    .prepare(`
      update documents
      set status = ?,
          updated_at = current_timestamp
      where id = ?
    `)
    .run(status, documentoId);
}

export async function findOpenByUser(userId) {
  if (isSqlServer) {
    const result = await sqlQuery(
      `
        ${sqlServerSelectApontamentosSql}
        where a.usuario_id = @userId
          and a.data_hora_fim is null
        order by a.data_hora_inicio desc
      `,
      { userId: { type: sql.Int, value: Number(userId) } }
    );

    return mapApontamento(result.recordset[0]);
  }

  return mapApontamento(
    db
      .prepare(`${sqliteSelectApontamentosSql} where a.user_id = ? and a.data_fim is null order by a.data_inicio desc limit 1`)
      .get(userId)
  );
}

export async function listOpenByUser(userId) {
  if (isSqlServer) {
    const result = await sqlQuery(
      `
        ${sqlServerSelectApontamentosSql}
        where a.usuario_id = @userId
          and a.data_hora_fim is null
        order by a.data_hora_inicio desc
      `,
      { userId: { type: sql.Int, value: Number(userId) } }
    );

    return result.recordset.map(mapApontamento);
  }

  return db
    .prepare(`${sqliteSelectApontamentosSql} where a.user_id = ? and a.data_fim is null order by a.data_inicio desc`)
    .all(userId)
    .map(mapApontamento);
}

export async function listHistoryByUser(userId) {
  if (isSqlServer) {
    const result = await sqlQuery(
      `
        ${sqlServerSelectApontamentosSql}
        where a.usuario_id = @userId
          and a.data_hora_fim is not null
        order by a.data_hora_inicio desc
      `,
      { userId: { type: sql.Int, value: Number(userId) } }
    );

    return result.recordset.map(mapApontamento);
  }

  return db
    .prepare(`${sqliteSelectApontamentosSql} where a.user_id = ? and a.data_fim is not null order by a.data_inicio desc`)
    .all(userId)
    .map(mapApontamento);
}

export async function listAll(filters = {}) {
  if (isSqlServer) {
    const params = {};
    const where = [];

    if (filters.userId) {
      where.push('a.usuario_id = @userId');
      params.userId = { type: sql.Int, value: Number(filters.userId) };
    }

    if (filters.openOnly) {
      where.push('a.data_hora_fim is null');
    }

    if (filters.finishedOnly) {
      where.push('a.data_hora_fim is not null');
    }

    const result = await sqlQuery(
      [
        sqlServerSelectApontamentosSql,
        where.length ? `where ${where.join(' and ')}` : '',
        'order by a.data_hora_inicio desc',
      ].join(' '),
      params
    );

    return result.recordset.map(mapApontamento);
  }

  const params = [];
  const where = [];

  if (filters.userId) {
    where.push('a.user_id = ?');
    params.push(filters.userId);
  }

  if (filters.openOnly) {
    where.push('a.data_fim is null');
  }

  if (filters.finishedOnly) {
    where.push('a.data_fim is not null');
  }

  const query = [
    sqliteSelectApontamentosSql,
    where.length ? `where ${where.join(' and ')}` : '',
    'order by a.data_inicio desc',
  ].join(' ');

  return db.prepare(query).all(...params).map(mapApontamento);
}

export async function createApontamento({
  userId,
  tipoOperacao,
  numeroDocumento,
  documentoId = null,
  delegatedByUserId = null,
}) {
  if (isSqlServer) {
    const opId = operationId(tipoOperacao);
    const useStatusProtheusFilter = await shouldUseStatusProtheusFilter();
    let documentEligibilityWhere = '1 = 0';

    if ([1, 2, 3].includes(opId)) {
      documentEligibilityWhere = "upper(ltrim(rtrim(convert(varchar(50), d.tabela_origem)))) = 'SF1'";
    }

    if (opId === 4) {
      documentEligibilityWhere = useStatusProtheusFilter
        ? "upper(ltrim(rtrim(convert(varchar(50), d.tabela_origem)))) = 'SC5' and right('0' + ltrim(rtrim(convert(varchar(10), d.status_protheus))), 2) = '05'"
        : "upper(ltrim(rtrim(convert(varchar(50), d.tabela_origem)))) = 'SC5'";
    }

    if ([5, 6].includes(opId)) {
      documentEligibilityWhere = useStatusProtheusFilter
        ? "upper(ltrim(rtrim(convert(varchar(50), d.tabela_origem)))) = 'SC5' and right('0' + ltrim(rtrim(convert(varchar(10), d.status_protheus))), 2) = '04'"
        : "upper(ltrim(rtrim(convert(varchar(50), d.tabela_origem)))) = 'SC5'";
    }

    const params = {
      userId: { type: sql.Int, value: Number(userId) },
      operationId: { type: sql.Int, value: opId },
      documentId: { type: sql.Int, value: documentoId ? Number(documentoId) : null },
      numeroDocumento: { type: sql.NVarChar(100), value: String(numeroDocumento || '') },
    };

    const result = await sqlQuery(
      `
        insert into DADOS_BI.dbo.tb_qlog_apontamentos (
          documento_id,
          usuario_id,
          tipo_operacao_id,
          data_hora_inicio,
          data_hora_fim,
          volumes,
          skus,
          criado,
          atualizado
        )
        output inserted.id
        select top 1
          d.id,
          @userId,
          @operationId,
          getdate(),
          null,
          d.volumes,
          d.skus,
          getdate(),
          null
        from DADOS_BI.dbo.tb_qlog_documentos d
        where upper(ltrim(rtrim(convert(varchar(50), d.status)))) in ('DISPONIVEL', 'CANCELADO')
          and ${documentEligibilityWhere}
          and not exists (
            select 1
            from DADOS_BI.dbo.tb_qlog_apontamentos completed
            where completed.documento_id = d.id
              and completed.tipo_operacao_id = @operationId
              and completed.data_hora_fim is not null
              and not exists (
                select 1
                from dbo.tb_qlog_eventos_documento cancel_event
                where cancel_event.apontamento_id = completed.id
                  and cancel_event.tipo_evento_id = 3
              )
          )
          and (
            (@documentId is not null and d.id = @documentId)
            or (@documentId is null and d.numero_documento = @numeroDocumento)
          )
        order by d.data_documento desc, d.id desc
      `,
      params
    );

    const insertedId = result.recordset[0]?.id;
    if (!insertedId) return null;

    const apontamento = await findById(insertedId);
    const statusAntigo = await getSqlServerDocumentStatus(apontamento.documento_id);
    await updateSqlServerDocumentStatus(apontamento.documento_id, 'INICIADO');

    await insertSqlServerDocumentEvent({
      documentoId: apontamento.documento_id,
      apontamentoId: apontamento.id,
      usuarioId: apontamento.user_id,
      tipoEventoId: DOCUMENT_EVENT_TYPE_ID.INICIADO,
      statusAntigo,
      statusNovo: 'INICIADO',
      metadata: {
        acao: 'status_alterado',
        evento: 'STATUS_ALTERADO',
        tipo_operacao_id: opId,
        status_documento_antigo: statusAntigo,
        status_documento_novo: 'INICIADO',
        ...(delegatedByUserId ? { delegated_by_user_id: Number(delegatedByUserId) } : {}),
      },
    });
    await updateSqlServerDocumentStatusFromLatestEvent(apontamento.documento_id);

    return apontamento;
  }

  const result = db
    .prepare(`
      insert into apontamentos (user_id, delegated_by_user_id, tipo_operacao, numero_documento, data_inicio, data_fim)
      values (?, ?, ?, ?, current_timestamp, null)
    `)
    .run(userId, delegatedByUserId, tipoOperacao, numeroDocumento);

  const document = documentoId
    ? { id: documentoId }
    : db.prepare('select id from documents where document_number = ? order by id desc limit 1').get(numeroDocumento);

  if (document?.id) {
    const statusAntigo = hasColumn('documents', 'status')
      ? db.prepare('select status from documents where id = ?').get(document.id)?.status ?? null
      : null;
    updateSqliteDocumentStatus(document.id, 'INICIADO');

    insertSqliteDocumentEvent({
      documentoId: document.id,
      usuarioId: userId,
      tipoEventoId: DOCUMENT_EVENT_TYPE_ID.INICIADO,
      statusAntigo,
      statusNovo: 'INICIADO',
      metadata: {
        acao: 'status_alterado',
        evento: 'STATUS_ALTERADO',
        tipo_operacao_id: operationId(tipoOperacao),
        status_documento_antigo: statusAntigo,
        status_documento_novo: 'INICIADO',
        ...(delegatedByUserId ? { delegated_by_user_id: Number(delegatedByUserId) } : {}),
      },
    });
  }

  return findById(result.lastInsertRowid);
}

export async function closeApontamento(id) {
  if (isSqlServer) {
    const apontamento = await findById(id);
    if (!apontamento) return null;
    const statusAntigo = await getSqlServerDocumentStatus(apontamento.documento_id);

    await sqlQuery(
      `
        update DADOS_BI.dbo.tb_qlog_apontamentos
        set data_hora_fim = getdate(),
            atualizado = getdate()
        where id = @id
          and data_hora_fim is null
      `,
      { id: { type: sql.Int, value: Number(id) } }
    );

    await updateSqlServerDocumentStatus(apontamento.documento_id, 'FINALIZADO');

    await insertSqlServerDocumentEvent({
      documentoId: apontamento.documento_id,
      apontamentoId: apontamento.id,
      usuarioId: apontamento.user_id,
      tipoEventoId: DOCUMENT_EVENT_TYPE_ID.FINALIZADO,
      statusAntigo,
      statusNovo: 'FINALIZADO',
      metadata: {
        acao: 'status_alterado',
        evento: 'STATUS_ALTERADO',
        status_documento_antigo: statusAntigo,
        status_documento_novo: 'FINALIZADO',
      },
    });
    await updateSqlServerDocumentStatusFromLatestEvent(apontamento.documento_id);

    return findById(id);
  }

  const apontamento = await findById(id);
  if (!apontamento) return null;

  db
    .prepare(`
      update apontamentos
      set data_fim = current_timestamp,
          updated_at = current_timestamp
      where id = ?
    `)
    .run(id);

  const document = getSqliteDocumentByAppointment(apontamento);

  if (document?.id) {
    updateSqliteDocumentStatus(document.id, 'FINALIZADO');

    insertSqliteDocumentEvent({
      documentoId: document.id,
      usuarioId: apontamento.user_id,
      tipoEventoId: DOCUMENT_EVENT_TYPE_ID.FINALIZADO,
      statusAntigo: document.status ?? null,
      statusNovo: 'FINALIZADO',
      metadata: {
        acao: 'status_alterado',
        evento: 'STATUS_ALTERADO',
        status_documento_antigo: document.status ?? null,
        status_documento_novo: 'FINALIZADO',
      },
    });
  }

  return findById(id);
}

export async function cancelApontamentoDocument({ apontamentoId, supervisorUserId }) {
  const apontamento = await findById(apontamentoId);
  if (!apontamento) return null;

  if (isSqlServer) {
    if (!apontamento.documento_id) return null;

    const statusAntigo = await getSqlServerDocumentStatus(apontamento.documento_id);
    await updateSqlServerDocumentStatus(apontamento.documento_id, 'CANCELADO');

    await sqlQuery(
      `
        update DADOS_BI.dbo.tb_qlog_apontamentos
        set data_hora_fim = coalesce(data_hora_fim, getdate()),
            atualizado = getdate()
        where id = @id
      `,
      { id: { type: sql.Int, value: Number(apontamento.id) } }
    );

    await insertSqlServerDocumentEvent({
      documentoId: apontamento.documento_id,
      apontamentoId: apontamento.id,
      usuarioId: supervisorUserId,
      tipoEventoId: DOCUMENT_EVENT_TYPE_ID.CANCELADO,
      statusAntigo,
      statusNovo: 'CANCELADO',
      metadata: {
        acao: 'status_alterado',
        evento: 'STATUS_ALTERADO',
        origem: 'tela_supervisor',
        status_documento_antigo: statusAntigo,
        status_documento_novo: 'CANCELADO',
      },
    });
    await updateSqlServerDocumentStatusFromLatestEvent(apontamento.documento_id);

    return findById(apontamento.id);
  }

  const document = getSqliteDocumentByAppointment(apontamento);

  if (!document?.id) return null;

  updateSqliteDocumentStatus(document.id, 'CANCELADO');

  db
    .prepare(`
      update apontamentos
      set data_fim = coalesce(data_fim, current_timestamp),
          updated_at = current_timestamp
      where id = ?
    `)
    .run(apontamento.id);

  insertSqliteDocumentEvent({
    documentoId: document.id,
    usuarioId: supervisorUserId,
    tipoEventoId: DOCUMENT_EVENT_TYPE_ID.CANCELADO,
    statusAntigo: document.status ?? null,
    statusNovo: 'CANCELADO',
    metadata: {
      acao: 'status_alterado',
      evento: 'STATUS_ALTERADO',
      origem: 'tela_supervisor',
      status_documento_antigo: document.status ?? null,
      status_documento_novo: 'CANCELADO',
    },
  });

  return findById(apontamento.id);
}
