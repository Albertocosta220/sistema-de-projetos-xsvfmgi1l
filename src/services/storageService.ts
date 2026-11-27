import { BackupHistorico, DadosEmpresaStore, Empresa } from '@/types/sigef'
import { EMPRESA_PLACEHOLDER, criarStoreVazia } from './limpezaSeeds'

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
        return parsed
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
      return JSON.parse(raw)
    }
  } catch (e) {
    console.error(`Erro ao carregar dados da empresa ${empresa.id}:`, e)
  }

  // Produção: empresa nova começa com estrutura zerada
  const vazia = criarStoreVazia(empresa)
  salvarDadosEmpresa(vazia)
  return vazia
}

export function salvarDadosEmpresa(dados: DadosEmpresaStore): void {
  if (!dados?.empresa?.id) return
  const chave = `${KEY_PREFIX_STORE}${dados.empresa.id}`
  try {
    localStorage.setItem(chave, JSON.stringify(dados))
  } catch (e) {
    console.error(`Erro ao salvar dados da empresa ${dados.empresa.id}:`, e)
  }
}

export function carregarHistoricoBackups(): BackupHistorico[] {
  try {
    const raw = localStorage.getItem(KEY_BACKUP_HISTORICO)
    if (raw) {
      return JSON.parse(raw)
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
