// Desqualificação para inventário (funcionalidade do usuário):
// "as notas que não vão fazer parte do inventário tenham uma opção para que
// elas fiquem fora do inventário — ao clicar, este fornecedor e todos que
// forem do mesmo CNPJ e mesmo produto não gerem o inventário".
//
// A regra é persistida por empresa (chave CNPJ emitente + cProd do fornecedor,
// comparação normalizada) e aplicada aos documentos existentes e a qualquer
// importação futura. A marca no documento é DERIVADA das regras — nunca
// gravada solta — garantindo que requalificar (excluir a regra) desmarque
// todos os documentos de uma vez.
import { DocumentoFiscal, RegraDesqualificacao } from '@/types/sigef'
import { normalizarCodigo } from './vinculoAutomaticoService'

/** Chave da regra: CNPJ emitente (só dígitos) + cProd normalizado. */
export function chaveRegraDesqualificacao(cnpjEmitente: string, cProd: string): string {
  return `${(cnpjEmitente || '').replace(/\D/g, '')}::${normalizarCodigo(cProd)}`
}

export function novaRegraDesqualificacao(params: {
  cnpjEmitente: string
  razaoSocialEmitente?: string
  cProd: string
  xProd?: string
  criadoPor: string
  chaveDocOrigem?: string
}): RegraDesqualificacao {
  return {
    id: `rdq-${params.cnpjEmitente.replace(/\D/g, '')}-${normalizarCodigo(params.cProd)}`.replace(
      /[^a-zA-Z0-9-]/g,
      '',
    ),
    cnpjEmitente: params.cnpjEmitente.replace(/\D/g, ''),
    razaoSocialEmitente: params.razaoSocialEmitente,
    cProd: params.cProd,
    xProd: params.xProd,
    criadoEm: new Date().toISOString(),
    criadoPor: params.criadoPor,
    chaveDocOrigem: params.chaveDocOrigem,
  }
}

/**
 * Aplica as regras de desqualificação aos documentos: todo documento que
 * contenha um item cujo CNPJ emitente + cProd esteja numa regra recebe a
 * marca desqualificadaParaInventario (com data/usuário da regra de origem).
 * Status (PROCESSADO, AGUARDANDO_DE_PARA...) são preservados — a
 * desqualificação é uma marca adicional, não um status.
 */
export function aplicarRegrasDesqualificacao(
  documentos: DocumentoFiscal[],
  regras: RegraDesqualificacao[],
): DocumentoFiscal[] {
  if (!regras || regras.length === 0) {
    // Sem regras, nenhuma marca deve sobrar (requalificação total).
    return documentos.map((d) =>
      d.desqualificadaParaInventario ? { ...d, desqualificadaParaInventario: false } : d,
    )
  }
  const chaves = new Set(regras.map((r) => chaveRegraDesqualificacao(r.cnpjEmitente, r.cProd)))
  return documentos.map((doc) => {
    const itens = Array.isArray(doc.itens) ? doc.itens : []
    const desqualificada = itens.some((it) =>
      chaves.has(chaveRegraDesqualificacao(doc.cnpjEmitente, it.cProd)),
    )
    if (desqualificada === !!doc.desqualificadaParaInventario) return doc
    if (desqualificada) {
      const regra = regras.find(
        (r) =>
          chaveRegraDesqualificacao(r.cnpjEmitente, r.cProd) ===
          chaveRegraDesqualificacao(
            doc.cnpjEmitente,
            itens.find((it) =>
              chaves.has(chaveRegraDesqualificacao(doc.cnpjEmitente, it.cProd)),
            )?.cProd || '',
          ),
      )
      return {
        ...doc,
        desqualificadaParaInventario: true,
        desqualificadaEm: regra?.criadoEm,
        desqualificadaPor: regra?.criadoPor,
      }
    }
    return { ...doc, desqualificadaParaInventario: false, desqualificadaEm: undefined, desqualificadaPor: undefined }
  })
}

/** Itens (cProd distintos) de um documento, com descrição, para confirmar a desqualificação. */
export function itensDocumento(doc: DocumentoFiscal): Array<{ cProd: string; xProd: string }> {
  const itens = Array.isArray(doc.itens) ? doc.itens : []
  const mapa = new Map<string, { cProd: string; xProd: string }>()
  itens.forEach((it) => {
    if (!it?.cProd) return
    const chave = normalizarCodigo(it.cProd)
    if (!chave) return
    if (!mapa.has(chave)) mapa.set(chave, { cProd: it.cProd, xProd: it.xProd || '' })
  })
  return Array.from(mapa.values())
}
