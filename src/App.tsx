import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AuthProvider, useAuth } from '@/context/AuthContext'
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
import type { ReactNode } from 'react'
import { TELA_POR_ROTA } from '@/types/usuario'

/**
 * Rota protegida por tela: exige sessão ativa E permissão da tela no perfil
 * do usuário logado. Sem permissão mostra bloqueio (não crash).
 */
function RotaProtegida({ tela, children }: { tela: string; children: ReactNode }) {
  const { usuarioAtual, perfis, carregando } = useAuth()

  if (carregando) return null

  if (!usuarioAtual) return <Navigate to="/login" replace />

  if (tela === 'painel') return <>{children}</>

  const perfil = perfis.find((p) => p.id === usuarioAtual.perfilId)
  const telaInfo = TELA_POR_ROTA[tela]
  const permitido =
    (perfil?.permissoes.includes(telaInfo?.key ?? tela) ?? false) ||
    (telaInfo?.semprePermitida ?? false)

  if (!permitido) return <TelaBloqueada titulo={telaInfo?.label ?? tela} />

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

const ROTAS: { path: string; tela: string; element: ReactNode }[] = [
  { path: '/', tela: 'painel', element: <PainelPage /> },
  { path: '/importar', tela: 'importar', element: <ImportarPage /> },
  { path: '/kardex', tela: 'kardex', element: <KardexPage /> },
  { path: '/inventario', tela: 'inventario', element: <InventarioPage /> },
  { path: '/bloco-k', tela: 'bloco-k', element: <BlocoKPage /> },
  { path: '/sped', tela: 'sped', element: <SpedPage /> },
  { path: '/produtos', tela: 'produtos', element: <ProdutosPage /> },
  { path: '/fornecedores', tela: 'fornecedores', element: <FornecedoresPage /> },
  { path: '/regras-cfop', tela: 'regras-cfop', element: <RegrasCfopPage /> },
  { path: '/empresas', tela: 'empresas', element: <EmpresasSefazPage /> },
  { path: '/sefaz', tela: 'sefaz', element: <EmpresasSefazPage /> },
  { path: '/auditoria', tela: 'auditoria', element: <AuditoriaPage /> },
  { path: '/reforma', tela: 'reforma', element: <ReformaTributariaPage /> },
  { path: '/assistente', tela: 'assistente', element: <AssistenteIaPage /> },
  { path: '/backup', tela: 'backup', element: <BackupPage /> },
  { path: '/certificado', tela: 'certificado', element: <CertificadoPage /> },
  { path: '/manuais', tela: 'manuais', element: <ManuaisPage /> },
  { path: '/verificacao', tela: 'verificacao', element: <VerificacaoLupoPage /> },
  { path: '/configuracoes', tela: 'configuracoes', element: <ConfiguracoesPage /> },
  { path: '/usuarios', tela: 'usuarios', element: <UsuariosPage /> },
  { path: '/perfis', tela: 'perfis', element: <PerfisPage /> },
]

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
              {ROTAS.map(({ path, tela, element }) => (
                <Route
                  key={path}
                  path={path}
                  element={<RotaProtegida tela={tela}>{element}</RotaProtegida>}
                />
              ))}
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </TooltipProvider>
      </SigefProvider>
    </AuthProvider>
  </BrowserRouter>
)

export default App
