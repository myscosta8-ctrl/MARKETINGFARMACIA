import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Entrar() {
  const { entrar } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  const destino = location.state?.from?.pathname || '/';

  async function aoEnviar(e) {
    e.preventDefault();
    setErro('');
    setCarregando(true);
    try {
      await entrar(email, senha);
      navigate(destino, { replace: true });
    } catch (err) {
      setErro('E-mail ou senha incorretos.');
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-base-950 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-mint-500 text-base-950 font-display font-semibold mb-3">
            F
          </div>
          <h1 className="font-display text-2xl text-ink-100">Farma Marketing</h1>
          <p className="text-ink-500 text-sm mt-1">Entre com sua conta da farmácia</p>
        </div>

        <form onSubmit={aoEnviar} className="space-y-4 bg-base-900 border border-base-700 rounded-xl p-6">
          <div>
            <label htmlFor="email" className="block text-sm text-ink-300 mb-1">
              E-mail
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg bg-base-800 border border-base-700 px-3 py-2 text-ink-100 focus:border-mint-500 outline-none"
              autoComplete="email"
            />
          </div>
          <div>
            <label htmlFor="senha" className="block text-sm text-ink-300 mb-1">
              Senha
            </label>
            <input
              id="senha"
              type="password"
              required
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className="w-full rounded-lg bg-base-800 border border-base-700 px-3 py-2 text-ink-100 focus:border-mint-500 outline-none"
              autoComplete="current-password"
            />
          </div>

          {erro && (
            <p role="alert" className="text-sm text-red-400">
              {erro}
            </p>
          )}

          <button
            type="submit"
            disabled={carregando}
            className="w-full rounded-lg bg-mint-500 hover:bg-mint-600 disabled:opacity-60 text-base-950 font-medium py-2 transition"
          >
            {carregando ? 'Entrando…' : 'Entrar'}
          </button>
        </form>

        <p className="text-center text-xs text-ink-500 mt-6">
          Contas são criadas por um administrador em Configurações → Usuários.
        </p>
      </div>
    </div>
  );
}
