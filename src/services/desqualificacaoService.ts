// Desqualificação para inventário / marca "Nota Controla Estoque":
//
// "as notas que não vão fazer parte do inventário tenham uma opção para que
// elas fiquem fora do inventário — ao clicar, este fornecedor e todos que
// forem do mesmo CNPJ e mesmo produto não gerem o inventário".
//
// A marca "Não controla estoque" (pedido do usuário na aba Importar) é um
// ALIAS da mesma regra (mesma persistência, mesmo efeito no Kardex e no Bloco
// H): difere apenas pela origem registrada na regra, que define o badge
// exibido na fila. A marca no documento é DERIVADA das regras — nunca gravada
// solta — garantindo que requalificar (excluir a regra) desmarque todos os
// documentos de uma vez.
//
// "Não vincular" (terceiro pedido do usuário): gravar o CNPJ emitente + o item
// que NÃO gera estoque/inventário SEM criar o de-para. Mesma persistência e
// mesmos efeitos de exclusão, com origem NAO_VINCULA_ESTOQUE — o de-para não
// é criado e as notas futuras do mesmo par já entram marcadas.
import { DocumentoFiscal, OrigemRegraDesqualificacao, RegraDesqualificacao } from '@/types/sigef'
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
  origem?: OrigemRegraDesqualificacao
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
    origem: params.origem ?? 'DESQUALIFICACAO',
  }
}

/**
 * Aplica as regras aos documentos: todo documento que contenha um item cujo
 * CNPJ emitente + cProd esteja numa regra recebe a marca derivada
 * (desqualificadaParaInventario sempre; naoControlaEstoque quando a regra de
 * origem foi criada como "Nota Controla Estoque"). Status (PROCESSADO,
 * AGUARDANDO_DE_PARA...) são preservados — a marca é adicional, não um status.
 */
export function aplicarRegrasDesqualificacao(
  documentos: DocumentoFiscal[],
  regras: RegraDesqualificacao[],
): DocumentoFiscal[] {
  if (!regras || regras.length === 0) {
    // Sem regras, nenhuma marca deve sobrar (requalificação total).
    return documentos.map((d) =>
      d.desqualificadaParaInventario || d.naoControlaEstoque || d.naoVinculaEstoque
        ? {
            ...d,
            desqualificadaParaInventario: false,
            naoControlaEstoque: false,
            naoVinculaEstoque: false,
            desqualificadaEm: undefined,
            desqualificadaPor: undefined,
          }
        : d,
    )
  }
  const mapaRegras = new Map(
    regras.map((r) => [chaveRegraDesqualificacao(r.cnpjEmitente, r.cProd), r] as const),
  )
  return documentos.map((doc) => {
    const itens = Array.isArray(doc.itens) ? doc.itens : []
    const regrasDoDoc = itens
      .map((it) => mapaRegras.get(chaveRegraDesqualificacao(doc.cnpjEmitente, it.cProd)))
      .filter((r): r is RegraDesqualificacao => !!r)
    const desqualificada = regrasDoDoc.length > 0
    // "Não controla estoque" vence quando qualquer item casado veio dessa origem.
    const naoControla = regrasDoDoc.some((r) => r.origem === 'CONTROLE_ESTOQUE')
    const naoVincula = regrasDoDoc.some((r) => r.origem === 'NAO_VINCULA_ESTOQUE')
    const regraOrigem = regrasDoDoc[0]
    if (
      desqualificada === !!doc.desqualificadaParaInventario &&
      naoControla === !!doc.naoControlaEstoque &&
      naoVincula === !!doc.naoVinculaEstoque
    )
      return doc
    if (desqualificada) {
      return {
        ...doc,
        desqualificadaParaInventario: true,
        naoControlaEstoque: naoControla,
        naoVinculaEstoque: naoVincula,
        desqualificadaEm: regraOrigem?.criadoEm,
        desqualificadaPor: regraOrigem?.criadoPor,
      }
    }
    return {
      ...doc,
      desqualificadaParaInventario: false,
      naoControlaEstoque: false,
      naoVinculaEstoque: false,
      desqualificadaEm: undefined,
      desqualificadaPor: undefined,
    }
  })
}

/**
 * Chaves de regra "Não vincular" (CNPJ emitente + cProd) a partir de uma lista
 * de regras — usado ANTES de classificar pendência de de-para: item com essa
 * regra ativa NÃO entra na lista de pendências (nem em Produtos → Pendências
 * de De-Para, nem na contagem da fila/Painel), não fica em
 * AGUARDANDO_DE_PARA por esse motivo e não gera aviso nem erro — não há
 * resolver de-para a executar.
 */
export function chavesNaoVinculaEstoque(regras: RegraDesqualificacao[]): Set<string> {
  return new Set(
    (regras || [])
      // TODAS as origens de desqualificação (desqualificada p/ inventário,
      // "não controla estoque" e "não vincular") tiram o item (CNPJ + cProd)
      // das pendências de de-para e da fila AGUARDANDO_DE_PARA — não é
      // pendência, aviso nem erro: ou o item já tem vínculo (e fica fora do
      // Kardex/Bloco H pela marca derivada), ou nunca terá (regra gravada sem
      // de-para). Fechamento do buraco da desqualificação por NOTA inteira:
      // as regras são por item, e itensDocumento cobre a nota inteira.
      .map((r) => chaveRegraDesqualificacao(r.cnpjEmitente, r.cProd)),
  )
}

/**
 * Diz se um item (CNPJ emitente + cProd) tem regra ativa "Não vincular" —
 * se tiver, não pode virar pendência de de-para, aviso nem erro.
 */
export function itemNaoVinculado(
  regras: RegraDesqualificacao[],
  cnpjEmitente: string,
  cProd: string,
): boolean {
  return chavesNaoVinculaEstoque(regras).has(chaveRegraDesqualificacao(cnpjEmitente, cProd))
}

/** Itens (cProd distintos) de um documento, com descrição, para confirmar a marca. */
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
