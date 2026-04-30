import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useApp } from '../context/AppContext';
import { Plus, Clock, CheckCircle, User, IdCard, TrendingUp, AlertCircle } from 'lucide-react';
import { formatDistanceToNow, format, differenceInMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ThemeToggle } from '../components/ThemeToggle';

export default function Home() {
  const navigate = useNavigate();
  const { user, processes, activeProcess, endProcess, refreshProcesses, logout } = useApp();
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    refreshProcesses().catch(() => {
      setActionError('Nao foi possivel carregar os apontamentos.');
    });

    const interval = window.setInterval(() => {
      refreshProcesses().catch(() => undefined);
    }, 5000);

    return () => window.clearInterval(interval);
  }, [refreshProcesses]);

  const completedProcesses = processes.filter((p) => p.status === 'Concluído');
  const todayProcesses = processes.filter(
    (p) => format(p.startDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
  );

  const totalTimeToday = todayProcesses.reduce((total, p) => {
    if (p.endDate) {
      return total + differenceInMinutes(p.endDate, p.startDate);
    }
    return total;
  }, 0);

  const handleNewProcess = () => {
    if (activeProcess) {
      return;
    }
    navigate('/nova-operacao');
  };

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const handleEndProcess = async () => {
    if (!activeProcess) return;

    setActionError('');

    try {
      await endProcess(activeProcess.id);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Nao foi possivel encerrar o processo.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <nav className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <h1 className="text-2xl text-blue-600 dark:text-blue-400">QLOG Apontamentos</h1>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <button
              onClick={handleLogout}
              className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              Sair
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex items-center gap-4">
            <div className="bg-blue-100 dark:bg-blue-900/30 w-16 h-16 rounded-2xl flex items-center justify-center">
              <User className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl text-gray-900 dark:text-white">{user?.name}</h2>
              <p className="text-gray-500 dark:text-gray-400 flex items-center gap-2">
                <IdCard className="w-4 h-4" />
                {user?.matricula}
              </p>
            </div>
            <div className="text-right">
              <div className="inline-flex items-center gap-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-4 py-2 rounded-full">
                <div className="w-2 h-2 bg-blue-600 dark:bg-blue-400 rounded-full animate-pulse" />
                Logado
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-gray-500 dark:text-gray-400">Processos Hoje</p>
              <TrendingUp className="w-5 h-5 text-blue-500 dark:text-blue-400" />
            </div>
            <p className="text-3xl text-gray-900 dark:text-white">{todayProcesses.length}</p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-gray-500 dark:text-gray-400">Tempo Trabalhado</p>
              <Clock className="w-5 h-5 text-purple-500 dark:text-purple-400" />
            </div>
            <p className="text-3xl text-gray-900 dark:text-white">{Math.floor(totalTimeToday / 60)}h {totalTimeToday % 60}m</p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-gray-500 dark:text-gray-400">Em Andamento</p>
              <Clock className="w-5 h-5 text-orange-500 dark:text-orange-400" />
            </div>
            <p className="text-3xl text-gray-900 dark:text-white">{activeProcess ? 1 : 0}</p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-gray-500 dark:text-gray-400">Concluídos</p>
              <CheckCircle className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <p className="text-3xl text-gray-900 dark:text-white">{completedProcesses.length}</p>
          </div>
        </div>

        {actionError && (
          <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-200 rounded-xl px-4 py-3 mb-6">
            {actionError}
          </div>
        )}

        {activeProcess && (
          <div className="bg-amber-50/80 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-2xl p-6 mb-6 shadow-sm">
            <div className="flex items-start gap-4">
              <AlertCircle className="w-6 h-6 text-amber-600 dark:text-amber-300 mt-1" />
              <div className="flex-1">
                <h3 className="text-lg text-slate-900 dark:text-slate-100 mb-1">Processo em Andamento</h3>
                <p className="text-slate-600 dark:text-slate-300 mb-4">
                  Você possui um processo ativo. Encerre-o antes de iniciar outro.
                </p>
                <div className="bg-white/85 dark:bg-slate-900/45 border border-transparent dark:border-slate-700/70 rounded-xl p-4 mb-4">
                  <div className="grid grid-cols-2 gap-4 mb-3">
                    <div>
                      <p className="text-sm text-slate-500 dark:text-slate-400">Operação</p>
                      <p className="text-slate-900 dark:text-slate-100">{activeProcess.type}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500 dark:text-slate-400">Documento</p>
                      <p className="text-slate-900 dark:text-slate-100">{activeProcess.documentNumber}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500 dark:text-slate-400">Cliente</p>
                      <p className="text-slate-900 dark:text-slate-100">{activeProcess.client}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500 dark:text-slate-400">Tempo Decorrido</p>
                      <p className="text-slate-900 dark:text-slate-100">
                        {formatDistanceToNow(activeProcess.startDate, { locale: ptBR, addSuffix: true })}
                      </p>
                    </div>
                  </div>
                </div>
                <button
                  onClick={handleEndProcess}
                  className="bg-red-600 hover:bg-red-700 dark:bg-red-500/90 dark:hover:bg-red-500 text-white px-6 py-3 rounded-xl transition-colors shadow-sm"
                >
                  Encerrar Processo
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="mb-6">
          <button
            onClick={handleNewProcess}
            disabled={!!activeProcess}
            className={`w-full py-6 rounded-2xl text-lg flex items-center justify-center gap-3 transition-all border ${
              activeProcess
                ? 'bg-slate-200 text-slate-500 border-slate-300 cursor-not-allowed shadow-inner dark:bg-slate-800/80 dark:text-slate-400 dark:border-slate-700'
                : 'bg-gradient-to-r from-blue-600 to-sky-500 hover:from-blue-700 hover:to-sky-600 text-white border-transparent shadow-lg hover:shadow-xl'
            }`}
          >
            <Plus className="w-6 h-6" />
            Registrar Início de Atividade
          </button>
          {activeProcess && (
            <p className="text-center text-amber-700 dark:text-amber-300 mt-2 text-sm">
              Encerre o processo em andamento primeiro
            </p>
          )}
        </div>

        <div className="w-full">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg text-gray-900 dark:text-white">Histórico Recente</h3>
              <button
                onClick={() => navigate('/performance')}
                className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-sm"
              >
                Ver Tudo
              </button>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {completedProcesses.slice(0, 5).map((process) => (
                <div key={process.id} className="bg-white dark:bg-gray-800 rounded-xl shadow p-4 min-h-[104px]">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-gray-900 dark:text-white">{process.type}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{process.documentNumber}</p>
                    </div>
                    <CheckCircle className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
                    <span>{process.client}</span>
                    <span>
                      {process.endDate &&
                        `${differenceInMinutes(process.endDate, process.startDate)} min`}
                    </span>
                  </div>
                </div>
              ))}
              {completedProcesses.length === 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-8 text-center text-gray-400 dark:text-gray-500 lg:col-span-2">
                  Nenhum processo concluído ainda
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
