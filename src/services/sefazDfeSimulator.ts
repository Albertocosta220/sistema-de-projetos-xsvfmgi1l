import { ConsultaDFeSefaz, DocumentoFiscal, Empresa } from '@/types/sigef'

/**
 * Consulta local do Web Service NFeDistribuicaoDFe da SEFAZ.
 * Em produção oficial o sistema parte do zero (NSU = 0) e não possui
 * documentos pré-carregados: cada consulta devolve o estado real do
 * distribuidor a partir dos documentos já baixados para a empresa.
 *
 * Retornos possíveis:
 * - 137: Nenhum documento localizado (último NSU já alcançado)
 * - 656: Rejeição - Consumo Indevido (consulta repetida sem intervalo)
 *
 * Documentos reais entram no sistema pela importação de XML (ImportarPage),
 * que atualiza o NSU/ultimoNSU da empresa normalmente.
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
  const { uf, ultimoNSUAtual, forcarConsumoIndevido } = params

  const agora = Date.now()
  const ultimoAcessoUf = ultimaConsultaTimestampPorUf[uf] || 0
  const diferencaSegundos = (agora - ultimoAcessoUf) / 1000

  // 1. Rejeição 656 - Consumo Indevido se consulta com menos de 3 segundos repetidamente
  if (forcarConsumoIndevido || (diferencaSegundos > 0 && diferencaSegundos < 3)) {
    ultimaConsultaTimestampPorUf[uf] = agora
    const consultaErro: ConsultaDFeSefaz = {
      id: `dfe-${Date.now()}`,
      uf,
      dataConsulta: new Date().toISOString(),
      nsuConsultado: ultimoNSUAtual,
      novoUltNSU: ultimoNSUAtual,
      maxNSU: ultimoNSUAtual,
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

  // 2. 137 - Nenhum documento localizado: sem seeds, não há documentos
  //    pré-existentes no distribuidor. Documentos reais chegam pela
  //    importação de XML e passam a ser vistos nas próximas consultas.
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
