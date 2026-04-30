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

export const OPERATION_IDS = {
  DESCARGA: 1,
  CONFERENCIA: 2,
  ARMAZENAGEM: 3,
  SEPARACAO: 4,
  EXPEDICAO: 5,
  ETIQUETAGEM: 6,
};

const OPERATION_CODES_BY_ID = Object.fromEntries(
  Object.entries(OPERATION_IDS).map(([code, id]) => [id, code])
);

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

export function operationId(value) {
  const code = normalizeOperationCode(value);
  return code ? OPERATION_IDS[code] : null;
}

export function operationCodeFromId(id) {
  return OPERATION_CODES_BY_ID[Number(id)] || null;
}

export function isValidOperation(value) {
  return Boolean(normalizeOperationCode(value));
}

