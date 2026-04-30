import { createContext, ReactNode, useCallback, useContext, useState } from 'react';
import {
  ApiUser,
  apiRequest,
  clearStoredUser,
  getStoredUser,
  setStoredUser,
} from '../services/api';

export interface User extends ApiUser {}

export interface Process {
  id: string;
  type: 'Descarga' | 'Conferência' | 'Armazenagem' | 'Separação' | 'Expedição';
  documentNumber: string;
  documentType: 'NF Entrada' | 'Pedido Venda';
  client: string;
  startDate: Date;
  endDate?: Date;
  status: 'Em andamento' | 'Concluído' | 'Cancelado';
  volumes: number;
  skus: number;
  userId: string;
}

interface AppContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<User | null>;
  logout: () => void;
  processes: Process[];
  activeProcess: Process | null;
  refreshProcesses: () => Promise<void>;
  startProcess: (documentId: string) => Promise<Process | null>;
  endProcess: (processId: string) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => getStoredUser());
  const [processes, setProcesses] = useState<Process[]>([]);

  const login = async (username: string, password: string): Promise<User | null> => {
    const data = await apiRequest<{ user: User }>('/api/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });

    setUser(data.user);
    setStoredUser(data.user);
    return data.user;
  };

  const logout = useCallback(() => {
    setUser(null);
    setProcesses([]);
    clearStoredUser();
  }, []);

  const mapProcess = (process: Process): Process => ({
    ...process,
    startDate: new Date(process.startDate),
    endDate: process.endDate ? new Date(process.endDate) : undefined,
  });

  const refreshProcesses = useCallback(async () => {
    if (!user) return;

    const data = await apiRequest<{ processes: Process[] }>('/api/operator/processes');
    setProcesses(data.processes.map(mapProcess));
  }, [user]);

  const startProcess = async (documentId: string): Promise<Process | null> => {
    const data = await apiRequest<{ process: Process | null }>(
      `/api/operator/documents/${documentId}/start`,
      {
        method: 'POST',
      }
    );

    await refreshProcesses();
    return data.process ? mapProcess(data.process) : null;
  };

  const endProcess = async (processId: string) => {
    await apiRequest(`/api/operator/documents/${processId}/end`, {
      method: 'POST',
    });
    await refreshProcesses();
  };

  const activeProcess = processes.find((p) => p.status === 'Em andamento') || null;

  return (
    <AppContext.Provider
      value={{
        user,
        login,
        logout,
        processes,
        activeProcess,
        refreshProcesses,
        startProcess,
        endProcess,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
}
