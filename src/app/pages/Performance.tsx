import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useApp } from '../context/AppContext';
import { ArrowLeft, TrendingUp, Clock, Package, Box, CheckCircle, ActivitySquare } from 'lucide-react';
import { format, differenceInMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ThemeToggle } from '../components/ThemeToggle';

export default function Performance() {
  const navigate = useNavigate();
  const { user, processes, refreshProcesses } = useApp();

  useEffect(() => {
    refreshProcesses().catch(() => undefined);
  }, [refreshProcesses]);

  const today = format(new Date(), 'yyyy-MM-dd');
  const todayProcesses = processes.filter(
    (p) => format(p.startDate, 'yyyy-MM-dd') === today
  );
  const thisWeekProcesses = processes.filter((p) => {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    return p.startDate >= weekStart;
  });

  const completedProcesses = processes.filter((p) => p.status === 'Concluído');

  const totalTimeToday = todayProcesses.reduce((total, p) => {
    if (p.endDate) {
      return total + differenceInMinutes(p.endDate, p.startDate);
    }
    return total;
  }, 0);

  const totalVolumes = completedProcesses.reduce((sum, p) => sum + p.volumes, 0);
  const totalSkus = completedProcesses.reduce((sum, p) => sum + p.skus, 0);

  const avgTime =
    completedProcesses.length > 0
      ? completedProcesses.reduce((sum, p) => {
          if (p.endDate) {
            return sum + differenceInMinutes(p.endDate, p.startDate);
          }
          return sum;
        }, 0) / completedProcesses.length
      : 0;

  const processesByType = processes.reduce((acc, p) => {
    acc[p.type] = (acc[p.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Em andamento':
        return 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400';
      case 'Concluído':
        return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400';
      case 'Cancelado':
        return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400';
      default:
        return 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300';
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
            <h1 className="text-2xl text-blue-600 dark:text-blue-400">Minha Performance</h1>
          </div>
          <ThemeToggle />
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 mb-6">
          <h2 className="text-xl text-gray-900 dark:text-white mb-1">{user?.name}</h2>
          <p className="text-gray-500 dark:text-gray-400">Matrícula: {user?.matricula}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-gray-500 dark:text-gray-400">Processos Hoje</p>
              <TrendingUp className="w-5 h-5 text-blue-500 dark:text-blue-400" />
            </div>
            <p className="text-4xl text-gray-900 dark:text-white">{todayProcesses.length}</p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-gray-500 dark:text-gray-400">Processos na Semana</p>
              <ActivitySquare className="w-5 h-5 text-purple-500 dark:text-purple-400" />
            </div>
            <p className="text-4xl text-gray-900 dark:text-white">{thisWeekProcesses.length}</p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-gray-500 dark:text-gray-400">Total Concluídos</p>
              <CheckCircle className="w-5 h-5 text-blue-600" />
            </div>
            <p className="text-4xl text-gray-900 dark:text-white">{completedProcesses.length}</p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-gray-500 dark:text-gray-400">Tempo Hoje</p>
              <Clock className="w-5 h-5 text-orange-500 dark:text-orange-400" />
            </div>
            <p className="text-4xl text-gray-900 dark:text-white">
              {Math.floor(totalTimeToday / 60)}h {totalTimeToday % 60}m
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-gray-500 dark:text-gray-400">Tempo Médio</p>
              <Clock className="w-5 h-5 text-teal-500 dark:text-teal-400" />
            </div>
            <p className="text-4xl text-gray-900 dark:text-white">{Math.round(avgTime)} min</p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-gray-500 dark:text-gray-400">Volumes Processados</p>
              <Package className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
            </div>
            <p className="text-4xl text-gray-900 dark:text-white">{totalVolumes}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
            <h3 className="text-lg text-gray-900 dark:text-white mb-4">Processos por Tipo</h3>
            <div className="space-y-3">
              {Object.entries(processesByType).map(([type, count]) => (
                <div key={type} className="flex items-center justify-between">
                  <span className="text-gray-700 dark:text-gray-300">{type}</span>
                  <div className="flex items-center gap-3">
                    <div className="bg-gray-200 dark:bg-gray-700 h-2 w-32 rounded-full overflow-hidden">
                      <div
                        className="bg-blue-600 dark:bg-blue-500 h-full"
                        style={{
                          width: `${(count / processes.length) * 100}%`,
                        }}
                      />
                    </div>
                    <span className="text-gray-900 dark:text-white w-8 text-right">{count}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
            <h3 className="text-lg text-gray-900 dark:text-white mb-4">Resumo Geral</h3>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Box className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">SKUs Processados</p>
                  <p className="text-2xl text-gray-900 dark:text-white">{totalSkus}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Package className="w-5 h-5 text-blue-500 dark:text-blue-400" />
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Volumes Processados</p>
                  <p className="text-2xl text-gray-900 dark:text-white">{totalVolumes}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
          <h3 className="text-lg text-gray-900 dark:text-white mb-4">Histórico Completo</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-3 px-4 text-gray-600 dark:text-gray-400">Operação</th>
                  <th className="text-left py-3 px-4 text-gray-600 dark:text-gray-400">Documento</th>
                  <th className="text-left py-3 px-4 text-gray-600 dark:text-gray-400">Cliente</th>
                  <th className="text-left py-3 px-4 text-gray-600 dark:text-gray-400">Início</th>
                  <th className="text-left py-3 px-4 text-gray-600 dark:text-gray-400">Fim</th>
                  <th className="text-left py-3 px-4 text-gray-600 dark:text-gray-400">Duração</th>
                  <th className="text-left py-3 px-4 text-gray-600 dark:text-gray-400">Status</th>
                </tr>
              </thead>
              <tbody>
                {processes.map((process) => (
                  <tr key={process.id} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="py-3 px-4 text-gray-900 dark:text-white">{process.type}</td>
                    <td className="py-3 px-4 text-gray-700 dark:text-gray-300">{process.documentNumber}</td>
                    <td className="py-3 px-4 text-gray-700 dark:text-gray-300">{process.client}</td>
                    <td className="py-3 px-4 text-gray-700 dark:text-gray-300">
                      {format(process.startDate, 'dd/MM HH:mm', { locale: ptBR })}
                    </td>
                    <td className="py-3 px-4 text-gray-700 dark:text-gray-300">
                      {process.endDate
                        ? format(process.endDate, 'dd/MM HH:mm', { locale: ptBR })
                        : '-'}
                    </td>
                    <td className="py-3 px-4 text-gray-700 dark:text-gray-300">
                      {process.endDate
                        ? `${differenceInMinutes(process.endDate, process.startDate)} min`
                        : '-'}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-3 py-1 rounded-full text-sm ${getStatusColor(process.status)}`}>
                        {process.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {processes.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-gray-400 dark:text-gray-500">
                      Nenhum processo registrado ainda
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
