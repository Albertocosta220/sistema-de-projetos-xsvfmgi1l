// Error Boundary global do SIGEF-ME: um erro de execução em QUALQUER tela ou
// modal não pode mais apagar o sistema inteiro (tela branca). O boundary
// intercepta o erro, mostra uma mensagem clara em português com botão para
// voltar ao Painel e registra o erro na régua de auditoria (console como
// fallback, pois o boundary pode ser montado fora do SigefContext).
import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, Home, RefreshCw } from 'lucide-react'

interface PropsBoundary {
  children: ReactNode
  /** Rótulo do bloco protegido, para a mensagem e o log (ex.: nome da tela). */
  rotulo?: string
  /**
   * false = fallback compacto (sem o quadro de página completa), para usar
   * DENTRO de modais — mantém o diálogo aberto com a mensagem de erro.
   */
  fallbackTelaCheia?: boolean
  /** Texto explicativo adicional, contextual ao bloco protegido. */
  textoErro?: string
}

interface EstadoBoundary {
  erro: Error | null
}

const CHAVE_LOG_ERROS = 'sigef-erros-runtime'

/** Loga o erro no localStorage (régua de auditoria técnica do sistema). */
function registrarErroAuditoria(rotulo: string, erro: Error, info: ErrorInfo): void {
  try {
    const registro = {
      rotulo,
      mensagem: erro?.message ?? String(erro),
      stack: erro?.stack?.split('\n').slice(0, 6).join('\n'),
      componente: info?.componentStack?.split('\n').slice(0, 4).join('\n'),
      dataHora: new Date().toISOString(),
    }
    const raw = localStorage.getItem(CHAVE_LOG_ERROS)
    const lista = raw ? (JSON.parse(raw) as unknown[]) : []
    lista.unshift(registro)
    localStorage.setItem(CHAVE_LOG_ERROS, JSON.stringify(lista.slice(0, 50)))
  } catch {
    // Armazenamento indisponível — o boundary segue apenas com a tela de erro.
  }
  // Console também recebe o erro, para diagnóstico no DevTools.
  // eslint-disable-next-line no-console
  console.error(`[SIGEF] Erro de execução em "${rotulo}":`, erro, info)
}

export class ErrorBoundary extends Component<PropsBoundary, EstadoBoundary> {
  state: EstadoBoundary = { erro: null }

  static getDerivedStateFromError(erro: Error): EstadoBoundary {
    return { erro }
  }

  componentDidCatch(erro: Error, info: ErrorInfo) {
    registrarErroAuditoria(this.props.rotulo ?? 'bloco sem rótulo', erro, info)
  }

  private voltarAoPainel = () => {
    this.setState({ erro: null })
    window.location.assign('/')
  }

  private tentarNovamente = () => {
    this.setState({ erro: null })
  }

  render() {
    if (this.state.erro) {
      const rotulo = this.props.rotulo ?? 'esta área'
      const mensagemTecnica = this.state.erro.message || String(this.state.erro)

      // Modo compacto (dentro de modais): só o quadro de erro, sem a página.
      if (this.props.fallbackTelaCheia === false) {
        return (
          <div
            className="flex items-start gap-3 rounded-lg border border-rose-300 bg-rose-50 p-4 text-sm text-rose-900"
            role="alert"
            aria-live="assertive"
          >
            <AlertTriangle className="size-5 shrink-0 mt-0.5" aria-hidden="true" />
            <div className="space-y-2 min-w-0">
              <p className="font-semibold">Ocorreu um erro ao exibir {rotulo}.</p>
              {this.props.textoErro ? <p className="text-[13px]">{this.props.textoErro}</p> : null}
              <pre className="text-[10px] font-mono whitespace-pre-wrap break-all max-h-24 overflow-y-auto">
                {mensagemTecnica}
              </pre>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-md border border-rose-300 bg-white px-3 py-1.5 text-xs font-semibold text-rose-800 hover:bg-rose-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600"
                onClick={this.tentarNovamente}
              >
                <RefreshCw className="size-3.5" aria-hidden="true" />
                Tentar novamente
              </button>
            </div>
          </div>
        )
      }

      return (
        <div className="sig-page" role="alert" aria-live="assertive">
          <div className="card-s p-8 max-w-xl mx-auto text-center space-y-4">
            <div className="mx-auto grid place-items-center size-12 rounded-full bg-rose-100 text-rose-700">
              <AlertTriangle className="size-6" aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <h1 className="text-lg font-bold text-[var(--petroleo)]">
                Ocorreu um erro ao exibir {rotulo}
              </h1>
              <p className="text-sm text-[var(--sig-muted)]">
                {this.props.textoErro ||
                  'O restante do sistema continua funcionando normalmente. Se o problema persistir, volte ao Painel e tente novamente — ou reporte a mensagem técnica abaixo ao suporte.'}
              </p>
            </div>
            <pre className="text-left text-[10px] font-mono bg-slate-100 border border-slate-200 rounded p-2 overflow-x-auto max-h-28">
              {mensagemTecnica}
            </pre>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                onClick={this.voltarAoPainel}
              >
                <Home className="size-4" aria-hidden="true" />
                Voltar ao Painel
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                onClick={this.tentarNovamente}
              >
                <RefreshCw className="size-4" aria-hidden="true" />
                Tentar novamente
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
