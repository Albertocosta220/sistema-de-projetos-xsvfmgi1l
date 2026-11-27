import React, { useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useSigef } from '@/context/SigefContext'
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Clock,
  Download,
  FileSpreadsheet,
  FileText,
  Layers,
  Menu,
  Package,
  RotateCcw,
  ShieldAlert,
  Upload,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { toast } from 'sonner'

export default function Layout() {
  const { pathname } = useLocation()
  const mainRef = useRef<HTMLElement>(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [backupModalOpen, setBackupModalOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const {
    empresas,
    empresaAtiva,
    trocarEmpresaAtiva,
    documentos,
    ocorrencias,
    exportarBackupJson,
    importarBackupJson,
    historicoBackups,
    restaurarBackupHistorico,
    resetarParaDadosExemplo,
  } = useSigef()

  const pendenciasCount = documentos.filter(
    (d) =>
      d.status === 'PENDENTE' || d.status === 'AGUARDANDO_DE_PARA' || d.status === 'DUPLICIDADE',
  ).length

  const ocorrenciasNaoResolvidas = ocorrencias.filter((o) => !o.resolvido).length

  const navItems = [
    { to: '/', label: 'Painel', icon: Layers },
    {
      to: '/importar',
      label: 'Importar',
      icon: Upload,
      badge: pendenciasCount > 0 ? pendenciasCount : undefined,
      badgeVariant: 'destructive' as const,
    },
    { to: '/produtos', label: 'Produtos & De-Para', icon: Package },
    { to: '/kardex', label: 'Kardex (CMP)', icon: FileSpreadsheet },
    { to: '/inventario', label: 'Inventário (Bloco H)', icon: CheckCircle2 },
    { to: '/sped', label: 'Bloco K & SPED TXT', icon: FileText },
    {
      to: '/auditoria',
      label: 'Auditoria (A01-A12)',
      icon: ShieldAlert,
      badge: ocorrenciasNaoResolvidas > 0 ? ocorrenciasNaoResolvidas : undefined,
      badgeVariant: 'destructive' as const,
    },
    { to: '/empresas-sefaz', label: 'Empresas & SEFAZ', icon: Building2 },
  ]

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result as string
      if (content) {
        const ok = importarBackupJson(content)
        if (ok) {
          setBackupModalOpen(false)
        }
      }
    }
    reader.readAsText(file)
    // reset input
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="min-h-dvh flex flex-col bg-slate-50 text-slate-900">
      {/* Skip link para acessibilidade */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:shadow-lg"
      >
        Pular para o conteúdo principal
      </a>

      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-4">
            {/* Logo e Nome do Sistema */}
            <div className="flex items-center gap-3">
              <Link to="/" className="flex items-center gap-2.5 group">
                <div className="size-9 rounded-lg bg-blue-700 text-white flex items-center justify-center font-bold text-lg shadow-sm group-hover:bg-blue-800 transition-colors">
                  Σ
                </div>
                <div>
                  <div className="font-extrabold text-lg text-slate-900 leading-none tracking-tight flex items-center gap-1.5">
                    SIGEF-ME
                    <span className="text-[10px] font-semibold bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded tracking-normal">
                      v2.0
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 font-medium">
                    Controle Fiscal de Estoque Multiempresa
                  </div>
                </div>
              </Link>
            </div>

            {/* Seletor de Empresa Ativa no Topo */}
            <div className="flex items-center gap-3 flex-1 max-w-md justify-center">
              <div className="flex items-center gap-2 w-full max-w-xs sm:max-w-sm">
                <span className="text-xs font-semibold text-slate-500 whitespace-nowrap hidden sm:inline">
                  Empresa:
                </span>
                <Select value={empresaAtiva.id} onValueChange={trocarEmpresaAtiva}>
                  <SelectTrigger
                    className="w-full bg-slate-50 border-slate-300 font-medium text-slate-800 h-9"
                    aria-label="Selecionar empresa ativa"
                  >
                    <SelectValue placeholder="Selecione a empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    {empresas.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id} className="text-sm">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{emp.nomeFantasia}</span>
                          <span className="text-xs text-slate-500">({emp.uf})</span>
                          {emp.situacaoCadastral !== 'ATIVA' && (
                            <Badge variant="destructive" className="text-[10px] py-0 px-1">
                              {emp.situacaoCadastral}
                            </Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {empresaAtiva.situacaoCadastral !== 'ATIVA' && (
                <div
                  className="hidden md:flex items-center gap-1 text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 px-2 py-1 rounded"
                  title="Empresa com restrições fiscais"
                >
                  <AlertTriangle className="size-3.5 text-rose-600" />
                  <span>Fechamento Bloqueado</span>
                </div>
              )}
            </div>

            {/* Ações Rápidas de Backup e Menu Mobile */}
            <div className="flex items-center gap-2">
              <Dialog open={backupModalOpen} onOpenChange={setBackupModalOpen}>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="hidden sm:inline-flex items-center gap-1.5 h-8 text-xs font-medium border-slate-300"
                    aria-label="Abrir gerenciador de backup JSON"
                  >
                    <Download className="size-3.5 text-slate-600" />
                    <span>Backup / Restaurar</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Backup e Restauração Local (JSON)</DialogTitle>
                    <DialogDescription>
                      Exportação e importação de arquivo com o estado completo da empresa ativa no
                      navegador.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4 py-2">
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900">
                      <strong>Persistência 100% no navegador:</strong> Todos os produtos, XMLs,
                      de-para, Kardex e fechamentos ficam salvos no seu localStorage. Exporte
                      regularmente o backup em arquivo para segurança.
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        onClick={exportarBackupJson}
                        className="w-full flex items-center justify-center gap-1.5"
                      >
                        <Download className="size-4" />
                        <span>Baixar JSON</span>
                      </Button>

                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full flex items-center justify-center gap-1.5"
                      >
                        <Upload className="size-4" />
                        <span>Carregar JSON</span>
                      </Button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".json"
                        className="hidden"
                        onChange={handleFileUpload}
                      />
                    </div>

                    {/* Histórico das últimas versões */}
                    <div>
                      <h4 className="text-xs font-bold uppercase text-slate-500 mb-2 tracking-wider flex items-center gap-1.5">
                        <Clock className="size-3.5" />
                        Últimas Versões Gravadas ({historicoBackups.length})
                      </h4>
                      {historicoBackups.length === 0 ? (
                        <p className="text-xs text-slate-400 italic">
                          Nenhum backup recente registrado.
                        </p>
                      ) : (
                        <div className="max-h-40 overflow-y-auto space-y-1.5 border border-slate-200 rounded p-1 bg-slate-50">
                          {historicoBackups.map((bkp) => (
                            <div
                              key={bkp.versao}
                              className="flex items-center justify-between p-2 bg-white rounded border border-slate-200 text-xs"
                            >
                              <div>
                                <div className="font-semibold text-slate-800">{bkp.versao}</div>
                                <div className="text-[11px] text-slate-500">
                                  {bkp.descricao} • {bkp.tamanhoKb} KB
                                </div>
                              </div>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs text-blue-700 hover:text-blue-900"
                                onClick={() => restaurarBackupHistorico(bkp.versao)}
                              >
                                Restaurar
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="pt-2 border-t border-slate-200">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={resetarParaDadosExemplo}
                        className="w-full text-xs text-slate-600 hover:text-rose-700 hover:border-rose-300 flex items-center justify-center gap-1.5"
                      >
                        <RotateCcw className="size-3.5" />
                        <span>Restaurar dados de exemplo iniciais (VB Metais)</span>
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              {/* Botão Menu Mobile */}
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label={mobileMenuOpen ? 'Fechar menu de navegação' : 'Abrir menu de navegação'}
              >
                {mobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
              </Button>
            </div>
          </div>
        </div>

        {/* Barra de Navegação Horizontal Desktop */}
        <nav
          aria-label="Navegação Principal"
          className="hidden lg:block bg-slate-100 border-t border-slate-200 px-4 sm:px-6 lg:px-8"
        >
          <div className="max-w-7xl mx-auto flex items-center gap-1 overflow-x-auto py-1">
            {navItems.map((item) => {
              const Icon = item.icon
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center gap-2 px-3.5 py-2 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                      isActive
                        ? 'bg-white text-blue-700 shadow-xs border border-slate-200 font-semibold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                    }`
                  }
                >
                  <Icon className="size-4 shrink-0" />
                  <span>{item.label}</span>
                  {item.badge !== undefined && (
                    <Badge
                      variant={item.badgeVariant || 'default'}
                      className="ml-1 text-[10px] px-1.5 py-0 h-4 min-w-[1rem] flex items-center justify-center rounded-full"
                    >
                      {item.badge}
                    </Badge>
                  )}
                </NavLink>
              )
            })}
          </div>
        </nav>

        {/* Menu Mobile Retrátil */}
        {mobileMenuOpen && (
          <nav
            aria-label="Navegação Mobile"
            className="lg:hidden bg-white border-b border-slate-200 px-4 py-3 space-y-1 shadow-md"
          >
            {navItems.map((item) => {
              const Icon = item.icon
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium ${
                      isActive
                        ? 'bg-blue-50 text-blue-700 font-semibold'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`
                  }
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="size-4.5" />
                    <span>{item.label}</span>
                  </div>
                  {item.badge !== undefined && (
                    <Badge variant={item.badgeVariant || 'default'} className="text-xs px-2 py-0">
                      {item.badge}
                    </Badge>
                  )}
                </NavLink>
              )
            })}
          </nav>
        )}
      </header>

      {/* Main Content Area */}
      <main
        id="main-content"
        ref={mainRef}
        tabIndex={-1}
        className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 focus:outline-none"
      >
        <Outlet />
      </main>

      {/* Footer simples e informativo */}
      <footer className="bg-white border-t border-slate-200 py-4 px-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            <strong>SIGEF-ME</strong> — Sistema Integrado de Gestão de Estoque Fiscal para
            Atacadistas (Reforma Tributária IBS/CBS & SPED Fiscal)
          </div>
          <div className="text-slate-400">
            Ambiente Local • Armazenamento seguro no navegador via localStorage
          </div>
        </div>
      </footer>
    </div>
  )
}
