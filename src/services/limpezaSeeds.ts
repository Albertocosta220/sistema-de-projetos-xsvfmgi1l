import { BackupHistorico, DadosEmpresaStore, DocumentoFiscal, Empresa } from '@/types/sigef'
import { MARCADOR_XML_COMPACTADO } from './storageService'

const KEY_EMPRESA_ATIVA = 'sigef_empresa_ativa_id'
const KEY_EMPRESAS_CADASTRO = 'sigef_empresas_lista'
const KEY_PREFIX_STORE = 'sigef_store_empresa_'
const KEY_BACKUP_HISTORICO = 'sigef_backup_historico'
const KEY_FLAG_SEEDS_REMOVIDOS = 'sigef-seeds-removidos'

// IDs/valores fixos usados APENAS pelos dados de exemplo da v0.x (seed VB Metais / ALENA / ALL METALS).
// Nada criado pelo usuário pelo app usa estes identificadores.
const IDS_SEED_EMPRESAS = ['vb-metais', 'alena', 'all-metals']

const IDS_SEED_REGRAS_CFOP = ['dp-1', 'dp-2', 'dp-3', 'dp-4', 'dp-5', 'cfop-exemplo']

// Placeholder usado apenas quando NÃO existe empresa ativa (nenhuma cadastrada).
// Nunca é gravado no localStorage — o Painel mostra onboarding de cadastro.
export const EMPRESA_PLACEHOLDER: Empresa = {
  id: '',
  razaoSocial: '',
  nomeFantasia: '',
  cnpj: '',
  inscricaoEstadual: '',
  uf: '',
  situacaoCadastral: 'ATIVA',
  bloquearFechamento: false,
}

function isFlagAtiva(): boolean {
  try {
    return localStorage.getItem(KEY_FLAG_SEEDS_REMOVIDOS) === 'true'
  } catch {
    return true // sem localStorage disponível: não tenta limpar
  }
}

function marcarFlag(): void {
  try {
    localStorage.setItem(KEY_FLAG_SEEDS_REMOVIDOS, 'true')
  } catch {
    // silencioso: sem storage não há o que persistir
  }
}

/**
 * Limpeza one-shot de produção: remove SOMENTE os registros semeados de exemplo
 * (empresas fictícias, produtos, de-para, fechamentos, consultas DF-e e as stores
 * inteiras ligadas às empresas de exemplo). Registros criados pelo usuário nunca
 * são apagados. Roda uma única vez — depois de executada, grava a flag
 * 'sigef-seeds-removidos' e não roda de novo.
 */
export function limparDadosSeedsOneShot(): void {
  if (isFlagAtiva()) return
  try {
    // 1. Empresas semeadas
    const empresasRaw = localStorage.getItem(KEY_EMPRESAS_CADASTRO)
    if (empresasRaw) {
      const empresas: Empresa[] = JSON.parse(empresasRaw)
      const restantes = empresas.filter((e) => !IDS_SEED_EMPRESAS.includes(e.id))
      if (restantes.length !== empresas.length) {
        if (restantes.length > 0) {
          localStorage.setItem(KEY_EMPRESAS_CADASTRO, JSON.stringify(restantes))
        } else {
          localStorage.removeItem(KEY_EMPRESAS_CADASTRO)
        }
      }
    }

    // 2. Store completa das empresas de exemplo (produtos, de-para, notas, kardex, fechamentos...)
    IDS_SEED_EMPRESAS.forEach((id) => {
      localStorage.removeItem(`${KEY_PREFIX_STORE}${id}`)
    })

    // 3. Empresa ativa apontando para empresa removida
    const ativaRaw = localStorage.getItem(KEY_EMPRESA_ATIVA)
    if (ativaRaw && IDS_SEED_EMPRESAS.includes(ativaRaw)) {
      localStorage.removeItem(KEY_EMPRESA_ATIVA)
    }

    // 4. Backups registrados com dados de exemplo (referenciam empresas removidas)
    const backupsRaw = localStorage.getItem(KEY_BACKUP_HISTORICO)
    if (backupsRaw) {
      try {
        const backups: BackupHistorico[] = JSON.parse(backupsRaw)
        const restantes = backups.filter((b) => {
          const texto = `${b.descricao ?? ''} ${b.dadosJson ?? ''}`
          return !/VB Metais|ALENA|ALL METALS/.test(texto)
        })
        if (restantes.length !== backups.length) {
          if (restantes.length > 0) {
            localStorage.setItem(KEY_BACKUP_HISTORICO, JSON.stringify(restantes))
          } else {
            localStorage.removeItem(KEY_BACKUP_HISTORICO)
          }
        }
      } catch {
        // histórico corrompido: mantém como está, não bloqueia a limpeza
      }
    }

    // 5. Regras CFOP semeadas de exemplo: eram persistidas como DeParaVigente com
    //    cProd 'CFOP-XXXX' e cnpjFornecedor 00000000000000 (formato legado) OU como
    //    entidades com ids do de-para de exemplo. Regras criadas pelo usuário
    //    (ids gerados via crypto.randomUUID) nunca são removidas.
    const regrasRaw = localStorage.getItem('sigef-regras-cfop')
    if (regrasRaw) {
      try {
        const regras = JSON.parse(regrasRaw) as Array<{ id: string }>
        if (Array.isArray(regras)) {
          const restantes = regras.filter((r) => !IDS_SEED_REGRAS_CFOP.includes(r.id))
          if (restantes.length !== regras.length) {
            if (restantes.length > 0) {
              localStorage.setItem('sigef-regras-cfop', JSON.stringify(restantes))
            } else {
              localStorage.removeItem('sigef-regras-cfop')
            }
          }
        }
      } catch {
        // mantém: usuário pode ter dados reais; só ignora JSON inválido
      }
    }
  } finally {
    marcarFlag()
  }
}

/**
 * Cria a estrutura vazia de produção para uma empresa recém-cadastrada.
 * Substitui o antigo seed de exemplo — o app parte sempre de dados zerados.
 */
export function criarStoreVazia(empresa: Empresa): DadosEmpresaStore {
  return {
    empresa,
    produtos: [],
    dePara: [],
    documentos: [],
    kardex: [],
    fechamentos: [],
    ocorrencias: [],
    consultasDFe: [],
    ultimoNSU: 0,
    competenciaAtiva: undefined,
  }
}

/**
 * Normaliza uma store carregada do localStorage: garante que todo campo
 * exista (stores antigas podem ter sido salvas sem os campos novos, como
 * competenciaAtiva). Sem isto, telas lidas de array undefined quebram.
 */
export function normalizarStore(dados: DadosEmpresaStore): DadosEmpresaStore {
  const vazia = criarStoreVazia(dados?.empresa ?? EMPRESA_PLACEHOLDER)
  return {
    ...vazia,
    ...dados,
    empresa: dados?.empresa ?? vazia.empresa,
    produtos: Array.isArray(dados?.produtos) ? dados.produtos : [],
    dePara: Array.isArray(dados?.dePara) ? dados.dePara : [],
    documentos: Array.isArray(dados?.documentos) ? sanitizarDocumentos(dados.documentos) : [],
    kardex: Array.isArray(dados?.kardex) ? dados.kardex : [],
    fechamentos: Array.isArray(dados?.fechamentos) ? dados.fechamentos : [],
    ocorrencias: Array.isArray(dados?.ocorrencias) ? dados.ocorrencias : [],
    consultasDFe: Array.isArray(dados?.consultasDFe) ? dados.consultasDFe : [],
    ultimoNSU: typeof dados?.ultimoNSU === 'number' ? dados.ultimoNSU : 0,
    competenciaAtiva: dados?.competenciaAtiva || undefined,
  }
}

/**
 * Documentos sem itens nem emitente são artefatos do re-parse por cota removido
 * na v0.0.23 (uma store antiga podia ter sido salva com notas sobrescritas por
 * dados vazios: chave '', emitente '', itens []). Sem itens/emitente eles não
 * participam de NENHUM fluxo (vínculo automático, kardex, auditoria) — mantê-los
 * só polui a fila com registros "vazios" e some o fornecedor da tela
 * Fornecedores. Descartados na carga: o usuário reimporta os XMLs originais.
 */
export function documentoVazio(d: DocumentoFiscal): boolean {
  return (
    (d.itens?.length ?? 0) === 0 &&
    !d.cnpjEmitente?.replace(/\D/g, '') &&
    !d.chaveAcesso?.replace(/\D/g, '')
  )
}

function sanitizarDocumentos(documentos: DocumentoFiscal[]): DocumentoFiscal[] {
  return documentos
    .filter((d) => d && !documentoVazio(d))
    .map((d) => ({
      ...d,
      // Garante os campos que o vínculo automático e o kardex varrem:
      // cnpjEmitente é o agrupador da tela Fornecedores e itens alimenta a
      // coleta de pares — um documento restaurado sem eles quebraria (ou
      // esconderia) o botão "Cadastrar e vincular automaticamente".
      cnpjEmitente: d.cnpjEmitente ?? '',
      nomeEmitente: d.nomeEmitente ?? '',
      chaveAcesso: d.chaveAcesso ?? '',
      itens: Array.isArray(d.itens) ? d.itens : [],
    }))
}
