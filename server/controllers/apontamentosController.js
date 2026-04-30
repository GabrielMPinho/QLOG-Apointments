import { Router } from 'express';
import { BusinessError } from '../services/apontamentosService.js';

function handleError(res, error) {
  if (error instanceof BusinessError) {
    return res.status(error.statusCode).json({ message: error.message });
  }

  console.error(error);
  return res.status(500).json({ message: 'Erro interno ao processar apontamento.' });
}

export function createApontamentosRouter(apontamentosService) {
  const router = Router();

  router.post('/iniciar', (req, res) => {
    try {
      const apontamento = apontamentosService.start({
        userId: req.user.id,
        tipoOperacao: req.body?.tipo_operacao,
        numeroDocumento: req.body?.numero_documento,
      });

      return res.status(201).json({
        sucesso: true,
        apontamento,
        process: apontamentosService.toProcess(apontamento),
      });
    } catch (error) {
      return handleError(res, error);
    }
  });

  router.post('/encerrar', (req, res) => {
    try {
      const apontamento = apontamentosService.closeOpenByUser(req.user.id);

      return res.json({
        sucesso: true,
        apontamento,
        process: apontamentosService.toProcess(apontamento),
      });
    } catch (error) {
      return handleError(res, error);
    }
  });

  router.get('/abertos', (req, res) => {
    const apontamentos = apontamentosService.listOpen(req.user.id);

    return res.json({
      apontamentos,
      processes: apontamentos.map(apontamentosService.toProcess),
    });
  });

  router.get('/historico', (req, res) => {
    const apontamentos = apontamentosService.listHistory(req.user.id);

    return res.json({
      apontamentos,
      processes: apontamentos.map(apontamentosService.toProcess),
    });
  });

  return router;
}

