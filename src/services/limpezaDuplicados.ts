// Limpeza one-shot de documentos duplicados gravados na store da empresa.
//
// A deduplicação na ENTRADA (importarXmlsEmLote) já impede novas duplicatas, mas
// stores antigas ainda tinham pares gravados: a mesma chave de acesso aparecia
// DUAS vezes na fila — uma PROCESSADO (tratada) e outra com status DUPLICIDADE
// (A01). Ao carregar a empresa, mantemos SEMPRE o PRIMEIRO documento de cada
// chave (o tratado, 100% intacto) e descartamos os seguintes. Ocorrências A01
// pendentes dessas chaves viram resolvidas ("resolvido na limpeza de
// duplicados"), preservando o histórico da régua de auditoria.

import type { DadosEmpresaStore, DocumentoFiscal, OcorrenciaAuditoria } from '@/types/sigef'
import { salvarDadosEmpresa } from './storageService'

/** Empresas já varridas nesta sessão — a limpeza roda UMA vez por empresa. */
const EMPRESAS_LIMPAS = new Set<string>()

export interface ResultadoLimpezaDuplicados {
  documentos: DocumentoFiscal[]
  ocorrencias: OcorrenciaAuditoria[]
  /** Documentos duplicados descartados (sempre o 2º, 3º... de cada chave). */
  removidos: number
  chavesRemovidas: string[]
  /** Ocorrências A01 pendentes marcadas como resolvidas pela limpeza. */
  a01Resolvidas: number
}

export function limparDocumentosDuplicados(
  documentos: DocumentoFiscal[],
  ocorrencias: OcorrenciaAuditoria[],
): ResultadoLimpezaDuplicados {
  const chavesVistas = new Set<string>()
  const chavesRemovidas = new Set<string>()
  const mantidos: DocumentoFiscal[] = []

  for (const doc of documentos) {
    const chave = (doc.chaveAcesso || '').trim()
    if (chave) {
      if (chavesVistas.has(chave)) {
        chavesRemovidas.add(chave)
        continue // duplicata: fora da store, o primeiro (tratado) fica intacto
      }
      chavesVistas.add(chave)
    }
    // Documento sem par duplicado que ainda carregava o status legado
    // DUPLICIDADE volta à fila como PENDENTE (status real, reprocessa normal).
    mantidos.push(doc.status === 'DUPLICIDADE' ? { ...doc, status: 'PENDENTE' } : doc)
  }

  // A01 pendentes que apontam para chave removida (ou que não existe mais na
  // escrituração) não podem continuar vermelhas: viram resolvidas, com histórico.
  const agora = new Date().toISOString()
  let a01Resolvidas = 0
  const ocorrenciasAjustadas = ocorrencias.map((o) => {
    // Ocorrência corrompida (null/lixo) na store: mantida como está — varrê-la
    // aqui derrubaria a carga da empresa (e /login, aninhada no provider).
    if (!o || typeof o !== 'object') return o
    if (o.regraCodigo !== 'A01' || o.resolvido) return o
    const chave = (o.chaveAcessoRef || '').trim()
    const obsoleta = (chave && !chavesVistas.has(chave)) || chavesRemovidas.has(chave)
    if (!obsoleta) return o
    a01Resolvidas++
    return {
      ...o,
      resolvido: true,
      resolvidoEm: agora,
      descricao: `${o.descricao} — Resolvido na limpeza de duplicados: mantido apenas o primeiro documento (tratado), sem alterações.`,
    }
  })

  return {
    documentos: mantidos,
    ocorrencias: ocorrenciasAjustadas,
    removidos: documentos.length - mantidos.length,
    chavesRemovidas: [...chavesRemovidas],
    a01Resolvidas,
  }
}

/**
 * Aplica a limpeza uma única vez por empresa por sessão: deduplica a store
 * carregada do localStorage e persiste o resultado. Nas chamadas seguintes
 * devolve a store intacta — nunca regrava nem reprocessa.
 */
export function limparDuplicadosOneShot(
  store: DadosEmpresaStore,
  empresaId: string,
): DadosEmpresaStore {
  if (!empresaId || EMPRESAS_LIMPAS.has(empresaId)) return store
  EMPRESAS_LIMPAS.add(empresaId)

  const res = limparDocumentosDuplicados(store.documentos, store.ocorrencias)
  if (res.removidos === 0 && res.a01Resolvidas === 0) return store

  const limpa: DadosEmpresaStore = {
    ...store,
    documentos: res.documentos,
    ocorrencias: res.ocorrencias,
  }
  try {
    salvarDadosEmpresa(limpa)
  } catch {
    // persistência falhou: segue em memória (a store corrigida ainda é exibida)
  }
  return limpa
}
