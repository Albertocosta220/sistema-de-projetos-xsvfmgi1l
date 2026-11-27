// Competências (AAAA-MM) disponíveis na empresa ativa — fonte única para os
// seletores de período de todas as abas.
//
// Lista: a competência ATIVA (o mês que o usuário está trabalhando — definido
// pela última importação e alterável em qualquer aba) + toda competência que
// tenha documento importado ou fechamento gravado. Sem inventar período.
import { useMemo } from 'react'
import { useSigef } from '@/context/SigefContext'
import type { CompetenciaFechamento, DocumentoFiscal } from '@/types/sigef'

export function listarCompetencias(
  competenciaAtiva: string,
  documentos: DocumentoFiscal[],
  fechamentos: CompetenciaFechamento[],
): string[] {
  const meses = new Set<string>()
  if (competenciaAtiva) meses.add(competenciaAtiva)
  ;(documentos || []).forEach((d) => {
    const mes = d.dataEmissao?.slice(0, 7)
    if (mes) meses.add(mes)
  })
  ;(fechamentos || []).forEach((f) => {
    if (f.competencia) meses.add(f.competencia)
  })
  return Array.from(meses).sort()
}

/**
 * Options (AAAA-MM) para os <select> de competência: sempre inclui a competência
 * ativa no topo da lista — mesmo que não haja documento/fechamento nela.
 */
export function useCompetencias() {
  const { competenciaAtiva, documentos, fechamentos } = useSigef()
  return useMemo(
    () => listarCompetencias(competenciaAtiva, documentos, fechamentos),
    [competenciaAtiva, documentos, fechamentos],
  )
}
