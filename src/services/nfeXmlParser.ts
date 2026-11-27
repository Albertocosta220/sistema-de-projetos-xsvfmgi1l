import { DocumentoFiscal, ItemNFe, TipoOperacaoNFe } from '@/types/sigef'
import { MARCADOR_XML_COMPACTADO } from './storageService'

// Helper simples e resiliente para extrair tags XML (funciona com namespace ou sem)
function getTagText(xml: string, tag: string): string {
  const match = xml.match(
    new RegExp(`<(?:w+:)?${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:w+:)?${tag}>`, 'i'),
  )
  return match ? match[1].trim() : ''
}

function getAllTags(xml: string, tag: string): string[] {
  const regex = new RegExp(`<(?:w+:)?${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:w+:)?${tag}>`, 'gi')
  const results: string[] = []
  let match
  while ((match = regex.exec(xml)) !== null) {
    results.push(match[1])
  }
  return results
}

export function extrairChaveAcesso(xml: string): string {
  // Procura no infNFe Id="NFe..."
  const matchId = xml.match(/<(?:\w+:)?infNFe[^>]*Id=["']NFe(\d{44})["']/i)
  if (matchId) return matchId[1]
  // Procura em chNFe
  const chNfe = getTagText(xml, 'chNFe')
  if (chNfe && chNfe.length === 44) return chNfe
  return ''
}

// Defesa: o marcador de cota NUNCA deve ser re-parseado — significaria que o
// chamador recebeu um documento do storage (dados estruturados íntegros) e
// tentaria reconstruí-lo do XML, que foi descartado.
export function parseNFeXml(xmlString: string, empresaAtivaCnpj: string): DocumentoFiscal {
  const cleanXml = xmlString.trim()

  // Defesa: o marcador de cota significa "dados estruturados íntegros, XML bruto
  // descartado" — re-parsear o marcador geraria um documento vazio (chave '',
  // número 'S/N', itens [], valor 0). Nunca deve acontecer.
  if (cleanXml.includes(MARCADOR_XML_COMPACTADO)) {
    throw new Error(
      'Tentativa de re-parsear XML compactado por cota — o documento já possui dados estruturados íntegros no storage.',
    )
  }
  const chaveAcesso = extrairChaveAcesso(cleanXml)

  const nNF = getTagText(cleanXml, 'nNF') || 'S/N'
  const serie = getTagText(cleanXml, 'serie') || '1'
  const dhEmi =
    getTagText(cleanXml, 'dhEmi') || getTagText(cleanXml, 'dEmi') || new Date().toISOString()
  const tpNF = getTagText(cleanXml, 'tpNF') // 0 = entrada, 1 = saída

  // Emitente
  const emitBlock = getTagText(cleanXml, 'emit')
  const cnpjEmit = getTagText(emitBlock, 'CNPJ') || getTagText(emitBlock, 'CPF')
  const xNomeEmit = getTagText(emitBlock, 'xNome') || 'EMITENTE NÃO IDENTIFICADO'

  // Destinatário
  const destBlock = getTagText(cleanXml, 'dest')
  const cnpjDest = getTagText(destBlock, 'CNPJ') || getTagText(destBlock, 'CPF')
  const xNomeDest = getTagText(destBlock, 'xNome') || 'DESTINATÁRIO NÃO IDENTIFICADO'

  // Identificação da operação do ponto de vista da empresa ativa
  const cnpjLimpoEmpresa = empresaAtivaCnpj.replace(/\D/g, '')
  const cnpjLimpoEmit = cnpjEmit.replace(/\D/g, '')
  const cnpjLimpoDest = cnpjDest.replace(/\D/g, '')

  let tipoOperacao: TipoOperacaoNFe = 'ENTRADA'
  if (cnpjLimpoEmit === cnpjLimpoEmpresa) {
    tipoOperacao = 'SAIDA'
  } else if (cnpjLimpoDest === cnpjLimpoEmpresa) {
    tipoOperacao = 'ENTRADA'
  } else {
    // Se tpNF for 0 é entrada, se for 1 depende
    tipoOperacao = tpNF === '0' ? 'ENTRADA' : 'ENTRADA'
  }

  // Itens <det>
  const detBlocks = getAllTags(cleanXml, 'det')
  const itens: ItemNFe[] = detBlocks.map((detXml, index) => {
    const prodBlock = getTagText(detXml, 'prod')
    const impostoBlock = getTagText(detXml, 'imposto')

    const cProd = getTagText(prodBlock, 'cProd') || `ITEM-${index + 1}`
    const cEAN = getTagText(prodBlock, 'cEAN')
    const xProd = getTagText(prodBlock, 'xProd') || 'MERCADORIA'
    const ncm = getTagText(prodBlock, 'NCM') || '00000000'
    const cfop = getTagText(prodBlock, 'CFOP') || '5102'
    const uCom = (getTagText(prodBlock, 'uCom') || 'UN').toUpperCase()
    const qCom = parseFloat(getTagText(prodBlock, 'qCom')) || 0
    const vUnCom = parseFloat(getTagText(prodBlock, 'vUnCom')) || 0
    const vProd = parseFloat(getTagText(prodBlock, 'vProd')) || qCom * vUnCom

    // Tributos destacados no item
    const vICMS = parseFloat(getTagText(impostoBlock, 'vICMS')) || 0
    const vPIS = parseFloat(getTagText(impostoBlock, 'vPIS')) || 0
    const vCOFINS = parseFloat(getTagText(impostoBlock, 'vCOFINS')) || 0
    const vIBS = parseFloat(getTagText(impostoBlock, 'vIBS')) || 0
    const vCBS = parseFloat(getTagText(impostoBlock, 'vCBS')) || 0

    return {
      nItem: index + 1,
      cProd,
      cEAN: cEAN && cEAN !== 'SEM GTIN' ? cEAN : undefined,
      xProd,
      ncm,
      cfop,
      uCom,
      qCom,
      vUnCom,
      vProd,
      vICMS,
      vPIS,
      vCOFINS,
      vIBS,
      vCBS,
    }
  })

  // Valor total da NF-e
  const totalBlock = getTagText(cleanXml, 'total')
  const vNF = parseFloat(getTagText(totalBlock, 'vNF')) || itens.reduce((s, i) => s + i.vProd, 0)

  return {
    id: chaveAcesso || `doc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    chaveAcesso,
    numero: nNF,
    serie,
    dataEmissao: dhEmi,
    dataEntradaSaida: dhEmi,
    tipoOperacao,
    cnpjEmitente: cnpjEmit,
    nomeEmitente: xNomeEmit,
    cnpjDestinatario: cnpjDest,
    nomeDestinatario: xNomeDest,
    valorTotal: vNF,
    status: 'PENDENTE',
    xmlOriginal: cleanXml,
    itens,
    importadoEm: new Date().toISOString(),
  }
}
