export const USER_STORAGE_KEY = 'qlog_user';

export interface ApiUser {
  id: string;
  name: string;
  username: string;
  matricula?: string;
  position: 'SEPARADOR' | 'SUPERVISOR';
  is_active: boolean;
  created_at?: string;
}

export interface ApiDocument {
  id: string;
  origin: string;
  document_number: string;
  series: string;
  type: string;
  operation: string;
  partner_name: string;
  partner_code: string;
  partner_store: string;
  document_date: string;
  volumes: number;
  skus: number;
  gross_weight: number;
  net_weight: number;
  status: string;
  current_user_id: string | null;
  current_user_name: string | null;
  current_username: string | null;
  started_at: string | null;
  finished_at: string | null;
  last_sync_at: string | null;
  created_at: string | null;
  time_spent_minutes: number | null;
}

export function getStoredUser(): ApiUser | null {
  const rawUser = localStorage.getItem(USER_STORAGE_KEY);
  if (!rawUser) return null;

  try {
    return JSON.parse(rawUser) as ApiUser;
  } catch {
    localStorage.removeItem(USER_STORAGE_KEY);
    return null;
  }
}

export function setStoredUser(user: ApiUser) {
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
}

export function clearStoredUser() {
  localStorage.removeItem(USER_STORAGE_KEY);
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  const storedUser = getStoredUser();

  if (storedUser?.id) {
    headers.set('x-user-id', storedUser.id);
  }

  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(path, {
    ...options,
    headers,
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || 'Erro ao comunicar com a API.');
  }

  return data as T;
}
