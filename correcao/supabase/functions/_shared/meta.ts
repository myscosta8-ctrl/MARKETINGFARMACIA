// supabase/functions/_shared/meta.ts
//
// Helpers compartilhados pelas 3 Edge Functions de integração Meta
// (webhook, oauth-callback, actions). Nada aqui guarda segredo em código —
// tudo vem de variáveis de ambiente da própria Function (SUPABASE_URL,
// SUPABASE_SERVICE_ROLE_KEY, META_APP_SECRET) ou do Vault via as funções
// SQL vault_gravar_token_integracao/vault_ler_token_integracao.
//
// NÃO TESTADO CONTRA A API REAL DA META — sem credenciais, isto nunca foi
// executado de ponta a ponta. A lógica de assinatura foi validada
// isoladamente (ver RELATORIO_FASE_2_INTEGRACOES.md); o resto segue a
// documentação oficial da Graph API, mas precisa ser testado com uma conta
// de teste real antes de considerar pronto para produção.

import { createClient } from 'jsr:@supabase/supabase-js@2';

export function clienteServiceRole() {
  const url = Deno.env.get('SUPABASE_URL');
  const chave = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !chave) {
    throw new Error('SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY não configurados nesta Function.');
  }
  // service_role bypassa RLS — é por isso que só as Edge Functions podem
  // usar esta chave, nunca o frontend. O isolamento multi-tenant aqui
  // passa a ser responsabilidade EXPLÍCITA de cada query (sempre filtrar
  // por farmacia_id), já que a RLS não está mais filtrando por padrão.
  return createClient(url, chave, { auth: { persistSession: false } });
}

/**
 * Valida a assinatura X-Hub-Signature-256 que a Meta envia em todo
 * webhook. Lógica idêntica à testada isoladamente com Node crypto antes
 * de escrever este arquivo — HMAC-SHA256 do payload bruto (não do JSON
 * re-serializado, que pode ter espaçamento diferente) usando o App Secret.
 */
export async function validarAssinaturaMeta(
  payloadBruto: string,
  headerAssinatura: string | null,
  appSecret: string
): Promise<boolean> {
  if (!headerAssinatura || !headerAssinatura.startsWith('sha256=')) return false;
  const assinaturaRecebida = headerAssinatura.slice('sha256='.length);

  const chave = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(appSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const assinaturaBuffer = await crypto.subtle.sign('HMAC', chave, new TextEncoder().encode(payloadBruto));
  const assinaturaEsperada = Array.from(new Uint8Array(assinaturaBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  if (assinaturaRecebida.length !== assinaturaEsperada.length) return false;
  // Comparação em tempo constante — evita timing attack.
  let diff = 0;
  for (let i = 0; i < assinaturaRecebida.length; i++) {
    diff |= assinaturaRecebida.charCodeAt(i) ^ assinaturaEsperada.charCodeAt(i);
  }
  return diff === 0;
}

export const GRAPH_API_VERSION = 'v21.0';
export const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

/**
 * Assina um payload de `state` do OAuth com HMAC-SHA256, usando um
 * segredo que só existe no servidor (env var OAUTH_STATE_SECRET) — nunca
 * no frontend. Corrige a falha de segurança encontrada em revisão externa
 * antes de produção: o `state` anterior era só base64 (legível E
 * reescrevível por qualquer pessoa, já que client_id/redirect_uri já são
 * públicos), permitindo que um usuário autenticado forjasse o farmacia_id
 * de OUTRA farmácia dentro do state e sequestrasse a conexão dela. Agora
 * o farmacia_id nunca é escolhido pelo cliente — é derivado do JWT
 * autenticado no momento de gerar o state (ver meta-actions,
 * tipo=iniciar_conexao_oauth), e qualquer adulteração do payload invalida
 * a assinatura.
 */
export async function assinarState(payload: Record<string, unknown>, secret: string): Promise<string> {
  const corpo = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const assinatura = await hmacBase64Url(corpo, secret);
  return `${corpo}.${assinatura}`;
}

/** Verifica assinatura e expiração. Retorna o payload só se válido; null caso contrário. */
export async function verificarState(stateAssinado: string, secret: string): Promise<Record<string, any> | null> {
  const partes = stateAssinado.split('.');
  if (partes.length !== 2) return null;
  const [corpo, assinaturaRecebida] = partes;

  const assinaturaEsperada = await hmacBase64Url(corpo, secret);
  if (assinaturaRecebida.length !== assinaturaEsperada.length) return null;
  let diff = 0;
  for (let i = 0; i < assinaturaRecebida.length; i++) {
    diff |= assinaturaRecebida.charCodeAt(i) ^ assinaturaEsperada.charCodeAt(i);
  }
  if (diff !== 0) return null;

  try {
    const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(corpo)));
    if (payload.expira_em && Date.now() > payload.expira_em) return null;
    return payload;
  } catch {
    return null;
  }
}

async function hmacBase64Url(texto: string, secret: string): Promise<string> {
  const chave = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const buffer = await crypto.subtle.sign('HMAC', chave, new TextEncoder().encode(texto));
  return base64UrlEncode(new Uint8Array(buffer));
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binario = '';
  for (const b of bytes) binario += String.fromCharCode(b);
  return btoa(binario).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(texto: string): Uint8Array {
  const normal = texto.replace(/-/g, '+').replace(/_/g, '/');
  const binario = atob(normal.padEnd(normal.length + ((4 - (normal.length % 4)) % 4), '='));
  return Uint8Array.from(binario, (c) => c.charCodeAt(0));
}

/** Resposta padronizada de erro — nunca finge sucesso quando a Meta não confirmou. */
export function respostaErro(mensagem: string, status = 400) {
  return new Response(JSON.stringify({ erro: mensagem }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function respostaOk(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
