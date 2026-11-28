/**
 * Acesso bruto ao armazenamento — agora VIA bancoService (cache + PocketBase).
 * Mantém a API síncrona que SigefContext e as telas já usam; o banco é
 * sincronizado em segundo plano (hidratar + fila de gravação).
 */
import { lerRaw, gravarRaw, removerChave, hidratar } from './bancoService'

export interface DadosEmpresaStore {
  produtos?: unknown[]
  deParaVigente?: unknown[]
  documentos?: unknown[]
  movimentacoes?: unknown[]
  fechamentos?: unknown[]
  contagens?: unknown[]
  contagensProdutos?: unknown[]
  ocorrencias?: unknown[]
  desqualificadas?: unknown[]
  naoVinculaEstoque?: unknown[]
  consultasDfe?: unknown[]
  [k: string]: unknown
}

const prefixoStore = (idEmpresa: string) => `sigef_store_empresa_${idEmpresa}`
const CHAVE_EMPRESAS = 'sigef_empresas_lista'
const CHAVE_ID_ATIVA = 'sigef_empresa_ativa_id'
const MARCADOR_XML_COMPACTADO = 'sigef:xml-compactado:'

function carregarEmpresasBrutas(): unknown[] {
  const raw = lerRaw(CHAVE_EMPRESAS)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    console.error('[SIGEF] lista de empresas corrompida; ignorada')
    return []
  }
}

export function carregarEmpresasCadastradas(): EmpresaLike[] {
  return carregarEmpresasBrutas().filter((e): e is EmpresaLike => !!e && typeof e === 'object')
}

export interface EmpresaLike {
  id: string
  razaoSocial?: string
  nomeFantasia?: string
  cnpj?: string
  [k: string]: unknown
}

export function salvarEmpresasCadastradas(empresas: EmpresaLike[]): void {
  gravarRaw(CHAVE_EMPRESAS, JSON.stringify(empresas))
}

export function carregarIdEmpresaAtiva(): string | null {
  try {
    return localStorage.getItem(CHAVE_ID_ATIVA)
  } catch {
    return null
  }
}

export function salvarIdEmpresaAtiva(id: string): void {
  try {
    localStorage.setItem(CHAVE_ID_ATIVA, id)
  } catch {
    // silencioso
  }
}

export function carregarDadosEmpresa(idEmpresa: string): DadosEmpresaStore {
  const raw = lerRaw(prefixoStore(idEmpresa))
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    // Blindagem anti-crash: arrays ausentes/corrompidos viram []; documentos
    // null nunca propagam (causa histórica da tela de erro no /login).
    const loja = parsed as DadosEmpresaStore
    if (loja.documentos !== undefined) {
      if (!Array.isArray(loja.documentos)) {
        loja.documentos = []
      } else {
        loja.documentos = loja.documentos.filter((d) => d && typeof d === 'object')
      }
    }
    for (const campo of [
      'produtos',
      'deParaVigente',
      'movimentacoes',
      'fechamentos',
      'contagens',
      'contagensProdutos',
      'ocorrencias',
      'desqualificadas',
      'naoVinculaEstoque',
      'consultasDfe',
    ] as const) {
      if (loja[campo] !== undefined && !Array.isArray(loja[campo])) {
        ;(loja as Record<string, unknown>)[campo] = []
      }
    }
    return loja
  } catch {
    console.error('[SIGEF] store da empresa corrompida; iniciando vazia')
    return {}
  }
}

export function salvarDadosEmpresa(idEmpresa: string, dados: DadosEmpresaStore): void {
  gravarRaw(prefixoStore(idEmpresa), JSON.stringify(dados))
}

export function carregarHistoricoBackups(): Array<{
  id: string
  criadoEm: string
  empresaId: string
}> {
  const raw = lerRaw('sigef-backups')
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function registrarBackup(empresaId: string, backup: { id: string; criadoEm: string }): void {
  const historico = carregarHistoricoBackups().filter((b) => b?.empresaId === empresaId)
  historico.unshift({ ...backup, empresaId })
  gravarRaw('sigef-backups', JSON.stringify(historico.slice(0, 20)))
}

export { hidratar }
