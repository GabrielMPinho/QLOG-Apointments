import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, CheckCircle2, Clipboard, Package, Search, Tags, Truck, Warehouse } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DocumentsPagination } from '../components/DocumentsPagination';
import { ThemeToggle } from '../components/ThemeToggle';
import { useApp } from '../context/AppContext';
import { ApiDocument, ApiDocumentsResponse, ApiPagination, apiRequest } from '../services/api';
import { parseApiDate } from '../utils/dates';

type OperationType =
  | 'Descarga'
  | 'Conferência'
  | 'Armazenagem'
  | 'Separação'
  | 'Etiquetagem'
  | 'Expedição';

const operationTypes: Array<{
  id: OperationType;
  name: string;
  documentType: 'NF Entrada' | 'Pedido Venda';
}> = [
  { id: 'Descarga', name: 'Descarga', documentType: 'NF Entrada' },
  { id: 'Conferência', name: 'Conferência', documentType: 'NF Entrada' },
  { id: 'Armazenagem', name: 'Armazenagem', documentType: 'NF Entrada' },
  { id: 'Separação', name: 'Separação', documentType: 'Pedido Venda' },
  { id: 'Etiquetagem', name: 'Etiquetagem', documentType: 'Pedido Venda' },
  { id: 'Expedição', name: 'Expedição', documentType: 'Pedido Venda' },
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

export default function NovaOperacao() {
  const navigate = useNavigate();
  const { startProcess } = useApp();
  const [selectedOperation, setSelectedOperation] = useState<OperationType | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<ApiDocument | null>(null);
  const [documents, setDocuments] = useState<ApiDocument[]>([]);
  const [documentSearch, setDocumentSearch] = useState('');
  const [documentsPage, setDocumentsPage] = useState(1);
  const [documentsPagination, setDocumentsPagination] = useState<ApiPagination>(emptyPagination);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState('');

  const selectedOperationType = operationTypes.find((op) => op.id === selectedOperation);
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
    if (!selectedOperation) {
      setDocuments([]);
      setDocumentsPagination(emptyPagination);
      return;
    }

    setIsLoadingDocuments(true);
    setError('');

    apiRequest<ApiDocumentsResponse>(`/api/operator/documents?${documentsQuery}`)
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

  const handleStartProcess = async () => {
    if (!selectedDocument) return;

    setIsStarting(true);
    setError('');

    try {
      await startProcess(selectedDocument);
      navigate('/confirmacao');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Nao foi possivel iniciar o processo.');
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <nav className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/home')}
              className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h1 className="text-2xl text-blue-600 dark:text-blue-400">Nova Operação</h1>
          </div>
          <ThemeToggle />
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h2 className="text-xl text-gray-900 dark:text-white mb-2">Selecione o tipo de operação</h2>
          <p className="text-gray-500 dark:text-gray-400">Escolha a atividade que você irá realizar</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
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
                    ? 'bg-blue-600 dark:bg-blue-500 text-white shadow-xl scale-105 ring-4 ring-blue-200 dark:ring-blue-700'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:shadow-lg'
                }`}
              >
                <div className="flex flex-col items-center gap-3">
                  <Icon className="w-12 h-12" />
                  <span className="text-center">{operation.name}</span>
                </div>
              </button>
            );
          })}
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-200 rounded-xl px-4 py-3 mb-6">
            {error}
          </div>
        )}

        {selectedOperation && (
          <div>
            <div className="mb-6">
              <h2 className="text-xl text-gray-900 dark:text-white mb-2">Selecione o documento</h2>
              <p className="text-gray-500 dark:text-gray-400">
                {selectedOperationType?.documentType === 'NF Entrada'
                  ? 'Notas fiscais de entrada disponíveis'
                  : 'Pedidos de venda disponíveis'}
              </p>
            </div>

            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
              <label className="relative block w-full md:max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-slate-500" />
                <input
                  value={documentSearch}
                  onChange={(event) => {
                    setDocumentSearch(event.target.value);
                    setDocumentsPage(1);
                    setSelectedDocument(null);
                  }}
                  placeholder="Pesquisar documentos"
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </label>
              <p className="text-sm text-gray-500 dark:text-slate-400">
                {documentsPagination.total} documento{documentsPagination.total === 1 ? '' : 's'}
              </p>
            </div>

            {isLoadingDocuments && (
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 text-center text-slate-500 dark:text-slate-300 mb-8">
                Carregando documentos disponíveis...
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
                const labelClass = isSelected ? 'text-blue-100' : 'text-gray-500 dark:text-slate-300';
                const valueClass = isSelected ? 'text-white' : 'text-gray-900 dark:text-slate-50';

                return (
                  <button
                    key={doc.id}
                    onClick={() => setSelectedDocument(doc)}
                    className={`p-6 rounded-2xl text-left transition-all ${
                      isSelected
                        ? 'bg-blue-600 dark:bg-blue-500 text-white shadow-xl ring-4 ring-blue-200 dark:ring-blue-400/40'
                        : 'bg-white dark:bg-slate-800/95 text-gray-700 dark:text-slate-100 border border-gray-100 dark:border-slate-700 hover:shadow-lg dark:hover:bg-slate-800 dark:hover:border-slate-500'
                    }`}
                  >
                    <div className="mb-4">
                      <p className={`text-sm mb-1 ${labelClass}`}>{doc.origin} - {doc.type}</p>
                      <p className={`text-lg ${valueClass}`}>{doc.document_number}</p>
                    </div>
                    <div className="space-y-2">
                      <div>
                        <p className={`text-sm ${labelClass}`}>
                          {selectedOperationType?.documentType === 'NF Entrada' ? 'Fornecedor' : 'Cliente'}
                        </p>
                        <p className={valueClass}>{doc.partner_name}</p>
                      </div>
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
                onClick={handleStartProcess}
                disabled={isStarting}
                className="w-full bg-gradient-to-r from-blue-600 to-sky-500 dark:from-blue-500 dark:to-sky-400 hover:from-blue-700 hover:to-sky-600 dark:hover:from-blue-600 dark:hover:to-sky-500 disabled:from-blue-300 disabled:to-blue-300 disabled:cursor-not-allowed text-white py-6 rounded-2xl text-lg shadow-lg hover:shadow-xl transition-all"
              >
                {isStarting ? 'Iniciando processo...' : 'Iniciar Processo'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

