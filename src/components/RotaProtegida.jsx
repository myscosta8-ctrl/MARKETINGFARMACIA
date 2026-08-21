import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export function RotaProtegida({ children }) {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base-950 text-ink-300">
        Carregando…
      </div>
    );
  }

  if (!session) return <Navigate to="/entrar" replace />;

  return children;
}
