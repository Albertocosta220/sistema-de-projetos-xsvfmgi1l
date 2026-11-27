import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AuthProvider } from '@/context/AuthContext'
import { SigefProvider } from '@/context/SigefContext'
import RequireAuth from '@/components/RequireAuth'
import Layout from '@/components/Layout'
import LoginPage from '@/pages/LoginPage'
import PainelPage from '@/pages/PainelPage'
import ImportarPage from '@/pages/ImportarPage'
import ProdutosPage from '@/pages/ProdutosPage'
import KardexPage from '@/pages/KardexPage'
import InventarioPage from '@/pages/InventarioPage'
import BlocoKPage from '@/pages/BlocoKPage'
import SpedPage from '@/pages/SpedPage'
import AuditoriaPage from '@/pages/AuditoriaPage'
import FornecedoresPage from '@/pages/FornecedoresPage'
import RegrasCfopPage from '@/pages/RegrasCfopPage'
import EmpresasSefazPage from '@/pages/EmpresasSefazPage'
import ReformaTributariaPage from '@/pages/ReformaTributariaPage'
import AssistenteIaPage from '@/pages/AssistenteIaPage'
import BackupPage from '@/pages/BackupPage'
import CertificadoPage from '@/pages/CertificadoPage'
import ManuaisPage from '@/pages/ManuaisPage'
import VerificacaoLupoPage from '@/pages/VerificacaoLupoPage'
import ConfiguracoesPage from '@/pages/ConfiguracoesPage'
import UsuariosPage from '@/pages/UsuariosPage'
import PerfisPage from '@/pages/PerfisPage'
import NotFound from '@/pages/NotFound'

const App = () => (
  <BrowserRouter>
    <AuthProvider>
      <SigefProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner position="bottom-right" richColors />
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<Layout />}>
              <Route
                path="/"
                element={
                  <RequireAuth>
                    <PainelPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/importar"
                element={
                  <RequireAuth>
                    <ImportarPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/kardex"
                element={
                  <RequireAuth>
                    <KardexPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/inventario"
                element={
                  <RequireAuth>
                    <InventarioPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/bloco-k"
                element={
                  <RequireAuth>
                    <BlocoKPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/sped"
                element={
                  <RequireAuth>
                    <SpedPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/produtos"
                element={
                  <RequireAuth>
                    <ProdutosPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/fornecedores"
                element={
                  <RequireAuth>
                    <FornecedoresPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/regras-cfop"
                element={
                  <RequireAuth>
                    <RegrasCfopPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/empresas"
                element={
                  <RequireAuth>
                    <EmpresasSefazPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/sefaz"
                element={
                  <RequireAuth>
                    <EmpresasSefazPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/auditoria"
                element={
                  <RequireAuth>
                    <AuditoriaPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/reforma"
                element={
                  <RequireAuth>
                    <ReformaTributariaPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/assistente"
                element={
                  <RequireAuth>
                    <AssistenteIaPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/backup"
                element={
                  <RequireAuth>
                    <BackupPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/certificado"
                element={
                  <RequireAuth>
                    <CertificadoPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/manuais"
                element={
                  <RequireAuth>
                    <ManuaisPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/verificacao"
                element={
                  <RequireAuth>
                    <VerificacaoLupoPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/configuracoes"
                element={
                  <RequireAuth>
                    <ConfiguracoesPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/usuarios"
                element={
                  <RequireAuth>
                    <UsuariosPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/perfis"
                element={
                  <RequireAuth>
                    <PerfisPage />
                  </RequireAuth>
                }
              />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </TooltipProvider>
      </SigefProvider>
    </AuthProvider>
  </BrowserRouter>
)

export default App
