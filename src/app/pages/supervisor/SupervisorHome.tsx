import { BarChart3 } from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { ApiDocument, ApiUser, apiRequest } from '../../services/api';
import { formatDateTime } from './format';

interface SupervisorAppointment {
  id: string;
  user_id: string;
  user_name: string | null;
  tipo_operacao_label: string;
  numero_documento: string;
  data_inicio: string;
  data_fim: string | null;
  document: {
    partner_name: string;
    volumes: number;
    skus: number;
  };
}

export default function SupervisorHome() {
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [documents, setDocuments] = useState<ApiDocument[]>([]);
  const [apontamentos, setApontamentos] = useState<SupervisorAppointment[]>([]);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadOverview = async () => {
      setIsLoading(true);
      setError('');

      try {
        const [usersData, documentsData, apontamentosData] = await Promise.all([
          apiRequest<{ users: ApiUser[] }>('/api/supervisor/users'),
          apiRequest<{ documents: ApiDocument[] }>('/api/supervisor/documents'),
          apiRequest<{ apontamentos: SupervisorAppointment[] }>('/api/supervisor/apontamentos'),
        ]);

        setUsers(usersData.users);
        setDocuments(documentsData.documents);
        setApontamentos(apontamentosData.apontamentos);
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Nao foi possivel carregar o overview.');
      } finally {
        setIsLoading(false);
      }
    };

    loadOverview();
  }, []);

  const operationCounts = useMemo(() => {
    const counts = apontamentos.reduce<Record<string, number>>((acc, item) => {
      acc[item.tipo_operacao_label] = (acc[item.tipo_operacao_label] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(counts)
      .map(([operation, total]) => ({ operation, total }))
      .sort((a, b) => b.total - a.total);
  }, [apontamentos]);

  const userRows = useMemo(() => {
    return users
      .filter((item) => item.position === 'SEPARADOR')
      .map((item) => {
        const userAppointments = apontamentos.filter((apontamento) => apontamento.user_id === item.id);
        const finished = userAppointments.filter((apontamento) => apontamento.data_fim);

        return {
          user: item,
          doing: userAppointments.filter((apontamento) => !apontamento.data_fim).length,
          done: finished.length,
          volumes: finished.reduce((sum, apontamento) => sum + apontamento.document.volumes, 0),
          skus: finished.reduce((sum, apontamento) => sum + apontamento.document.skus, 0),
        };
      });
  }, [apontamentos, users]);

  const openAppointments = apontamentos.filter((item) => !item.data_fim);
  const finishedAppointments = apontamentos.filter((item) => item.data_fim);
  const activeUsers = users.filter((user) => user.is_active);
  const maxOperation = Math.max(...operationCounts.map((item) => item.total), 1);

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-sm text-blue-600 dark:text-blue-300 mb-1">Overview</p>
          <h2 className="text-2xl text-slate-900 dark:text-white">Situação geral da empresa</h2>
          <p className="text-slate-500 dark:text-slate-400">
            Documentos são referência; execução operacional é controlada por apontamentos.
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-200 border border-red-200 dark:border-red-500/30 rounded-xl px-4 py-3 mb-4">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-8 text-slate-500 dark:text-slate-300">
          Carregando overview...
        </div>
      ) : (
        <>
          <section className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
            <MetricCard label="Documentos" value={documents.length} />
            <MetricCard label="Apontamentos" value={apontamentos.length} />
            <MetricCard label="Em aberto" value={openAppointments.length} />
            <MetricCard label="Finalizados" value={finishedAppointments.length} />
            <MetricCard label="Usuários ativos" value={activeUsers.length} />
            <MetricCard label="Separadores" value={users.filter((user) => user.position === 'SEPARADOR').length} />
          </section>

          <section className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6">
              <h3 className="text-lg text-slate-900 dark:text-white mb-4">Apontamentos por operação</h3>
              <div className="space-y-4">
                {operationCounts.map((item) => (
                  <HorizontalBar
                    key={item.operation}
                    label={item.operation}
                    value={item.total}
                    percent={(item.total / maxOperation) * 100}
                  />
                ))}
                {operationCounts.length === 0 && (
                  <p className="text-slate-400 dark:text-slate-500">Nenhum apontamento encontrado.</p>
                )}
              </div>
            </div>

            <OverviewTable
              title="Processos em aberto"
              headers={['Documento', 'Operação', 'Usuário', 'Parceiro', 'Início']}
              emptyText="Nenhum processo em aberto."
              rows={openAppointments.map((apontamento) => [
                apontamento.numero_documento,
                apontamento.tipo_operacao_label,
                apontamento.user_name || '-',
                apontamento.document.partner_name || '-',
                formatDateTime(apontamento.data_inicio),
              ])}
            />
          </section>

          <section>
            <OverviewTable
              title="Resumo por separador"
              headers={['Separador', 'Em aberto', 'Finalizados', 'Volumes', 'SKUs']}
              emptyText="Nenhum separador cadastrado."
              rows={userRows.map((row) => [row.user.name, row.doing, row.done, row.volumes, row.skus])}
            />
          </section>
        </>
      )}
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5">
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">{label}</p>
      <p className="text-3xl text-slate-900 dark:text-white">{value}</p>
    </div>
  );
}

function HorizontalBar({ label, value, percent }: { label: string; value: number; percent: number }) {
  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-2">
        <span className="text-slate-700 dark:text-slate-300">{label}</span>
        <span className="text-slate-900 dark:text-white">{value}</span>
      </div>
      <div className="h-3 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
        <div className="h-full bg-blue-600 dark:bg-blue-400 rounded-full" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function OverviewTable({
  title,
  headers,
  rows,
  emptyText,
}: {
  title: string;
  headers: string[];
  rows: Array<Array<ReactNode>>;
  emptyText: string;
}) {
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700">
        <h3 className="text-lg text-slate-900 dark:text-white">{title}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px]">
          <thead className="bg-slate-100 dark:bg-slate-900/60">
            <tr>
              {headers.map((header) => (
                <th key={header} className="text-left px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index} className="border-t border-slate-100 dark:border-slate-700">
                {row.map((cell, cellIndex) => (
                  <td
                    key={cellIndex}
                    className={`px-4 py-3 ${
                      cellIndex === 0 ? 'text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={headers.length} className="px-4 py-8 text-center text-slate-400 dark:text-slate-500">
                  {emptyText}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

