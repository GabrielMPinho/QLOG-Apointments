import { db, isSqlServer, sql, sqlQuery } from '../lib/database.js';
import { shouldUseStatusProtheusFilter } from '../lib/documentStatusProtheus.js';
import {
  normalizeOperationCode,
  operationCodeFromId,
  operationId,
  operationLabel,
} from '../lib/operations.js';

function minutesBetween(startedAt, finishedAt) {
  if (!startedAt || !finishedAt) return null;

  const start = new Date(startedAt).getTime();
  const end = new Date(finishedAt).getTime();

  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;

  return Math.round((end - start) / 60_000);
}

export function mapApontamento(row) {
  if (!row) return null;

  const operationCode =
    normalizeOperationCode(row.tipo_operacao) ||
    operationCodeFromId(row.tipo_operacao_id) ||
    '';
  const dataInicio = row.data_inicio || row.data_hora_inicio;
  const dataFim = row.data_fim || row.data_hora_fim || null;

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
    status: dataFim ? 'FINALIZADO' : 'EM_ANDAMENTO',
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
    time_spent_minutes: minutesBetween(dataInicio, dataFim),
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
    a.data_hora_inicio,
    a.data_hora_fim,
    a.volumes,
    a.skus,
    a.criado,
    a.atualizado,
    u.nome as nome_usuario,
    u.login,
    d.tabela_origem,
    d.numero_documento,
    d.tipo_documento,
    d.nome_parceiro,
    d.codigo_parceiro,
    d.loja_parceiro,
    d.data_documento,
    d.peso_bruto,
    d.peso_liquido,
    try_convert(int, json_value(ev.metadados, '$.delegated_by_user_id')) as delegated_by_user_id,
    delegator.nome as delegated_by_user_name,
    delegator.login as delegated_by_username
  from DADOS_BI.dbo.tb_qlog_apontamentos a
  left join dbo.tb_qlog_usuarios u on u.id = a.usuario_id
  left join DADOS_BI.dbo.tb_qlog_documentos d on d.id = a.documento_id
  outer apply (
    select top 1 e.metadados
    from dbo.tb_qlog_eventos_documento e
    where e.apontamento_id = a.id
      and e.metadados is not null
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
        where upper(ltrim(rtrim(convert(varchar(50), d.status)))) = 'DISPONIVEL'
          and ${documentEligibilityWhere}
          and not exists (
            select 1
            from DADOS_BI.dbo.tb_qlog_apontamentos completed
            where completed.documento_id = d.id
              and completed.tipo_operacao_id = @operationId
              and completed.data_hora_fim is not null
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

    if (delegatedByUserId) {
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
          select
            documento_id,
            id,
            @delegatedByUserId,
            1,
            null,
            null,
            getdate(),
            @metadata
          from DADOS_BI.dbo.tb_qlog_apontamentos
          where id = @insertedId
        `,
        {
          insertedId: { type: sql.Int, value: Number(insertedId) },
          delegatedByUserId: { type: sql.Int, value: Number(delegatedByUserId) },
          metadata: {
            type: sql.NVarChar(sql.MAX),
            value: JSON.stringify({ delegated_by_user_id: Number(delegatedByUserId) }),
          },
        }
      );
    }

    return findById(insertedId);
  }

  const result = db
    .prepare(`
      insert into apontamentos (user_id, delegated_by_user_id, tipo_operacao, numero_documento, data_inicio, data_fim)
      values (?, ?, ?, ?, current_timestamp, null)
    `)
    .run(userId, delegatedByUserId, tipoOperacao, numeroDocumento);

  return findById(result.lastInsertRowid);
}

export async function closeApontamento(id) {
  if (isSqlServer) {
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

    return findById(id);
  }

  db
    .prepare(`
      update apontamentos
      set data_fim = current_timestamp,
          updated_at = current_timestamp
      where id = ?
    `)
    .run(id);

  return findById(id);
}
