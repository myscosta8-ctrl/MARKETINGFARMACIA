/**
 * Contrato base para qualquer integração externa (WhatsApp, Instagram,
 * Facebook, Anúncios, LC Sistemas). Nenhum adaptador concreto está
 * implementado neste sprint — isso depende de credenciais/API oficiais que
 * ainda não existem. Implementar aqui evitaria simular uma conexão que não
 * é real, o que a especificação proíbe explicitamente.
 *
 * Quando uma credencial oficial existir:
 * 1. Criar `./adaptadores/whatsapp.js` (etc.) implementando esta classe.
 * 2. Armazenar a credencial no Supabase Vault (nunca em texto puro na tabela
 *    `integracoes.configuracao`, que é só para dados não-sensíveis).
 * 3. Atualizar `integracoes.status` para 'configurado' e, após o primeiro
 *    handshake bem-sucedido, 'conectado'.
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
