import { ConsultaDFeSefaz, DocumentoFiscal, Empresa } from '@/types/sigef'
import { parseNFeXml } from './nfeXmlParser'
import { XMLS_SEED_VB_METAIS } from '@/data/seedData'

/**
 * Simulador local do Web Service NFeDistribuicaoDFe da SEFAZ
 * Retornos simulados:
 * - 138: Documento localizado para o destinatário (incrementa NSU e baixa XML)
 * - 137: Nenhum documento localizado (último NSU já alcançado)
 * - 656: Rejeição - Consumo Indevido (consulta repetida sem intervalo ou NSU já processado)
 */

export interface ResultadoConsultaDFe {
  consulta: ConsultaDFeSefaz
  documentosNovos: DocumentoFiscal[]
  mensagem: string
  tipo: 'SUCESSO_DOC' | 'SUCESSO_VAZIO' | 'ERRO_CONSUMO_INDEVIDO'
}

let ultimaConsultaTimestampPorUf: Record<string, number> = {}

export function consultarDFeSimulado(params: {
  empresa: Empresa
  uf: string
  ultimoNSUAtual: number
  forcarConsumoIndevido?: boolean
}): ResultadoConsultaDFe {
  const { empresa, uf, ultimoNSUAtual, forcarConsumoIndevido } = params

  const agora = Date.now()
  const ultimoAcessoUf = ultimaConsultaTimestampPorUf[uf] || 0
  const diferencaSegundos = (agora - ultimoAcessoUf) / 1000

  // 1. Simulação Rejeição 656 - Consumo Indevido se consulta com menos de 3 segundos repetidamente
  if (forcarConsumoIndevido || (diferencaSegundos > 0 && diferencaSegundos < 3)) {
    ultimaConsultaTimestampPorUf[uf] = agora
    const consultaErro: ConsultaDFeSefaz = {
      id: `dfe-${Date.now()}`,
      uf,
      dataConsulta: new Date().toISOString(),
      nsuConsultado: ultimoNSUAtual,
      novoUltNSU: ultimoNSUAtual,
      maxNSU: ultimoNSUAtual + 10,
      codigoStatus: 656,
      xMotivo:
        'Rejeição 656: Consumo Indevido. Deve ser aguardado o tempo regulamentar de consulta ao Web Service SEFAZ.',
      documentosRetornados: 0,
    }
    return {
      consulta: consultaErro,
      documentosNovos: [],
      mensagem: 'Rejeição 656: Consumo Indevido retornado pela SEFAZ.',
      tipo: 'ERRO_CONSUMO_INDEVIDO',
    }
  }

  ultimaConsultaTimestampPorUf[uf] = agora

  // 2. Simulação 138 ou 137 com base no NSU
  // Exemplo: se NSU < 5, retorna um documento simulado do seed; se >= 5 retorna 137
  if (ultimoNSUAtual < 6) {
    const proximoNSU = ultimoNSUAtual + 1
    const xmlIndice = Math.min(proximoNSU - 1, XMLS_SEED_VB_METAIS.length - 1)
    const xmlExemplo = XMLS_SEED_VB_METAIS[xmlIndice]
    const docParsed = parseNFeXml(xmlExemplo, empresa.cnpj)

    const consultaDoc: ConsultaDFeSefaz = {
      id: `dfe-${Date.now()}`,
      uf,
      dataConsulta: new Date().toISOString(),
      nsuConsultado: ultimoNSUAtual,
      novoUltNSU: proximoNSU,
      maxNSU: 6,
      codigoStatus: 138,
      xMotivo: 'Documento localizado para o destinatário (NSU ' + proximoNSU + ')',
      documentosRetornados: 1,
    }

    return {
      consulta: consultaDoc,
      documentosNovos: [docParsed],
      mensagem: `Documento localizado com sucesso pela SEFAZ ${uf}: NF-e ${docParsed.numero} (NSU ${proximoNSU})`,
      tipo: 'SUCESSO_DOC',
    }
  }

  // 3. Simulação 137 - Nenhum documento localizado
  const consultaVazia: ConsultaDFeSefaz = {
    id: `dfe-${Date.now()}`,
    uf,
    dataConsulta: new Date().toISOString(),
    nsuConsultado: ultimoNSUAtual,
    novoUltNSU: ultimoNSUAtual,
    maxNSU: ultimoNSUAtual,
    codigoStatus: 137,
    xMotivo: 'Nenhum documento localizado para o destinatário no período consultado.',
    documentosRetornados: 0,
  }

  return {
    consulta: consultaVazia,
    documentosNovos: [],
    mensagem: `SEFAZ ${uf}: Nenhum documento localizado (cStat 137). O NSU atual (${ultimoNSUAtual}) já é o mais recente.`,
    tipo: 'SUCESSO_VAZIO',
  }
}
