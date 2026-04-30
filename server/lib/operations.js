export const OPERATION_CODES = [
  'DESCARGA',
  'CONFERENCIA',
  'ARMAZENAGEM',
  'SEPARACAO',
  'EXPEDICAO',
  'ETIQUETAGEM',
];

const OPERATION_LABELS = {
  DESCARGA: 'Descarga',
  CONFERENCIA: 'Conferência',
  ARMAZENAGEM: 'Armazenagem',
  SEPARACAO: 'Separação',
  EXPEDICAO: 'Expedição',
  ETIQUETAGEM: 'Etiquetagem',
};

export function normalizeOperationCode(value) {
  const normalized = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();

  return OPERATION_CODES.includes(normalized) ? normalized : null;
}

export function operationLabel(value) {
  const code = normalizeOperationCode(value);
  return code ? OPERATION_LABELS[code] : String(value || '');
}

export function isValidOperation(value) {
  return Boolean(normalizeOperationCode(value));
}

