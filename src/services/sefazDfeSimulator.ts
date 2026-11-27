import { ConsultaDFeSefaz, DocumentoFiscal, Empresa } from '@/types/sigef'
import { carregarConfiguracoes, INTERVALO_SEFAZ_MIN_PADRAO } from './configuracoesService'

/**
 * Consulta local do Web Service NFeDistribuicaoDFe da SEFAZ.
 * Em produção oficial o sistema parte do zero (NSU = 0) e não possui
 * documentos pré-carregados: cada consulta devolve o estado real do
 * distribuidor a partir dos documentos já baixados para a empresa.
 *
 * A consulta EXIGE certificado digital A1 ativo (o gate é feito no
 * SigefContext): o certificado usado é registrado no histórico da consulta.
 *
 * Retornos possíveis:
 * - 137: Nenhum documento localizado (último NSU já alcançado)
 * - 138: Documento localizado — há NSU a avançar (base: documentos importados
 *        para a empresa que ainda não foram "distribuídos" pelo NSU)
 * - 656: Rejeição - Consumo Indevido (consulta antes do intervalo configurado
 *        em Configurações → intervaloSefazMin, em minutos)
 *
 * Documentos reais entram no sistema pela importação de XML (ImportarPage),
 * que atualiza o NSU/ultimoNSU da empresa normalmente.
 */

export interface CertificadoUsadoConsulta {
  subjectCN: string
  cnpj: string
  vencido: boolean
}

export interface ResultadoConsultaDFe {
  consulta: ConsultaDFeSefaz
  documentosNovos: DocumentoFiscal[]
  mensagem: string
  tipo: 'SUCESSO_DOC' | 'SUCESSO_VAZIO' | 'ERRO_CONSUMO_INDEVIDO'
}

// Timestamp da última consulta por UF — persistido na sessão do navegador
// (sessionStorage) para sobreviver ao F5 e respeitar o intervalo regulamentar
// configurado (intervaloSefazMin) entre consultas à mesma UF.
const KEY_ULTIMA_CONSULTA = 'sigef-dfe-ultima-consulta-por-uf'

function carregarUltimaConsultaPorUf(): Record<string, number> {
  try {
    const raw = sessionStorage.getItem(KEY_ULTIMA_CONSULTA)
    if (raw) return JSON.parse(raw) as Record<string, number>
  } catch {
    // sessionStorage indisponível — segue com mapa vazio
  }
  return {}
}

function salvarUltimaConsultaPorUf(mapa: Record<string, number>): void {
  try {
    sessionStorage.setItem(KEY_ULTIMA_CONSULTA, JSON.stringify(mapa))
  } catch {
    // sessionStorage indisponível — a consulta segue sem memória de intervalo
  }
}

export function consultarDFeSimulado(params: {
  empresa: Empresa
  uf: string
  ultimoNSUAtual: number
  forcarConsumoIndevido?: boolean
  certificadoUsado?: CertificadoUsadoConsulta
  /** Documentos já importados pela empresa — base do distribuidor simulado */
  documentosImportados?: DocumentoFiscal[]
}): ResultadoConsultaDFe {
  const {
    uf,
    ultimoNSUAtual,
    forcarConsumoIndevido,
    certificadoUsado,
    documentosImportados = [],
  } = params

  const agora = Date.now()
  const intervaloMin = carregarConfiguracoes().intervaloSefazMin ?? INTERVALO_SEFAZ_MIN_PADRAO
  const intervaloMs = Math.max(intervaloMin, 0.05) * 60 * 1000

  const ultimoAcessoMapa = carregarUltimaConsultaPorUf()
  const ultimoAcessoUf = ultimoAcessoMapa[uf] || 0
  const diferencaMs = agora - ultimoAcessoUf

  const certificadoResumo = certificadoUsado
    ? ` · Certificado: ${certificadoUsado.subjectCN}${
        certificadoUsado.cnpj ? ` (CNPJ ${certificadoUsado.cnpj})` : ''
      }`
    : ''

  // 1. Rejeição 656 - Consumo Indevido: consulta repetida antes do intervalo
  //    regulamentar configurado (intervaloSefazMin em Configurações).
  if (forcarConsumoIndevido || (ultimoAcessoUf > 0 && diferencaMs < intervaloMs)) {
    ultimoAcessoMapa[uf] = agora
    salvarUltimaConsultaPorUf(ultimoAcessoMapa)
    const consultaErro: ConsultaDFeSefaz = {
      id: `dfe-${Date.now()}`,
      uf,
      dataConsulta: new Date().toISOString(),
      nsuConsultado: ultimoNSUAtual,
      novoUltNSU: ultimoNSUAtual,
      maxNSU: ultimoNSUAtual,
      codigoStatus: 656,
      xMotivo:
        'Rejeição 656: Consumo Indevido. Deve ser aguardado o intervalo regulamentar de ' +
        `${intervaloMin} minuto(s) entre consultas ao Web Service SEFAZ.` +
        certificadoResumo,
      documentosRetornados: 0,
    }
    return {
      consulta: consultaErro,
      documentosNovos: [],
      mensagem: 'Rejeição 656: Consumo Indevido retornado pela SEFAZ.',
      tipo: 'ERRO_CONSUMO_INDEVIDO',
    }
  }

  ultimoAcessoMapa[uf] = agora
  salvarUltimaConsultaPorUf(ultimoAcessoMapa)

  // 2. 138 - Documento localizado: enquanto houver documentos importados da
  //    empresa com NSU acima do último consultado, o distribuidor os devolve
  //    (um por consulta, como o serviço real faz por lote).
  const documentosPendentes = documentosImportados.filter(
    (d) => d.status !== 'CANCELADO' && d.nsu !== undefined && d.nsu > ultimoNSUAtual,
  )

  if (documentosPendentes.length > 0) {
    const proximoNsu = Math.min(...documentosPendentes.map((d) => d.nsu as number))
    const novoUltNSU = Math.max(proximoNsu, ultimoNSUAtual)
    const lote = documentosPendentes.filter((d) => d.nsu === proximoNsu)

    const consultaComDoc: ConsultaDFeSefaz = {
      id: `dfe-${Date.now()}`,
      uf,
      dataConsulta: new Date().toISOString(),
      nsuConsultado: ultimoNSUAtual,
      novoUltNSU,
      maxNSU: Math.max(...documentosImportados.map((d) => d.nsu ?? 0), ultimoNSUAtual),
      codigoStatus: 138,
      xMotivo:
        `Documento localizado — ${lote.length} documento(s) distribuído(s) para o destinatário.` +
        certificadoResumo,
      documentosRetornados: lote.length,
    }

    return {
      consulta: consultaComDoc,
      documentosNovos: [],
      mensagem: `SEFAZ ${uf}: ${lote.length} documento(s) localizado(s) (cStat 138). Novo ultNSU: ${novoUltNSU}.${certificadoResumo}`,
      tipo: 'SUCESSO_DOC',
    }
  }

  // 3. 137 - Nenhum documento localizado: todos os NSUs já foram alcançados.
  const maxNSU = Math.max(...documentosImportados.map((d) => d.nsu ?? 0), ultimoNSUAtual)
  const consultaVazia: ConsultaDFeSefaz = {
    id: `dfe-${Date.now()}`,
    uf,
    dataConsulta: new Date().toISOString(),
    nsuConsultado: ultimoNSUAtual,
    novoUltNSU: ultimoNSUAtual,
    maxNSU,
    codigoStatus: 137,
    xMotivo:
      'Nenhum documento localizado para o destinatário no período consultado.' + certificadoResumo,
    documentosRetornados: 0,
  }

  return {
    consulta: consultaVazia,
    documentosNovos: [],
    mensagem: `SEFAZ ${uf}: Nenhum documento localizado (cStat 137). O NSU atual (${ultimoNSUAtual}) já é o mais recente.${certificadoResumo}`,
    tipo: 'SUCESSO_VAZIO',
  }
}
