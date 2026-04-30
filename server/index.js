import express from 'express';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const databasePath = path.resolve(__dirname, '../database/Qlog.db');
const db = new DatabaseSync(databasePath);
const app = express();
const port = Number(process.env.PORT || 3001);

app.use(express.json());

function tableExists(tableName) {
  return Boolean(
    db
      .prepare("select name from sqlite_master where type = 'table' and name = ?")
      .get(tableName)
  );
}

function initializeDatabaseIfNeeded() {
  if (!tableExists('users')) {
    db.exec(`
      create table users (
        id integer primary key autoincrement,
        name text not null,
        username text not null unique,
        password_hash text not null,
        position text not null check (position in ('SEPARADOR', 'SUPERVISOR')),
        is_active integer not null default 1,
        created_at text not null default current_timestamp
      )
    `);
  }

  if (!tableExists('documents')) {
    db.exec(`
      create table documents (
        id integer primary key autoincrement,
        origin text not null,
        document_number text not null,
        series text,
        type text not null,
        operation text not null,
        partner_name text not null,
        partner_code text,
        partner_store text,
        document_date text,
        volumes integer not null default 0,
        skus integer not null default 0,
        gross_weight real not null default 0,
        net_weight real not null default 0,
        status text not null default 'AVAILABLE',
        current_user_id integer,
        started_at text,
        finished_at text,
        last_sync_at text,
        created_at text not null default current_timestamp
      )
    `);
  }

  if (!tableExists('document_events')) {
    db.exec(`
      create table document_events (
        id integer primary key autoincrement,
        document_id integer not null,
        user_id integer,
        event_type text not null,
        event_at text not null default current_timestamp,
        metadata text
      )
    `);
  }

  const userCount = db.prepare('select count(*) as total from users').get().total;
  if (userCount === 0) {
    const insertUser = db.prepare(`
      insert into users (name, username, password_hash, position, is_active)
      values (?, ?, ?, ?, ?)
    `);

    insertUser.run('Gabriel Supervisor', 'gabriel', '123456', 'SUPERVISOR', 1);
    insertUser.run('Joao Separador', 'joao', '123456', 'SEPARADOR', 1);
  }

  const documentCount = db.prepare('select count(*) as total from documents').get().total;
  if (documentCount === 0) {
    const gabriel = db.prepare("select id from users where username = 'gabriel'").get();
    const joao = db.prepare("select id from users where username = 'joao'").get();
    const now = new Date();
    const minutesAgo = (minutes) => new Date(now.getTime() - minutes * 60_000).toISOString();
    const insertDocument = db.prepare(`
      insert into documents (
        origin, document_number, series, type, operation, partner_name, partner_code,
        partner_store, document_date, volumes, skus, gross_weight, net_weight,
        status, current_user_id, started_at, finished_at, last_sync_at
      )
      values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertDocument.run(
      'SF1',
      'NF-2024-1245',
      '1',
      'NF Entrada',
      'Descarga',
      'Fornecedor ABC Ltda',
      'FOR001',
      '01',
      '2026-04-29',
      15,
      42,
      540.3,
      512.8,
      'DOING',
      joao.id,
      minutesAgo(28),
      null,
      minutesAgo(5)
    );
    insertDocument.run(
      'SF1',
      'NF-2024-1246',
      '1',
      'NF Entrada',
      'Armazenagem',
      'Distribuidora XYZ',
      'FOR002',
      '01',
      '2026-04-29',
      8,
      18,
      210.1,
      198.4,
      'DONE',
      gabriel.id,
      minutesAgo(95),
      minutesAgo(58),
      minutesAgo(4)
    );
    insertDocument.run(
      'SC5',
      'PV-2024-5678',
      'A',
      'Pedido Venda',
      'Separacao',
      'Cliente Premium Ltda',
      'CLI001',
      '01',
      '2026-04-29',
      5,
      12,
      92.7,
      88.2,
      'AVAILABLE',
      null,
      null,
      null,
      minutesAgo(3)
    );
    insertDocument.run(
      'SC5',
      'PV-2024-5680',
      'A',
      'Pedido Venda',
      'Expedicao',
      'E-commerce Solutions',
      'CLI003',
      '02',
      '2026-04-28',
      18,
      45,
      390.0,
      371.6,
      'CANCELLED',
      joao.id,
      minutesAgo(185),
      minutesAgo(172),
      minutesAgo(2)
    );
    insertDocument.run(
      'SF1',
      'NF-2024-1247',
      '1',
      'NF Entrada',
      'Conferencia',
      'Industria Nacional S/A',
      'FOR003',
      '01',
      '2026-04-28',
      25,
      67,
      820.5,
      789.4,
      'BLOCKED',
      null,
      null,
      null,
      minutesAgo(8)
    );
  }
}

function normalizeActive(value) {
  return value === true || Number(value) === 1;
}

function mapUser(row) {
  if (!row) return null;

  return {
    id: String(row.id),
    name: row.name,
    username: row.username,
    matricula: row.employee_number || row.username,
    position: row.position,
    is_active: normalizeActive(row.is_active),
    created_at: row.created_at,
  };
}

function mapDocument(row) {
  const startedAt = row.started_at || row.startedAt || null;
  const finishedAt = row.finished_at || row.ended_at || row.finishedAt || null;

  return {
    id: String(row.id),
    origin: row.origin || row.source_table || row.source || '',
    document_number: row.document_number || row.number || '',
    series: row.series || row.document_series || '',
    type: row.type || row.document_type || '',
    operation: row.operation || row.operation_type_code || '',
    partner_name: row.partner_name || row.partner || row.client || '',
    partner_code: row.partner_code || '',
    partner_store: row.partner_store || '',
    document_date: row.document_date || row.date || '',
    volumes: Number(row.volumes || row.volumes_count || 0),
    skus: Number(row.skus || row.skus_count || 0),
    gross_weight: Number(row.gross_weight || 0),
    net_weight: Number(row.net_weight || 0),
    status: row.status || 'AVAILABLE',
    current_user_id: row.current_user_id ? String(row.current_user_id) : null,
    current_user_name: row.current_user_name || null,
    current_username: row.current_username || null,
    started_at: startedAt,
    finished_at: finishedAt,
    last_sync_at: row.last_sync_at || row.synced_at || null,
    created_at: row.created_at || null,
    time_spent_minutes: calculateMinutes(startedAt, finishedAt),
  };
}

function calculateMinutes(startedAt, finishedAt) {
  if (!startedAt || !finishedAt) return null;

  const start = new Date(startedAt).getTime();
  const end = new Date(finishedAt).getTime();

  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;

  return Math.round((end - start) / 60_000);
}

function getUserById(id) {
  return db.prepare('select * from users where id = ?').get(id);
}

function getRequester(req) {
  const userId = req.header('x-user-id');
  if (!userId) return null;
  return getUserById(userId);
}

function requireUser(req, res, next) {
  const requester = getRequester(req);

  if (!requester || !normalizeActive(requester.is_active)) {
    return res.status(401).json({ message: 'Usuario nao autenticado.' });
  }

  req.user = requester;
  return next();
}

function requireSupervisor(req, res, next) {
  const requester = getRequester(req);

  if (!requester || !normalizeActive(requester.is_active)) {
    return res.status(401).json({ message: 'Usuario nao autenticado.' });
  }

  if (requester.position !== 'SUPERVISOR') {
    return res.status(403).json({ message: 'Acesso permitido apenas para supervisor.' });
  }

  req.user = requester;
  return next();
}

function getAllDocuments() {
  return db
    .prepare(`
      select
        d.*,
        u.name as current_user_name,
        u.username as current_username
      from documents d
      left join users u on u.id = d.current_user_id
      order by
        case d.status
          when 'DOING' then 1
          when 'AVAILABLE' then 2
          when 'DONE' then 3
          when 'CANCELLED' then 4
          when 'BLOCKED' then 5
          else 6
        end,
        d.created_at desc
    `)
    .all()
    .map(mapDocument);
}

function matchesText(value, query) {
  if (!query) return true;
  return String(value || '').toLowerCase().includes(String(query).toLowerCase());
}

function normalizeOperation(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();
}

function documentToProcess(document) {
  const statusMap = {
    DOING: 'Em andamento',
    DONE: 'Concluído',
    CANCELLED: 'Cancelado',
  };
  const documentType = document.origin === 'SC5' ? 'Pedido Venda' : 'NF Entrada';

  return {
    id: document.id,
    type: document.operation,
    documentNumber: document.document_number,
    documentType,
    client: document.partner_name,
    startDate: document.started_at || document.created_at,
    endDate: document.finished_at,
    status: statusMap[document.status] || document.status,
    volumes: document.volumes,
    skus: document.skus,
    userId: document.current_user_id,
  };
}

function insertDocumentEvent({ documentId, userId, eventType, metadata }) {
  const columns = new Set(db.prepare('pragma table_info(document_events)').all().map((column) => column.name));

  if (columns.has('old_status') && columns.has('new_status')) {
    db.prepare(`
      insert into document_events (document_id, user_id, event_type, old_status, new_status, metadata)
      values (?, ?, ?, ?, ?, ?)
    `).run(
      documentId,
      userId,
      eventType,
      metadata?.old_status || null,
      metadata?.new_status || null,
      metadata ? JSON.stringify(metadata) : null
    );
    return;
  }

  db.prepare(`
    insert into document_events (document_id, user_id, event_type, metadata)
    values (?, ?, ?, ?)
  `).run(documentId, userId, eventType, metadata ? JSON.stringify(metadata) : null);
}

initializeDatabaseIfNeeded();

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({ message: 'Informe usuario e senha.' });
  }

  const user = db
    .prepare('select * from users where lower(username) = lower(?) or lower(name) = lower(?) limit 1')
    .get(username, username);

  if (!user || !normalizeActive(user.is_active) || user.password_hash !== password) {
    return res.status(401).json({ message: 'Usuario ou senha invalidos.' });
  }

  return res.json({ user: mapUser(user) });
});

app.get('/api/me', requireUser, (req, res) => {
  res.json({ user: mapUser(req.user) });
});

app.get('/api/supervisor/dashboard', requireSupervisor, (_req, res) => {
  const users = db.prepare('select * from users order by name').all().map(mapUser);
  const documents = getAllDocuments();

  res.json({
    totals: {
      users: users.length,
      active_users: users.filter((user) => user.is_active).length,
      documents: documents.length,
      doing: documents.filter((document) => document.status === 'DOING').length,
      done: documents.filter((document) => document.status === 'DONE').length,
      available: documents.filter((document) => document.status === 'AVAILABLE').length,
    },
  });
});

app.get('/api/supervisor/users', requireSupervisor, (_req, res) => {
  const users = db
    .prepare('select * from users order by is_active desc, name asc')
    .all()
    .map(mapUser);

  res.json({ users });
});

app.post('/api/supervisor/users', requireSupervisor, (req, res) => {
  const name = String(req.body?.name || '').trim();
  const username = String(req.body?.username || '').trim();
  const password = String(req.body?.password || '123456').trim();
  const position = String(req.body?.position || 'SEPARADOR').trim().toUpperCase();

  if (!name || !username || !password) {
    return res.status(400).json({ message: 'Nome, username e senha sao obrigatorios.' });
  }

  if (!['SEPARADOR', 'SUPERVISOR'].includes(position)) {
    return res.status(400).json({ message: 'Cargo invalido.' });
  }

  try {
    const result = db
      .prepare(`
        insert into users (name, username, password_hash, position, is_active)
        values (?, ?, ?, ?, 1)
      `)
      .run(name, username, password, position);
    const user = getUserById(result.lastInsertRowid);

    return res.status(201).json({ user: mapUser(user) });
  } catch (error) {
    return res.status(400).json({ message: 'Nao foi possivel criar o usuario.' });
  }
});

app.put('/api/supervisor/users/:id/name', requireSupervisor, (req, res) => {
  const name = String(req.body?.name || '').trim();

  if (!name) {
    return res.status(400).json({ message: 'Nome obrigatorio.' });
  }

  db.prepare('update users set name = ? where id = ?').run(name, req.params.id);

  return res.json({ user: mapUser(getUserById(req.params.id)) });
});

app.put('/api/supervisor/users/:id/position', requireSupervisor, (req, res) => {
  const position = String(req.body?.position || '').trim().toUpperCase();

  if (!['SEPARADOR', 'SUPERVISOR'].includes(position)) {
    return res.status(400).json({ message: 'Cargo invalido.' });
  }

  db.prepare('update users set position = ? where id = ?').run(position, req.params.id);

  return res.json({ user: mapUser(getUserById(req.params.id)) });
});

app.delete('/api/supervisor/users/:id', requireSupervisor, (req, res) => {
  db.prepare('update users set is_active = 0 where id = ?').run(req.params.id);

  return res.json({ user: mapUser(getUserById(req.params.id)) });
});

app.get('/api/supervisor/users/:id/performance', requireSupervisor, (req, res) => {
  const user = mapUser(getUserById(req.params.id));

  if (!user) {
    return res.status(404).json({ message: 'Usuario nao encontrado.' });
  }

  const documents = getAllDocuments().filter((document) => document.current_user_id === user.id);
  const doneDocuments = documents.filter((document) => document.status === 'DONE');
  const finalizedWithTime = doneDocuments.filter((document) => document.time_spent_minutes !== null);
  const totalMinutes = finalizedWithTime.reduce(
    (sum, document) => sum + Number(document.time_spent_minutes || 0),
    0
  );

  res.json({
    user,
    indicators: {
      total_done_documents: doneDocuments.length,
      total_doing_documents: documents.filter((document) => document.status === 'DOING').length,
      total_cancelled_documents: documents.filter((document) => document.status === 'CANCELLED').length,
      total_volumes_processed: doneDocuments.reduce((sum, document) => sum + document.volumes, 0),
      total_skus_processed: doneDocuments.reduce((sum, document) => sum + document.skus, 0),
      average_finished_minutes:
        finalizedWithTime.length > 0 ? Math.round(totalMinutes / finalizedWithTime.length) : 0,
    },
    documents,
  });
});

app.get('/api/supervisor/documents', requireSupervisor, (req, res) => {
  const { status, operation, origin, documentNumber, partner, currentUser } = req.query;
  const documents = getAllDocuments().filter((document) => {
    return (
      (!status || document.status === status) &&
      (!operation || String(document.operation).toLowerCase() === String(operation).toLowerCase()) &&
      (!origin || String(document.origin).toLowerCase() === String(origin).toLowerCase()) &&
      matchesText(document.document_number, documentNumber) &&
      matchesText(document.partner_name, partner) &&
      matchesText(document.current_user_name || document.current_username, currentUser)
    );
  });

  res.json({ documents });
});

app.get('/api/operator/processes', requireUser, (req, res) => {
  const documents = getAllDocuments().filter(
    (document) =>
      document.current_user_id === String(req.user.id) &&
      ['DOING', 'DONE', 'CANCELLED'].includes(document.status)
  );

  res.json({ processes: documents.map(documentToProcess), documents });
});

app.get('/api/operator/documents', requireUser, (req, res) => {
  const operation = normalizeOperation(req.query.operation);
  const documents = getAllDocuments().filter((document) => {
    return (
      document.status === 'AVAILABLE' &&
      (!operation || normalizeOperation(document.operation) === operation)
    );
  });

  res.json({ documents });
});

app.post('/api/operator/documents/:id/start', requireUser, (req, res) => {
  const activeDocument = db
    .prepare("select id from documents where current_user_id = ? and status = 'DOING' limit 1")
    .get(req.user.id);

  if (activeDocument) {
    return res.status(409).json({ message: 'Voce possui um documento em andamento.' });
  }

  const document = db.prepare('select * from documents where id = ?').get(req.params.id);

  if (!document) {
    return res.status(404).json({ message: 'Documento nao encontrado.' });
  }

  if (document.status !== 'AVAILABLE') {
    return res.status(409).json({ message: 'Documento nao esta disponivel para inicio.' });
  }

  db.prepare(`
    update documents
    set status = 'DOING',
        current_user_id = ?,
        started_at = current_timestamp,
        ended_at = null,
        updated_at = current_timestamp
    where id = ?
  `).run(req.user.id, req.params.id);

  insertDocumentEvent({
    documentId: req.params.id,
    userId: req.user.id,
    eventType: 'STARTED',
    metadata: { old_status: document.status, new_status: 'DOING' },
  });

  const updatedDocument = getAllDocuments().find((item) => item.id === String(req.params.id));

  res.json({
    document: updatedDocument,
    process: updatedDocument ? documentToProcess(updatedDocument) : null,
  });
});

app.post('/api/operator/documents/:id/end', requireUser, (req, res) => {
  const document = db.prepare('select * from documents where id = ?').get(req.params.id);

  if (!document) {
    return res.status(404).json({ message: 'Documento nao encontrado.' });
  }

  if (document.status !== 'DOING' || String(document.current_user_id) !== String(req.user.id)) {
    return res.status(409).json({ message: 'Documento nao esta em andamento para este usuario.' });
  }

  db.prepare(`
    update documents
    set status = 'DONE',
        ended_at = current_timestamp,
        updated_at = current_timestamp
    where id = ?
  `).run(req.params.id);

  insertDocumentEvent({
    documentId: req.params.id,
    userId: req.user.id,
    eventType: 'COMPLETED',
    metadata: { old_status: document.status, new_status: 'DONE' },
  });

  const updatedDocument = getAllDocuments().find((item) => item.id === String(req.params.id));

  res.json({
    document: updatedDocument,
    process: updatedDocument ? documentToProcess(updatedDocument) : null,
  });
});

app.listen(port, () => {
  console.log(`QLOG API running on http://127.0.0.1:${port}`);
});
