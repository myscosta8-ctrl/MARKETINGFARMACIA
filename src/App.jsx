import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { RotaProtegida } from './components/RotaProtegida';
import Layout from './components/Layout';

const Entrar = lazy(() => import('./pages/Entrar'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Configuracoes = lazy(() => import('./pages/Configuracoes'));
const CampanhasLista = lazy(() => import('./modules/campanhas/CampanhasLista'));
const CampanhaNova = lazy(() => import('./modules/campanhas/CampanhaNova'));
const CampanhaDetalhe = lazy(() => import('./modules/campanhas/CampanhaDetalhe'));
const ProdutosLista = lazy(() => import('./modules/produtos/ProdutosLista'));
const CalendarioPage = lazy(() => import('./modules/calendario/CalendarioPage'));
const ConteudosLista = lazy(() => import('./modules/conteudo/ConteudosLista'));
const ConteudoNovo = lazy(() => import('./modules/conteudo/ConteudoNovo'));
const ConteudoDetalhe = lazy(() => import('./modules/conteudo/ConteudoDetalhe'));
const OportunidadesLista = lazy(() => import('./modules/oportunidades/OportunidadesLista'));
const IAPage = lazy(() => import('./modules/ia/IAPage'));
const CrmLista = lazy(() => import('./modules/crm/CrmLista'));
const CrmDetalhe = lazy(() => import('./modules/crm/CrmDetalhe'));
const LeadsLista = lazy(() => import('./modules/leads/LeadsLista'));
const LeadDetalhe = lazy(() => import('./modules/leads/LeadDetalhe'));
const WhatsAppPage = lazy(() => import('./modules/whatsapp/WhatsAppPage'));
const InstagramPage = lazy(() => import('./modules/instagram/InstagramPage'));
const FacebookPage = lazy(() => import('./modules/facebook/FacebookPage'));
const AnunciosLista = lazy(() => import('./modules/anuncios/AnunciosLista'));
const AnalyticsPage = lazy(() => import('./modules/analytics/AnalyticsPage'));

function TelaCarregando() {
  return <div className="min-h-screen flex items-center justify-center text-sm text-ink-500">Carregando…</div>;
}

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <AuthProvider>
        <Suspense fallback={<TelaCarregando />}>
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
            <Route path="crm" element={<CrmLista />} />
            <Route path="crm/:id" element={<CrmDetalhe />} />
            <Route path="leads" element={<LeadsLista />} />
            <Route path="leads/:id" element={<LeadDetalhe />} />
            <Route path="whatsapp" element={<WhatsAppPage />} />
            <Route path="instagram" element={<InstagramPage />} />
            <Route path="facebook" element={<FacebookPage />} />
            <Route path="anuncios" element={<AnunciosLista />} />
            <Route path="analytics" element={<AnalyticsPage />} />
          </Route>
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}
