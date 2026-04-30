import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import { AppProvider, useApp } from './context/AppContext';
import { ThemeProvider } from './components/ThemeProvider';
import Login from './pages/Login';
import Home from './pages/Home';
import NovaOperacao from './pages/NovaOperacao';
import Confirmacao from './pages/Confirmacao';
import Performance from './pages/Performance';
import SupervisorDocuments from './pages/supervisor/SupervisorDocuments';
import SupervisorHome from './pages/supervisor/SupervisorHome';
import SupervisorLayout from './pages/supervisor/SupervisorLayout';
import SupervisorUserPerformance from './pages/supervisor/SupervisorUserPerformance';
import SupervisorUsers from './pages/supervisor/SupervisorUsers';

function ProtectedRoute({
  children,
  allowedPositions,
}: {
  children: ReactNode;
  allowedPositions?: Array<'SEPARADOR' | 'SUPERVISOR'>;
}) {
  const { user } = useApp();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedPositions && !allowedPositions.includes(user.position)) {
    return <Navigate to={user.position === 'SUPERVISOR' ? '/supervisor' : '/home'} replace />;
  }

  return <>{children}</>;
}

function LoginRoute() {
  const { logout } = useApp();

  useEffect(() => {
    logout();
  }, [logout]);

  return <Login />;
}

export default function App() {
  return (
    <ThemeProvider>
      <AppProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LoginRoute />} />
            <Route path="/login" element={<LoginRoute />} />
            <Route
              path="/home"
              element={
                <ProtectedRoute allowedPositions={['SEPARADOR', 'SUPERVISOR']}>
                  <Home />
                </ProtectedRoute>
              }
            />
            <Route
              path="/nova-operacao"
              element={
                <ProtectedRoute allowedPositions={['SEPARADOR', 'SUPERVISOR']}>
                  <NovaOperacao />
                </ProtectedRoute>
              }
            />
            <Route
              path="/confirmacao"
              element={
                <ProtectedRoute allowedPositions={['SEPARADOR', 'SUPERVISOR']}>
                  <Confirmacao />
                </ProtectedRoute>
              }
            />
            <Route
              path="/performance"
              element={
                <ProtectedRoute allowedPositions={['SEPARADOR', 'SUPERVISOR']}>
                  <Performance />
                </ProtectedRoute>
              }
            />
            <Route
              path="/supervisor"
              element={
                <ProtectedRoute allowedPositions={['SUPERVISOR']}>
                  <SupervisorLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<SupervisorHome />} />
              <Route path="users" element={<SupervisorUsers />} />
              <Route path="users/:id/performance" element={<SupervisorUserPerformance />} />
              <Route path="documents" element={<SupervisorDocuments />} />
            </Route>
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </BrowserRouter>
      </AppProvider>
    </ThemeProvider>
  );
}
