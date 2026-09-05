// supabase/functions/meta-oauth-callback/index.ts
//
// Recebe o callback do fluxo "Login com Facebook para Empresas" depois
// que o admin autoriza o app no popup da Meta. Troca o código por um
// token de curta duração, troca esse token por um de longa duração, e
// grava no Vault (nunca em uma coluna normal).
//
// Fluxo completo (Fase 8):
//  1. Frontend abre popup para
//     https://www.facebook.com/{GRAPH_API_VERSION}/dialog/oauth?client_id=...&redirect_uri=<esta-function>&state=<farmacia_id assinado>
//  2. Meta redireciona de volta para esta Function com ?code=...&state=...
//  3. Esta Function troca o code por um token de curta duração
//  4. Troca o token de curta duração por um de longa duração (~60 dias)
//  5. Descobre as Páginas/contas Instagram vinculadas ao usuário que autorizou
//  6. Grava o token no Vault, associado à farmacia_id do state
//  7. Redireciona de volta para o app com sucesso/erro
//
// NÃO TESTADO CONTRA A META REAL.

import { clienteServiceRole, GRAPH_API_BASE, respostaErro } from '../_shared/meta.ts';

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
  try {
    // O state precisa ser assinado (JWT curto ou HMAC) quando o popup é
    // aberto, para impedir que alguém troque o farmacia_id manualmente na
    // URL de callback. Placeholder aqui — implementar junto com o botão
    // "Conectar" no frontend (Fase 8), que ainda não existe.
    const decodificado = JSON.parse(atob(state));
    farmaciaId = decodificado.farmacia_id;
    provedor = decodificado.provedor;
  } catch {
    return respostaErro('state inválido ou adulterado.', 400);
  }

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
