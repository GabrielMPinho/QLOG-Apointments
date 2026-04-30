import { BarChart3, Edit3, Plus, Trash2, UserCog } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { ApiUser, apiRequest } from '../../services/api';
import { formatDateTime } from './format';

type ModalMode = 'create' | 'name' | 'position' | null;

export default function SupervisorUsers() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<ApiUser | null>(null);
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('123456');
  const [position, setPosition] = useState<'SEPARADOR' | 'SUPERVISOR'>('SEPARADOR');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const loadUsers = async () => {
    const data = await apiRequest<{ users: ApiUser[] }>('/api/supervisor/users');
    setUsers(data.users);
  };

  useEffect(() => {
    loadUsers().catch((error) => setError(error.message));
  }, []);

  const openCreate = () => {
    setSelectedUser(null);
    setName('');
    setUsername('');
    setPassword('123456');
    setPosition('SEPARADOR');
    setError('');
    setModalMode('create');
  };

  const openNameEdit = (user: ApiUser) => {
    setSelectedUser(user);
    setName(user.name);
    setError('');
    setModalMode('name');
  };

  const openPositionEdit = (user: ApiUser) => {
    setSelectedUser(user);
    setPosition(user.position);
    setError('');
    setModalMode('position');
  };

  const closeModal = () => {
    setModalMode(null);
    setSelectedUser(null);
    setError('');
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      if (modalMode === 'create') {
        await apiRequest('/api/supervisor/users', {
          method: 'POST',
          body: JSON.stringify({ name, username, password, position }),
        });
      }

      if (modalMode === 'name' && selectedUser) {
        await apiRequest(`/api/supervisor/users/${selectedUser.id}/name`, {
          method: 'PUT',
          body: JSON.stringify({ name }),
        });
      }

      if (modalMode === 'position' && selectedUser) {
        await apiRequest(`/api/supervisor/users/${selectedUser.id}/position`, {
          method: 'PUT',
          body: JSON.stringify({ position }),
        });
      }

      await loadUsers();
      closeModal();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Nao foi possivel salvar.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (user: ApiUser) => {
    const confirmed = window.confirm(`Inativar o usuario ${user.name}?`);
    if (!confirmed) return;

    try {
      await apiRequest(`/api/supervisor/users/${user.id}`, {
        method: 'DELETE',
      });
      await loadUsers();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Nao foi possivel inativar.');
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      <main>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-xl text-slate-900 dark:text-white">Usuarios cadastrados</h2>
            <p className="text-slate-500 dark:text-slate-400">
              Supervisores e separadores autorizados no sistema.
            </p>
          </div>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-xl transition-colors"
          >
            <Plus className="w-5 h-5" />
            Criar usuario
          </button>
        </div>

        {error && !modalMode && (
          <div className="bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-200 border border-red-200 dark:border-red-500/30 rounded-xl px-4 py-3 mb-4">
            {error}
          </div>
        )}

        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px]">
              <thead className="bg-slate-100 dark:bg-slate-900/60">
                <tr>
                  <th className="text-left px-4 py-3 text-sm text-slate-600 dark:text-slate-300">Nome</th>
                  <th className="text-left px-4 py-3 text-sm text-slate-600 dark:text-slate-300">Username</th>
                  <th className="text-left px-4 py-3 text-sm text-slate-600 dark:text-slate-300">Cargo</th>
                  <th className="text-left px-4 py-3 text-sm text-slate-600 dark:text-slate-300">Ativo/Inativo</th>
                  <th className="text-left px-4 py-3 text-sm text-slate-600 dark:text-slate-300">Data de criacao</th>
                  <th className="text-left px-4 py-3 text-sm text-slate-600 dark:text-slate-300">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-t border-slate-100 dark:border-slate-700">
                    <td className="px-4 py-3 text-slate-900 dark:text-slate-100">{user.name}</td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{user.username}</td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{user.position}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-3 py-1 rounded-full text-sm ${
                          user.is_active
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200'
                            : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {user.is_active ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                      {formatDateTime(user.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => openNameEdit(user)}
                          className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-100 text-sm"
                        >
                          <Edit3 className="w-4 h-4" />
                          Editar nome
                        </button>
                        <button
                          onClick={() => openPositionEdit(user)}
                          className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-100 text-sm"
                        >
                          <UserCog className="w-4 h-4" />
                          Editar cargo
                        </button>
                        <button
                          onClick={() => handleDelete(user)}
                          className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 dark:bg-red-500/20 dark:hover:bg-red-500/30 dark:text-red-200 text-sm"
                        >
                          <Trash2 className="w-4 h-4" />
                          Excluir
                        </button>
                        {user.position === 'SEPARADOR' && (
                          <button
                            onClick={() => navigate(`/supervisor/users/${user.id}/performance`)}
                            className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:hover:bg-blue-500/30 dark:text-blue-200 text-sm"
                          >
                            <BarChart3 className="w-4 h-4" />
                            Dados
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {modalMode && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <form
            onSubmit={handleSubmit}
            className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-6 w-full max-w-md border border-slate-200 dark:border-slate-700"
          >
            <h3 className="text-lg text-slate-900 dark:text-white mb-4">
              {modalMode === 'create' && 'Criar usuario'}
              {modalMode === 'name' && 'Editar nome'}
              {modalMode === 'position' && 'Editar cargo'}
            </h3>

            {error && (
              <div className="bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-200 border border-red-200 dark:border-red-500/30 rounded-xl px-4 py-3 mb-4">
                {error}
              </div>
            )}

            {(modalMode === 'create' || modalMode === 'name') && (
              <label className="block mb-4">
                <span className="block text-sm text-slate-600 dark:text-slate-300 mb-2">Nome</span>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                  required
                />
              </label>
            )}

            {modalMode === 'create' && (
              <>
                <label className="block mb-4">
                  <span className="block text-sm text-slate-600 dark:text-slate-300 mb-2">Username</span>
                  <input
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                    required
                  />
                </label>
                <label className="block mb-4">
                  <span className="block text-sm text-slate-600 dark:text-slate-300 mb-2">Senha</span>
                  <input
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                    required
                  />
                </label>
              </>
            )}

            {(modalMode === 'create' || modalMode === 'position') && (
              <label className="block mb-5">
                <span className="block text-sm text-slate-600 dark:text-slate-300 mb-2">Cargo</span>
                <select
                  value={position}
                  onChange={(event) => setPosition(event.target.value as 'SEPARADOR' | 'SUPERVISOR')}
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                >
                  <option value="SEPARADOR">SEPARADOR</option>
                  <option value="SUPERVISOR">SUPERVISOR</option>
                </select>
              </label>
            )}

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={closeModal}
                className="px-4 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-100"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white"
              >
                Salvar
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
