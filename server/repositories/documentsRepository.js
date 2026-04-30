import { db } from '../lib/database.js';
import { normalizeOperationCode, operationLabel } from '../lib/operations.js';

function calculateMinutes(startedAt, finishedAt) {
  if (!startedAt || !finishedAt) return null;

  const start = new Date(startedAt).getTime();
  const end = new Date(finishedAt).getTime();

  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;

  return Math.round((end - start) / 60_000);
}

export function mapDocument(row) {
  if (!row) return null;

  const operationCode = normalizeOperationCode(row.operation_type_code || row.operation) || '';

  return {
    id: String(row.id),
    origin: row.source_table || row.origin || '',
    document_number: row.document_number || row.number || '',
    series: row.document_series || row.series || '',
    type: row.document_type || row.type || '',
    operation_type_code: operationCode,
    operation: operationLabel(operationCode),
    partner_name: row.partner_name || row.partner || row.client || '',
    partner_code: row.partner_code || '',
    partner_store: row.partner_store || '',
    document_date: row.document_date || row.date || '',
    volumes: Number(row.volumes_count || row.volumes || 0),
    skus: Number(row.skus_count || row.skus || 0),
    gross_weight: Number(row.gross_weight || 0),
    net_weight: Number(row.net_weight || 0),
    last_sync_at: row.synced_at || row.last_sync_at || null,
    created_at: row.created_at || null,
    time_spent_minutes: calculateMinutes(row.started_at, row.ended_at || row.finished_at),
  };
}

export function listDocuments(filters = {}) {
  const documents = db
    .prepare(`
      select *
      from documents
      order by created_at desc, id desc
    `)
    .all()
    .map(mapDocument);

  const operation = normalizeOperationCode(filters.operation);

  return documents.filter((document) => {
    return (
      (!operation || document.operation_type_code === operation) &&
      (!filters.origin || document.origin.toLowerCase() === String(filters.origin).toLowerCase()) &&
      (!filters.documentNumber ||
        document.document_number.toLowerCase().includes(String(filters.documentNumber).toLowerCase())) &&
      (!filters.partner ||
        document.partner_name.toLowerCase().includes(String(filters.partner).toLowerCase()))
    );
  });
}

export function getDocumentById(id) {
  return mapDocument(db.prepare('select * from documents where id = ?').get(id));
}

export function getDocumentByNumber(numeroDocumento) {
  return mapDocument(
    db.prepare('select * from documents where document_number = ? order by id desc limit 1').get(numeroDocumento)
  );
}

