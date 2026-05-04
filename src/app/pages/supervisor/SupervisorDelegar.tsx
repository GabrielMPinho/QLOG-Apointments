import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { ArrowLeft, CheckCircle2, Clipboard, Package, Search, Tags, Truck, Warehouse } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DocumentsPagination } from '../../components/DocumentsPagination';
import { ApiDocument, ApiDocumentsResponse, ApiPagination, ApiUser, apiRequest } from '../../services/api';
import { parseApiDate } from '../../utils/dates';

type OperationType =
  | 'Descarga'
  | 'Conferência'
  | 'Armazenagem'
  | 'Separação'
  | 'Etiquetagem'
  | 'Expedição';

const operationTypes: Array<{ id: OperationType; name: string }> = [
  { id: 'Descarga', name: 'Descarga' },
  { id: 'Conferência', name: 'Conferência' },
  { id: 'Armazenagem', name: 'Armazenagem' },
  { id: 'Separação', name: 'Separação' },
  { id: 'Etiquetagem', name: 'Etiquetagem' },
  { id: 'Expedição', name: 'Expedição' },
];

const iconMap: Record<OperationType, typeof Package> = {
  Descarga: Package,
  Conferência: CheckCircle2,
  Armazenagem: Warehouse,
  Separação: Clipboard,
  Etiquetagem: Tags,
  Expedição: Truck,
};

const DOCUMENTS_PER_PAGE = 6;
const emptyPagination: ApiPagination = {
  page: 1,
  perPage: DOCUMENTS_PER_PAGE,
  total: 0,
  totalPages: 1,
};

export default function SupervisorDelegar() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialSeparadorId = searchParams.get('separadorId') || '';
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState(initialSeparadorId);
  const [selectedOperation, setSelectedOperation] = useState<OperationType | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<ApiDocument | null>(null);
  const [documents, setDocuments] = useState<ApiDocument[]>([]);
  const [documentSearch, setDocumentSearch] = useState('');
  const [documentsPage, setDocumentsPage] = useState(1);
  const [documentsPagination, setDocumentsPagination] = useState<ApiPagination>(emptyPagination);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const separadores = useMemo(
    () => users.filter((user) => user.position === 'SEPARADOR' && user.is_active),
    [users]
  );
  const documentsQuery = useMemo(() => {
    if (!selectedOperation) return '';

    const params = new URLSearchParams({
      operation: selectedOperation,
      page: String(documentsPage),
      perPage: String(DOCUMENTS_PER_PAGE),
    });
    const search = documentSearch.trim();
    if (search) params.set('search', search);

    return params.toString();
  }, [documentSearch, documentsPage, selectedOperation]);

  useEffect(() => {
    apiRequest<{ users: ApiUser[] }>('/api/supervisor/users')
      .then((data) => {
        setUsers(data.users);
        if (!selectedUserId) {
          const firstSeparador = data.users.find((user) => user.position === 'SEPARADOR' && user.is_active);
          if (firstSeparador) setSelectedUserId(firstSeparador.id);
        }
      })
      .catch((error) => setError(error instanceof Error ? error.message : 'Nao foi possivel carregar separadores.'));
  }, []);

  useEffect(() => {
    if (!selectedOperation) {
      setDocuments([]);
      setDocumentsPagination(emptyPagination);
      return;
    }

    setIsLoadingDocuments(true);
    setError('');
    setSuccess('');

    apiRequest<ApiDocumentsResponse>(`/api/supervisor/documents?${documentsQuery}`)
      .then((data) => {
        setDocuments(data.documents);
        setDocumentsPagination(data.pagination || {
          ...emptyPagination,
          total: data.documents.length,
          totalPages: Math.max(1, Math.ceil(data.documents.length / DOCUMENTS_PER_PAGE)),
        });
      })
      .catch((error) =>
        setError(error instanceof Error ? error.message : 'Nao foi possivel carregar documentos.')
      )
      .finally(() => setIsLoadingDocuments(false));
  }, [documentsQuery, selectedOperation]);

  const handleDelegate = async () => {
    if (!selectedUserId || !selectedOperation || !selectedDocument) return;

    setIsSaving(true);
    setError('');
    setSuccess('');

    try {
      await apiRequest('/api/supervisor/delegacoes', {
        method: 'POST',
        body: JSON.stringify({
          separador_id: selectedUserId,
          documento_id: selectedDocument.id,
          tipo_operacao: selectedOperation,
          numero_documento: selectedDocument.document_number,
        }),
      });

      const separador = separadores.find((user) => user.id === selectedUserId);
      setSuccess(`Processo delegado para ${separador?.name || 'o separador'}.`);
      setSelectedDocument(null);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Nao foi possivel delegar o processo.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      <header className="mb-6">
        <button
          onClick={() => navigate('/supervisor/users')}
          className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white mb-4"
        >
          <ArrowLeft className="w-5 h-5" />
          Voltar
        </button>
        <h1 className="text-2xl text-slate-900 dark:text-white">Delegar processo</h1>
        <p className="text-slate-500 dark:text-slate-400">
          Escolha o separador, a operação e o documento de referência.
        </p>
      </header>

      <main>
        <section className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 mb-6">
          <label className="block">
            <span className="block text-sm text-slate-600 dark:text-slate-300 mb-2">Separador</span>
            <select
              value={selectedUserId}
              onChange={(event) => setSelectedUserId(event.target.value)}
              className="w-full md:w-96 px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
            >
              <option value="">Selecione um separador</option>
              {separadores.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name} ({user.username})
                </option>
              ))}
            </select>
          </label>
        </section>

        <section className="mb-8">
          <h2 className="text-xl text-slate-900 dark:text-white mb-3">Tipo de operação</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-4">
            {operationTypes.map((operation) => {
              const Icon = iconMap[operation.id];
              const isSelected = selectedOperation === operation.id;

              return (
                <button
                  key={operation.id}
                  onClick={() => {
                    setSelectedOperation(operation.id);
                    setSelectedDocument(null);
                    setDocumentSearch('');
                    setDocumentsPage(1);
                  }}
                  className={`p-6 rounded-2xl transition-all ${
                    isSelected
                      ? 'bg-blue-600 dark:bg-blue-500 text-white shadow-xl ring-4 ring-blue-200 dark:ring-blue-700'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:shadow-lg'
                  }`}
                >
                  <div className="flex flex-col items-center gap-3">
                    <Icon className="w-12 h-12" />
                    <span>{operation.name}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {error && (
          <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-200 rounded-xl px-4 py-3 mb-6">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-200 rounded-xl px-4 py-3 mb-6">
            {success}
          </div>
        )}

        {selectedOperation && (
          <section>
            <h2 className="text-xl text-slate-900 dark:text-white mb-3">Documento</h2>

            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
              <label className="relative block w-full md:max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
                <input
                  value={documentSearch}
                  onChange={(event) => {
                    setDocumentSearch(event.target.value);
                    setDocumentsPage(1);
                    setSelectedDocument(null);
                  }}
                  placeholder="Pesquisar documentos"
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </label>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {documentsPagination.total} documento{documentsPagination.total === 1 ? '' : 's'}
              </p>
            </div>

            {isLoadingDocuments && (
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 text-center text-slate-500 dark:text-slate-300 mb-8">
                Carregando documentos...
              </div>
            )}

            {!isLoadingDocuments && documents.length === 0 && (
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 text-center text-slate-500 dark:text-slate-300 mb-8">
                Nenhum documento encontrado para esta operação.
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {documents.map((doc) => {
                const isSelected = selectedDocument?.id === doc.id;
                const labelClass = isSelected ? 'text-blue-100' : 'text-slate-500 dark:text-slate-300';
                const valueClass = isSelected ? 'text-white' : 'text-slate-900 dark:text-slate-50';

                return (
                  <button
                    key={doc.id}
                    onClick={() => setSelectedDocument(doc)}
                    className={`p-6 rounded-2xl text-left transition-all ${
                      isSelected
                        ? 'bg-blue-600 dark:bg-blue-500 text-white shadow-xl ring-4 ring-blue-200 dark:ring-blue-400/40'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-100 border border-slate-200 dark:border-slate-700 hover:shadow-lg'
                    }`}
                  >
                    <p className={`text-sm mb-1 ${labelClass}`}>{doc.origin} - {doc.type}</p>
                    <p className={`text-lg mb-4 ${valueClass}`}>{doc.document_number}</p>
                    <p className={`text-sm ${labelClass}`}>Parceiro</p>
                    <p className={`${valueClass} mb-3`}>{doc.partner_name}</p>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <p className={`text-sm ${labelClass}`}>Data</p>
                        <p className={valueClass}>
                          {doc.document_date
                            ? format(parseApiDate(doc.document_date) || new Date(doc.document_date), 'dd/MM', { locale: ptBR })
                            : '-'}
                        </p>
                      </div>
                      <div>
                        <p className={`text-sm ${labelClass}`}>Volumes</p>
                        <p className={valueClass}>{doc.volumes}</p>
                      </div>
                      <div>
                        <p className={`text-sm ${labelClass}`}>SKUs</p>
                        <p className={valueClass}>{doc.skus}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <DocumentsPagination
              page={documentsPagination.page}
              totalPages={documentsPagination.totalPages}
              onPageChange={(page) => {
                setDocumentsPage(page);
                setSelectedDocument(null);
              }}
            />

            {selectedDocument && (
              <button
                onClick={handleDelegate}
                disabled={isSaving || !selectedUserId}
                className="w-full bg-gradient-to-r from-blue-600 to-sky-500 dark:from-blue-500 dark:to-sky-400 hover:from-blue-700 hover:to-sky-600 disabled:from-blue-300 disabled:to-blue-300 disabled:cursor-not-allowed text-white py-6 rounded-2xl text-lg shadow-lg hover:shadow-xl transition-all"
              >
                {isSaving ? 'Delegando processo...' : 'Delegar processo'}
              </button>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

