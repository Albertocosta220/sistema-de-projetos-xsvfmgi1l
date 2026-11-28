/**
 * Acesso bruto ao armazenamento — VIA bancoService (cache + PocketBase).
 * Mantém a API síncrona que SigefContext e as telas já usam; o banco é
 * sincronizado em segundo plano (hidratar + fila de gravação).
 *
 * Blindagem anti-crash (rota /login aninhada nos providers): NENHUMA leitura
 * pode propagar null/undefined/lixo — toda lista ausente ou corrompida vira [].
 */
import type { BackupHistorico, DadosEmpresaStore, Empresa } from '@/types/sigef'
import { lerRaw, gravarRaw, hidratar } from './bancoService'

export type { DadosEmpresaStore }

const prefixoStore = (idEmpresa: string) => `sigef_store_empresa_${idEmpresa}`
const CHAVE_EMPRESAS = 'sigef_empresas_lista'
const CHAVE_ID_ATIVA = 'sigef_empresa_ativa_id'
export const MARCADOR_XML_COMPACTADO = 'sigef:xml-compactado:'

const EMPRESA_VAZIA: Empresa = {
  id: '',
  razaoSocial: '',
  nomeFantasia: '',
  cnpj: '',
  inscricaoEstadual: '',
  uf: '',
  situacaoCadastral: 'ATIVA',
  bloquearFechamento: false,
}

/** Store vazia na forma completa (mesma estrutura de criarStoreVazia). */
export function storeVazia(empresa?: Empresa): DadosEmpresaStore {
  return {
    empresa: empresa ?? EMPRESA_VAZIA,
    produtos: [],
    dePara: [],
    documentos: [],
    kardex: [],
    fechamentos: [],
    ocorrencias: [],
    consultasDFe: [],
    ultimoNSU: 0,
    regrasDesqualificacao: [],
  }
}

export interface EmpresaLike {
  id: string
  razaoSocial?: string
  nomeFantasia?: string
  cnpj?: string
  [k: string]: unknown
}

/** Aceita id (string) ou o objeto empresa — o contexto chama das duas formas. */
function idDaEmpresa(empresa: string | EmpresaLike | null | undefined): string {
  if (typeof empresa === 'string') return empresa
  if (empresa && typeof empresa === 'object' && typeof empresa.id === 'string') return empresa.id
  return ''
}

function carregarEmpresasBrutas(): unknown[] {
  const raw = lerRaw(CHAVE_EMPRESAS)
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    console.error('[SIGEF] lista de empresas corrompida; ignorada')
    return []
  }
}

export function carregarEmpresasCadastradas(): Empresa[] {
  return carregarEmpresasBrutas().filter(
    (e): e is Empresa => !!e && typeof e === 'object' && typeof (e as Empresa).id === 'string',
  )
}

export function salvarEmpresasCadastradas(empresas: Empresa[]): void {
  gravarRaw(CHAVE_EMPRESAS, JSON.stringify(Array.isArray(empresas) ? empresas : []))
}

export function carregarIdEmpresaAtiva(): string {
  try {
    return localStorage.getItem(CHAVE_ID_ATIVA) ?? ''
  } catch {
    return ''
  }
}

export function salvarIdEmpresaAtiva(id: string): void {
  try {
    localStorage.setItem(CHAVE_ID_ATIVA, id)
  } catch {
    // silencioso
  }
}

/**
 * Lê a store da empresa. Aceita string (id) ou o objeto Empresa. Nunca lança
 * e nunca devolve estrutura incompleta: toda lista ausente/corrompida vira [].
 */
export function carregarDadosEmpresa(
  empresa: string | EmpresaLike | null | undefined,
): DadosEmpresaStore {
  const id = idDaEmpresa(empresa)
  const raw = id ? lerRaw(prefixoStore(id)) : null
  if (!raw) return storeVazia()
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    console.error('[SIGEF] store da empresa corrompida; iniciando vazia')
    return storeVazia()
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return storeVazia()
  const loja = parsed as Partial<DadosEmpresaStore> & Record<string, unknown>
  const base = storeVazia(loja.empresa)
  return {
    ...base,
    ...loja,
    empresa: loja.empresa ?? base.empresa,
    produtos: Array.isArray(loja.produtos) ? loja.produtos : [],
    dePara: Array.isArray(loja.dePara) ? loja.dePara : [],
    // documentos null/lixo nunca propagam (causa histórica do crash no /login)
    documentos: Array.isArray(loja.documentos)
      ? loja.documentos.filter((d) => d && typeof d === 'object')
      : [],
    kardex: Array.isArray(loja.kardex) ? loja.kardex : [],
    fechamentos: Array.isArray(loja.fechamentos) ? loja.fechamentos : [],
    ocorrencias: Array.isArray(loja.ocorrencias) ? loja.ocorrencias : [],
    consultasDFe: Array.isArray(loja.consultasDFe) ? loja.consultasDFe : [],
    ultimoNSU: typeof loja.ultimoNSU === 'number' ? loja.ultimoNSU : 0,
    competenciaAtiva: loja.competenciaAtiva || undefined,
    regrasDesqualificacao: Array.isArray(loja.regrasDesqualificacao)
      ? loja.regrasDesqualificacao
      : [],
  }
}

/** Gravação flexível: salvarDadosEmpresa(dados) na empresa ativa, ou (id, dados). */
export function salvarDadosEmpresa(a: DadosEmpresaStore | string, b?: DadosEmpresaStore): void {
  const id = typeof a === 'string' ? a : carregarIdEmpresaAtiva()
  const dados = typeof a === 'string' ? b : a
  if (!id || !dados || typeof dados !== 'object') return
  gravarRaw(prefixoStore(id), JSON.stringify(dados))
}

/**
 * Histórico de backups, SEMPRE como lista de registros completos. Registros
 * antigos (gravados como {id, criadoEm, empresaId}) ganham valores padrão —
 * a tela de Backup lê versao/dataBackup/descricao/tamanhoKb/dadosJson e um
 * registro sem eles nunca pode quebrar a listagem nem a restauração.
 */
export function carregarHistoricoBackups(): BackupHistorico[] {
  const raw = lerRaw('sigef-backups')
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((b): b is Record<string, unknown> => !!b && typeof b === 'object')
      .map((b, i) => {
        const r = b as Partial<BackupHistorico> & { id?: string; criadoEm?: string }
        const dadosJson = typeof r.dadosJson === 'string' ? r.dadosJson : ''
        return {
          versao: r.versao || r.id || `v-${i + 1}`,
          dataBackup: r.dataBackup || r.criadoEm || '',
          descricao: r.descricao || '',
          tamanhoKb:
            typeof r.tamanhoKb === 'number' && r.tamanhoKb > 0
              ? r.tamanhoKb
              : Math.max(1, Math.round(dadosJson.length / 1024)),
          dadosJson,
        }
      })
  } catch {
    return []
  }
}

/** Entrada aceita pelo registrarBackup — descrição + dados (gravados como JSON). */
export interface EntradaBackup {
  descricao?: string
  dados?: unknown
  criadoEm?: string
  versao?: string
}

/**
 * Registra um backup no histórico da empresa e DEVOLVE o registro gravado
 * (com versao/dadosJson/tamanhoKb já calculados) — o toast do contexto usa
 * bkp.versao e a restauração do histórico faz JSON.parse(bkp.dadosJson).
 */
export function registrarBackup(empresaId: string, backup: EntradaBackup): BackupHistorico {
  const dadosJson = backup.dados !== undefined ? JSON.stringify(backup.dados) : ''
  const historico = carregarHistoricoBackups()
  const registro: BackupHistorico = {
    versao: backup.versao || `v-${Date.now()}-${historico.length + 1}`,
    dataBackup: backup.criadoEm || new Date().toISOString(),
    descricao: backup.descricao || 'Backup',
    tamanhoKb: Math.max(1, Math.round(dadosJson.length / 1024)),
    dadosJson,
  }
  historico.unshift({ ...registro, empresaId } as BackupHistorico)
  gravarRaw('sigef-backups', JSON.stringify(historico.slice(0, 20)))
  return registro
}

export { hidratar }
