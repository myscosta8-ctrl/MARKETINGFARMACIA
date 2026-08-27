import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useModulos } from '../hooks/useModulos';
import { SinoNotificacoes } from './SinoNotificacoes';

const ROTA_POR_MODULO = {
  dashboard: '/',
  configuracoes: '/configuracoes',
  campanhas: '/campanhas',
  produtos: '/produtos',
  calendario: '/calendario',
  conteudo: '/conteudo',
  oportunidades: '/oportunidades',
  ia: '/ia',
  crm: '/crm'
};

export default function Layout() {
  const { perfil, sair } = useAuth();
  const { modulos } = useModulos();

  return (
    <div className="min-h-screen flex bg-base-950">
      <aside className="w-64 shrink-0 border-r border-base-800 flex flex-col">
        <div className="h-16 flex items-center gap-2 px-5 border-b border-base-800">
          <div className="h-7 w-7 rounded-md bg-mint-500 text-base-950 font-display font-semibold flex items-center justify-center text-sm">
            F
          </div>
          <span className="font-display text-ink-100 text-sm tracking-wide">Farma Marketing</span>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {modulos.map((m) => {
            const rota = ROTA_POR_MODULO[m.id];
            const disponivel = m.disponivel && rota;
            if (disponivel) {
              return (
                <NavLink
                  key={m.id}
                  to={rota}
                  end={rota === '/'}
                  className={({ isActive }) =>
                    `flex items-center justify-between px-3 py-2 rounded-lg text-sm transition ${
                      isActive
                        ? 'bg-mint-500/10 text-mint-400 font-medium'
                        : 'text-ink-300 hover:bg-base-800 hover:text-ink-100'
                    }`
                  }
                >
                  {m.nome}
                </NavLink>
              );
            }
            return (
              <div
                key={m.id}
                className="flex items-center justify-between px-3 py-2 rounded-lg text-sm text-ink-500 cursor-default"
                title="No roadmap — ainda não implementado neste sprint"
              >
                <span>{m.nome}</span>
                <span className="text-[10px] uppercase tracking-wide border border-base-700 rounded px-1.5 py-0.5">
                  em breve
                </span>
              </div>
            );
          })}
        </nav>

        <div className="border-t border-base-800 p-3">
          <div className="flex items-center gap-2 px-2 py-1.5">
            <div className="h-8 w-8 rounded-full bg-base-800 flex items-center justify-center text-xs text-ink-300 font-medium">
              {perfil?.nome?.[0]?.toUpperCase() ?? '?'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-ink-100 truncate">{perfil?.nome ?? 'Carregando…'}</p>
              <p className="text-xs text-ink-500 capitalize">{perfil?.papel}</p>
            </div>
          </div>
          <button
            onClick={sair}
            className="mt-1 w-full text-left px-2 py-1.5 rounded-lg text-sm text-ink-500 hover:bg-base-800 hover:text-ink-100 transition"
          >
            Sair
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-base-800 flex items-center justify-end px-6 gap-2">
          <SinoNotificacoes />
        </header>
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
