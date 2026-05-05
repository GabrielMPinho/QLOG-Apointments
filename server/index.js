import express from 'express';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { createApontamentosRouter } from './controllers/apontamentosController.js';
import { isSqlServer, normalizeActive } from './lib/database.js';
import { normalizeOperationCode } from './lib/operations.js';
import { hashPassword, isPasswordHash, verifyPassword } from './lib/passwords.js';
import { initializeDatabase } from './migrations.js';
import * as apontamentosRepository from './repositories/apontamentosRepository.js';
import { getDocumentById, listDocuments } from './repositories/documentsRepository.js';
import {
  createUser,
  deleteUser,
  getUserById,
  getUserByLogin,
  listUsers,
  mapUser,
  updateUserName,
  updateUserPosition,
  updateUser,
  updateUserPasswordHash,
} from './repositories/usersRepository.js';
import { createApontamentosService } from './services/apontamentosService.js';

const app = express();
const port = Number(process.env.PORT || 3001);
const staticPath = path.resolve(process.cwd(), 'dist');
const apontamentosService = createApontamentosService(apontamentosRepository);

if (!isSqlServer) {
  initializeDatabase();
} else {
  await apontamentosRepository.syncSqlServerDocumentEventTypes();
}

app.use(express.json());

async function getRequester(req) {
  const userId = req.header('x-user-id');
  if (!userId) return null;
  return getUserById(userId);
}

async function requireUser(req, res, next) {
  try {
    const requester = await getRequester(req);

    if (!requester || !normalizeActive(requester.is_active ?? requester.ativo)) {
      return res.status(401).json({ message: 'Usuario nao autenticado.' });
    }

    req.user = requester;
    return next();
  } catch (error) {
    return next(error);
  }
}

async function requireSupervisor(req, res, next) {
  try {
    const requester = await getRequester(req);

    if (!requester || !normalizeActive(requester.is_active ?? requester.ativo)) {
      return res.status(401).json({ message: 'Usuario nao autenticado.' });
    }

    const user = mapUser(requester);
    if (user.position !== 'SUPERVISOR') {
      return res.status(403).json({ message: 'Acesso permitido apenas para supervisor.' });
    }

    req.user = requester;
    return next();
  } catch (error) {
    return next(error);
  }
}

function appointmentAsSupervisorRow(apontamento) {
  const status = {
    INICIADO: 'DOING',
    CANCELADO: 'CANCELLED',
    FINALIZADO: 'DONE',
  }[apontamento.status] || (apontamento.data_fim ? 'DONE' : 'DOING');

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
    status,
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

function documentsResponse(result) {
  return Array.isArray(result) ? { documents: result } : result;
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, provider: 'sqlserver'});
});

app.post('/api/login', async (req, res, next) => {
  try {
    const { username, password } = req.body || {};

    if (!username || !password) {
      return res.status(400).json({ message: 'Informe usuario e senha.' });
    }

    const user = await getUserByLogin(username);
    const storedPassword = user?.password_hash ?? user?.senha_hash;

    if (!user || !normalizeActive(user.is_active ?? user.ativo) || !verifyPassword(password, storedPassword)) {
      return res.status(401).json({ message: 'Usuario ou senha invalidos.' });
    }

    if (!isPasswordHash(storedPassword)) {
      await updateUserPasswordHash(user.id, hashPassword(password));
    }

    return res.json({ user: mapUser(user) });
  } catch (error) {
    return next(error);
  }
});

app.get('/api/me', requireUser, (req, res) => {
  res.json({ user: mapUser(req.user) });
});

app.use('/apontamentos', requireUser, createApontamentosRouter(apontamentosService));
app.use('/api/apontamentos', requireUser, createApontamentosRouter(apontamentosService));

app.get('/api/supervisor/dashboard', requireSupervisor, async (_req, res, next) => {
  try {
    const users = await listUsers();
    const documents = await listDocuments();
    const apontamentos = await apontamentosRepository.listAll();

    res.json({
      totals: {
        users: users.length,
        active_users: users.filter((user) => user.is_active).length,
        documents: documents.length,
        open_appointments: apontamentos.filter((item) => !item.data_fim).length,
        finished_appointments: apontamentos.filter((item) => item.data_fim).length,
      },
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/supervisor/users', requireSupervisor, async (_req, res, next) => {
  try {
    res.json({ users: await listUsers() });
  } catch (error) {
    next(error);
  }
});

app.post('/api/supervisor/users', requireSupervisor, async (req, res, next) => {
  try {
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

    return res.status(201).json({ user: await createUser({ name, username, password, position }) });
  } catch (error) {
    return next(error);
  }
});

app.put('/api/supervisor/users/:id/name', requireSupervisor, async (req, res, next) => {
  try {
    const name = String(req.body?.name || '').trim();

    if (!name) {
      return res.status(400).json({ message: 'Nome obrigatorio.' });
    }

    return res.json({ user: await updateUserName(req.params.id, name) });
  } catch (error) {
    return next(error);
  }
});

app.put('/api/supervisor/users/:id/position', requireSupervisor, async (req, res, next) => {
  try {
    const position = String(req.body?.position || '').trim().toUpperCase();

    if (!['SEPARADOR', 'SUPERVISOR'].includes(position)) {
      return res.status(400).json({ message: 'Cargo invalido.' });
    }

    return res.json({ user: await updateUserPosition(req.params.id, position) });
  } catch (error) {
    return next(error);
  }
});

app.put('/api/supervisor/users/:id', requireSupervisor, async (req, res, next) => {
  try {
    const name = String(req.body?.name || '').trim();
    const username = String(req.body?.username || '').trim();
    const password = String(req.body?.password || '').trim();
    const position = String(req.body?.position || '').trim().toUpperCase();
    if (!name || !username) {
      return res.status(400).json({ message: 'Nome e username sao obrigatorios.' });
    }

    if (!['SEPARADOR', 'SUPERVISOR'].includes(position)) {
      return res.status(400).json({ message: 'Cargo invalido.' });
    }

    const user = await updateUser(req.params.id, { name, username, password, position });
    if (!user) return res.status(404).json({ message: 'Usuario nao encontrado.' });
    return res.json({ user });
  } catch (error) {
    return next(error);
  }
});

app.delete('/api/supervisor/users/:id', requireSupervisor, async (req, res, next) => {
  try {
    if (String(req.params.id) === String(mapUser(req.user).id)) {
      return res.status(400).json({ message: 'Nao e permitido excluir o usuario autenticado.' });
    }

    const user = await deleteUser(req.params.id);
    if (!user) return res.status(404).json({ message: 'Usuario nao encontrado.' });
    return res.json({ user });
  } catch (error) {
    if (error?.number === 547) {
      return res.status(409).json({
        message: 'Nao foi possivel excluir: usuario possui apontamentos ou eventos vinculados.',
      });
    }

    return next(error);
  }
});

app.post('/api/supervisor/delegacoes', requireSupervisor, async (req, res) => {
  const separadorId = String(req.body?.separador_id || '').trim();
  const tipoOperacao = req.body?.tipo_operacao;
  const numeroDocumento = req.body?.numero_documento;
  const documentoId = req.body?.documento_id;
  const separador = await getUserById(separadorId);
  const mappedSeparador = mapUser(separador);

  if (!separador || !normalizeActive(separador.is_active ?? separador.ativo)) {
    return res.status(404).json({ message: 'Separador nao encontrado ou inativo.' });
  }

  if (mappedSeparador.position !== 'SEPARADOR') {
    return res.status(400).json({ message: 'Delegacao permitida apenas para separadores.' });
  }

  try {
    const apontamento = await apontamentosService.start({
      userId: mappedSeparador.id,
      tipoOperacao,
      numeroDocumento,
      documentoId,
      delegatedByUserId: mapUser(req.user).id,
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

app.get('/api/supervisor/users/:id/performance', requireSupervisor, async (req, res, next) => {
  try {
    const user = mapUser(await getUserById(req.params.id));

    if (!user) {
      return res.status(404).json({ message: 'Usuario nao encontrado.' });
    }

    const apontamentos = await apontamentosRepository.listAll({ userId: req.params.id });
    const finished = apontamentos.filter((item) => item.status === 'FINALIZADO');
    const cancelled = apontamentos.filter((item) => item.status === 'CANCELADO');
    const totalMinutes = finished.reduce((sum, item) => sum + Number(item.time_spent_minutes || 0), 0);

    res.json({
      user,
      indicators: {
        total_done_documents: finished.length,
        total_doing_documents: apontamentos.filter((item) => item.status === 'INICIADO').length,
        total_cancelled_documents: cancelled.length,
        total_volumes_processed: finished.reduce((sum, item) => sum + item.document.volumes, 0),
        total_skus_processed: finished.reduce((sum, item) => sum + item.document.skus, 0),
        average_finished_minutes: finished.length > 0 ? Math.round(totalMinutes / finished.length) : 0,
      },
      documents: apontamentos.map(appointmentAsSupervisorRow),
      apontamentos,
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/supervisor/users/:id/close-open', requireSupervisor, async (req, res, next) => {
  try {
    const targetUser = mapUser(await getUserById(req.params.id));

    if (!targetUser) {
      return res.status(404).json({ message: 'Usuario nao encontrado.' });
    }

    if (targetUser.position !== 'SEPARADOR') {
      return res.status(400).json({ message: 'Encerramento permitido apenas para separadores.' });
    }

    const apontamento = await apontamentosService.closeOpenByUser(targetUser.id);

    return res.json({
      sucesso: true,
      apontamento,
      process: apontamentosService.toProcess(apontamento),
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message: error.message || 'Nao foi possivel encerrar o processo.',
    });
  }
});

app.get('/api/supervisor/apontamentos', requireSupervisor, async (req, res, next) => {
  try {
    const { userId, status } = req.query;
    const filters = {
      userId,
      openOnly: status === 'ABERTO',
      finishedOnly: status === 'FINALIZADO',
    };

    const apontamentos = await apontamentosRepository.listAll(filters);

    res.json({
      apontamentos,
      processes: apontamentos.map(apontamentosService.toProcess),
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/supervisor/apontamentos/:id/cancel', requireSupervisor, async (req, res) => {
  try {
    const apontamento = await apontamentosService.cancelBySupervisor({
      apontamentoId: req.params.id,
      supervisorUserId: mapUser(req.user).id,
    });

    return res.json({
      sucesso: true,
      apontamento,
      process: apontamentosService.toProcess(apontamento),
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message: error.message || 'Nao foi possivel cancelar o processo no QLOG.',
    });
  }
});

app.get('/api/supervisor/documents', requireSupervisor, async (req, res, next) => {
  try {
    const { operation, origin, documentNumber, partner, page, perPage, search } = req.query;
    const documents = await listDocuments({ operation, origin, documentNumber, partner, page, perPage, search });

    res.json(documentsResponse(documents));
  } catch (error) {
    next(error);
  }
});

app.get('/api/operator/processes', requireUser, async (req, res, next) => {
  try {
    const open = await apontamentosService.listOpen(mapUser(req.user).id);
    const history = await apontamentosService.listHistory(mapUser(req.user).id);
    const apontamentos = [...open, ...history];

    res.json({
      apontamentos,
      processes: apontamentos.map(apontamentosService.toProcess),
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/operator/documents', requireUser, async (req, res, next) => {
  try {
    const { operation, page, perPage, search } = req.query;
    const documents = await listDocuments({ operation, page, perPage, search });

    res.json(documentsResponse(documents));
  } catch (error) {
    next(error);
  }
});

app.post('/api/operator/documents/:id/start', requireUser, async (req, res) => {
  const document = await getDocumentById(req.params.id);

  if (!document) {
    return res.status(404).json({ message: 'Documento nao encontrado.' });
  }

  try {
    const apontamento = await apontamentosService.start({
      userId: mapUser(req.user).id,
      tipoOperacao: normalizeOperationCode(req.body?.tipo_operacao),
      numeroDocumento: document.document_number,
      documentoId: document.id,
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

app.post('/api/operator/documents/:id/end', requireUser, async (req, res) => {
  try {
    const apontamento = await apontamentosService.closeOpenByUser(mapUser(req.user).id);

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

if (existsSync(staticPath)) {
  app.use(express.static(staticPath));
  app.get(/^(?!\/api(?:\/|$)|\/apontamentos(?:\/|$)).*/, (_req, res) => {
    res.sendFile(path.join(staticPath, 'index.html'));
  });
}

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ message: 'Erro interno da API.' });
});

app.listen(port, () => {
  console.log(`QLOG running on http://0.0.0.0:${port}`);
});
