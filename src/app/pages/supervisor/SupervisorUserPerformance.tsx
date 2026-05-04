import { AlertCircle, Box, Clock, FileCheck2, Package, PauseCircle, XCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { ApiUser, apiRequest } from '../../services/api';
import { SupervisorDocument } from './SupervisorDocuments';
import { formatDateTime, formatMinutes, statusClass, statusLabel } from './format';

interface PerformanceResponse {
  user: ApiUser;
  indicators: {
    total_done_documents: number;
    total_doing_documents: number;
    total_cancelled_documents: number;
    total_volumes_processed: number;
    total_skus_processed: number;
    average_finished_minutes: number;
  };
  documents: SupervisorDocument[];
}

export default function SupervisorUserPerformance() {
  const { id } = useParams();
  const [data, setData] = useState<PerformanceResponse | null>(null);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [isClosingProcess, setIsClosingProcess] = useState(false);

  const loadPerformance = async () => {
    if (!id) return;

    setError('');

    try {
      setData(await apiRequest<PerformanceResponse>(`/api/supervisor/users/${id}/performance`));
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Nao foi possivel carregar performance.');
    }
  };

  useEffect(() => {
    loadPerformance();
  }, [id]);

  const activeDocument =
    data?.documents.find((document) => document.status === 'DOING' && !document.finished_at) || null;

  const elapsedLabel = activeDocument?.started_at
    ? formatDistanceToNow(new Date(activeDocument.started_at), { locale: ptBR, addSuffix: true })
    : '-';

  const handleCloseOpenProcess = async () => {
    if (!id || !activeDocument) return;

    setActionError('');
    setIsClosingProcess(true);

    try {
      await apiRequest(`/api/supervisor/users/${id}/close-open`, {
        method: 'POST',
      });
      await loadPerformance();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Nao foi possivel encerrar o processo.');
    } finally {
      setIsClosingProcess(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      <header className="mb-5">
        <h1 className="text-2xl text-slate-900 dark:text-white">Performance do Usuario</h1>
        <p className="text-slate-500 dark:text-slate-400">Indicadores por colaborador</p>
      </header>

      <main>
        {error && (
          <div className="bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-200 border border-red-200 dark:border-red-500/30 rounded-xl px-4 py-3 mb-4">
            {error}
          </div>
        )}

        {!data && !error && (
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 text-slate-500 dark:text-slate-300">
            Carregando performance...
          </div>
        )}

        {data && (
          <>
            {activeDocument && (
              <section className="bg-amber-50/80 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-2xl p-6 mb-6 shadow-sm">
                <div className="flex items-start gap-4">
                  <AlertCircle className="w-6 h-6 text-amber-600 dark:text-amber-300 mt-1" />
                  <div className="flex-1">
                    <h3 className="text-lg text-slate-900 dark:text-slate-100 mb-1">
                      Processo em Andamento
                    </h3>
                    <p className="text-slate-600 dark:text-slate-300 mb-4">
                      Este separador possui um processo ativo. Encerre-o antes de delegar outro.
                    </p>

                    {actionError && (
                      <div className="bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-200 border border-red-200 dark:border-red-500/30 rounded-xl px-4 py-3 mb-4">
                        {actionError}
                      </div>
                    )}

                    <div className="bg-white/85 dark:bg-slate-900/45 border border-transparent dark:border-slate-700/70 rounded-xl p-4 mb-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-slate-500 dark:text-slate-400">Operacao</p>
                          <p className="text-slate-900 dark:text-slate-100">{activeDocument.operation}</p>
                        </div>
                        <div>
                          <p className="text-sm text-slate-500 dark:text-slate-400">Documento</p>
                          <p className="text-slate-900 dark:text-slate-100">
                            {activeDocument.document_number}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-slate-500 dark:text-slate-400">Cliente</p>
                          <p className="text-slate-900 dark:text-slate-100">
                            {activeDocument.partner_name || '-'}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-slate-500 dark:text-slate-400">Tempo Decorrido</p>
                          <p className="text-slate-900 dark:text-slate-100">{elapsedLabel}</p>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={handleCloseOpenProcess}
                      disabled={isClosingProcess}
                      className="bg-red-600 hover:bg-red-700 disabled:bg-red-300 dark:bg-red-500/90 dark:hover:bg-red-500 dark:disabled:bg-red-500/50 text-white px-6 py-3 rounded-xl transition-colors shadow-sm"
                    >
                      {isClosingProcess ? 'Encerrando...' : 'Encerrar Processo'}
                    </button>
                  </div>
                </div>
              </section>
            )}

            <section className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Nome</p>
                  <p className="text-lg text-slate-900 dark:text-white">{data.user.name}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Username</p>
                  <p className="text-lg text-slate-900 dark:text-white">{data.user.username}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Cargo</p>
                  <p className="text-lg text-slate-900 dark:text-white">{data.user.position}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Status</p>
                  <span
                    className={`inline-flex px-3 py-1 rounded-full text-sm mt-1 ${
                      data.user.is_active
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200'
                        : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {data.user.is_active ? 'Ativo' : 'Inativo'}
                  </span>
                </div>
              </div>
            </section>

            <section className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
              <MetricCard
                icon={<FileCheck2 className="w-5 h-5" />}
                label="Documentos feitos"
                value={data.indicators.total_done_documents}
              />
              <MetricCard
                icon={<PauseCircle className="w-5 h-5" />}
                label="Em andamento"
                value={data.indicators.total_doing_documents}
              />
              <MetricCard
                icon={<XCircle className="w-5 h-5" />}
                label="Cancelados"
                value={data.indicators.total_cancelled_documents}
              />
              <MetricCard
                icon={<Package className="w-5 h-5" />}
                label="Volumes"
                value={data.indicators.total_volumes_processed}
              />
              <MetricCard
                icon={<Box className="w-5 h-5" />}
                label="SKUs"
                value={data.indicators.total_skus_processed}
              />
              <MetricCard
                icon={<Clock className="w-5 h-5" />}
                label="Tempo medio"
                value={formatMinutes(data.indicators.average_finished_minutes)}
              />
            </section>

            <section className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700">
                <h2 className="text-lg text-slate-900 dark:text-white">Documentos do usuario</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1250px]">
                  <thead className="bg-slate-100 dark:bg-slate-900/60">
                    <tr>
                      {[
                        'Numero do documento',
                        'Origem',
                        'Tipo',
                        'Operacao',
                        'Parceiro',
                        'Volumes',
                        'SKUs',
                        'Status',
                        'Iniciado em',
                        'Finalizado em',
                        'Tempo gasto',
                      ].map((header) => (
                        <th key={header} className="text-left px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.documents.map((document) => (
                      <tr key={document.id} className="border-t border-slate-100 dark:border-slate-700">
                        <td className="px-4 py-3 text-slate-900 dark:text-white">{document.document_number}</td>
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{document.origin}</td>
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{document.type}</td>
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{document.operation}</td>
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{document.partner_name}</td>
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{document.volumes}</td>
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{document.skus}</td>
                        <td className="px-4 py-3">
                          <span className={`px-3 py-1 rounded-full text-sm ${statusClass(document.status)}`}>
                            {statusLabel(document.status)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                          {formatDateTime(document.started_at)}
                        </td>
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                          {formatDateTime(document.finished_at)}
                        </td>
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                          {formatMinutes(document.time_spent_minutes)}
                        </td>
                      </tr>
                    ))}
                    {data.documents.length === 0 && (
                      <tr>
                        <td colSpan={11} className="px-4 py-8 text-center text-slate-400 dark:text-slate-500">
                          Nenhum documento vinculado a este usuario.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: number | string;
}) {
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5">
      <div className="flex items-center justify-between text-blue-600 dark:text-blue-300 mb-3">
        <span>{label}</span>
        {icon}
      </div>
      <p className="text-3xl text-slate-900 dark:text-white">{value}</p>
    </div>
  );
}
