import { useNavigate } from 'react-router';
import { useApp } from '../context/AppContext';
import { CheckCircle, AlertCircle, Home } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ThemeToggle } from '../components/ThemeToggle';

export default function Confirmacao() {
  const navigate = useNavigate();
  const { activeProcess, user } = useApp();

  if (!activeProcess) {
    navigate('/home');
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-sky-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-8 max-w-2xl w-full">
        <div className="text-center mb-8">
          <div className="bg-blue-100 dark:bg-blue-900/30 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-12 h-12 text-blue-600 dark:text-blue-400" />
          </div>
          <h1 className="text-3xl text-gray-900 dark:text-white mb-2">Apontamento Iniciado com Sucesso!</h1>
          <p className="text-gray-500 dark:text-gray-400">Seu processo foi registrado</p>
        </div>

        <div className="bg-gray-50 dark:bg-gray-700 rounded-2xl p-6 mb-6">
          <h3 className="text-lg text-gray-900 dark:text-white mb-4">Resumo da Operação</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Tipo de Operação</p>
              <p className="text-gray-900 dark:text-white">{activeProcess.type}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Documento</p>
              <p className="text-gray-900 dark:text-white">{activeProcess.documentNumber}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Cliente/Fornecedor</p>
              <p className="text-gray-900 dark:text-white">{activeProcess.client}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Data/Hora Início</p>
              <p className="text-gray-900 dark:text-white">
                {format(activeProcess.startDate, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Volumes</p>
              <p className="text-gray-900 dark:text-white">{activeProcess.volumes}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">SKUs</p>
              <p className="text-gray-900 dark:text-white">{activeProcess.skus}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Status</p>
              <div className="inline-flex items-center gap-2 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 px-3 py-1 rounded-full text-sm">
                <div className="w-2 h-2 bg-orange-500 dark:bg-orange-400 rounded-full animate-pulse" />
                Em andamento
              </div>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Colaborador</p>
              <p className="text-gray-900 dark:text-white">{user?.name}</p>
            </div>
          </div>
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-700 rounded-2xl p-4 mb-6 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-blue-900 dark:text-blue-300 text-sm">
              Sistema bloqueado para novo apontamento. Para iniciar outra atividade, encerre este
              processo primeiro na tela inicial.
            </p>
          </div>
        </div>

        <button
          onClick={() => navigate('/home')}
          className="w-full bg-gradient-to-r from-blue-600 to-sky-500 dark:from-blue-500 dark:to-sky-400 hover:from-blue-700 hover:to-sky-600 dark:hover:from-blue-600 dark:hover:to-sky-500 text-white py-4 rounded-2xl text-lg flex items-center justify-center gap-3 shadow-lg hover:shadow-xl transition-all"
        >
          <Home className="w-6 h-6" />
          Voltar à Tela Inicial
        </button>
      </div>
    </div>
  );
}
