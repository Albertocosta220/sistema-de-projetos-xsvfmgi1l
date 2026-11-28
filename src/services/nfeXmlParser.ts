// Parser NF-e: extração do espelho estruturado (protocolo de autorização,
// eventos como cancelamento/CCe/manifestação, endereços e totais) no momento
// da importação — o espelho da tela Importar lê desses dados estruturados,
// funcionando mesmo depois de o XML bruto ser descartado do localStorage.
import {
  DocumentoFiscal,
  EspelhoNFe,
  EventoNFe,
  ParticipanteNFe,
  ItemNFe,
  TipoOperacaoNFe,
} from '@/types/sigef'
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

/** Descrição amigável dos tipos de evento conhecidos da NF-e. */
export function descricaoTipoEvento(codigo: string, descEventoXml?: string): string {
  if (codigo === '110111') return 'Cancelamento de NF-e'
  if (codigo === '110112') return 'Cancelamento por substituição'
  if (codigo === '110110') return 'Carta de Correção Eletrônica'
  if (codigo === '210200') return 'Manifestação — Confirmação da Operação'
  if (codigo === '210210') return 'Manifestação — Ciência da Operação'
  if (codigo === '210220') return 'Manifestação — Desconhecimento da Operação'
  if (codigo === '210240') return 'Manifestação — Operação Não Realizada'
  return descEventoXml || 'Evento'
}

/** Participante (emitente/destinatário) com endereço, a partir do bloco XML. */
export function extrairParticipante(bloco: string, nomePadrao: string): ParticipanteNFe {
  const enderBlock = getTagText(bloco, 'enderEmit') || getTagText(bloco, 'enderDest')
  return {
    xNome: getTagText(bloco, 'xNome') || nomePadrao,
    cnpjCpf: getTagText(bloco, 'CNPJ') || getTagText(bloco, 'CPF'),
    ie: getTagText(bloco, 'IE') || undefined,
    endereco: enderBlock
      ? {
          xLgr: getTagText(enderBlock, 'xLgr') || undefined,
          nro: getTagText(enderBlock, 'nro') || undefined,
          xBairro: getTagText(enderBlock, 'xBairro') || undefined,
          xMun: getTagText(enderBlock, 'xMun') || undefined,
          uf: getTagText(enderBlock, 'UF') || undefined,
          cep: getTagText(enderBlock, 'CEP') || undefined,
        }
      : undefined,
  }
}

/**
 * Extrai o protocolo de autorização (protNFe) e TODOS os eventos
 * (procEventoNFe/resEvento: cancelamento 110111, CCe 110110, manifestação
 * 2102xx e quaisquer outros) presentes no XML.
 */
export function extrairEspelho(xml: string, itens: ItemNFe[], vNF: number): EspelhoNFe {
  // XML ausente/não-texto nunca derruba a extração — espelho vazio, sem crash.
  const cleanXml = typeof xml === 'string' ? xml.trim() : ''
  const itensSeguros = Array.isArray(itens) ? itens : []
  const somaItens = itensSeguros.reduce((s, i) => s + (i?.vProd || 0), 0)

  // Protocolo de autorização (protNFe/infProt)
  const protBlock = getTagText(cleanXml, 'protNFe')
  const infProt = getTagText(protBlock, 'infProt')
  const protocoloAutorizacao = infProt
    ? {
        nProt: getTagText(infProt, 'nProt'),
        dhRecbto: getTagText(infProt, 'dhRecbto') || getTagText(infProt, 'dRecbto') || undefined,
        cStat: getTagText(infProt, 'cStat') || undefined,
        xMotivo: getTagText(infProt, 'xMotivo') || undefined,
        tpAmb: getTagText(infProt, 'tpAmb') || undefined,
        verAplic: getTagText(infProt, 'verAplic') || undefined,
      }
    : undefined

  // Eventos: procEventoNFe (com protEvento/resEvento dentro)
  const eventos: EventoNFe[] = []
  getAllTags(cleanXml, 'procEventoNFe').forEach((bloco) => {
    const evBlock = getTagText(bloco, 'evento')
    const infEvento = getTagText(evBlock, 'infEvento') || getTagText(bloco, 'infEvento')
    const retBlock = getTagText(bloco, 'retEvento')
    const infRet = getTagText(retBlock, 'infEvento') || retBlock
    const codigo = getTagText(infEvento, 'tpEvento')
    if (!codigo && !getTagText(infEvento, 'nProt')) return
    const seqRaw = getTagText(infEvento, 'nSeqEvento')
    eventos.push({
      tipo: classificarEvento(codigo),
      codigoEvento: codigo,
      descricao: descricaoTipoEvento(
        codigo,
        getTagText(infEvento, 'descEvento') || getTagText(infEvento, 'xEvento'),
      ),
      sequencial: seqRaw ? parseInt(seqRaw, 10) : undefined,
      nProt: getTagText(infRet, 'nProt') || getTagText(infEvento, 'nProt') || undefined,
      dataEvento:
        getTagText(infEvento, 'dhEvento') || getTagText(infEvento, 'dhsRegEvento') || undefined,
      dataRegistro:
        getTagText(infRet, 'dhRegEvento') || getTagText(infEvento, 'dhsRegEvento') || undefined,
      cStat: getTagText(infRet, 'cStat') || undefined,
      xMotivo: getTagText(infRet, 'xMotivo') || getTagText(infEvento, 'xMotivo') || undefined,
    })
  })

  // Eventos soltos: resEvento / evento sem proc (ex.: XML somente do retorno)
  getAllTags(cleanXml, 'resEvento').forEach((bloco) => {
    const codigo = getTagText(bloco, 'tpEvento')
    if (!codigo) return
    if (
      eventos.some(
        (e) => e.codigoEvento === codigo && e.nProt && getTagText(bloco, 'nProt') === e.nProt,
      )
    )
      return
    const seqRaw = getTagText(bloco, 'nSeqEvento')
    eventos.push({
      tipo: classificarEvento(codigo),
      codigoEvento: codigo,
      descricao: descricaoTipoEvento(
        codigo,
        getTagText(bloco, 'descEvento') || getTagText(bloco, 'xEvento'),
      ),
      sequencial: seqRaw ? parseInt(seqRaw, 10) : undefined,
      nProt: getTagText(bloco, 'nProt') || undefined,
      dataEvento: getTagText(bloco, 'dhEvento') || getTagText(bloco, 'dhsRegEvento') || undefined,
      dataRegistro:
        getTagText(bloco, 'dhRegEvento') || getTagText(bloco, 'dhsRegEvento') || undefined,
      cStat: getTagText(bloco, 'cStat') || undefined,
      xMotivo: getTagText(bloco, 'xMotivo') || undefined,
    })
  })

  // Totais do bloco ICMSTot
  const totalBlock = getTagText(cleanXml, 'ICMSTot') || getTagText(cleanXml, 'total')
  const toNum = (tag: string): number | undefined => {
    const raw = getTagText(totalBlock, tag)
    const n = raw ? parseFloat(raw) : NaN
    return Number.isNaN(n) ? undefined : n
  }
  const totais = {
    vBC: toNum('vBC'),
    vICMS: toNum('vICMS'),
    vProd: toNum('vProd') ?? somaItens,
    vFrete: toNum('vFrete'),
    vSeg: toNum('vSeg'),
    vDesc: toNum('vDesc'),
    vII: toNum('vII'),
    vIPI: toNum('vIPI'),
    vPIS: toNum('vPIS'),
    vCOFINS: toNum('vCOFINS'),
    vOutro: toNum('vOutro'),
    vNF: toNum('vNF') ?? vNF,
  }

  return {
    naturezaOperacao: getTagText(cleanXml, 'natOp') || undefined,
    emitente: extrairParticipante(getTagText(cleanXml, 'emit'), 'EMITENTE NÃO IDENTIFICADO'),
    destinatario: extrairParticipante(
      getTagText(cleanXml, 'dest'),
      'DESTINATÁRIO NÃO IDENTIFICADO',
    ),
    protocoloAutorizacao,
    eventos,
    totais,
  }
}

function classificarEvento(codigo: string): EventoNFe['tipo'] {
  if (codigo === '110111' || codigo === '110112') return 'CANC'
  if (codigo === '110110') return 'CCe'
  if (codigo.startsWith('2102')) return 'MANIFESTACAO'
  return 'OUTRO'
}

// Defesa: o marcador de cota NUNCA deve ser re-parseado — significaria que o
// chamador recebeu um documento do storage (dados estruturados íntegros) e
// tentaria reconstruí-lo do XML, que foi descartado.
export function parseNFeXml(xmlString: string, empresaAtivaCnpj: string): DocumentoFiscal {
  // XML ausente/não-texto não pode derrubar a importação inteira.
  const cleanXml = typeof xmlString === 'string' ? xmlString.trim() : ''
  if (!cleanXml) {
    throw new Error('XML vazio ou inválido — arquivo corrompido ou não é uma NF-e.')
  }

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

  // Itens <det> — bloco de item ilegível é pulado, não derruba a importação.
  const detBlocks = getAllTags(cleanXml, 'det')
  const itens: ItemNFe[] = detBlocks.map((detXml, index) => {
    try {
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
    } catch {
      // Item ilegível (XML parcial/corrompido): vira linha placeholder, sem crash.
      return {
        nItem: index + 1,
        cProd: `ITEM-${index + 1}`,
        xProd: 'ITEM ILEGÍVEL NO XML',
        ncm: '00000000',
        cfop: '0000',
        uCom: 'UN',
        qCom: 0,
        vUnCom: 0,
        vProd: 0,
      }
    }
  })

  // Valor total da NF-e
  const totalBlock = getTagText(cleanXml, 'total')
  const vNF =
    parseFloat(getTagText(totalBlock, 'vNF')) || itens.reduce((s, i) => s + (i?.vProd || 0), 0)

  // Espelho estruturado: protocolo de autorização, eventos, endereços e totais
  // extraídos AGORA — sobrevivem ao descarte do XML bruto por cota.
  const espelho = extrairEspelho(cleanXml, itens, vNF)

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
    espelho,
  }
}
