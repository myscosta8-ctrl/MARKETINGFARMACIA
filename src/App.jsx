import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { RotaProtegida } from './components/RotaProtegida';
import Layout from './components/Layout';
import Entrar from './pages/Entrar';
import Dashboard from './pages/Dashboard';
import Configuracoes from './pages/Configuracoes';
import CampanhasLista from './modules/campanhas/CampanhasLista';
import CampanhaNova from './modules/campanhas/CampanhaNova';
import CampanhaDetalhe from './modules/campanhas/CampanhaDetalhe';
import ProdutosLista from './modules/produtos/ProdutosLista';
import CalendarioPage from './modules/calendario/CalendarioPage';
import ConteudosLista from './modules/conteudo/ConteudosLista';
import ConteudoNovo from './modules/conteudo/ConteudoNovo';
import ConteudoDetalhe from './modules/conteudo/ConteudoDetalhe';
import OportunidadesLista from './modules/oportunidades/OportunidadesLista';
import IAPage from './modules/ia/IAPage';

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <AuthProvider>
        <Routes>
          <Route path="/entrar" element={<Entrar />} />
          <Route
            path="/"
            element={
              <RotaProtegida>
                <Layout />
              </RotaProtegida>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="configuracoes" element={<Configuracoes />} />
            <Route path="campanhas" element={<CampanhasLista />} />
            <Route path="campanhas/nova" element={<CampanhaNova />} />
            <Route path="campanhas/:id" element={<CampanhaDetalhe />} />
            <Route path="produtos" element={<ProdutosLista />} />
            <Route path="calendario" element={<CalendarioPage />} />
            <Route path="conteudo" element={<ConteudosLista />} />
            <Route path="conteudo/novo" element={<ConteudoNovo />} />
            <Route path="conteudo/:id" element={<ConteudoDetalhe />} />
            <Route path="oportunidades" element={<OportunidadesLista />} />
            <Route path="ia" element={<IAPage />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
