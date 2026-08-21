import { Component } from 'react';
import { logger } from '../utils/logger';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { erro: null };
  }

  static getDerivedStateFromError(erro) {
    return { erro };
  }

  componentDidCatch(erro, info) {
    logger.error('Erro não tratado na interface', erro, info?.componentStack);
  }

  render() {
    if (this.state.erro) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-base-950 text-ink-100 p-6">
          <div className="max-w-md text-center space-y-3">
            <h1 className="font-display text-2xl">Algo deu errado</h1>
            <p className="text-ink-300 text-sm">
              A tela encontrou um erro inesperado. Isso foi registrado. Recarregue a página — se
              persistir, avise o administrador do sistema.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-2 px-4 py-2 rounded-lg bg-mint-500 hover:bg-mint-600 text-base-950 font-medium transition"
            >
              Recarregar
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
