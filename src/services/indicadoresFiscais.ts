// Indicadores fiscais do Painel (dashboard) — cálculo puro, sem persistência.
//
// Fontes: os MESMOS stores que alimentam Kardex, Inventário e Importar
// (via SigefContext). Nada novo é gravado no localStorage — o app já sofreu
// problema de cota de armazenamento.
//
// Regras respeitadas:
// - Documentos desqualificados p/ inventário ou marcados "Não controla
//   estoque" (alias da mesma regra CNPJ + cProd) ficam FORA dos indicadores
//   de estoque e dos totais fiscais do período.
// - Notas CANCELADAS não somam nos totais fiscais (o cancelamento já estornou
//   os saldos no Kardex — Regra A05).
// - Isolamento multiempresa: quem chama passa apenas os dados da empresa ativa
//   (o SigefContext já expõe somente a store da empresa ativa).
import type {
  CompetenciaFechamento,
  DocumentoFiscal,
  MovimentoKardex,
  Produto,
} from '@/types/sigef'

export interface PendenciasFila {
  aguardandoDePara: number
  erro: number
  duplicidade: number
  total: number
}

export interface TotaisFiscaisPeriodo {
  icms: number
  ipi: number
  pis: number
  cofins: number
  ibs: number
  cbs: number
  /** Notas válidas que entraram na soma (processadas, não desqualificadas). */
  notasConsideradas: number
  /** IBS/CBS só é exibido quando existe valor destacado no modelo/período. */
  temIbsCbs: boolean
}

export interface PontoEvolucaoEstoque {
  competencia: string
  saldoEscriturado: number
  /** Valor homologado no fechamento da competência, quando existir. */
  valorHomologado: number | null
}

export interface ItemRankingEstoque {
  codigoInventario: string
  descricao: string
  unidade: string
  quantidade: number
  custoMedio: number
  valorTotal: number
}

export interface IndicadoresFiscaisPainel {
  competencia: string
  valorTotalEstoque: number
  itensCadastrados: number
  itensEmEstoque: number
  notasProcessadasPeriodo: number
  pendencias: PendenciasFila
  totaisFiscais: TotaisFiscaisPeriodo
  evolucao: PontoEvolucaoEstoque[]
  ranking: ItemRankingEstoque[]
}

/** Nota válida p/ totais do período: processada e sem marca de desqualificação. */
function notaValidaParaTotais(doc: DocumentoFiscal): boolean {
  return (
    doc.status === 'PROCESSADO' &&
    !doc.desqualificadaParaInventario &&
    !doc.naoControlaEstoque &&
    !doc.naoVinculaEstoque
  )
}

function saldoUltimoMovimento(kardex: MovimentoKardex[], codigoInventario: string) {
  const movs = kardex.filter((k) => k.codigoInventario === codigoInventario)
  return movs.length > 0 ? movs[movs.length - 1] : undefined
}

/**
 * Evolução do valor do estoque por competência: replay do Kardex
 * chronológico — para cada mês, o saldo de cada produto é o saldo do último
 * movimento dele até o fim daquele mês. Só dados reais gravados (nenhuma
 * projeção é inventada); competências fechadas também mostram o valor
 * homologado do fechamento.
 */
function montarEvolucao(
  kardex: MovimentoKardex[],
  fechamentos: CompetenciaFechamento[],
  competenciaAtiva: string,
): PontoEvolucaoEstoque[] {
  const meses = new Set<string>()
  kardex.forEach((k) => {
    const mes = k.dataMovimento?.slice(0, 7)
    if (mes) meses.add(mes)
  })
  fechamentos.forEach((f) => {
    if (f.competencia) meses.add(f.competencia)
  })
  if (competenciaAtiva) meses.add(competenciaAtiva)

  const ordenados = meses.size > 0 ? Array.from(meses).sort() : []

  const kardexOrdenado = [...kardex].sort((a, b) =>
    (a.dataMovimento || '').localeCompare(b.dataMovimento || ''),
  )

  const saldoPorProduto = new Map<string, { valor: number; quantidade: number }>()
  const serie: PontoEvolucaoEstoque[] = []
  let idx = 0

  ordenados.forEach((mes) => {
    // Limite superior do mês: '-31' cobre todos os dias reais (28/30/31) e
    // exclui o mês seguinte na comparação de string YYYY-MM-DD.
    const limite = `${mes}-31`
    while (
      idx < kardexOrdenado.length &&
      (kardexOrdenado[idx].dataMovimento || '').slice(0, 10) <= limite
    ) {
      const mov = kardexOrdenado[idx]
      if (mov.codigoInventario) {
        saldoPorProduto.set(mov.codigoInventario, {
          valor: mov.saldoValorTotal,
          quantidade: mov.saldoQuantidade,
        })
      }
      idx++
    }
    let saldo = 0
    saldoPorProduto.forEach((s) => {
      saldo += s.valor
    })
    const fechamento = fechamentos.find((f) => f.competencia === mes)
    serie.push({
      competencia: mes,
      saldoEscriturado: saldo,
      valorHomologado: fechamento ? fechamento.valorTotalEstoque : null,
    })
  })

  return serie
}

function montarRanking(produtos: Produto[], kardex: MovimentoKardex[]): ItemRankingEstoque[] {
  const itens: ItemRankingEstoque[] = produtos
    .map((p) => {
      const ultimo = saldoUltimoMovimento(kardex, p.codigoInventario)
      return {
        codigoInventario: p.codigoInventario,
        descricao: p.descricao,
        unidade: p.unidade,
        quantidade: ultimo ? ultimo.saldoQuantidade : 0,
        custoMedio: ultimo ? ultimo.custoMedioUnitario : 0,
        valorTotal: ultimo ? ultimo.saldoValorTotal : 0,
      }
    })
    .filter((it) => it.valorTotal > 0.0001 || it.quantidade > 0.0001)
  return itens.sort((a, b) => b.valorTotal - a.valorTotal).slice(0, 10)
}

export function calcularIndicadoresFiscais(params: {
  competencia: string
  produtos: Produto[]
  documentos: DocumentoFiscal[]
  kardex: MovimentoKardex[]
  fechamentos: CompetenciaFechamento[]
}): IndicadoresFiscaisPainel {
  const { competencia, produtos, documentos, kardex, fechamentos } = params

  // ===== Estoque: o Kardex JÁ exclui desqualificadas/"não controla estoque" e
  // estornos de canceladas (reprocessarKardexCronologico), logo o saldo
  // escriturado é o saldo conforme as regras existentes.
  let valorTotalEstoque = 0
  let itensEmEstoque = 0
  produtos.forEach((p) => {
    const ultimo = saldoUltimoMovimento(kardex, p.codigoInventario)
    if (!ultimo) return
    valorTotalEstoque += ultimo.saldoValorTotal
    if (ultimo.saldoQuantidade > 0.0001) itensEmEstoque++
  })

  // ===== Fila de pendências (estado atual da fila da empresa ativa)
  // Documentos com marca derivada de desqualificação / "não controla estoque" /
  // "não vincular" NÃO são pendência de De-Para nem erro: a regra CNPJ + cProd
  // já define que o item não gera vínculo/estoque — não há o que resolver.
  // Mesmo filtro defensivo aplicado nos totais (notaValidaParaTotais).
  const pendencias: PendenciasFila = {
    aguardandoDePara: documentos.filter(
      (d) =>
        d.status === 'AGUARDANDO_DE_PARA' &&
        !d.desqualificadaParaInventario &&
        !d.naoControlaEstoque &&
        !d.naoVinculaEstoque,
    ).length,
    erro: documentos.filter((d) => d.status === 'ERRO').length,
    duplicidade: documentos.filter((d) => d.status === 'DUPLICIDADE').length,
    total: 0,
  }
  pendencias.total = pendencias.aguardandoDePara + pendencias.erro + pendencias.duplicidade

  // ===== Notas processadas na competência ativa (entradas + saídas)
  const notasProcessadasPeriodo = documentos.filter(
    (d) => d.status === 'PROCESSADO' && d.dataEmissao?.slice(0, 7) === competencia,
  ).length

  // ===== Totais fiscais das notas do período (destaques das notas importadas)
  const totaisFiscais: TotaisFiscaisPeriodo = {
    icms: 0,
    ipi: 0,
    pis: 0,
    cofins: 0,
    ibs: 0,
    cbs: 0,
    notasConsideradas: 0,
    temIbsCbs: false,
  }
  documentos.forEach((doc) => {
    if (!notaValidaParaTotais(doc)) return
    if (doc.dataEmissao?.slice(0, 7) !== competencia) return
    totaisFiscais.notasConsideradas++

    const itens = Array.isArray(doc.itens) ? doc.itens : []
    itens.forEach((it) => {
      totaisFiscais.icms += it.vICMS || 0
      totaisFiscais.pis += it.vPIS || 0
      totaisFiscais.cofins += it.vCOFINS || 0
      totaisFiscais.ibs += it.vIBS || 0
      totaisFiscais.cbs += it.vCBS || 0
    })
    // IPI não existe por item no modelo (ItemNFe) — vem do totalizador do
    // espelho estruturado gravado na importação (sem re-parse do XML).
    const vIpi = doc.espelho?.totais?.vIPI
    if (typeof vIpi === 'number') totaisFiscais.ipi += vIpi
  })
  totaisFiscais.temIbsCbs = totaisFiscais.ibs > 0.0001 || totaisFiscais.cbs > 0.0001

  return {
    competencia,
    valorTotalEstoque,
    itensCadastrados: produtos.length,
    itensEmEstoque,
    notasProcessadasPeriodo,
    pendencias,
    totaisFiscais,
    evolucao: montarEvolucao(kardex, fechamentos, competencia),
    ranking: montarRanking(produtos, kardex),
  }
}
