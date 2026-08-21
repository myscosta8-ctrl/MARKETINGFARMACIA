/**
 * Contrato que todo provedor de IA deve implementar. Nada no resto do
 * sistema deve depender diretamente de um fornecedor específico (ex:
 * Anthropic, OpenAI) — apenas desta interface.
 *
 * Métodos retornam Promises. Implementações concretas ficam em
 * ./provedores/*.js e são registradas em ./registro.js.
 *
 * @interface
 */
export class ProvedorIA {
  /** @returns {Promise<{resumo: string, pontos: string[]}>} */
  async analisarDados(_contexto) {
    throw new Error('analisarDados não implementado');
  }

  /** @returns {Promise<{titulo: string, justificativa: string}[]>} */
  async gerarRecomendacoes(_contexto) {
    throw new Error('gerarRecomendacoes não implementado');
  }

  /** Gera um rascunho de campanha. IA nunca publica — apenas cria rascunho. */
  async gerarRascunhoCampanha(_briefing) {
    throw new Error('gerarRascunhoCampanha não implementado');
  }

  /** @returns {Promise<string>} */
  async gerarConteudo(_briefing) {
    throw new Error('gerarConteudo não implementado');
  }

  /** @returns {Promise<{resumo: string, metricas: Record<string, number>}>} */
  async analisarDesempenho(_dados) {
    throw new Error('analisarDesempenho não implementado');
  }
}
