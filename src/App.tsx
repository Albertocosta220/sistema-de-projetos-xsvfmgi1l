import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import { SigefProvider } from '@/context/SigefContext'
import Layout from '@/components/Layout'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import LoginPage from '@/pages/LoginPage'
import PainelPage from '@/pages/PainelPage'
import ImportarPage from '@/pages/ImportarPage'
import ProdutosPage from '@/pages/ProdutosPage'
import KardexPage from '@/pages/KardexPage'
import InventarioPage from '@/pages/InventarioPage'
import InventarioNegativoPage from '@/pages/InventarioNegativoPage'
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
import type { ReactNode } from 'react'
import { TELA_POR_ROTA } from '@/types/usuario'

/**
 * Rota protegida por tela: exige sessão ativa E permissão da tela no perfil
 * do usuário logado. Sem permissão mostra bloqueio (não crash).
 */
function RotaProtegida({ children }: { children: ReactNode }) {
  const { pronto, usuarioAtual, temPermissao } = useAuth()
  const location = useLocation()

  if (!pronto) return null

  if (!usuarioAtual) return <Navigate to="/login" replace />

  // A permissão é sempre resolvida pela ROTA atual via TELA_POR_ROTA (mapa rota → tela),
  // nunca pela chave passada solta — telas sem chave mapeada ficam livres.
  const telaInfo = TELA_POR_ROTA[location.pathname]
  if (telaInfo && !temPermissao(telaInfo.key)) {
    return <TelaBloqueada titulo={telaInfo.label} />
  }

  return <>{children}</>
}

function TelaBloqueada({ titulo }: { titulo: string }) {
  return (
    <div className="sig-page">
      <div className="page-head">
        <div>
          <p className="eyebrow">Acesso restrito</p>
          <h1 className="text-xl font-bold text-[var(--petroleo)]">{titulo}</h1>
        </div>
      </div>
      <div className="card-s p-8 text-center">
        <p className="text-sm text-[var(--sig-muted)] max-w-md mx-auto">
          Seu perfil de acesso não tem permissão para abrir esta tela. Solicite ao administrador do
          sistema a liberação em <strong>Sistema → Perfis de acesso</strong>.
        </p>
      </div>
    </div>
  )
}

const ROTAS: { path: string; element: ReactNode }[] = [
  { path: '/', element: <PainelPage /> },
  { path: '/importar', element: <ImportarPage /> },
  { path: '/kardex', element: <KardexPage /> },
  { path: '/inventario', element: <InventarioPage /> },
  { path: '/inventario-negativo', element: <InventarioNegativoPage /> },
  { path: '/bloco-k', element: <BlocoKPage /> },
  { path: '/sped', element: <SpedPage /> },
  { path: '/produtos', element: <ProdutosPage /> },
  { path: '/fornecedores', element: <FornecedoresPage /> },
  { path: '/regras-cfop', element: <RegrasCfopPage /> },
  { path: '/empresas', element: <EmpresasSefazPage /> },
  { path: '/auditoria', element: <AuditoriaPage /> },
  { path: '/reforma', element: <ReformaTributariaPage /> },
  { path: '/assistente', element: <AssistenteIaPage /> },
  { path: '/backup', element: <BackupPage /> },
  { path: '/certificado', element: <CertificadoPage /> },
  { path: '/manuais', element: <ManuaisPage /> },
  { path: '/verificacao', element: <VerificacaoLupoPage /> },
  { path: '/configuracoes', element: <ConfiguracoesPage /> },
  { path: '/usuarios', element: <UsuariosPage /> },
  { path: '/perfis', element: <PerfisPage /> },
]

const TELA_POR_ROTA_ROTULO: Record<string, string> = Object.fromEntries(
  Object.entries(TELA_POR_ROTA).map(([rota, tela]) => [rota, tela.label]),
)

const App = () => (
  <BrowserRouter>
    <ErrorBoundary rotulo="do sistema">
      <AuthProvider>
        <SigefProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner position="bottom-right" richColors />
            <Routes>
              <Route
                path="/login"
                element={
                  <ErrorBoundary rotulo="da tela Login">
                    <LoginPage />
                  </ErrorBoundary>
                }
              />
              <Route element={<Layout />}>
                {ROTAS.map(({ path, element }) => (
                  <Route
                    key={path}
                    path={path}
                    element={
                      <ErrorBoundary rotulo={`da tela ${TELA_POR_ROTA_ROTULO[path] ?? path}`}>
                        <RotaProtegida>{element}</RotaProtegida>
                      </ErrorBoundary>
                    }
                  />
                ))}
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </TooltipProvider>
        </SigefProvider>
      </AuthProvider>
    </ErrorBoundary>
  </BrowserRouter>
)

export default App
