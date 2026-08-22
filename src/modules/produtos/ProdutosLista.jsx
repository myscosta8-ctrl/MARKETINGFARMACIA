import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { usePermissoes } from '../../hooks/usePermissoes';
import { logger } from '../../utils/logger';

const PRODUTO_VAZIO = {
  id: null,
  nome: '',
  categoria: '',
  marca: '',
  descricao: '',
  codigo_interno: '',
  codigo_barras: '',
  preco_venda: '',
  preco_custo: '',
  observacoes: '',
};

export default function ProdutosLista() {
  const { perfil } = useAuth();
  const { pode_ver, pode_editar, carregando: carregandoPermissoes } = usePermissoes('produtos');

  const [produtos, setProdutos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('ativos'); // ativos | inativos | todos
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [modalAberto, setModalAberto] = useState(false);
  const [produtoEditando, setProdutoEditando] = useState(PRODUTO_VAZIO);
  const [produtoVisualizando, setProdutoVisualizando] = useState(null);

  useEffect(() => {
    if (!carregandoPermissoes) carregar();
  }, [carregandoPermissoes]);

  async function carregar() {
    setCarregando(true);
    setErro('');
    const { data, error } = await supabase.from('produtos').select('*').order('nome');
    if (error) {
      logger.error('Falha ao carregar produtos', error);
      setErro('Não foi possível carregar o catálogo. Confira suas permissões.');
    }
    setProdutos(data ?? []);
    setCarregando(false);
  }

  const categorias = useMemo(
    () => [...new Set(produtos.map((p) => p.categoria).filter(Boolean))].sort(),
    [produtos]
  );

  const produtosFiltrados = useMemo(() => {
    return produtos.filter((p) => {
      if (filtroStatus === 'ativos' && !p.ativo) return false;
      if (filtroStatus === 'inativos' && p.ativo) return false;
      if (filtroCategoria && p.categoria !== filtroCategoria) return false;
      if (busca) {
        const alvo = `${p.nome} ${p.marca ?? ''} ${p.codigo_barras ?? ''} ${p.codigo_interno ?? ''}`.toLowerCase();
        if (!alvo.includes(busca.toLowerCase())) return false;
      }
      return true;
    });
  }, [produtos, filtroStatus, filtroCategoria, busca]);

  function abrirNovo() {
    setProdutoEditando({ ...PRODUTO_VAZIO });
    setModalAberto(true);
  }

  function abrirEdicao(p) {
    setProdutoEditando({
      id: p.id,
      nome: p.nome ?? '',
      categoria: p.categoria ?? '',
      marca: p.marca ?? '',
      descricao: p.descricao ?? '',
      codigo_interno: p.codigo_interno ?? '',
      codigo_barras: p.codigo_barras ?? '',
      preco_venda: p.preco_venda ?? '',
      preco_custo: p.preco_custo ?? '',
      observacoes: p.observacoes ?? '',
    });
    setModalAberto(true);
  }

  async function salvar(dados) {
    const payload = {
      nome: dados.nome.trim(),
      categoria: dados.categoria.trim() || null,
      marca: dados.marca.trim() || null,
      descricao: dados.descricao.trim() || null,
      codigo_interno: dados.codigo_interno.trim() || null,
      codigo_barras: dados.codigo_barras.trim() || null,
      preco_venda: dados.preco_venda !== '' ? Number(dados.preco_venda) : null,
      preco_custo: dados.preco_custo !== '' ? Number(dados.preco_custo) : null,
      observacoes: dados.observacoes.trim() || null,
    };

    const { error } = dados.id
      ? await supabase.from('produtos').update(payload).eq('id', dados.id)
      : await supabase.from('produtos').insert({ ...payload, criado_por: perfil?.id ?? null });

    if (error) {
      logger.error('Falha ao salvar produto', error);
      throw error;
    }
    setModalAberto(false);
    await carregar();
  }

  async function alternarAtivo(p) {
    const { error } = await supabase.from('produtos').update({ ativo: !p.ativo }).eq('id', p.id);
    if (error) {
      logger.error('Falha ao alterar status do produto', error);
      return;
    }
    await carregar();
  }

  if (carregandoPermissoes) return <p className="text-ink-500 text-sm">Carregando…</p>;

  if (!pode_ver) {
    return (
      <div className="max-w-2xl">
        <h1 className="font-display text-2xl text-ink-100">Produtos</h1>
        <p className="text-ink-500 text-sm mt-2">
          Você não tem permissão para visualizar o catálogo de produtos. Fale com um administrador.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl text-ink-100">Produtos</h1>
          <p className="text-ink-500 text-sm mt-1">
            Catálogo próprio do sistema de marketing — independente do estoque do LC Sistemas.
          </p>
        </div>
        {pode_editar && (
          <button
            onClick={abrirNovo}
            className="rounded-lg bg-mint-500 hover:bg-mint-600 text-base-950 font-medium px-4 py-2 text-sm transition"
          >
            + Novo produto
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2 mt-6">
        <input
          placeholder="Buscar por nome, marca ou código…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="flex-1 min-w-[200px] rounded-lg bg-base-800 border border-base-700 px-3 py-1.5 text-sm text-ink-100 focus:border-mint-500 outline-none"
        />
        <select
          value={filtroStatus}
          onChange={(e) => setFiltroStatus(e.target.value)}
          className="rounded-lg bg-base-800 border border-base-700 px-2 py-1.5 text-sm text-ink-100"
        >
          <option value="ativos">Ativos</option>
          <option value="inativos">Inativos</option>
          <option value="todos">Todos</option>
        </select>
        <select
          value={filtroCategoria}
          onChange={(e) => setFiltroCategoria(e.target.value)}
          className="rounded-lg bg-base-800 border border-base-700 px-2 py-1.5 text-sm text-ink-100"
        >
          <option value="">Todas as categorias</option>
          {categorias.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {erro && <p className="text-sm text-red-400 mt-4">{erro}</p>}

      {carregando ? (
        <p className="text-ink-500 text-sm mt-6">Carregando…</p>
      ) : produtosFiltrados.length === 0 ? (
        <div className="mt-8 rounded-xl border border-base-800 bg-base-900 p-6 text-center">
          <p className="text-ink-300 text-sm">
            {produtos.length === 0
              ? 'Nenhum produto cadastrado ainda.'
              : 'Nenhum produto encontrado com esses filtros.'}
          </p>
          {pode_editar && produtos.length === 0 && (
            <button onClick={abrirNovo} className="mt-3 text-sm text-mint-400 hover:text-mint-300">
              Cadastrar o primeiro produto
            </button>
          )}
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-base-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-base-900 text-ink-500 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-2.5">Produto</th>
                <th className="text-left px-4 py-2.5 hidden sm:table-cell">Categoria</th>
                <th className="text-left px-4 py-2.5 hidden md:table-cell">Marca</th>
                <th className="text-left px-4 py-2.5 hidden md:table-cell">Preço venda</th>
                <th className="text-left px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-base-800">
              {produtosFiltrados.map((p) => (
                <tr key={p.id} className="hover:bg-base-900/60 transition">
                  <td className="px-4 py-3">
                    <button onClick={() => setProdutoVisualizando(p)} className="text-ink-100 hover:text-mint-400 font-medium text-left">
                      {p.nome}
                    </button>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell text-ink-300">{p.categoria || '—'}</td>
                  <td className="px-4 py-3 hidden md:table-cell text-ink-300">{p.marca || '—'}</td>
                  <td className="px-4 py-3 hidden md:table-cell text-ink-300">
                    {p.preco_venda != null ? `R$ ${Number(p.preco_venda).toFixed(2)}` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${p.ativo ? 'text-mint-400 bg-mint-400/10' : 'text-ink-500 bg-ink-500/10'}`}>
                      {p.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {pode_editar && (
                      <div className="flex justify-end gap-3">
                        <button onClick={() => abrirEdicao(p)} className="text-xs text-ink-400 hover:text-ink-100">
                          Editar
                        </button>
                        <button onClick={() => alternarAtivo(p)} className="text-xs text-ink-400 hover:text-ink-100">
                          {p.ativo ? 'Inativar' : 'Reativar'}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalAberto && (
        <ModalProduto produto={produtoEditando} onFechar={() => setModalAberto(false)} onSalvar={salvar} />
      )}

      {produtoVisualizando && (
        <ModalVisualizacao produto={produtoVisualizando} onFechar={() => setProdutoVisualizando(null)} />
      )}

      <p className="text-xs text-ink-500 mt-6">
        "Produto parado" e giro de vendas ainda não estão disponíveis — dependem de uma fonte real
        de estoque/vendas (LC Sistemas ou outra), que ainda não está integrada neste sprint.
      </p>
    </div>
  );
}

function ModalProduto({ produto, onFechar, onSalvar }) {
  const [dados, setDados] = useState(produto);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  async function enviar(e) {
    e.preventDefault();
    if (!dados.nome.trim()) {
      setErro('Dê um nome ao produto.');
      return;
    }
    setErro('');
    setSalvando(true);
    try {
      await onSalvar(dados);
    } catch {
      setErro('Não foi possível salvar. Confira código de barras duplicado ou permissões.');
    } finally {
      setSalvando(false);
    }
  }

  function set(campo, valor) {
    setDados((d) => ({ ...d, [campo]: valor }));
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50" onClick={onFechar}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-base-900 border border-base-800 rounded-xl p-5 w-full max-w-lg max-h-[90vh] overflow-y-auto"
      >
        <h2 className="font-display text-xl text-ink-100 mb-4">{dados.id ? 'Editar produto' : 'Novo produto'}</h2>
        <form onSubmit={enviar} className="space-y-3">
          <Campo label="Nome *">
            <input value={dados.nome} onChange={(e) => set('nome', e.target.value)} className="campo" autoFocus />
          </Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Categoria">
              <input value={dados.categoria} onChange={(e) => set('categoria', e.target.value)} className="campo" />
            </Campo>
            <Campo label="Marca">
              <input value={dados.marca} onChange={(e) => set('marca', e.target.value)} className="campo" />
            </Campo>
          </div>
          <Campo label="Descrição">
            <textarea value={dados.descricao} onChange={(e) => set('descricao', e.target.value)} className="campo" rows={2} />
          </Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Código interno">
              <input value={dados.codigo_interno} onChange={(e) => set('codigo_interno', e.target.value)} className="campo" />
            </Campo>
            <Campo label="Código de barras">
              <input value={dados.codigo_barras} onChange={(e) => set('codigo_barras', e.target.value)} className="campo" />
            </Campo>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Preço de venda (R$)">
              <input type="number" min="0" step="0.01" value={dados.preco_venda} onChange={(e) => set('preco_venda', e.target.value)} className="campo" />
            </Campo>
            <Campo label="Preço de custo (R$)">
              <input type="number" min="0" step="0.01" value={dados.preco_custo} onChange={(e) => set('preco_custo', e.target.value)} className="campo" />
            </Campo>
          </div>
          {dados.preco_venda !== '' && dados.preco_custo !== '' && !isNaN(Number(dados.preco_venda)) && !isNaN(Number(dados.preco_custo)) && (
            <p className="text-xs text-ink-500">
              Margem estimada: R$ {(Number(dados.preco_venda) - Number(dados.preco_custo)).toFixed(2)}
            </p>
          )}
          <Campo label="Observações">
            <textarea value={dados.observacoes} onChange={(e) => set('observacoes', e.target.value)} className="campo" rows={2} />
          </Campo>

          {erro && <p className="text-sm text-red-400">{erro}</p>}

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={salvando}
              className="rounded-lg bg-mint-500 hover:bg-mint-600 disabled:opacity-60 text-base-950 font-medium px-4 py-2 text-sm transition"
            >
              {salvando ? 'Salvando…' : 'Salvar'}
            </button>
            <button type="button" onClick={onFechar} className="rounded-lg border border-base-700 text-ink-300 hover:text-ink-100 px-4 py-2 text-sm transition">
              Cancelar
            </button>
          </div>
        </form>
        <style>{`.campo { width: 100%; border-radius: 0.5rem; background: #16213a; border: 1px solid #1f2d4d; padding: 0.5rem 0.75rem; color: #eef2f8; outline: none; font-size: 0.875rem; } .campo:focus { border-color: #2fb894; }`}</style>
      </div>
    </div>
  );
}

function ModalVisualizacao({ produto, onFechar }) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50" onClick={onFechar}>
      <div onClick={(e) => e.stopPropagation()} className="bg-base-900 border border-base-800 rounded-xl p-5 w-full max-w-md">
        <h2 className="font-display text-xl text-ink-100">{produto.nome}</h2>
        <div className="mt-3 space-y-1.5 text-sm">
          <Linha rotulo="Categoria" valor={produto.categoria || '—'} />
          <Linha rotulo="Marca" valor={produto.marca || '—'} />
          <Linha rotulo="Código interno" valor={produto.codigo_interno || '—'} />
          <Linha rotulo="Código de barras" valor={produto.codigo_barras || '—'} />
          <Linha rotulo="Preço de venda" valor={produto.preco_venda != null ? `R$ ${Number(produto.preco_venda).toFixed(2)}` : '—'} />
          <Linha rotulo="Preço de custo" valor={produto.preco_custo != null ? `R$ ${Number(produto.preco_custo).toFixed(2)}` : 'sem dado'} />
          <Linha rotulo="Status" valor={produto.ativo ? 'Ativo' : 'Inativo'} />
        </div>
        {produto.descricao && <p className="text-sm text-ink-300 mt-3 whitespace-pre-wrap">{produto.descricao}</p>}
        {produto.observacoes && <p className="text-xs text-ink-500 mt-2 whitespace-pre-wrap">{produto.observacoes}</p>}
        <button onClick={onFechar} className="mt-4 text-sm text-ink-400 hover:text-ink-100">Fechar</button>
      </div>
    </div>
  );
}

function Campo({ label, children }) {
  return (
    <div>
      <label className="block text-sm text-ink-300 mb-1">{label}</label>
      {children}
    </div>
  );
}

function Linha({ rotulo, valor }) {
  return (
    <div className="flex justify-between">
      <span className="text-ink-500">{rotulo}</span>
      <span className="text-ink-200">{valor}</span>
    </div>
  );
}
