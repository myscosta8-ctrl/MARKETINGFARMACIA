import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { logger } from '../utils/logger';
import { registrarAuditoria } from '../utils/auditoria';
import { PainelIntegracoesMeta } from '../components/PainelIntegracoesMeta';

export default function Configuracoes() {
  const { perfil } = useAuth();
  const [farmacia, setFarmacia] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState('');

  useEffect(() => {
    if (!perfil?.farmacia_id) return;
    supabase
      .from('farmacias')
      .select('id, nome, cnpj, telefone')
      .eq('id', perfil.farmacia_id)
      .single()
      .then(({ data, error }) => {
        if (error) logger.error('Falha ao carregar farmácia', error);
        setFarmacia(data);
      });
  }, [perfil?.farmacia_id]);

  async function salvar(e) {
    e.preventDefault();
    setSalvando(true);
    setMensagem('');
    const { error } = await supabase
      .from('farmacias')
      .update({ nome: farmacia.nome, cnpj: farmacia.cnpj, telefone: farmacia.telefone })
      .eq('id', farmacia.id);
    setSalvando(false);
    if (error) {
      logger.error('Falha ao salvar farmácia', error);
      setMensagem('Não foi possível salvar. Tente novamente.');
      return;
    }
    await registrarAuditoria({ acao: 'editar', entidade: 'farmacia', entidadeId: farmacia.id });
    setMensagem('Salvo.');
  }

  if (!farmacia) return <p className="text-ink-500 text-sm">Carregando…</p>;

  const podeEditar = perfil?.papel === 'admin';

  return (
    <div className="max-w-lg">
      <h1 className="font-display text-2xl text-ink-100">Configurações da farmácia</h1>
      <p className="text-ink-500 text-sm mt-1">Dados usados em todo o sistema de marketing.</p>

      <form onSubmit={salvar} className="mt-6 space-y-4 bg-base-900 border border-base-800 rounded-xl p-5">
        <div>
          <label className="block text-sm text-ink-300 mb-1">Nome</label>
          <input
            value={farmacia.nome ?? ''}
            disabled={!podeEditar}
            onChange={(e) => setFarmacia({ ...farmacia, nome: e.target.value })}
            className="w-full rounded-lg bg-base-800 border border-base-700 px-3 py-2 text-ink-100 disabled:opacity-60 focus:border-mint-500 outline-none"
          />
        </div>
        <div>
          <label className="block text-sm text-ink-300 mb-1">CNPJ</label>
          <input
            value={farmacia.cnpj ?? ''}
            disabled={!podeEditar}
            onChange={(e) => setFarmacia({ ...farmacia, cnpj: e.target.value })}
            className="w-full rounded-lg bg-base-800 border border-base-700 px-3 py-2 text-ink-100 disabled:opacity-60 focus:border-mint-500 outline-none"
          />
        </div>
        <div>
          <label className="block text-sm text-ink-300 mb-1">Telefone</label>
          <input
            value={farmacia.telefone ?? ''}
            disabled={!podeEditar}
            onChange={(e) => setFarmacia({ ...farmacia, telefone: e.target.value })}
            className="w-full rounded-lg bg-base-800 border border-base-700 px-3 py-2 text-ink-100 disabled:opacity-60 focus:border-mint-500 outline-none"
          />
        </div>

        {!podeEditar && (
          <p className="text-xs text-ink-500">Somente administradores podem editar estes dados.</p>
        )}
        {mensagem && <p className="text-sm text-mint-400">{mensagem}</p>}

        {podeEditar && (
          <button
            type="submit"
            disabled={salvando}
            className="rounded-lg bg-mint-500 hover:bg-mint-600 disabled:opacity-60 text-base-950 font-medium px-4 py-2 transition"
          >
            {salvando ? 'Salvando…' : 'Salvar alterações'}
          </button>
        )}
      </form>

      <PainelIntegracoesMeta farmaciaId={farmacia.id} podeEditar={podeEditar} />

      <div className="mt-6 rounded-xl border border-base-800 bg-base-900 p-5">
        <h2 className="font-display text-lg text-ink-100 mb-1">Privacidade e LGPD</h2>
        <p className="text-sm text-ink-500">
          A gestão de consentimentos (opt-in/opt-out de comunicação de marketing) fica disponível
          para admin e gestor. A tela dedicada entra no módulo de CRM/Leads.
        </p>
      </div>
    </div>
  );
}
