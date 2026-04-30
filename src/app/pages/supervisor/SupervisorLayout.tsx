import { FileText, LayoutDashboard, LogOut, Users } from 'lucide-react';
import { Outlet, useLocation, useNavigate } from 'react-router';
import { ThemeToggle } from '../../components/ThemeToggle';
import { useApp } from '../../context/AppContext';

export default function SupervisorLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useApp();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const itemClass = (active: boolean) =>
    `w-full inline-flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
      active
        ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/20 dark:text-blue-200'
        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white'
    }`;

  return (
    <div className="h-screen overflow-hidden bg-slate-50 dark:bg-slate-900 flex">
      <aside className="w-72 h-screen bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 flex flex-col shrink-0 overflow-hidden">
        <div className="p-6 border-b border-slate-200 dark:border-slate-700">
          <h1 className="text-2xl text-blue-600 dark:text-blue-400">QLOG</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Painel supervisor</p>
        </div>

        <nav className="p-4 space-y-2 flex-1">
          <button onClick={() => navigate('/supervisor')} className={itemClass(location.pathname === '/supervisor')}>
            <LayoutDashboard className="w-5 h-5" />
            Overview
          </button>
          <button
            onClick={() => navigate('/supervisor/users')}
            className={itemClass(location.pathname.startsWith('/supervisor/users'))}
          >
            <Users className="w-5 h-5" />
            Usuarios
          </button>
          <button
            onClick={() => navigate('/supervisor/documents')}
            className={itemClass(location.pathname.startsWith('/supervisor/documents'))}
          >
            <FileText className="w-5 h-5" />
            Documentos
          </button>
        </nav>

        <div className="p-4 border-t border-slate-200 dark:border-slate-700 space-y-3">
          <div className="bg-slate-50 dark:bg-slate-900/60 rounded-xl p-3">
            <p className="text-sm text-slate-900 dark:text-white">{user?.name}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{user?.position}</p>
          </div>
          <div className="flex items-center justify-between">
            <ThemeToggle />
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
            >
              <LogOut className="w-4 h-4" />
              Sair
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 min-w-0 h-screen px-8 py-8 overflow-y-auto overflow-x-hidden">
        <Outlet />
      </main>
    </div>
  );
}
