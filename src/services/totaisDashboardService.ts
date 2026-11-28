// Dashboard de totais do Painel — cálculo PURO a partir dos dados reais da
// empresa ativa (produtos, documentos, kardex, ocorrências e fechamentos via
// SigefContext). Nada é persistido e nenhum número é fixo: o que não tem fonte
// de dados simplesmente não entra no resultado (o cartão é omitido na tela).
//
// Convenções herdadas do indicadoresFiscais:
// - Isolamento multiempresa: quem chama passa SÓ os dados da empresa ativa.
// - Notas CANCELADAS têm movimentos estornados no Kardex (Regra A05) — entram
//   apenas na contagem de documentos, nunca nos totais de entrada/saída ativos.
import type { DocumentoFiscal, MovimentoKardex, OcorrenciaAuditoria, Produto } from '@/types/sigef'

export interface TotaisDocumentos {
  total: number
  pendente: number
  processado: number
  aguardandoDePara: number
  erro: number
  duplicidade: number
  cancelado: number
}

export interface TotaisMovimentacao {
  /** Movimentos de entrada ativos (compras + ajustes de entrada). */
  entradasQtd: number
  entradasValor: number
  /** Saídas de venda ativas (sem estornos de cancelamento). */
  saidasQtd: number
  saidasValor: number
  /** Movimentos bloqueados por saldo negativo (alerta A03). */
  movimentosBloqueados: number
  temMovimentos: boolean
}

export interface TotaisAlertas {
  /** Documentos bloqueados por saldo negativo + ocorrências não resolvidas. */
  ocorrenciasPendentes: number
  ocorrenciasBloqueantes: number
  /** Produtos com saldo físico negativo no último movimento (fonte: Kardex). */
  saldosNegativos: number
  total: number
}

export interface TotaisDashboard {
  totalProdutos: number
  valorTotalEstoque: number
  quantidadeTotalEstoque: number
  itensComEstoque: number
  documentos: TotaisDocumentos
  movimentacao: TotaisMovimentacao
  /** Pendências de de-para reais (AGUARDANDO_DE_PARA sem marca de desqualificação). */
  pendenciasDePara: number
  alertas: TotaisAlertas
}

/** Documento aguardando de-para de verdade (mesmo filtro do indicadoresFiscais). */
function ehPendenciaDeParaReal(d: DocumentoFiscal): boolean {
  return (
    d.status === 'AGUARDANDO_DE_PARA' &&
    !d.desqualificadaParaInventario &&
    !d.naoControlaEstoque &&
    !d.naoVinculaEstoque
  )
}

export function calcularTotaisDashboard(params: {
  produtos: Produto[]
  documentos: DocumentoFiscal[]
  kardex: MovimentoKardex[]
  ocorrencias: OcorrenciaAuditoria[]
}): TotaisDashboard {
  const { produtos, documentos, kardex, ocorrencias } = params

  // ===== Estoque: saldo do ÚLTIMO movimento de cada produto (mesma regra do
  // Painel atual e do indicadoresFiscais — o Kardex já exclui desqualificadas).
  const saldoPorProduto = new Map<string, MovimentoKardex>()
  for (const mov of kardex) {
    const codigo = mov?.codigoInventario
    if (!codigo) continue
    saldoPorProduto.set(codigo, mov) // o kardex já é cronológico: fica o último
  }

  let valorTotalEstoque = 0
  let quantidadeTotalEstoque = 0
  let itensComEstoque = 0
  let saldosNegativos = 0
  saldoPorProduto.forEach((mov) => {
    valorTotalEstoque += mov.saldoValorTotal || 0
    quantidadeTotalEstoque += mov.saldoQuantidade || 0
    if ((mov.saldoQuantidade || 0) > 0.0001) itensComEstoque++
    if ((mov.saldoQuantidade || 0) < -0.0001) saldosNegativos++
  })

  // ===== Documentos por status (o tipo garante o conjunto de status existentes)
  const documentosTotais: TotaisDocumentos = {
    total: documentos.length,
    pendente: 0,
    processado: 0,
    aguardandoDePara: 0,
    erro: 0,
    duplicidade: 0,
    cancelado: 0,
  }
  let pendenciasDePara = 0
  for (const d of documentos) {
    if (!d || typeof d !== 'object') continue
    switch (d.status) {
      case 'PENDENTE':
        documentosTotais.pendente++
        break
      case 'PROCESSADO':
        documentosTotais.processado++
        break
      case 'AGUARDANDO_DE_PARA':
        documentosTotais.aguardandoDePara++
        if (ehPendenciaDeParaReal(d)) pendenciasDePara++
        break
      case 'ERRO':
        documentosTotais.erro++
        break
      case 'DUPLICIDADE':
        documentosTotais.duplicidade++
        break
      case 'CANCELADO':
        documentosTotais.cancelado++
        break
    }
  }

  // ===== Entradas e saídas (quantidade e valor) — só dados gravados no Kardex
  const movimentacao: TotaisMovimentacao = {
    entradasQtd: 0,
    entradasValor: 0,
    saidasQtd: 0,
    saidasValor: 0,
    movimentosBloqueados: 0,
    temMovimentos: kardex.length > 0,
  }
  for (const mov of kardex) {
    if (!mov || typeof mov !== 'object') continue
    if (mov.bloqueadoSaldoNegativo) {
      movimentacao.movimentosBloqueados++
      continue // saída bloqueada não movimentou estoque
    }
    movimentacao.entradasQtd += mov.quantidadeEntrada || 0
    movimentacao.entradasValor += mov.valorTotalEntrada || 0
    movimentacao.saidasQtd += mov.quantidadeSaida || 0
    movimentacao.saidasValor += mov.valorTotalSaida || 0
  }

  // ===== Alertas: ocorrências da régua de auditoria + saldos negativos
  let ocorrenciasPendentes = 0
  let ocorrenciasBloqueantes = 0
  for (const o of ocorrencias) {
    if (!o || typeof o !== 'object' || o.resolvido) continue
    ocorrenciasPendentes++
    if (o.severidade === 'BLOQUEANTE') ocorrenciasBloqueantes++
  }

  const alertas: TotaisAlertas = {
    ocorrenciasPendentes,
    ocorrenciasBloqueantes,
    saldosNegativos,
    total: ocorrenciasPendentes + saldosNegativos,
  }

  return {
    totalProdutos: produtos.length,
    valorTotalEstoque,
    quantidadeTotalEstoque,
    itensComEstoque,
    documentos: documentosTotais,
    movimentacao,
    pendenciasDePara,
    alertas,
  }
}
