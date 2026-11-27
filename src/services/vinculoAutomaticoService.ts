// Vínculo automático de fornecedor (emitente de NF-e) → catálogo de inventário.
// Fluxo pedido pelo usuário: a partir do CNPJ do emitente, cadastra o fornecedor
// com os dados das notas, varre os itens emitidos por ele e cria os vínculos de
// de-para (cProd → codigoInventario) para os itens que JÁ existem no catálogo.
// Itens sem produto correspondente NÃO são inventados: ficam como pendência
// "cadastrar produto".
import { DeParaVigente, DocumentoFiscal, Produto } from '@/types/sigef'

export interface ParItemFornecedor {
  cProd: string // Código do item no fornecedor
  xProd: string // Descrição do item na nota
  uCom: string // Unidade de compra
}

/** Normaliza um código para comparação: trim, maiúsculas e zeros à esquerda removidos. */
export function normalizarCodigo(valor: string): string {
  const t = (valor || '').trim().toUpperCase()
  const semZeros = t.replace(/^0+/, '')
  return semZeros.length > 0 ? semZeros : t
}

/**
 * Varre TODOS os itens de TODAS as notas emitidas pelo CNPJ (ignorando
 * canceladas) e agrupa os pares únicos cProd + xProd.
 */
export function coletarParesUnicos(
  documentos: DocumentoFiscal[],
  cnpjFornecedor: string,
): ParItemFornecedor[] {
  const cnpj = cnpjFornecedor.replace(/\D/g, '')
  const mapa = new Map<string, ParItemFornecedor>()

  documentos
    .filter((d) => {
      const emit = (d?.cnpjEmitente || '').replace(/\D/g, '')
      return emit === cnpj && d.status !== 'CANCELADO'
    })
    .forEach((d) => {
      // Documentos restaurados do storage podem ter chegado sem o array de itens
      // (XML bruto descartado por cota); sem a defesa, o forEach quebra e o botão
      // "Cadastrar e vincular automaticamente" falha em silêncio.
      const itens = Array.isArray(d?.itens) ? d.itens : []
      itens.forEach((it) => {
        if (!it?.cProd) return
        const chave = normalizarCodigo(it.cProd)
        if (!chave) return
        const atual = mapa.get(chave)
        if (!atual) {
          mapa.set(chave, {
            cProd: it.cProd.trim(),
            xProd: (it.xProd || '').trim(),
            uCom: (it.uCom || 'UN').trim().toUpperCase(),
          })
        } else if ((it.xProd || '').trim().length > atual.xProd.length) {
          // Mantém a descrição mais completa já vista para o mesmo código
          atual.xProd = (it.xProd || '').trim()
        }
      })
    })

  return Array.from(mapa.values())
}

/** Produto do catálogo cujo codigoInventario corresponde ao cProd (exato ou normalizado). */
export function encontrarProdutoPorCProd(
  produtos: Produto[] | undefined,
  cProd: string,
): Produto | undefined {
  const alvo = (cProd || '').trim()
  if (!alvo || !Array.isArray(produtos)) return undefined
  return (
    produtos.find((p) => p.codigoInventario === alvo) ||
    produtos.find((p) => normalizarCodigo(p.codigoInventario) === normalizarCodigo(alvo))
  )
}

export interface ResultadoMontagemVinculos {
  /** Vínculos prontos para gravar (somente itens com produto correspondente). */
  vinculos: Array<Omit<DeParaVigente, 'id' | 'atualizadoEm'>>
  /** Itens sem correspondência no catálogo — pendência "cadastrar produto". */
  pendentes: ParItemFornecedor[]
  totalPares: number
}

/**
 * Monta os vínculos de de-para para os pares do emitente:
 * - produto correspondente no catálogo → vínculo com fator 1, descrição do
 *   fornecedor (xProd) preenchida e unidade de compra da nota;
 * - sem correspondência → pendência (nenhum produto inventado).
 */
export function montarVinculosAutomaticos(params: {
  cnpjFornecedor: string
  razaoSocialFornecedor: string
  pares: ParItemFornecedor[]
  produtos: Produto[]
  deParaAtuais: DeParaVigente[]
}): ResultadoMontagemVinculos {
  const { cnpjFornecedor, razaoSocialFornecedor, pares, produtos, deParaAtuais } = params
  const cnpjLimpo = cnpjFornecedor.replace(/\D/g, '')

  const vinculos: Array<Omit<DeParaVigente, 'id' | 'atualizadoEm'>> = []
  const pendentes: ParItemFornecedor[] = []

  pares.forEach((par) => {
    const produto = encontrarProdutoPorCProd(produtos, par.cProd)
    if (!produto) {
      pendentes.push(par)
      return
    }

    // Já existe vínculo manual/atual para este CNPJ + cProd? Atualiza em cima.
    const existente = deParaAtuais.find(
      (dp) =>
        dp.cnpjFornecedor.replace(/\D/g, '') === cnpjLimpo &&
        normalizarCodigo(dp.cProd) === normalizarCodigo(par.cProd),
    )
    if (existente && existente.codigoInventario === produto.codigoInventario) {
      // Vínculo idêntico já cadastrado — preserva (não cria duplicado nem toca)
      return
    }

    vinculos.push({
      cnpjFornecedor: cnpjLimpo,
      razaoSocialFornecedor,
      cProd: par.cProd,
      xProd: par.xProd,
      uCom: par.uCom,
      fatorConversao: 1,
      codigoInventario: produto.codigoInventario,
    })
  })

  return { vinculos, pendentes, totalPares: pares.length }
}
