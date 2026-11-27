import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { SigefProvider } from '@/context/SigefContext'
import Layout from '@/components/Layout'
import PainelPage from '@/pages/PainelPage'
import ImportarPage from '@/pages/ImportarPage'
import ProdutosPage from '@/pages/ProdutosPage'
import KardexPage from '@/pages/KardexPage'
import InventarioPage from '@/pages/InventarioPage'
import SpedPage from '@/pages/SpedPage'
import AuditoriaPage from '@/pages/AuditoriaPage'
import EmpresasSefazPage from '@/pages/EmpresasSefazPage'
import NotFound from '@/pages/NotFound'

const App = () => (
  <BrowserRouter>
    <SigefProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner position="top-right" richColors />
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<PainelPage />} />
            <Route path="/importar" element={<ImportarPage />} />
            <Route path="/produtos" element={<ProdutosPage />} />
            <Route path="/kardex" element={<KardexPage />} />
            <Route path="/inventario" element={<InventarioPage />} />
            <Route path="/sped" element={<SpedPage />} />
            <Route path="/auditoria" element={<AuditoriaPage />} />
            <Route path="/empresas-sefaz" element={<EmpresasSefazPage />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </TooltipProvider>
    </SigefProvider>
  </BrowserRouter>
)

export default App
