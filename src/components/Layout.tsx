import { useEffect, useMemo, useState, type ElementType } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  BarChart3,
  BookOpen,
  Bot,
  Boxes,
  Building2,
  Calendar,
  ClipboardList,
  FileSpreadsheet,
  FileText,
  Globe,
  Gavel,
  HardDriveDownload,
  Layers,
  Package,
  Settings,
  ShieldCheck,
  Store,
  Upload,
  Menu,
  X,
  LogOut,
  UserCircle2,
  Users,
  KeyRound,
} from 'lucide-react'
import { useSigef } from '@/context/SigefContext'
import { useAuth } from '@/context/AuthContext'
import { TELA_POR_ROTA } from '@/types/usuario'
import { Pill } from '@/components/shell'
import { Button } from '@/components/ui/button'

type NavItem = { to: string; label: string; icon: ElementType }
type NavGroup = { titulo: string; itens: NavItem[] }

const GRUPOS: NavGroup[] = [
  {
    titulo: 'Operacional',
    itens: [
      { to: '/', label: 'Painel', icon: BarChart3 },
      { to: '/importar', label: 'Importar', icon: Upload },
      { to: '/kardex', label: 'Kardex', icon: Layers },
      { to: '/inventario', label: 'Inventário', icon: ClipboardList },
      { to: '/bloco-k', label: 'Bloco K', icon: Boxes },
      { to: '/sped', label: 'SPED TXT', icon: FileSpreadsheet },
      { to: '/produtos', label: 'Produtos (De-Para)', icon: Package },
    ],
  },
  {
    titulo: 'Fiscal',
    itens: [
      { to: '/fornecedores', label: 'Fornecedores', icon: Store },
      { to: '/regras-cfop', label: 'Regras CFOP', icon: Gavel },
      { to: '/empresas', label: 'Empresas & Consulta DF-e SEFAZ', icon: Building2 },
      { to: '/auditoria', label: 'Auditoria', icon: ShieldCheck },
      { to: '/reforma', label: 'Reforma Tributária', icon: FileText },
      { to: '/assistente', label: 'Assistente IA', icon: Bot },
    ],
  },
  {
    titulo: 'Sistema',
    itens: [
      { to: '/backup', label: 'Backup', icon: HardDriveDownload },
      { to: '/certificado', label: 'Certificado Digital', icon: FileText },
      { to: '/manuais', label: 'Manuais', icon: BookOpen },
      { to: '/verificacao', label: 'Verificação (Lupo)', icon: Calendar },
      { to: '/configuracoes', label: 'Configurações', icon: Settings },
      { to: '/usuarios', label: 'Usuários', icon: Users },
      { to: '/perfis', label: 'Perfis de acesso', icon: KeyRound },
    ],
  },
]

export default function Layout() {
  const { empresaAtiva, empresas, trocarEmpresaAtiva } = useSigef()
  const { usuarioAtual, perfis, temPermissao, sair } = useAuth()
  const [menuAberto, setMenuAberto] = useState(false)
  const location = useLocation()

  // Fecha o drawer mobile a cada troca de rota
  useEffect(() => setMenuAberto(false), [location.pathname])

  const nomePerfilAtual = perfis.find((p) => p.id === usuarioAtual?.perfilId)?.nome ?? 'sem perfil'

  // Menu filtrado pelas permissões do perfil do usuário logado
  const gruposVisiveis = useMemo(
    () =>
      GRUPOS.map((g) => ({
        ...g,
        itens: g.itens.filter((it) => {
          const tela = TELA_POR_ROTA[it.to]
          return tela ? temPermissao(tela.key) : true
        }),
      })).filter((g) => g.itens.length > 0),
    [temPermissao],
  )

  return (
    <div className="app-shell">
      <aside className={`sig-sidebar ${menuAberto ? 'open' : ''}`} aria-label="Navegação principal">
        <div className="sig-brand">
          <span
            aria-hidden="true"
            className="grid place-items-center size-8 rounded-lg bg-[var(--accent)] text-white text-sm font-extrabold"
          >
            S
          </span>
          <div>
            <strong>SIGEF-ME</strong>
            <span>Estoque &amp; Fiscal — v2.0</span>
          </div>
          <button
            type="button"
            className="ml-auto lg:hidden text-white/80 hover:text-white"
            aria-label="Fechar menu"
            onClick={() => setMenuAberto(false)}
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex-1">
          {gruposVisiveis.map((g) => (
            <div key={g.titulo}>
              <h4>{g.titulo}</h4>
              {g.itens.map((it) => (
                <NavLink key={it.to} to={it.to} end={it.to === '/'} className="sig-nav">
                  <it.icon aria-hidden="true" />
                  {it.label}
                </NavLink>
              ))}
            </div>
          ))}
        </div>

        <div className="pt-3 mt-2 border-t border-white/12">
          <button
            type="button"
            className="sig-nav text-rose-200 hover:text-white hover:bg-rose-500/20"
            onClick={sair}
          >
            <LogOut aria-hidden="true" />
            Sair
          </button>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sig-topbar">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="lg:hidden sig-input !w-auto flex items-center gap-1.5"
              aria-label="Abrir menu"
              aria-expanded={menuAberto}
              onClick={() => setMenuAberto((v) => !v)}
            >
              <Menu className="size-4" /> Menu
            </button>
            <span className="sig-top-title">
              {GRUPOS.flatMap((g) => g.itens).find((i) => i.to === location.pathname)?.label ??
                'SIGEF-ME'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 text-xs text-[var(--petroleo)] max-w-[180px] sm:max-w-none">
              <UserCircle2 aria-hidden="true" className="size-4 text-[var(--accent)] flex-none" />
              <span className="font-semibold truncate">{usuarioAtual?.nome}</span>
              <span className="hidden md:inline text-[var(--sig-muted)]">· {nomePerfilAtual}</span>
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1.5"
              onClick={sair}
            >
              <LogOut aria-hidden="true" className="size-3.5" />
              Sair
            </Button>
            <Pill tone="t-accent">{empresas.length} empresa(s)</Pill>
            {empresas.length > 0 ? (
              <>
                <label className="field !gap-1 !min-w-0">
                  <span className="sr-only">Empresa ativa</span>
                  <select
                    className="sig-input !w-auto text-xs"
                    value={empresaAtiva.id}
                    onChange={(e) => trocarEmpresaAtiva(e.target.value)}
                    aria-label="Selecionar empresa ativa"
                  >
                    {empresas.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.nomeFantasia}
                      </option>
                    ))}
                  </select>
                </label>
                <Pill
                  tone={
                    empresaAtiva.situacaoCadastral === 'ATIVA' ? 't-verde' : ('t-vermelho' as const)
                  }
                >
                  {empresaAtiva.situacaoCadastral}
                </Pill>
              </>
            ) : (
              <Button asChild size="sm" className="h-7 text-xs">
                <Link to="/empresas">
                  <Building2 className="size-3.5 mr-1" />
                  Cadastrar empresa
                </Link>
              </Button>
            )}
          </div>
        </header>

        <main className="sig-content" id="conteudo">
          <Outlet />
        </main>

        <footer className="footer-sig">
          SIGEF-ME v2.0 — os cálculos devem ser conferidos contra a escrituração oficial antes do
          envio à EFD ICMS/IPI.
        </footer>
      </div>

      {menuAberto && (
        <button
          type="button"
          aria-label="Fechar menu"
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setMenuAberto(false)}
        />
      )}
    </div>
  )
}
