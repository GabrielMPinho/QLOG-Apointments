import { BarChart3 } from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { ApiDocument, ApiUser, apiRequest } from '../../services/api';
import { formatDateTime, statusClass, statusLabel } from './format';

const statusOrder = ['DOING', 'DONE', 'AVAILABLE', 'CANCELLED', 'BLOCKED'];

export default function SupervisorHome() {
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [documents, setDocuments] = useState<ApiDocument[]>([]);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadOverview = async () => {
      setIsLoading(true);
      setError('');

      try {
        const [usersData, documentsData] = await Promise.all([
          apiRequest<{ users: ApiUser[] }>('/api/supervisor/users'),
          apiRequest<{ documents: ApiDocument[] }>('/api/supervisor/documents'),
        ]);

        setUsers(usersData.users);
        setDocuments(documentsData.documents);
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Nao foi possivel carregar o overview.');
      } finally {
        setIsLoading(false);
      }
    };

    loadOverview();
  }, []);

  const statusCounts = useMemo(() => {
    return statusOrder.map((status) => ({
      status,
      total: documents.filter((document) => document.status === status).length,
    }));
  }, [documents]);

  const operationCounts = useMemo(() => {
    const counts = documents.reduce<Record<string, number>>((acc, document) => {
      const operation = document.operation || 'Sem operacao';
      acc[operation] = (acc[operation] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(counts)
      .map(([operation, total]) => ({ operation, total }))
      .sort((a, b) => b.total - a.total);
  }, [documents]);

  const userRows = useMemo(() => {
    return users
      .filter((item) => item.position === 'SEPARADOR')
      .map((item) => {
        const userDocuments = documents.filter((document) => document.current_user_id === item.id);
        const doneDocuments = userDocuments.filter((document) => document.status === 'DONE');

        return {
          user: item,
          doing: userDocuments.filter((document) => document.status === 'DOING').length,
          done: doneDocuments.length,
          cancelled: userDocuments.filter((document) => document.status === 'CANCELLED').length,
          volumes: doneDocuments.reduce((sum, document) => sum + document.volumes, 0),
          skus: doneDocuments.reduce((sum, document) => sum + document.skus, 0),
        };
      });
  }, [documents, users]);

  const activeDocuments = documents.filter((document) => document.status === 'DOING');
  const doneDocuments = documents.filter((document) => document.status === 'DONE');
  const availableDocuments = documents.filter((document) => document.status === 'AVAILABLE');
  const blockedDocuments = documents.filter((document) => document.status === 'BLOCKED');
  const cancelledDocuments = documents.filter((document) => document.status === 'CANCELLED');
  const maxStatus = Math.max(...statusCounts.map((item) => item.total), 1);
  const maxOperation = Math.max(...operationCounts.map((item) => item.total), 1);

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-sm text-blue-600 dark:text-blue-300 mb-1">Overview</p>
          <h2 className="text-2xl text-slate-900 dark:text-white">Situacao geral da empresa</h2>
          <p className="text-slate-500 dark:text-slate-400">
            Dados consolidados de usuarios, documentos e operacoes.
          </p>
        </div>
        <div className="hidden md:flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-600 dark:text-slate-300">
          <BarChart3 className="w-5 h-5 text-blue-600 dark:text-blue-300" />
          Consulta no carregamento da pagina
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
            <MetricCard label="Ativos" value={activeDocuments.length} />
            <MetricCard label="Finalizados" value={doneDocuments.length} />
            <MetricCard label="Nao iniciados" value={availableDocuments.length} />
            <MetricCard label="Bloqueados" value={blockedDocuments.length} />
            <MetricCard label="Cancelados" value={cancelledDocuments.length} />
          </section>

          <section className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6">
              <h3 className="text-lg text-slate-900 dark:text-white mb-4">Documentos por status</h3>
              <div className="space-y-4">
                {statusCounts.map((item) => (
                  <HorizontalBar
                    key={item.status}
                    label={statusLabel(item.status)}
                    value={item.total}
                    percent={(item.total / maxStatus) * 100}
                  />
                ))}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6">
              <h3 className="text-lg text-slate-900 dark:text-white mb-4">Documentos por operacao</h3>
              <div className="space-y-4">
                {operationCounts.slice(0, 8).map((item) => (
                  <HorizontalBar
                    key={item.operation}
                    label={item.operation}
                    value={item.total}
                    percent={(item.total / maxOperation) * 100}
                  />
                ))}
                {operationCounts.length === 0 && (
                  <p className="text-slate-400 dark:text-slate-500">Nenhum documento encontrado.</p>
                )}
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <OverviewTable
              title="Documentos em andamento"
              headers={['Documento', 'Operacao', 'Usuario', 'Inicio', 'Status']}
              emptyText="Nenhum documento ativo."
              rows={activeDocuments.map((document) => [
                document.document_number,
                document.operation,
                document.current_user_name || '-',
                formatDateTime(document.started_at),
                <span className={`px-3 py-1 rounded-full text-sm ${statusClass(document.status)}`}>
                  {statusLabel(document.status)}
                </span>,
              ])}
            />

            <OverviewTable
              title="Resumo por separador"
              headers={['Separador', 'Ativos', 'Finalizados', 'Cancelados', 'Volumes', 'SKUs']}
              emptyText="Nenhum separador cadastrado."
              rows={userRows.map((row) => [
                row.user.name,
                row.doing,
                row.done,
                row.cancelled,
                row.volumes,
                row.skus,
              ])}
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
