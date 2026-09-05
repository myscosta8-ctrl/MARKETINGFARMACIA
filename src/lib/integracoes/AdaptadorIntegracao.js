/**
 * Contrato base para qualquer integração externa (WhatsApp, Instagram,
 * Facebook, Anúncios, LC Sistemas).
 *
 * ATUALIZAÇÃO (Fase 2 — integrações reais): em vez de uma classe concreta
 * por provedor rodando no navegador (que exigiria o token de acesso no
 * cliente — proibido), a implementação real fica em
 * `supabase/functions/meta-actions/` (Edge Function, roda no servidor,
 * único lugar que vê o token, lido do Supabase Vault via
 * `vault_ler_token_integracao`). Os `service.js` de cada módulo
 * (`whatsapp/`, `instagram/`, `facebook/`) chamam essa Function via
 * `supabase.functions.invoke('meta-actions', ...)`.
 *
 * Esta classe continua existindo como o contrato conceitual (testarConexao/
 * sincronizar) e cobre integrações que ainda não têm nenhuma implementação
 * (Anúncios, LC Sistemas) — nada foi quebrado, nenhum comportamento
 * anterior mudou para quem ainda depende só desta interface.
 *
 * @interface
 */
export class AdaptadorIntegracao {
  /** Identificador do provedor, deve bater com o enum provedor_integracao no banco */
  get provedor() {
    throw new Error('provedor não definido');
  }

  /** @returns {Promise<boolean>} */
  async testarConexao() {
    throw new Error(`Integração "${this.provedor}" ainda não está implementada — sem credenciais.`);
  }

  async sincronizar() {
    throw new Error(`Integração "${this.provedor}" ainda não está implementada — sem credenciais.`);
  }
}
