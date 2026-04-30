import { db } from '../lib/database.js';
import { normalizeOperationCode, operationLabel } from '../lib/operations.js';

function minutesBetween(startedAt, finishedAt) {
  if (!startedAt || !finishedAt) return null;

  const start = new Date(startedAt).getTime();
  const end = new Date(finishedAt).getTime();

  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;

  return Math.round((end - start) / 60_000);
}

export function mapApontamento(row) {
  if (!row) return null;

  const operationCode = normalizeOperationCode(row.tipo_operacao);
  const dataInicio = row.data_inicio;
  const dataFim = row.data_fim || null;

  return {
    id: String(row.id),
    user_id: String(row.user_id),
    user_name: row.user_name || null,
    username: row.username || null,
    delegated_by_user_id: row.delegated_by_user_id ? String(row.delegated_by_user_id) : null,
    delegated_by_user_name: row.delegated_by_user_name || null,
    delegated_by_username: row.delegated_by_username || null,
    tipo_operacao: operationCode,
    tipo_operacao_label: operationLabel(operationCode),
    numero_documento: row.numero_documento,
    data_inicio: dataInicio,
    data_fim: dataFim,
    status: dataFim ? 'FINALIZADO' : 'EM_ANDAMENTO',
    document: {
      origin: row.source_table || '',
      type: row.document_type || '',
      partner_name: row.partner_name || '',
      partner_code: row.partner_code || '',
      partner_store: row.partner_store || '',
      document_date: row.document_date || '',
      volumes: Number(row.volumes_count || 0),
      skus: Number(row.skus_count || 0),
      gross_weight: Number(row.gross_weight || 0),
      net_weight: Number(row.net_weight || 0),
    },
    time_spent_minutes: minutesBetween(dataInicio, dataFim),
    created_at: row.created_at || null,
    updated_at: row.updated_at || null,
  };
}

const selectApontamentosSql = `
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

export function findOpenByUser(userId) {
  return mapApontamento(
    db
      .prepare(`${selectApontamentosSql} where a.user_id = ? and a.data_fim is null order by a.data_inicio desc limit 1`)
      .get(userId)
  );
}

export function listOpenByUser(userId) {
  return db
    .prepare(`${selectApontamentosSql} where a.user_id = ? and a.data_fim is null order by a.data_inicio desc`)
    .all(userId)
    .map(mapApontamento);
}

export function listHistoryByUser(userId) {
  return db
    .prepare(`${selectApontamentosSql} where a.user_id = ? and a.data_fim is not null order by a.data_inicio desc`)
    .all(userId)
    .map(mapApontamento);
}

export function listAll(filters = {}) {
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

  const sql = [
    selectApontamentosSql,
    where.length ? `where ${where.join(' and ')}` : '',
    'order by a.data_inicio desc',
  ].join(' ');

  return db.prepare(sql).all(...params).map(mapApontamento);
}

export function createApontamento({ userId, tipoOperacao, numeroDocumento, delegatedByUserId = null }) {
  const result = db
    .prepare(`
      insert into apontamentos (user_id, delegated_by_user_id, tipo_operacao, numero_documento, data_inicio, data_fim)
      values (?, ?, ?, ?, current_timestamp, null)
    `)
    .run(userId, delegatedByUserId, tipoOperacao, numeroDocumento);

  return mapApontamento(
    db.prepare(`${selectApontamentosSql} where a.id = ?`).get(result.lastInsertRowid)
  );
}

export function closeApontamento(id) {
  db
    .prepare(`
      update apontamentos
      set data_fim = current_timestamp,
          updated_at = current_timestamp
      where id = ?
    `)
    .run(id);

  return mapApontamento(db.prepare(`${selectApontamentosSql} where a.id = ?`).get(id));
}
