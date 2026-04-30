import { db, getTableColumns, hasColumn, tableExists } from './lib/database.js';
import { normalizeOperationCode, OPERATION_CODES } from './lib/operations.js';

function createUsersTableIfNeeded() {
  if (tableExists('users')) return;

  db.exec(`
    create table users (
      id integer primary key autoincrement,
      name text not null,
      username text not null unique,
      password_hash text not null,
      position text not null check (position in ('SEPARADOR', 'SUPERVISOR')),
      is_active integer not null default 1,
      created_at text not null default current_timestamp,
      updated_at text
    )
  `);
}

function createApontamentosTableIfNeeded() {
  db.exec(`
    create table if not exists apontamentos (
      id integer primary key autoincrement,
      user_id integer not null,
      delegated_by_user_id integer,
      tipo_operacao text not null check (
        tipo_operacao in ('DESCARGA', 'CONFERENCIA', 'ARMAZENAGEM', 'SEPARACAO', 'EXPEDICAO', 'ETIQUETAGEM')
      ),
      numero_documento text not null,
      data_inicio datetime not null default current_timestamp,
      data_fim datetime,
      created_at datetime not null default current_timestamp,
      updated_at datetime,
      foreign key (user_id) references users(id),
      foreign key (delegated_by_user_id) references users(id)
    )
  `);

  if (!hasColumn('apontamentos', 'delegated_by_user_id')) {
    db.exec('alter table apontamentos add column delegated_by_user_id integer');
  }

  db.exec(`
    create unique index if not exists apontamentos_um_aberto_por_usuario_idx
    on apontamentos (user_id)
    where data_fim is null
  `);
}

function createDocumentEventsTableIfNeeded() {
  if (tableExists('document_events')) return;

  db.exec(`
    create table document_events (
      id integer primary key autoincrement,
      document_id integer not null,
      user_id integer,
      event_type text not null,
      old_status text,
      new_status text,
      event_at datetime not null default current_timestamp,
      metadata text
    )
  `);
}

function createReferenceDocumentsTable(tableName = 'documents') {
  db.exec(`
    create table ${tableName} (
      id integer primary key autoincrement,
      source_table text not null,
      external_id text,
      branch_code text not null default '01',
      document_number text not null,
      document_series text,
      document_type text not null,
      document_key text,
      partner_code text,
      partner_store text,
      partner_name text,
      document_date date,
      operation_type_code text not null check (
        operation_type_code in ('DESCARGA', 'CONFERENCIA', 'ARMAZENAGEM', 'SEPARACAO', 'EXPEDICAO', 'ETIQUETAGEM')
      ),
      volumes_count integer not null default 0,
      skus_count integer not null default 0,
      gross_weight real not null default 0,
      net_weight real not null default 0,
      source_payload text,
      synced_at datetime,
      created_at datetime not null default current_timestamp,
      updated_at datetime
    )
  `);
}

function rowValue(row, ...keys) {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== '') return row[key];
  }

  return null;
}

function migrateDocumentOperationalState() {
  if (!tableExists('documents')) return;

  const columns = new Set(getTableColumns('documents').map((column) => column.name));
  const hasUser = columns.has('current_user_id');
  const hasStarted = columns.has('started_at');
  const hasFinished = columns.has('finished_at') || columns.has('ended_at');

  if (!hasUser || !hasStarted) return;

  const rows = db.prepare('select * from documents').all();
  const insert = db.prepare(`
    insert into apontamentos (user_id, tipo_operacao, numero_documento, data_inicio, data_fim, created_at, updated_at)
    values (?, ?, ?, ?, ?, current_timestamp, current_timestamp)
  `);

  for (const row of rows) {
    const userId = row.current_user_id;
    const startedAt = row.started_at;
    const documentNumber = row.document_number || row.number;
    const operationCode = normalizeOperationCode(row.operation_type_code || row.operation);

    if (!userId || !startedAt || !documentNumber || !operationCode) continue;

    const existing = db
      .prepare(`
        select id
        from apontamentos
        where user_id = ?
          and tipo_operacao = ?
          and numero_documento = ?
          and data_inicio = ?
        limit 1
      `)
      .get(userId, operationCode, documentNumber, startedAt);

    if (existing) continue;

    const status = String(row.status || '').toUpperCase();
    const finishedAt =
      hasFinished && status !== 'DOING' ? row.finished_at || row.ended_at || null : null;

    try {
      insert.run(userId, operationCode, documentNumber, startedAt, finishedAt);
    } catch {
      // A partial unique index may reject multiple open rows for the same user.
      // In that case we keep the first open appointment and ignore duplicates.
    }
  }
}

function rebuildDocumentsWithoutOperationalStateIfNeeded() {
  if (!tableExists('documents')) {
    createReferenceDocumentsTable();
    return;
  }

  const operationalColumns = [
    'status',
    'current_user_id',
    'started_at',
    'ended_at',
    'finished_at',
    'current_user_name',
    'current_username',
  ];
  const needsRebuild = operationalColumns.some((column) => hasColumn('documents', column));

  if (!needsRebuild) return;

  const rows = db.prepare('select * from documents').all();
  db.exec('drop table if exists documents_reference_new');
  createReferenceDocumentsTable('documents_reference_new');

  const insert = db.prepare(`
    insert into documents_reference_new (
      id, source_table, external_id, branch_code, document_number, document_series, document_type,
      document_key, partner_code, partner_store, partner_name, document_date, operation_type_code,
      volumes_count, skus_count, gross_weight, net_weight, source_payload, synced_at, created_at, updated_at
    )
    values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const row of rows) {
    const operationCode = normalizeOperationCode(rowValue(row, 'operation_type_code', 'operation')) || 'DESCARGA';

    insert.run(
      row.id,
      rowValue(row, 'source_table', 'origin') || 'MANUAL',
      row.external_id || null,
      row.branch_code || '01',
      rowValue(row, 'document_number', 'number'),
      rowValue(row, 'document_series', 'series'),
      rowValue(row, 'document_type', 'type') || 'DOCUMENTO',
      row.document_key || null,
      row.partner_code || null,
      row.partner_store || null,
      rowValue(row, 'partner_name', 'partner', 'client'),
      rowValue(row, 'document_date', 'date'),
      operationCode,
      Number(rowValue(row, 'volumes_count', 'volumes') || 0),
      Number(rowValue(row, 'skus_count', 'skus') || 0),
      Number(row.gross_weight || 0),
      Number(row.net_weight || 0),
      row.source_payload || null,
      rowValue(row, 'synced_at', 'last_sync_at'),
      row.created_at || new Date().toISOString(),
      row.updated_at || null
    );
  }

  db.exec('pragma foreign_keys = off');
  try {
    db.exec('drop table documents');
    db.exec('alter table documents_reference_new rename to documents');
  } finally {
    db.exec('pragma foreign_keys = on');
  }
}

function seedUsersIfNeeded() {
  const userCount = db.prepare('select count(*) as total from users').get().total;
  if (userCount > 0) return;

  const insertUser = db.prepare(`
    insert into users (name, username, password_hash, position, is_active)
    values (?, ?, ?, ?, ?)
  `);

  insertUser.run('Gabriel Supervisor', 'gabriel', '123456', 'SUPERVISOR', 1);
  insertUser.run('Joao Separador', 'joao', '123456', 'SEPARADOR', 1);
}

function seedDocumentsIfNeeded() {
  const documentCount = db.prepare('select count(*) as total from documents').get().total;
  if (documentCount > 0) return;

  const insertDocument = db.prepare(`
    insert into documents (
      source_table, external_id, branch_code, document_number, document_series, document_type,
      partner_code, partner_store, partner_name, document_date, operation_type_code,
      volumes_count, skus_count, gross_weight, net_weight, synced_at
    )
    values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, current_timestamp)
  `);

  const seeds = [
    ['SF1', null, '01', 'NF-2024-1245', '1', 'NF Entrada', 'FOR001', '01', 'Fornecedor ABC Ltda', '2026-04-29', 'DESCARGA', 15, 42, 540.3, 512.8],
    ['SF1', null, '01', 'NF-2024-1246', '1', 'NF Entrada', 'FOR002', '01', 'Distribuidora XYZ', '2026-04-29', 'ARMAZENAGEM', 8, 18, 210.1, 198.4],
    ['SC5', null, '01', 'PV-2024-5678', 'A', 'Pedido Venda', 'CLI001', '01', 'Cliente Premium Ltda', '2026-04-29', 'SEPARACAO', 5, 12, 92.7, 88.2],
    ['SC5', null, '01', 'PV-2024-5680', 'A', 'Pedido Venda', 'CLI003', '02', 'E-commerce Solutions', '2026-04-28', 'EXPEDICAO', 18, 45, 390, 371.6],
    ['SF1', null, '01', 'NF-2024-1247', '1', 'NF Entrada', 'FOR003', '01', 'Industria Nacional S/A', '2026-04-28', 'CONFERENCIA', 25, 67, 820.5, 789.4],
    ['SC5', null, '01', 'PV-2024-5681', 'A', 'Pedido Venda', 'CLI004', '01', 'Operacao Marketplace', '2026-04-30', 'ETIQUETAGEM', 12, 28, 180, 172.4],
  ];

  for (const seed of seeds) {
    insertDocument.run(...seed);
  }
}

function ensureOperationValuesAreValid() {
  const rows = db.prepare('select id, operation_type_code from documents').all();
  const update = db.prepare('update documents set operation_type_code = ? where id = ?');

  for (const row of rows) {
    const operationCode = normalizeOperationCode(row.operation_type_code);
    if (operationCode) continue;
    update.run(OPERATION_CODES[0], row.id);
  }
}

export function initializeDatabase() {
  createUsersTableIfNeeded();
  createApontamentosTableIfNeeded();
  createDocumentEventsTableIfNeeded();
  migrateDocumentOperationalState();
  rebuildDocumentsWithoutOperationalStateIfNeeded();
  seedUsersIfNeeded();
  seedDocumentsIfNeeded();
  ensureOperationValuesAreValid();
}
