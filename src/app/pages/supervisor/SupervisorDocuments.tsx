import { Filter, Search, X } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../../services/api';
import { formatDate, formatDateTime } from './format';

export interface SupervisorDocument {
  id: string;
  origin: string;
  document_number: string;
  series: string;
  type: string;
  operation_type_code?: string;
  operation: string;
  partner_name: string;
  partner_code: string;
  partner_store: string;
  document_date: string;
  volumes: number;
  skus: number;
  gross_weight: number;
  net_weight: number;
  status?: string;
  current_user_id?: string | null;
  current_user_name?: string | null;
  current_username?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
  last_sync_at: string | null;
  created_at: string | null;
  time_spent_minutes?: number | null;
}

const emptyFilters = {
  operation: '',
  origin: '',
  documentNumber: '',
  partner: '',
};

export default function SupervisorDocuments() {
  const [documents, setDocuments] = useState<SupervisorDocument[]>([]);
  const [filters, setFilters] = useState(emptyFilters);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    return params.toString();
  }, [filters]);

  const loadDocuments = async () => {
    setIsLoading(true);
    setError('');

    try {
      const data = await apiRequest<{ documents: SupervisorDocument[] }>(
        `/api/supervisor/documents${query ? `?${query}` : ''}`
      );
      setDocuments(data.documents);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Nao foi possivel carregar documentos.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, [query]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    loadDocuments();
  };

  const updateFilter = (key: keyof typeof filters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters(emptyFilters);
  };

  return (
    <div className="max-w-7xl mx-auto">
      <header className="mb-5">
        <h1 className="text-2xl text-slate-900 dark:text-white">Documentos</h1>
        <p className="text-slate-500 dark:text-slate-400">
          Catálogo de referência. O andamento operacional é controlado por apontamentos.
        </p>
      </header>

      <main>
        <form
          onSubmit={handleSubmit}
          className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 mb-6"
        >
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-5 h-5 text-blue-600 dark:text-blue-300" />
            <h2 className="text-lg text-slate-900 dark:text-white">Filtros</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <select
              value={filters.operation}
              onChange={(event) => updateFilter('operation', event.target.value)}
              className="px-3 py-3 rounded-xl border border-slate-300 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
            >
              <option value="">Operação</option>
              <option value="DESCARGA">Descarga</option>
              <option value="CONFERENCIA">Conferência</option>
              <option value="ARMAZENAGEM">Armazenagem</option>
              <option value="SEPARACAO">Separação</option>
              <option value="ETIQUETAGEM">Etiquetagem</option>
              <option value="EXPEDICAO">Expedição</option>
            </select>



            <input
              value={filters.documentNumber}
              onChange={(event) => updateFilter('documentNumber', event.target.value)}
              placeholder="Número"
              className="px-3 py-3 rounded-xl border border-slate-300 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
            />

            <input
              value={filters.partner}
              onChange={(event) => updateFilter('partner', event.target.value)}
              placeholder="Parceiro"
              className="px-3 py-3 rounded-xl border border-slate-300 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
            />
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-100"
            >
              <X className="w-4 h-4" />
              Limpar
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Search className="w-4 h-4" />
              Aplicar filtros
            </button>
          </div>
        </form>

        {error && (
          <div className="bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-200 border border-red-200 dark:border-red-500/30 rounded-xl px-4 py-3 mb-4">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 text-slate-500 dark:text-slate-300">
            Carregando documentos...
          </div>
        ) : (
          <DocumentTable documents={documents} />
        )}
      </main>
    </div>
  );
}

function DocumentTable({ documents }: { documents: SupervisorDocument[] }) {
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1400px]">
          <thead className="bg-slate-100 dark:bg-slate-900/60">
            <tr>
              {[
                'ID',
                'Origem',
                'Número do documento',
                'Série',
                'Tipo',
                'Operação',
                'Parceiro',
                'Código do parceiro',
                'Loja do parceiro',
                'Data do documento',
                'Volumes',
                'SKUs',
                'Peso bruto',
                'Peso líquido',
                'Última sincronização',
                'Data de criação',
              ].map((header) => (
                <th key={header} className="text-left px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {documents.map((document) => (
              <tr key={document.id} className="border-t border-slate-100 dark:border-slate-700">
                <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{document.id}</td>
                <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{document.origin}</td>
                <td className="px-4 py-3 text-slate-900 dark:text-slate-100">{document.document_number}</td>
                <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{document.series || '-'}</td>
                <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{document.type}</td>
                <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{document.operation}</td>
                <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{document.partner_name}</td>
                <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{document.partner_code || '-'}</td>
                <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{document.partner_store || '-'}</td>
                <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                  {formatDate(document.document_date)}
                </td>
                <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{document.volumes}</td>
                <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{document.skus}</td>
                <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{document.gross_weight}</td>
                <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{document.net_weight}</td>
                <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                  {formatDateTime(document.last_sync_at)}
                </td>
                <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                  {formatDateTime(document.created_at)}
                </td>
              </tr>
            ))}
            {documents.length === 0 && (
              <tr>
                <td colSpan={16} className="px-4 py-8 text-center text-slate-400 dark:text-slate-500">
                  Nenhum documento encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
