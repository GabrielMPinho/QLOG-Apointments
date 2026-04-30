import express from 'express';
import { createApontamentosRouter } from './controllers/apontamentosController.js';
import { normalizeActive } from './lib/database.js';
import { normalizeOperationCode } from './lib/operations.js';
import { initializeDatabase } from './migrations.js';
import * as apontamentosRepository from './repositories/apontamentosRepository.js';
import { getDocumentById, listDocuments } from './repositories/documentsRepository.js';
import {
  createUser,
  deactivateUser,
  getUserById,
  getUserByLogin,
  listUsers,
  mapUser,
  updateUserName,
  updateUserPosition,
  updateUser,
} from './repositories/usersRepository.js';
import { createApontamentosService } from './services/apontamentosService.js';

const app = express();
const port = Number(process.env.PORT || 3001);
const apontamentosService = createApontamentosService(apontamentosRepository);

initializeDatabase();

app.use(express.json());

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

function matchesText(value, query) {
  if (!query) return true;
  return String(value || '').toLowerCase().includes(String(query).toLowerCase());
}

function appointmentAsSupervisorRow(apontamento) {
  return {
    id: apontamento.id,
    origin: apontamento.document.origin,
    document_number: apontamento.numero_documento,
    series: '',
    type: apontamento.document.type,
    operation: apontamento.tipo_operacao_label,
    operation_type_code: apontamento.tipo_operacao,
    partner_name: apontamento.document.partner_name,
    partner_code: apontamento.document.partner_code,
    partner_store: apontamento.document.partner_store,
    document_date: apontamento.document.document_date,
    volumes: apontamento.document.volumes,
    skus: apontamento.document.skus,
    gross_weight: apontamento.document.gross_weight,
    net_weight: apontamento.document.net_weight,
    status: apontamento.data_fim ? 'DONE' : 'DOING',
    current_user_id: apontamento.user_id,
    current_user_name: apontamento.user_name,
    current_username: apontamento.username,
    started_at: apontamento.data_inicio,
    finished_at: apontamento.data_fim,
    last_sync_at: null,
    created_at: apontamento.created_at,
    time_spent_minutes: apontamento.time_spent_minutes,
  };
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({ message: 'Informe usuario e senha.' });
  }

  const user = getUserByLogin(username);

  if (!user || !normalizeActive(user.is_active) || user.password_hash !== password) {
    return res.status(401).json({ message: 'Usuario ou senha invalidos.' });
  }

  return res.json({ user: mapUser(user) });
});

app.get('/api/me', requireUser, (req, res) => {
  res.json({ user: mapUser(req.user) });
});

app.use('/apontamentos', requireUser, createApontamentosRouter(apontamentosService));
app.use('/api/apontamentos', requireUser, createApontamentosRouter(apontamentosService));

app.get('/api/supervisor/dashboard', requireSupervisor, (_req, res) => {
  const users = listUsers();
  const documents = listDocuments();
  const apontamentos = apontamentosRepository.listAll();

  res.json({
    totals: {
      users: users.length,
      active_users: users.filter((user) => user.is_active).length,
      documents: documents.length,
      open_appointments: apontamentos.filter((item) => !item.data_fim).length,
      finished_appointments: apontamentos.filter((item) => item.data_fim).length,
    },
  });
});

app.get('/api/supervisor/users', requireSupervisor, (_req, res) => {
  res.json({ users: listUsers() });
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
    return res.status(201).json({ user: createUser({ name, username, password, position }) });
  } catch {
    return res.status(400).json({ message: 'Nao foi possivel criar o usuario.' });
  }
});

app.put('/api/supervisor/users/:id/name', requireSupervisor, (req, res) => {
  const name = String(req.body?.name || '').trim();

  if (!name) {
    return res.status(400).json({ message: 'Nome obrigatorio.' });
  }

  return res.json({ user: updateUserName(req.params.id, name) });
});

app.put('/api/supervisor/users/:id/position', requireSupervisor, (req, res) => {
  const position = String(req.body?.position || '').trim().toUpperCase();

  if (!['SEPARADOR', 'SUPERVISOR'].includes(position)) {
    return res.status(400).json({ message: 'Cargo invalido.' });
  }

  return res.json({ user: updateUserPosition(req.params.id, position) });
});

app.put('/api/supervisor/users/:id', requireSupervisor, (req, res) => {
  const name = String(req.body?.name || '').trim();
  const username = String(req.body?.username || '').trim();
  const password = String(req.body?.password || '').trim();
  const position = String(req.body?.position || '').trim().toUpperCase();
  const isActive = req.body?.is_active !== false;

  if (!name || !username) {
    return res.status(400).json({ message: 'Nome e username sao obrigatorios.' });
  }

  if (!['SEPARADOR', 'SUPERVISOR'].includes(position)) {
    return res.status(400).json({ message: 'Cargo invalido.' });
  }

  try {
    const user = updateUser(req.params.id, { name, username, password, position, isActive });
    if (!user) return res.status(404).json({ message: 'Usuario nao encontrado.' });
    return res.json({ user });
  } catch {
    return res.status(400).json({ message: 'Nao foi possivel atualizar o usuario.' });
  }
});

app.delete('/api/supervisor/users/:id', requireSupervisor, (req, res) => {
  return res.json({ user: deactivateUser(req.params.id) });
});

app.post('/api/supervisor/delegacoes', requireSupervisor, (req, res) => {
  const separadorId = String(req.body?.separador_id || '').trim();
  const tipoOperacao = req.body?.tipo_operacao;
  const numeroDocumento = req.body?.numero_documento;
  const separador = getUserById(separadorId);

  if (!separador || !normalizeActive(separador.is_active)) {
    return res.status(404).json({ message: 'Separador nao encontrado ou inativo.' });
  }

  if (separador.position !== 'SEPARADOR') {
    return res.status(400).json({ message: 'Delegacao permitida apenas para separadores.' });
  }

  try {
    const apontamento = apontamentosService.start({
      userId: separador.id,
      tipoOperacao,
      numeroDocumento,
      delegatedByUserId: req.user.id,
    });

    return res.status(201).json({
      sucesso: true,
      apontamento,
      process: apontamentosService.toProcess(apontamento),
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message: error.message || 'Nao foi possivel delegar o apontamento.',
    });
  }
});

app.get('/api/supervisor/users/:id/performance', requireSupervisor, (req, res) => {
  const user = mapUser(getUserById(req.params.id));

  if (!user) {
    return res.status(404).json({ message: 'Usuario nao encontrado.' });
  }

  const apontamentos = apontamentosRepository.listAll({ userId: req.params.id });
  const finished = apontamentos.filter((item) => item.data_fim);
  const totalMinutes = finished.reduce((sum, item) => sum + Number(item.time_spent_minutes || 0), 0);

  res.json({
    user,
    indicators: {
      total_done_documents: finished.length,
      total_doing_documents: apontamentos.filter((item) => !item.data_fim).length,
      total_cancelled_documents: 0,
      total_volumes_processed: finished.reduce((sum, item) => sum + item.document.volumes, 0),
      total_skus_processed: finished.reduce((sum, item) => sum + item.document.skus, 0),
      average_finished_minutes: finished.length > 0 ? Math.round(totalMinutes / finished.length) : 0,
    },
    documents: apontamentos.map(appointmentAsSupervisorRow),
    apontamentos,
  });
});

app.get('/api/supervisor/apontamentos', requireSupervisor, (req, res) => {
  const { userId, status } = req.query;
  const filters = {
    userId,
    openOnly: status === 'ABERTO',
    finishedOnly: status === 'FINALIZADO',
  };

  const apontamentos = apontamentosRepository.listAll(filters);

  res.json({
    apontamentos,
    processes: apontamentos.map(apontamentosService.toProcess),
  });
});

app.get('/api/supervisor/documents', requireSupervisor, (req, res) => {
  const { operation, origin, documentNumber, partner } = req.query;
  const documents = listDocuments({ operation, origin, documentNumber, partner });

  res.json({ documents });
});

app.get('/api/operator/processes', requireUser, (req, res) => {
  const open = apontamentosService.listOpen(req.user.id);
  const history = apontamentosService.listHistory(req.user.id);
  const apontamentos = [...open, ...history];

  res.json({
    apontamentos,
    processes: apontamentos.map(apontamentosService.toProcess),
  });
});

app.get('/api/operator/documents', requireUser, (req, res) => {
  const { operation } = req.query;
  const documents = listDocuments({ operation });

  res.json({ documents });
});

app.post('/api/operator/documents/:id/start', requireUser, (req, res) => {
  const document = getDocumentById(req.params.id);

  if (!document) {
    return res.status(404).json({ message: 'Documento nao encontrado.' });
  }

  try {
    const apontamento = apontamentosService.start({
      userId: req.user.id,
      tipoOperacao: normalizeOperationCode(req.body?.tipo_operacao) || document.operation_type_code,
      numeroDocumento: document.document_number,
    });

    return res.status(201).json({
      sucesso: true,
      apontamento,
      process: apontamentosService.toProcess(apontamento),
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message: error.message || 'Erro interno ao iniciar apontamento.',
    });
  }
});

app.post('/api/operator/documents/:id/end', requireUser, (req, res) => {
  try {
    const apontamento = apontamentosService.closeOpenByUser(req.user.id);

    return res.json({
      sucesso: true,
      apontamento,
      process: apontamentosService.toProcess(apontamento),
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message: error.message || 'Erro interno ao encerrar apontamento.',
    });
  }
});

app.listen(port, () => {
  console.log(`QLOG API running on http://127.0.0.1:${port}`);
});
