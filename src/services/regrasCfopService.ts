import { DeParaVigente, RegraCfop } from '@/types/sigef'

// Armazenamento dedicado das Regras CFOP (entidade própria, fora do de-para de produtos)
const KEY_REGRAS_CFOP = 'sigef-regras-cfop'

/** CNPJ sentinel usado pelas regras no formato antigo (persistidas como DeParaVigente) */
export const CNPJ_REGRA_CFOP_LEGADO = '00000000000000'

function gerarId(): string {
  return `cfop-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`
}

export function carregarRegrasCfop(): RegraCfop[] {
  try {
    const raw = localStorage.getItem(KEY_REGRAS_CFOP)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed as RegraCfop[]
    }
  } catch (e) {
    console.error('Erro ao carregar regras CFOP do localStorage:', e)
  }
  return []
}

export function salvarRegrasCfop(regras: RegraCfop[]): void {
  try {
    localStorage.setItem(KEY_REGRAS_CFOP, JSON.stringify(regras))
  } catch (e) {
    console.error('Erro ao salvar regras CFOP no localStorage:', e)
  }
}

export function novaRegraCfop(dados: Omit<RegraCfop, 'id' | 'atualizadoEm'>): RegraCfop {
  return { ...dados, id: gerarId(), atualizadoEm: new Date().toISOString() }
}

/**
 * Migração one-shot: regras CFOP antigas eram salvas como entradas do de-para
 * (DeParaVigente com cProd 'CFOP-XXXX' e cnpjFornecedor 00000000000000).
 * Converte para a entidade própria, remove do de-para e devolve o de-para limpo.
 * Já migrado (nenhuma regra legada restante) devolve os dados sem alteração.
 */
export function migrarRegrasCfopLegadas(
  regrasAtuais: RegraCfop[],
  dePara: DeParaVigente[],
): { regras: RegraCfop[]; deParaLimpo: DeParaVigente[]; migradas: number } {
  const cfs = dePara.filter(
    (dp) =>
      dp.cProd.trim().toUpperCase().startsWith('CFOP-') &&
      dp.cnpjFornecedor.replace(/\D/g, '') === CNPJ_REGRA_CFOP_LEGADO,
  )

  if (cfs.length === 0) {
    return { regras: regrasAtuais, deParaLimpo: dePara, migradas: 0 }
  }

  const cfopsExistentes = new Set(regrasAtuais.map((r) => r.cfop))
  const convertidas: RegraCfop[] = cfs
    .map((dp) => {
      const cfop = dp.cProd
        .trim()
        .replace(/^CFOP-/i, '')
        .replace(/\D/g, '')
      return {
        id: dp.id,
        cfop,
        naturezaMovimento: dp.codigoInventario,
        descricao: dp.xProd,
        tipoOperacao: (dp.uCom === 'ENT' ? 'ENTRADA' : 'SAIDA') as RegraCfop['tipoOperacao'],
        gerarBlocoK: true,
        ativa: dp.razaoSocialFornecedor !== 'Regra fiscal interna (inativa)',
        atualizadoEm: dp.atualizadoEm || new Date().toISOString(),
      }
    })
    .filter((r) => r.cfop.length === 4 && !cfopsExistentes.has(r.cfop))

  const idsMigrados = new Set(cfs.map((dp) => dp.id))
  const deParaLimpo = dePara.filter((dp) => !idsMigrados.has(dp.id))

  return { regras: [...regrasAtuais, ...convertidas], deParaLimpo, migradas: convertidas.length }
}
