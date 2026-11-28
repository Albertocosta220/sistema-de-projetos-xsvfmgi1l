import { BackupHistorico, DadosEmpresaStore, Empresa } from '@/types/sigef'
import { EMPRESA_PLACEHOLDER, criarStoreVazia, normalizarStore } from './limpezaSeeds'

const KEY_EMPRESA_ATIVA = 'sigef_empresa_ativa_id'
const KEY_EMPRESAS_CADASTRO = 'sigef_empresas_lista'
const KEY_PREFIX_STORE = 'sigef_store_empresa_'
const KEY_BACKUP_HISTORICO = 'sigef_backup_historico'

export function carregarEmpresasCadastradas(): Empresa[] {
  try {
    const raw = localStorage.getItem(KEY_EMPRESAS_CADASTRO)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Empresa corrompida (null/lixo) no array: descartada — o SigefProvider
        // (e com ele a rota /login) roda dentro deste boot.
        return parsed.filter((e) => e && typeof e === 'object' && typeof e.id === 'string')
      }
    }
  } catch (e) {
    console.error('Erro ao ler empresas do localStorage:', e)
  }
  // Produção: sem empresas cadastradas, inicia vazio (onboarding de primeira empresa)
  return []
}

export function salvarEmpresasCadastradas(empresas: Empresa[]): void {
  try {
    localStorage.setItem(KEY_EMPRESAS_CADASTRO, JSON.stringify(empresas))
  } catch (e) {
    console.error('Erro ao salvar empresas no localStorage:', e)
  }
}

export function carregarIdEmpresaAtiva(): string {
  try {
    const id = localStorage.getItem(KEY_EMPRESA_ATIVA)
    if (id) return id
  } catch (e) {
    console.error('Erro ao ler id da empresa ativa:', e)
  }
  return ''
}

export function salvarIdEmpresaAtiva(empresaId: string): void {
  try {
    localStorage.setItem(KEY_EMPRESA_ATIVA, empresaId)
  } catch (e) {
    console.error('Erro ao salvar id da empresa ativa:', e)
  }
}

export function carregarDadosEmpresa(empresa: Empresa | undefined): DadosEmpresaStore {
  if (!empresa) {
    return criarStoreVazia(EMPRESA_PLACEHOLDER)
  }
  const chave = `${KEY_PREFIX_STORE}${empresa.id}`
  try {
    const raw = localStorage.getItem(chave)
    if (raw) {
      return normalizarStore(JSON.parse(raw))
    }
  } catch (e) {
    console.error(`Erro ao carregar dados da empresa ${empresa.id}:`, e)
  }

  // Produção: empresa nova começa com estrutura zerada
  const vazia = criarStoreVazia(empresa)
  salvarDadosEmpresa(vazia)
  return vazia
}

/**
 * Marcador gravado no lugar do XML bruto persistido. O parse da NF-e já extraiu
 * itens, emitente, destinatário, valores e chave de acesso — nada no app usa o
 * XML inteiro do storage — então ele NÃO vai para o localStorage: um XML de
 * ~200 KB viraria a causa nº 1 de estouro de cota (~5 MB) e a importação
 * "sumiria" ao sair do sistema (setItem falhando em silêncio).
 */
export const MARCADOR_XML_COMPACTADO = '<!--XML_COMPACTADO_QUOTA-->'

export function salvarDadosEmpresa(dados: DadosEmpresaStore): void {
  if (!dados?.empresa?.id) return
  const chave = `${KEY_PREFIX_STORE}${dados.empresa.id}`
  // Persiste SEM o XML bruto: cada documento mantém todos os campos estruturados
  // (itens, emitente, valores, status) e apenas o marcador no xmlOriginal. A
  // escrituração completa — documentos, kardex, de-para, regras CFOP, fechamentos
  // e competência ativa — continua gravada por empresa.
  const persistido: DadosEmpresaStore = {
    ...dados,
    documentos: (Array.isArray(dados.documentos) ? dados.documentos : [])
      .filter((d) => d && typeof d === 'object')
      .map((d) => ({ ...d, xmlOriginal: MARCADOR_XML_COMPACTADO })),
  }
  try {
    localStorage.setItem(chave, JSON.stringify(persistido))
  } catch (e) {
    console.error(`Erro ao salvar dados da empresa ${dados.empresa.id}:`, e)
    console.warn(
      `Cota do localStorage estourada mesmo sem XMLs brutos: verifique o volume de lançamentos da empresa ${dados.empresa.id}.`,
    )
  }
}

export function carregarHistoricoBackups(): BackupHistorico[] {
  try {
    const raw = localStorage.getItem(KEY_BACKUP_HISTORICO)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed.filter((b) => b && typeof b === 'object')
    }
  } catch (e) {
    console.error('Erro ao carregar histórico de backups:', e)
  }
  return []
}

export function registrarBackup(descricao: string, dadosCompletos: unknown): BackupHistorico {
  const historico = carregarHistoricoBackups()
  const jsonStr = JSON.stringify(dadosCompletos, null, 2)
  const tamanhoKb = Math.round((jsonStr.length / 1024) * 10) / 10

  const novoBackup: BackupHistorico = {
    versao: `v${historico.length + 1}.${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`,
    dataBackup: new Date().toISOString(),
    descricao,
    tamanhoKb,
    dadosJson: jsonStr,
  }

  // Mantém no histórico as últimas 10 versões
  const atualizado = [novoBackup, ...historico].slice(0, 10)
  try {
    localStorage.setItem(KEY_BACKUP_HISTORICO, JSON.stringify(atualizado))
  } catch (e) {
    console.error('Erro ao registrar histórico de backup:', e)
  }

  return novoBackup
}
