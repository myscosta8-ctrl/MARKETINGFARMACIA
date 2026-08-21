/**
 * Registro central de provedores de IA. O restante do app chama
 * `obterProvedorIA()` e nunca importa um provedor concreto diretamente —
 * isso é o que permite trocar de fornecedor (ou usar múltiplos, ex: um para
 * texto e outro para análise) sem reescrever o app.
 *
 * Nenhuma chamada real está implementada aqui neste sprint — apenas o
 * contrato e o mecanismo de registro. Implementações concretas (Anthropic,
 * OpenAI, etc.) entram no módulo "IA" do roadmap, quando houver credencial
 * configurada em Integrações.
 */

const provedores = new Map();

export function registrarProvedorIA(nome, instancia) {
  provedores.set(nome, instancia);
}

export function obterProvedorIA(nome = 'padrao') {
  const provedor = provedores.get(nome) ?? provedores.get('padrao');
  if (!provedor) {
    throw new Error(
      `Nenhum provedor de IA registrado ("${nome}"). Configure uma credencial em Integrações antes de usar recursos de IA.`
    );
  }
  return provedor;
}

export function provedorIAConfigurado(nome = 'padrao') {
  return provedores.has(nome) || provedores.has('padrao');
}
