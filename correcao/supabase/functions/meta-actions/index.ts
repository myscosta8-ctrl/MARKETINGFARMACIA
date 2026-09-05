// supabase/functions/meta-actions/index.ts
//
// Único endpoint autenticado que o frontend chama para pedir uma ação
// real: enviar mensagem de WhatsApp, publicar no Instagram, publicar no
// Facebook. O token de acesso NUNCA passa pelo navegador — só esta
// Function o lê (via vault_ler_token_integracao, restrita a service_role)
// e o usa para chamar a Graph API.
//
// Decisão importante de design: a ESCRITA do resultado em
// whatsapp_mensagens/instagram_publicacoes/facebook_publicacoes é feita
// com o cliente Supabase DO PRÓPRIO USUÁRIO que chamou (repassando o JWT
// dele), não com service_role — assim as triggers de identidade, máquina
// de estados e auditoria de cada tabela (já existentes desde os Sprints
// 10-12) continuam valendo exatamente como valem hoje, sem duplicar essa
// lógica aqui. service_role é usado só para a leitura do token no Vault,
// que exige esse privilégio por design.
//
// NÃO TESTADO CONTRA A META REAL.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { clienteServiceRole, GRAPH_API_BASE, respostaErro, respostaOk, assinarState } from '../_shared/meta.ts';

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return respostaErro('Método não suportado.', 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return respostaErro('Não autenticado.', 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  // Cliente "como o usuário" — RLS e triggers de identidade se aplicam
  // normalmente, exatamente como se o próprio frontend tivesse chamado.
  const clienteUsuario = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });

  const { data: userData, error: erroUser } = await clienteUsuario.auth.getUser();
  if (erroUser || !userData?.user) return respostaErro('Sessão inválida.', 401);

  let corpo: any;
  try {
    corpo = await req.json();
  } catch {
    return respostaErro('Corpo da requisição inválido.', 400);
  }

  const { tipo } = corpo;

  try {
    if (tipo === 'iniciar_conexao_oauth') {
      return await iniciarConexaoOAuth(clienteUsuario, corpo);
    }
    if (tipo === 'enviar_whatsapp') {
      return await enviarWhatsApp(clienteUsuario, corpo);
    }
    if (tipo === 'publicar_instagram') {
      return await publicar(clienteUsuario, corpo, 'instagram_publicacoes', 'instagram');
    }
    if (tipo === 'publicar_facebook') {
      return await publicar(clienteUsuario, corpo, 'facebook_publicacoes', 'facebook');
    }
    return respostaErro(`Tipo de ação desconhecido: ${tipo}`, 400);
  } catch (e) {
    console.error('Erro em meta-actions', e);
    return respostaErro('Erro interno ao processar a ação.', 500);
  }
});

/** Busca a integração + token da farmácia do usuário autenticado (via RLS normal, sem vazar cross-tenant). */
async function obterIntegracaoETokenDoUsuario(clienteUsuario: ReturnType<typeof createClient>, provedor: string) {
  const { data: integracao, error } = await clienteUsuario
    .from('integracoes')
    .select('id, status, conta_externa_id, token_expira_em')
    .eq('provedor', provedor)
    .maybeSingle();

  if (error || !integracao) return { integracao: null, token: null, motivo: 'Integração não configurada.' };
  if (integracao.status !== 'conectado') return { integracao, token: null, motivo: 'Integração não está conectada.' };
  if (integracao.token_expira_em && new Date(integracao.token_expira_em) < new Date()) {
    return { integracao, token: null, motivo: 'Token expirado — reconexão necessária.' };
  }

  // A leitura do Vault exige service_role — só esta parte usa esse cliente,
  // e só depois de confirmar (via RLS normal, acima) que este usuário
  // realmente pode ver essa integração.
  const svc = clienteServiceRole();
  const { data: token, error: erroToken } = await svc.rpc('vault_ler_token_integracao', {
    p_integracao_id: integracao.id,
  });
  if (erroToken || !token) return { integracao, token: null, motivo: 'Falha ao ler credencial.' };

  return { integracao, token, motivo: null };
}

/**
 * Gera o `state` assinado do OAuth. farmacia_id NUNCA vem do corpo da
 * requisição — é derivado do JWT autenticado, buscando a farmácia real do
 * usuário em `usuarios` (que já é protegida por RLS/FK desde o Sprint 1).
 * Só admin pode iniciar conexão (mesma exigência de `integracoes_write`).
 */
async function iniciarConexaoOAuth(clienteUsuario: ReturnType<typeof createClient>, corpo: any) {
  const { provedor } = corpo;
  if (!['whatsapp', 'instagram', 'facebook'].includes(provedor)) {
    return respostaErro('provedor inválido.', 400);
  }

  const { data: userData } = await clienteUsuario.auth.getUser();
  const { data: usuario, error: erroUsuario } = await clienteUsuario
    .from('usuarios')
    .select('farmacia_id, papel')
    .eq('id', userData!.user!.id)
    .single();

  if (erroUsuario || !usuario) return respostaErro('Usuário não encontrado.', 403);
  if (usuario.papel !== 'admin') return respostaErro('Somente administradores podem conectar integrações.', 403);

  const stateSecret = Deno.env.get('OAUTH_STATE_SECRET');
  if (!stateSecret) return respostaErro('OAUTH_STATE_SECRET não configurado nesta Function.', 500);

  const state = await assinarState(
    {
      farmacia_id: usuario.farmacia_id, // derivado do JWT, nunca do corpo da requisição
      provedor,
      expira_em: Date.now() + 5 * 60 * 1000, // 5 minutos para completar o fluxo no popup
    },
    stateSecret
  );

  return respostaOk({ state });
}

async function enviarWhatsApp(clienteUsuario: ReturnType<typeof createClient>, corpo: any) {
  const { mensagemId } = corpo; // id da linha já criada em whatsapp_mensagens (status='pendente')
  if (!mensagemId) return respostaErro('mensagemId é obrigatório.', 400);

  const { data: mensagem } = await clienteUsuario
    .from('whatsapp_mensagens')
    .select('id, telefone_destino, conteudo, status')
    .eq('id', mensagemId)
    .maybeSingle();
  if (!mensagem) return respostaErro('Mensagem não encontrada (ou não pertence à sua farmácia).', 404);

  const { token, integracao, motivo } = await obterIntegracaoETokenDoUsuario(clienteUsuario, 'whatsapp');
  if (!token) {
    await clienteUsuario
      .from('whatsapp_mensagens')
      .update({ status: 'indisponivel', erro_mensagem: motivo ?? 'Integração indisponível.' })
      .eq('id', mensagemId);
    return respostaOk({ enviado: false, motivo });
  }

  const resposta = await fetch(`${GRAPH_API_BASE}/${integracao!.conta_externa_id}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: mensagem.telefone_destino,
      type: 'text',
      text: { body: mensagem.conteudo },
    }),
  });
  const dados = await resposta.json();

  if (!resposta.ok) {
    await clienteUsuario
      .from('whatsapp_mensagens')
      .update({ status: 'erro', erro_mensagem: JSON.stringify(dados).slice(0, 500) })
      .eq('id', mensagemId);
    return respostaOk({ enviado: false, erro: dados });
  }

  const idExterno = dados.messages?.[0]?.id ?? null;
  await clienteUsuario
    .from('whatsapp_mensagens')
    .update({ status: 'enviada', id_externo: idExterno })
    .eq('id', mensagemId);

  return respostaOk({ enviado: true, id_externo: idExterno });
}

async function publicar(
  clienteUsuario: ReturnType<typeof createClient>,
  corpo: any,
  tabela: 'instagram_publicacoes' | 'facebook_publicacoes',
  provedor: 'instagram' | 'facebook'
) {
  const { publicacaoId } = corpo;
  if (!publicacaoId) return respostaErro('publicacaoId é obrigatório.', 400);

  const { data: publicacao } = await clienteUsuario
    .from(tabela)
    .select('id, conteudo_id, status, conteudos(texto_copy, conteudo_midias(url))')
    .eq('id', publicacaoId)
    .maybeSingle();
  if (!publicacao) return respostaErro('Publicação não encontrada (ou não pertence à sua farmácia).', 404);

  const { token, integracao, motivo } = await obterIntegracaoETokenDoUsuario(clienteUsuario, provedor);
  if (!token) {
    await clienteUsuario.from(tabela).update({ status: 'indisponivel', erro_mensagem: motivo ?? 'Integração indisponível.' }).eq('id', publicacaoId);
    return respostaOk({ publicado: false, motivo });
  }

  // Publicação real de imagem/texto via Graph API — simplificado: assume
  // uma mídia de imagem (o fluxo de vídeo/carrossel/reels tem endpoints
  // próprios, fora do escopo desta primeira versão).
  const conteudo = (publicacao as any).conteudos;
  const urlMidia = conteudo?.conteudo_midias?.[0]?.url;
  if (!urlMidia) {
    await clienteUsuario.from(tabela).update({ status: 'erro', erro_mensagem: 'Conteúdo sem mídia associada.' }).eq('id', publicacaoId);
    return respostaOk({ publicado: false, motivo: 'Conteúdo sem mídia associada.' });
  }

  const respostaContainer = await fetch(`${GRAPH_API_BASE}/${integracao!.conta_externa_id}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ image_url: urlMidia, caption: conteudo?.texto_copy ?? '' }),
  });
  const dadosContainer = await respostaContainer.json();
  if (!respostaContainer.ok || !dadosContainer.id) {
    await clienteUsuario.from(tabela).update({ status: 'erro', erro_mensagem: JSON.stringify(dadosContainer).slice(0, 500) }).eq('id', publicacaoId);
    return respostaOk({ publicado: false, erro: dadosContainer });
  }

  const respostaPublicar = await fetch(`${GRAPH_API_BASE}/${integracao!.conta_externa_id}/media_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ creation_id: dadosContainer.id }),
  });
  const dadosPublicar = await respostaPublicar.json();
  if (!respostaPublicar.ok || !dadosPublicar.id) {
    await clienteUsuario.from(tabela).update({ status: 'erro', erro_mensagem: JSON.stringify(dadosPublicar).slice(0, 500) }).eq('id', publicacaoId);
    return respostaOk({ publicado: false, erro: dadosPublicar });
  }

  await clienteUsuario
    .from(tabela)
    .update({ status: 'publicada', id_externo: dadosPublicar.id, link_publicado: `https://www.instagram.com/p/${dadosPublicar.id}` })
    .eq('id', publicacaoId);

  return respostaOk({ publicado: true, id_externo: dadosPublicar.id });
}
