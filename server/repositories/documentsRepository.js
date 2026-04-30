import { db, isSqlServer, sql, sqlQuery } from '../lib/database.js';
import { shouldUseStatusProtheusFilter } from '../lib/documentStatusProtheus.js';
import { normalizeOperationCode, operationId, operationLabel } from '../lib/operations.js';

function calculateMinutes(startedAt, finishedAt) {
  if (!startedAt || !finishedAt) return null;

  const start = new Date(startedAt).getTime();
  const end = new Date(finishedAt).getTime();

  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;

  return Math.round((end - start) / 60_000);
}

export function mapDocument(row) {
  if (!row) return null;

  const operationCode =
    normalizeOperationCode(row.operation_type_code || row.operation || row.requested_operation_code) || '';

  return {
    id: String(row.id),
    origin: row.source_table || row.tabela_origem || row.origin || '',
    document_number: row.document_number || row.numero_documento || row.number || '',
    series: row.document_series || row.serie_documento || row.series || '',
    type: row.document_type || row.tipo_documento || row.type || '',
    operation_type_code: operationCode,
    operation: operationLabel(operationCode),
    partner_name: row.partner_name || row.nome_parceiro || row.partner || row.client || '',
    partner_code: row.partner_code || row.codigo_parceiro || '',
    partner_store: row.partner_store || row.loja_parceiro || '',
    document_date: row.document_date || row.data_documento || row.date || '',
    volumes: Number(row.volumes_count || row.volumes || 0),
    skus: Number(row.skus_count || row.skus || 0),
    gross_weight: Number(row.gross_weight || row.peso_bruto || 0),
    net_weight: Number(row.net_weight || row.peso_liquido || 0),
    status: row.status || undefined,
    last_sync_at: row.synced_at || row.sincronizado_em || row.last_sync_at || null,
    created_at: row.created_at || row.criado || null,
    time_spent_minutes: calculateMinutes(row.started_at, row.ended_at || row.finished_at),
  };
}

function parsePositiveInteger(value, fallback, max = Number.MAX_SAFE_INTEGER) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 1) return fallback;
  return Math.min(Math.trunc(number), max);
}

function paginateDocuments(documents, filters) {
  if (!filters.page && !filters.perPage) return documents;

  const page = parsePositiveInteger(filters.page, 1);
  const perPage = parsePositiveInteger(filters.perPage, 6, 50);
  const total = documents.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const start = (page - 1) * perPage;

  return {
    documents: documents.slice(start, start + perPage),
    pagination: { page, perPage, total, totalPages },
  };
}

function documentMatchesSearch(document, search) {
  const term = String(search || '').trim().toLowerCase();
  if (!term) return true;

  return Object.values(document).some((value) =>
    String(value ?? '').toLowerCase().includes(term)
  );
}

export async function listDocuments(filters = {}) {
  if (isSqlServer) {
    const where = ["upper(ltrim(rtrim(convert(varchar(50), d.status)))) = 'DISPONIVEL'"];
    const parameters = {};
    const operation = normalizeOperationCode(filters.operation);
    const opId = operationId(operation);
    const useStatusProtheusFilter = await shouldUseStatusProtheusFilter();

    if (['DESCARGA', 'CONFERENCIA', 'ARMAZENAGEM'].includes(operation)) {
      where.push("upper(ltrim(rtrim(convert(varchar(50), d.tabela_origem)))) = 'SF1'");
    }

    if (operation === 'SEPARACAO') {
      where.push("upper(ltrim(rtrim(convert(varchar(50), d.tabela_origem)))) = 'SC5'");
      if (useStatusProtheusFilter) {
        where.push("right('0' + ltrim(rtrim(convert(varchar(10), d.status_protheus))), 2) = '05'");
      }
    }

    if (['EXPEDICAO', 'ETIQUETAGEM'].includes(operation)) {
      where.push("upper(ltrim(rtrim(convert(varchar(50), d.tabela_origem)))) = 'SC5'");
      if (useStatusProtheusFilter) {
        where.push("right('0' + ltrim(rtrim(convert(varchar(10), d.status_protheus))), 2) = '04'");
      }
    }

    if (opId) {
      where.push(`
        not exists (
          select 1
          from DADOS_BI.dbo.tb_qlog_apontamentos a
          where a.documento_id = d.id
            and a.tipo_operacao_id = @operationId
            and a.data_hora_fim is not null
        )
      `);
      parameters.operationId = { type: sql.Int, value: opId };
    }

    if (filters.origin) {
      where.push('d.tabela_origem = @origin');
      parameters.origin = { type: sql.NVarChar(50), value: String(filters.origin) };
    }

    if (filters.documentNumber) {
      where.push('d.numero_documento like @documentNumber');
      parameters.documentNumber = {
        type: sql.NVarChar(100),
        value: `%${String(filters.documentNumber)}%`,
      };
    }

    if (filters.partner) {
      where.push('d.nome_parceiro like @partner');
      parameters.partner = {
        type: sql.NVarChar(255),
        value: `%${String(filters.partner)}%`,
      };
    }

    const search = String(filters.search || '').trim();

    if (search) {
      where.push(`
        (
          convert(varchar(50), d.id) like @search
          or convert(varchar(100), d.tabela_origem) like @search
          or convert(varchar(100), d.id_externo) like @search
          or convert(varchar(100), d.filial) like @search
          or convert(varchar(100), d.numero_documento) like @search
          or convert(varchar(100), d.serie_documento) like @search
          or convert(varchar(100), d.tipo_documento) like @search
          or convert(varchar(255), d.chave_documento) like @search
          or convert(varchar(100), d.codigo_parceiro) like @search
          or convert(varchar(100), d.loja_parceiro) like @search
          or convert(varchar(255), d.nome_parceiro) like @search
          or convert(varchar(30), d.data_documento, 120) like @search
          or convert(varchar(50), d.volumes) like @search
          or convert(varchar(50), d.skus) like @search
          or convert(varchar(50), d.peso_bruto) like @search
          or convert(varchar(50), d.peso_liquido) like @search
          or convert(varchar(100), d.status) like @search
        )
      `);
      parameters.search = { type: sql.NVarChar(255), value: `%${search}%` };
    }

    const hasPagination = Boolean(filters.page || filters.perPage);
    const page = parsePositiveInteger(filters.page, 1);
    const perPage = parsePositiveInteger(filters.perPage, 6, 50);
    const offset = (page - 1) * perPage;
    const selectSql = `
      select
        id,
        tabela_origem,
        id_externo,
        filial,
        numero_documento,
        serie_documento,
        tipo_documento,
        chave_documento,
        codigo_parceiro,
        loja_parceiro,
        nome_parceiro,
        data_documento,
        volumes,
        skus,
        peso_bruto,
        peso_liquido,
        status,
        payload_origem,
        sincronizado_em,
        criado,
        atualizado
      from DADOS_BI.dbo.tb_qlog_documentos d
      where ${where.join(' and ')}
      order by data_documento desc, id desc
    `;

    if (hasPagination) {
      const countResult = await sqlQuery(
        `
          select count(1) as total
          from DADOS_BI.dbo.tb_qlog_documentos d
          where ${where.join(' and ')}
        `,
        parameters
      );
      const total = Number(countResult.recordset[0]?.total || 0);
      const result = await sqlQuery(
        `
          ${selectSql}
          offset @offset rows
          fetch next @perPage rows only
        `,
        {
          ...parameters,
          offset: { type: sql.Int, value: offset },
          perPage: { type: sql.Int, value: perPage },
        }
      );

      return {
        documents: result.recordset.map((row) => mapDocument({ ...row, requested_operation_code: operation })),
        pagination: {
          page,
          perPage,
          total,
          totalPages: Math.max(1, Math.ceil(total / perPage)),
        },
      };
    }

    const result = await sqlQuery(
      selectSql,
      parameters
    );

    return result.recordset.map((row) => mapDocument({ ...row, requested_operation_code: operation }));
  }

  const documents = db
    .prepare(`
      select *
      from documents
      order by created_at desc, id desc
    `)
    .all()
    .map(mapDocument);

  const operation = normalizeOperationCode(filters.operation);

  const filteredDocuments = documents.filter((document) => {
    const matchesFilters =
      (!operation || document.operation_type_code === operation) &&
      (!filters.origin || document.origin.toLowerCase() === String(filters.origin).toLowerCase()) &&
      (!filters.documentNumber ||
        document.document_number.toLowerCase().includes(String(filters.documentNumber).toLowerCase())) &&
      (!filters.partner ||
        document.partner_name.toLowerCase().includes(String(filters.partner).toLowerCase()));

    return matchesFilters && documentMatchesSearch(document, filters.search);
  });

  return paginateDocuments(filteredDocuments, filters);
}

export async function getDocumentById(id) {
  if (isSqlServer) {
    const result = await sqlQuery(
      `
        select top 1 *
        from DADOS_BI.dbo.tb_qlog_documentos
        where id = @id
      `,
      { id: { type: sql.Int, value: Number(id) } }
    );

    return mapDocument(result.recordset[0]);
  }

  return mapDocument(db.prepare('select * from documents where id = ?').get(id));
}

export async function getDocumentByNumber(numeroDocumento) {
  if (isSqlServer) {
    const result = await sqlQuery(
      `
        select top 1 *
        from DADOS_BI.dbo.tb_qlog_documentos
        where numero_documento = @numeroDocumento
        order by id desc
      `,
      {
        numeroDocumento: {
          type: sql.NVarChar(100),
          value: String(numeroDocumento),
        },
      }
    );

    return mapDocument(result.recordset[0]);
  }

  return mapDocument(
    db.prepare('select * from documents where document_number = ? order by id desc limit 1').get(numeroDocumento)
  );
}
