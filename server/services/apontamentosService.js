import { normalizeOperationCode } from '../lib/operations.js';

export class BusinessError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = 'BusinessError';
    this.statusCode = statusCode;
  }
}

export function createApontamentosService(apontamentosRepository) {
  function toProcess(apontamento) {
    return {
      id: apontamento.id,
      type: apontamento.tipo_operacao_label,
      documentNumber: apontamento.numero_documento,
      documentType: apontamento.document.type || 'Documento',
      client: apontamento.document.partner_name || '-',
      startDate: apontamento.data_inicio,
      endDate: apontamento.data_fim || undefined,
      status: apontamento.data_fim ? 'Concluído' : 'Em andamento',
      volumes: apontamento.document.volumes,
      skus: apontamento.document.skus,
      userId: apontamento.user_id,
      delegatedByUserId: apontamento.delegated_by_user_id,
      delegatedByName: apontamento.delegated_by_user_name,
    };
  }

  function start({ userId, tipoOperacao, numeroDocumento, delegatedByUserId = null }) {
    const operationCode = normalizeOperationCode(tipoOperacao);
    const documentNumber = String(numeroDocumento || '').trim();

    if (!operationCode) {
      throw new BusinessError('Tipo de operação inválido.', 400);
    }

    if (!documentNumber) {
      throw new BusinessError('Número do documento é obrigatório.', 400);
    }

    const openApontamento = apontamentosRepository.findOpenByUser(userId);
    if (openApontamento) {
      throw new BusinessError('Você já possui um processo em andamento', 409);
    }

    return apontamentosRepository.createApontamento({
      userId,
      tipoOperacao: operationCode,
      numeroDocumento: documentNumber,
      delegatedByUserId,
    });
  }

  function closeOpenByUser(userId) {
    const openApontamento = apontamentosRepository.findOpenByUser(userId);

    if (!openApontamento) {
      throw new BusinessError('Nenhum processo em andamento encontrado.', 404);
    }

    return apontamentosRepository.closeApontamento(openApontamento.id);
  }

  function listOpen(userId) {
    return apontamentosRepository.listOpenByUser(userId);
  }

  function listHistory(userId) {
    return apontamentosRepository.listHistoryByUser(userId);
  }

  return {
    toProcess,
    start,
    closeOpenByUser,
    listOpen,
    listHistory,
  };
}
