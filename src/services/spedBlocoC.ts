import { DocumentoFiscal, Empresa, ItemNFe, Produto } from '@/types/sigef'

/**
 * Bloco C do SPED Fiscal (EFD-ICMS/IPI): NF-e emitidas ou recebidas.
 * Registros gerados: C100 (cabeçalho do documento) e C170 (itens), além do
 * C990 (encerramento do bloco) e a linha 0990/contagem usada pelo Bloco 9.
 */

export interface ItemSpedC170 {
  nItem: number
  codItem: string // COD_ITEM vinculado ao código de inventário do de-para
  descrCompl: string
  ncm: string
  cstIcms: string
  cfop: string
  qtd: number // quantidade já convertida pelo fator do de-para
  unid: string // unidade de inventário
  vlItem: number // valor líquido dos tributos deduzidos no custo
  vlBcIcms: number
  aliqIcms: number
  vlIcms: number
  vlIpi: number
}

export interface DocSpedC100 {
  registro: 'C100'
  indOper: '0' | '1' // 0 - entrada, 1 - saída
  indEmit: '0' | '1' // 0 - emissão própria, 1 - terceiros
  codPart: string // CNPJ do participante (fornecedor na entrada / destinatário na saída)
  codMod: '55' // NF-e
  codSit: '00' | '02' // 00 - regular, 02 - cancelada
  ser: string
  numDoc: string
  chvNfe: string
  dtDoc: string
  dtES: string
  vlDoc: number
  indPgto: '0' | '1' | '2'
  vlMerc: number
  indFrt: '0' | '1' | '9'
  vlFrt: number
  vlSeg: number
  vlOutDa: number
  vlBcIcms: number
  vlIcms: number
  vlIpi: number
  itens: ItemSpedC170[]
}

export interface ResultadoBlocoC {
  registros: DocSpedC100[]
  totalC100: number
  totalC170: number
}

/**
 * Monta os registros C100/C170 do Bloco C a partir dos documentos
 * fiscais processados e cancelados da empresa ativa, coerentes com os
 * dados que alimentam o Kardex (quantidade já convertida pelo fator do
 * de-para e valores líquidos dos tributos deduzidos no custo).
 *
 * - PROCESSADO: C100 com COD_SIT "00" (regular) e seus itens C170.
 * - CANCELADO:  C100 com COD_SIT "02" (NF-e cancelada) e SEM itens C170,
 *   pois o cancelamento já estornou os saldos no Kardex — o registro
 *   existe apenas para comunicar a situação ao fisco.
 * - Demais status (AGUARDANDO_DE_PARA, ERRO, DUPLICIDADE, PENDENTE)
 *   permanecem fora do Bloco C.
 */
export function montarBlocoC(params: {
  empresa: Empresa
  competencia: string // YYYY-MM
  produtos: Produto[]
  documentos: DocumentoFiscal[]
}): ResultadoBlocoC {
  const { empresa, competencia, produtos, documentos } = params
  const [anoStr, mesStr] = competencia.split('-')
  const ano = parseInt(anoStr, 10)
  const mes = parseInt(mesStr, 10)
  const dtIni = new Date(ano, mes - 1, 1)
  const dtFin = new Date(ano, mes, 0)

  const docIdsJaLancados = new Set<string>()
  const registros: DocSpedC100[] = []

  const docsProcessados = documentos
    .filter(
      (d) =>
        (d.status === 'PROCESSADO' || d.status === 'CANCELADO') &&
        !docIdsJaLancados.has(d.id) &&
        new Date(d.dataEmissao) >= dtIni &&
        new Date(d.dataEmissao) <= dtFin,
    )
    .sort((a, b) => {
      // Ordena por data de emissão e, em seguida, por número da nota
      const diffData = new Date(a.dataEmissao).getTime() - new Date(b.dataEmissao).getTime()
      if (diffData !== 0) return diffData
      const numA = parseInt(a.numero.replace(/\D/g, ''), 10) || 0
      const numB = parseInt(b.numero.replace(/\D/g, ''), 10) || 0
      return numA - numB
    })

  docsProcessados.forEach((doc) => {
    docIdsJaLancados.add(doc.id)

    const indOper: '0' | '1' = doc.tipoOperacao === 'SAIDA' ? '1' : '0'
    // Entrada: emitente é o fornecedor (terceiros). Saída: emissão própria.
    const indEmit: '0' | '1' = doc.tipoOperacao === 'SAIDA' ? '0' : '1'
    const codPart = (
      doc.tipoOperacao === 'SAIDA' ? doc.cnpjDestinatario : doc.cnpjEmitente
    ).replace(/\D/g, '')

    const isCancelado = doc.status === 'CANCELADO'

    // Nota cancelada: apenas o C100 com COD_SIT 02, SEM itens C170 —
    // o cancelamento já estornou os saldos no Kardex, e valores de item
    // gerariam crédito/saída que não existem mais.
    const itensC170: ItemSpedC170[] = isCancelado
      ? []
      : doc.itens.map((item) => montarItemC170(item, produtos, doc.tipoOperacao === 'ENTRADA'))

    const vlMerc = doc.itens.reduce((s, it) => s + it.vProd, 0)
    const vlBcIcms = itensC170.reduce((s, it) => s + it.vlBcIcms, 0)
    const vlIcms = itensC170.reduce((s, it) => s + it.vlIcms, 0)
    const vlIpi = itensC170.reduce((s, it) => s + it.vlIpi, 0)

    registros.push({
      registro: 'C100',
      indOper,
      indEmit,
      codPart,
      codMod: '55',
      codSit: isCancelado ? '02' : '00',
      ser: doc.serie,
      numDoc: doc.numero,
      chvNfe: doc.chaveAcesso,
      dtDoc: formatarDataSped(doc.dataEmissao),
      dtES: formatarDataSped(doc.dataEntradaSaida || doc.dataEmissao),
      vlDoc: doc.valorTotal,
      indPgto: '2',
      vlMerc,
      indFrt: '9',
      vlFrt: doc.itens.reduce((s, it) => s + (it.vFrete || 0), 0),
      vlSeg: 0,
      vlOutDa: 0,
      vlBcIcms,
      vlIcms,
      vlIpi,
      itens: itensC170,
    })
  })

  return {
    registros,
    totalC100: registros.length,
    totalC170: registros.reduce((s, r) => s + r.itens.length, 0),
  }
}

// Chaves de tributos deduzidos no custo líquido de aquisição (Regra A06)
function montarItemC170(item: ItemNFe, produtos: Produto[], isEntrada: boolean): ItemSpedC170 {
  const produto = produtos.find((p) => p.codigoInventario === item.codigoInventario)

  // Quantidade já convertida pelo fator do de-para (igual à quantidade que entra no Kardex)
  const qtd = item.quantidadeConvertida ?? item.qCom

  // Valor líquido de aquisição (menos tributos recuperáveis), coerente com o Kardex
  const vlItem = item.custoLiquidoAquisicao ?? item.vProd

  const aliqIcms = produto?.aliquotaIcms ?? 0
  // Base de ICMS: entrada = valor líquido deduzido dos tributos recuperáveis (base do
  // crédito); saída = valor da mercadoria (base da saída).
  const vlBcIcms = isEntrada ? vlItem : item.vProd
  const vlIcmsRecebido = item.vICMS || 0
  const vlIcms =
    isEntrada && item.vProd > 0 ? vlIcmsRecebido * (vlItem / item.vProd) : vlIcmsRecebido

  return {
    nItem: item.nItem,
    codItem: item.codigoInventario || item.cProd,
    descrCompl: (produto?.descricao || item.xProd).toUpperCase(),
    ncm: (produto?.ncm || item.ncm).replace(/\D/g, ''),
    cstIcms: produto?.cstIcms || '000',
    cfop: item.cfop,
    qtd,
    unid: (produto?.unidade || item.uCom).toUpperCase(),
    vlItem,
    vlBcIcms,
    aliqIcms,
    vlIcms,
    vlIpi: 0,
  }
}

export function formatarDataSped(dataIsoOuDate: string | Date): string {
  const d = typeof dataIsoOuDate === 'string' ? new Date(dataIsoOuDate) : dataIsoOuDate
  const dia = String(d.getDate()).padStart(2, '0')
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const ano = d.getFullYear()
  return `${dia}${mes}${ano}`
}
