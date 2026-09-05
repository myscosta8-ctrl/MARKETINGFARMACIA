// supabase/functions/meta-oauth-callback/index.ts
//
// Recebe o callback do fluxo "Login com Facebook para Empresas" depois
// que o admin autoriza o app no popup da Meta. Troca o código por um
// token de curta duração, troca esse token por um de longa duração, e
// grava no Vault (nunca em uma coluna normal).
//
// Fluxo completo (Fase 8):
//  1. Frontend chama meta-actions (tipo=iniciar_conexao_oauth), que deriva
//     farmacia_id do JWT do admin autenticado e devolve um `state`
//     assinado (HMAC, nunca escolhido pelo cliente)
//  2. Frontend abre popup para
//     https://www.facebook.com/{GRAPH_API_VERSION}/dialog/oauth?client_id=...&redirect_uri=<esta-function>&state=<state assinado>
//  3. Meta redireciona de volta para esta Function com ?code=...&state=...
//  4. Esta Function VERIFICA a assinatura do state (rejeita se adulterado
//     ou expirado) e só então confia no farmacia_id contido nele
//  5. Troca o code por um token de curta duração
//  6. Troca o token de curta duração por um de longa duração (~60 dias)
//  7. Grava o token no Vault, associado à farmacia_id do state verificado
//  8. Redireciona de volta para o app com sucesso/erro
//
// NÃO TESTADO CONTRA A META REAL.

import { clienteServiceRole, GRAPH_API_BASE, respostaErro, verificarState } from '../_shared/meta.ts';

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const erroOAuth = url.searchParams.get('error');

  const appUrlBase = Deno.env.get('APP_URL_BASE') ?? 'https://SEU-DOMINIO-AQUI';

  if (erroOAuth) {
    return Response.redirect(`${appUrlBase}/configuracoes?integracao_erro=${encodeURIComponent(erroOAuth)}`, 302);
  }
  if (!code || !state) {
    return respostaErro('Parâmetros code/state ausentes no callback OAuth.', 400);
  }

  let farmaciaId: string;
  let provedor: string;

  const stateSecret = Deno.env.get('OAUTH_STATE_SECRET');
  if (!stateSecret) return respostaErro('OAUTH_STATE_SECRET não configurado nesta Function.', 500);

  // Verifica a assinatura HMAC do state — nunca decodifica cegamente.
  // Corrige a falha encontrada em revisão antes de produção: o state
  // anterior era só base64, reescrevível por qualquer pessoa autenticada
  // para forjar o farmacia_id de outra farmácia. Agora, qualquer
  // adulteração invalida a assinatura e o callback rejeita.
  const payload = await verificarState(state, stateSecret);
  if (!payload) {
    return respostaErro('state inválido, expirado ou adulterado.', 400);
  }
  farmaciaId = payload.farmacia_id;
  provedor = payload.provedor;

  const appId = Deno.env.get('META_APP_ID');
  const appSecret = Deno.env.get('META_APP_SECRET');
  const redirectUri = Deno.env.get('META_OAUTH_REDIRECT_URI');
  if (!appId || !appSecret || !redirectUri) {
    return respostaErro('META_APP_ID/META_APP_SECRET/META_OAUTH_REDIRECT_URI não configurados.', 500);
  }

  const trocaCurta = await fetch(
    `${GRAPH_API_BASE}/oauth/access_token?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${appSecret}&code=${code}`
  );
  const dadosCurta = await trocaCurta.json();
  if (!trocaCurta.ok || !dadosCurta.access_token) {
    return respostaErro(`Falha ao trocar código por token: ${JSON.stringify(dadosCurta)}`, 502);
  }

  const trocaLonga = await fetch(
    `${GRAPH_API_BASE}/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${dadosCurta.access_token}`
  );
  const dadosLonga = await trocaLonga.json();
  if (!trocaLonga.ok || !dadosLonga.access_token) {
    return respostaErro(`Falha ao trocar por token de longa duração: ${JSON.stringify(dadosLonga)}`, 502);
  }

  const tokenLongo = dadosLonga.access_token as string;
  const expiraEmSegundos = dadosLonga.expires_in as number | undefined;

  const supabase = clienteServiceRole();

  const { data: integracao, error: erroUpsert } = await supabase
    .from('integracoes')
    .upsert(
      {
        farmacia_id: farmaciaId,
        provedor,
        status: 'configurado',
        token_expira_em: expiraEmSegundos ? new Date(Date.now() + expiraEmSegundos * 1000).toISOString() : null,
      },
      { onConflict: 'farmacia_id,provedor' }
    )
    .select('id')
    .single();

  if (erroUpsert || !integracao) {
    return respostaErro(`Falha ao registrar integração: ${erroUpsert?.message}`, 500);
  }

  const { error: erroVault } = await supabase.rpc('vault_gravar_token_integracao', {
    p_integracao_id: integracao.id,
    p_token: tokenLongo,
    p_nome_secret: `${provedor}-${farmaciaId}`,
  });
  if (erroVault) {
    return respostaErro(`Falha ao gravar token no Vault: ${erroVault.message}`, 500);
  }

  await supabase.from('integracoes').update({ status: 'conectado' }).eq('id', integracao.id);

  return Response.redirect(`${appUrlBase}/configuracoes?integracao=${provedor}&sucesso=1`, 302);
});
