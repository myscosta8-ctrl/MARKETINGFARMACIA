// supabase/functions/meta-webhook/index.ts
//
// Único ponto de entrada para eventos da Meta (WhatsApp Cloud API,
// Instagram Graph API, Facebook Graph API compartilham o mesmo formato de
// webhook). URL final depois do deploy:
//   https://<project-ref>.supabase.co/functions/v1/meta-webhook
//
// Configurar essa URL no Meta for Developers > seu App > Webhooks, com o
// mesmo "Verify Token" salvo na env var META_WEBHOOK_VERIFY_TOKEN desta
// Function.
//
// NÃO TESTADO CONTRA A META REAL — ver aviso em _shared/meta.ts.

import { clienteServiceRole, validarAssinaturaMeta, respostaErro, respostaOk } from '../_shared/meta.ts';

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);

  // GET: verificação do endpoint (handshake inicial, feito uma vez ao
  // configurar o webhook no painel da Meta).
  if (req.method === 'GET') {
    const modo = url.searchParams.get('hub.mode');
    const tokenRecebido = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');
    const tokenEsperado = Deno.env.get('META_WEBHOOK_VERIFY_TOKEN');

    if (modo === 'subscribe' && tokenEsperado && tokenRecebido === tokenEsperado && challenge) {
      return new Response(challenge, { status: 200 });
    }
    return respostaErro('Verificação de webhook falhou.', 403);
  }

  // POST: evento real (mensagem recebida, status de entrega, etc.)
  if (req.method === 'POST') {
    const appSecret = Deno.env.get('META_APP_SECRET');
    if (!appSecret) return respostaErro('META_APP_SECRET não configurado nesta Function.', 500);

    const payloadBruto = await req.text();
    const assinatura = req.headers.get('X-Hub-Signature-256');

    const valida = await validarAssinaturaMeta(payloadBruto, assinatura, appSecret);
    if (!valida) {
      return respostaErro('Assinatura inválida.', 401);
    }

    let corpo: any;
    try {
      corpo = JSON.parse(payloadBruto);
    } catch {
      return respostaErro('Payload malformado.', 400);
    }

    const supabase = clienteServiceRole();
    const objeto = corpo.object as string | undefined;

    for (const entrada of corpo.entry ?? []) {
      const eventoId = `${entrada.id}:${entrada.time ?? Date.now()}`;
      const provedor = objeto === 'whatsapp_business_account' ? 'whatsapp' : objeto === 'instagram' ? 'instagram' : 'facebook';

      const { error: erroIdempotencia } = await supabase
        .from('webhook_eventos_processados')
        .insert({ provedor, evento_id: eventoId });

      if (erroIdempotencia) {
        if (erroIdempotencia.code === '23505') continue;
        console.error('Erro ao registrar idempotência de webhook', erroIdempotencia);
        continue;
      }

      try {
        if (provedor === 'whatsapp') {
          await processarEventoWhatsApp(supabase, entrada);
        } else if (provedor === 'instagram') {
          await processarEventoInstagramOuFacebook(supabase, entrada, 'instagram_publicacoes');
        } else {
          await processarEventoInstagramOuFacebook(supabase, entrada, 'facebook_publicacoes');
        }
      } catch (e) {
        console.error(`Falha ao processar evento ${eventoId}`, e);
      }
    }

    return respostaOk({ recebido: true });
  }

  return respostaErro('Método não suportado.', 405);
});

async function processarEventoWhatsApp(supabase: ReturnType<typeof clienteServiceRole>, entrada: any) {
  for (const mudanca of entrada.changes ?? []) {
    const valor = mudanca.value;
    const phoneNumberId = valor?.metadata?.phone_number_id;
    if (!phoneNumberId) continue;

    const { data: integracao } = await supabase
      .from('integracoes')
      .select('farmacia_id')
      .eq('provedor', 'whatsapp')
      .eq('conta_externa_id', phoneNumberId)
      .maybeSingle();
    if (!integracao) {
      console.error('Webhook de WhatsApp para phone_number_id sem integração cadastrada:', phoneNumberId);
      continue;
    }
    const farmaciaId = integracao.farmacia_id;

    for (const status of valor.statuses ?? []) {
      await supabase
        .from('whatsapp_mensagens')
        .update({ status: mapearStatusWhatsApp(status.status) })
        .eq('farmacia_id', farmaciaId)
        .eq('id_externo', status.id);
    }

    for (const msg of valor.messages ?? []) {
      const telefone = msg.from as string;
      const texto = msg.text?.body ?? '(mensagem sem texto — tipo não suportado ainda)';

      let leadId: string | null = null;
      let contatoId: string | null = null;

      const { data: leadExistente } = await supabase
        .from('leads')
        .select('id')
        .eq('farmacia_id', farmaciaId)
        .or(`telefone.eq.${telefone},whatsapp.eq.${telefone}`)
        .maybeSingle();
      const { data: contatoExistente } = await supabase
        .from('crm_contatos')
        .select('id')
        .eq('farmacia_id', farmaciaId)
        .or(`telefone.eq.${telefone},whatsapp.eq.${telefone}`)
        .maybeSingle();

      if (contatoExistente) {
        contatoId = contatoExistente.id;
      } else if (leadExistente) {
        leadId = leadExistente.id;
      } else {
        const { data: novoLead } = await supabase
          .from('leads')
          .insert({ nome: telefone, whatsapp: telefone, origem: 'outro', farmacia_id: farmaciaId })
          .select('id')
          .single();
        leadId = novoLead?.id ?? null;
      }

      await supabase.from('whatsapp_mensagens').insert({
        farmacia_id: farmaciaId,
        telefone_destino: telefone,
        conteudo: texto,
        direcao: 'recebida',
        status: 'lida',
        id_externo: msg.id,
        contato_id: contatoId,
        lead_id: leadId,
      });
    }
  }
}

function mapearStatusWhatsApp(statusMeta: string): string {
  const mapa: Record<string, string> = {
    sent: 'enviada',
    delivered: 'entregue',
    read: 'lida',
    failed: 'erro',
  };
  return mapa[statusMeta] ?? 'erro';
}

async function processarEventoInstagramOuFacebook(
  supabase: ReturnType<typeof clienteServiceRole>,
  entrada: any,
  tabela: 'instagram_publicacoes' | 'facebook_publicacoes'
) {
  for (const mudanca of entrada.changes ?? []) {
    const valor = mudanca.value;
    if (!valor?.media_id && !valor?.post_id) continue;
    const idExterno = valor.media_id ?? valor.post_id;
    await supabase.from(tabela).update({ status: 'publicada' }).eq('id_externo', idExterno).eq('status', 'pendente');
  }
}
