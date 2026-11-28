// Inventário Negativo: separa o inventário da competência em saldo positivo e
// saldo negativo, com o extrato nota a nota que compõe cada saldo.
// Fonte: Kardex cronológico (replay CMP) — o mesmo que o Bloco H usa.
//
// Regra de exibição (pedido do usuário): para cada produto são SOMADAS todas as
// entradas (qtd e valor) e todas as saídas (qtd e valor) do período, e o saldo
// final é entradas − saídas — podendo ficar negativo. O replay do Kardex (CMP,
// bloqueios A03, estornos A05) NÃO muda: a agregação é só para esta tela.
//
// Agrupamento é pelo CÓDIGO DE INVENTÁRIO: dois vínculos de de-para (ou dois
// cadastros) que apontam para o mesmo código somam as movimentações numa única
// linha (caso VB0076 "Sucata de Metal" + "SUCATA DE LATÃO").

import type {
  DeParaVigente,
  DocumentoFiscal,
  ItemContagemInventario,
  MovimentoKardex,
  Produto,
} from '@/types/sigef'
import { buscarDePara } from './kardexEngine'

export interface LinhaSaldoInventario {
  codigoInventario: string
  descricao: string
  unidade: string
  /** Total SOMADO de todas as entradas do produto até o fim da competência. */
  totalQuantidadeEntradas: number
  totalValorEntradas: number
  /** Total SOMADO de todas as saídas (inclui saídas bloqueadas por saldo). */
  totalQuantidadeSaidas: number
  totalValorSaidas: number
  /** Saldo final = total de entradas − total de saídas (pode ser negativo). */
  saldoQuantidade: number
  /** Custo médio do último movimento do Kardex (o replay CMP não muda). */
  custoMedio: number
  /** Saldo em valor = total de entradas − total de saídas (pode ser negativo). */
  saldoValor: number
  /** Movimentos do Kardex até o fim da competência, em ordem cronológica. */
  movimentos: MovimentoKardex[]
  /** Descrições distintas dos itens mesclados neste código (quando > 1). */
  descricoesMescladas?: string[]
}

export interface GrupoSaldoInventario {
  itens: LinhaSaldoInventario[]
  quantidadeItens: number
  valorTotal: number
}

export interface ResumoInventarioNegativo {
  positivo: GrupoSaldoInventario
  negativo: GrupoSaldoInventario
  /** Produtos da competência com saldo zero (não entram em nenhum grupo). */
  quantidadeZerados: number
  /** Soma líquida de todos os saldos (positivos + negativos). */
  valorTotalLiquido: number
  /** Totais SOMADOS de entradas e saídas de TODOS os produtos da competência. */
  totalQuantidadeEntradas: number
  totalValorEntradas: number
  totalQuantidadeSaidas: number
  totalValorSaidas: number
}

/** Fim (último instante) da competência YYYY-MM, em horário local. */
export function fimDaCompetencia(competencia: string): Date {
  const [ano, mes] = competencia.split('-').map(Number)
  const ultimoDia = new Date(ano, mes, 0).getDate()
  return new Date(ano, mes - 1, ultimoDia, 23, 59, 59, 999)
}

const TOLERANCIA = 0.0001

function grupoVazio(): GrupoSaldoInventario {
  return { itens: [], quantidadeItens: 0, valorTotal: 0 }
}

/**
 * Mescla itens que compartilham o mesmo código de inventário: as movimentações
 * do Kardex são por código, então dois cadastros/vínculos do mesmo código
 * somariam os MESMOS movimentos duas vezes (caso VB0076 duplicado). A linha
 * única carrega a primeira descrição e lista as outras em descricoesMescladas.
 */
function mesclarPorCodigo(itens: ItemContagemInventario[]): ItemContagemInventario[] {
  const ordem: string[] = []
  const porCodigo = new Map<string, ItemContagemInventario>()

  for (const item of itens) {
    const existente = porCodigo.get(item.codigoInventario)
    if (!existente) {
      ordem.push(item.codigoInventario)
      porCodigo.set(item.codigoInventario, { ...item })
      continue
    }
    // Mescla: mesma movimentação — mantém a 1ª descrição, lista as demais.
    const descricoes = new Set([
      existente.descricao,
      item.descricao,
      ...((existente as ItemContagemInventario & { descricoesMescladas?: string[] })
        .descricoesMescladas ?? []),
    ])
    descricoes.delete(existente.descricao)
    porCodigo.set(item.codigoInventario, {
      ...existente,
      descricao: existente.descricao || item.descricao,
      unidade: existente.unidade || item.unidade,
      descricoesMescladas: descricoes.size > 0 ? Array.from(descricoes) : undefined,
    } as ItemContagemInventario)
  }
  return ordem.map((cod) => porCodigo.get(cod)!)
}

/**
 * Monta o resumo a partir dos itens do inventário da competência (já filtrados
 * pelas regras de desqualificação e pelo fechamento) e do Kardex. Cada código
 * de inventário acumula TODAS as entradas e TODAS as saídas até o fim da
 * competência ativa; o saldo é a diferença entre elas (podendo ser negativo).
 */
export function montarInventarioNegativo(
  itens: ItemContagemInventario[],
  kardex: MovimentoKardex[],
  competencia: string,
): ResumoInventarioNegativo {
  const limite = fimDaCompetencia(competencia).getTime()

  // Agrupa o Kardex por produto uma única vez, já cortado na competência
  const porProduto = new Map<string, MovimentoKardex[]>()
  for (const mov of kardex) {
    if (new Date(mov.dataMovimento).getTime() > limite) continue
    const lista = porProduto.get(mov.codigoInventario)
    if (lista) lista.push(mov)
    else porProduto.set(mov.codigoInventario, [mov])
  }

  const positivo = grupoVazio()
  const negativo = grupoVazio()
  let quantidadeZerados = 0
  let valorTotalLiquido = 0
  let totalQuantidadeEntradas = 0
  let totalValorEntradas = 0
  let totalQuantidadeSaidas = 0
  let totalValorSaidas = 0

  for (const item of mesclarPorCodigo(itens)) {
    const movimentos = porProduto.get(item.codigoInventario) ?? []
    const descricoesMescladas = (
      item as ItemContagemInventario & { descricoesMescladas?: string[] }
    ).descricoesMescladas

    // Soma TODAS as entradas e TODAS as saídas do produto (cada movimento uma
    // única vez — inclusive saídas bloqueadas por saldo negativo, que também
    // foram tentativas de saída escrituradas no extrato).
    let qtdEntradas = 0
    let valEntradas = 0
    let qtdSaidas = 0
    let valSaidas = 0
    for (const mov of movimentos) {
      qtdEntradas += mov.quantidadeEntrada || 0
      valEntradas += mov.valorTotalEntrada || 0
      qtdSaidas += mov.quantidadeSaida || 0
      valSaidas += mov.valorTotalSaida || 0
    }

    const saldoQuantidade = qtdEntradas - qtdSaidas
    const saldoValor = valEntradas - valSaidas
    const ultimo = movimentos[movimentos.length - 1]
    const custoMedio = ultimo ? ultimo.custoMedioUnitario : 0

    totalQuantidadeEntradas += qtdEntradas
    totalValorEntradas += valEntradas
    totalQuantidadeSaidas += qtdSaidas
    totalValorSaidas += valSaidas
    valorTotalLiquido += saldoValor

    // Código SEM movimentação nenhuma (produto do catálogo parado): fora das
    // listas — só produtos movimentados aparecem (pedido do usuário).
    if (movimentos.length === 0) {
      quantidadeZerados++
      continue
    }

    if (Math.abs(saldoQuantidade) < TOLERANCIA) {
      quantidadeZerados++
      continue
    }

    const linha: LinhaSaldoInventario = {
      codigoInventario: item.codigoInventario,
      descricao: item.descricao,
      unidade: item.unidade,
      totalQuantidadeEntradas: qtdEntradas,
      totalValorEntradas: valEntradas,
      totalQuantidadeSaidas: qtdSaidas,
      totalValorSaidas: valSaidas,
      saldoQuantidade,
      custoMedio,
      saldoValor,
      movimentos,
      descricoesMescladas:
        descricoesMescladas && descricoesMescladas.length > 0 ? descricoesMescladas : undefined,
    }

    const grupo = saldoQuantidade > 0 ? positivo : negativo
    grupo.itens.push(linha)
    grupo.quantidadeItens++
    grupo.valorTotal += saldoValor
  }

  // Ordena: maior saldo absoluto primeiro (negativos: o mais negativo no topo)
  positivo.itens.sort((a, b) => b.saldoValor - a.saldoValor)
  negativo.itens.sort((a, b) => a.saldoValor - b.saldoValor)

  return {
    positivo,
    negativo,
    quantidadeZerados,
    valorTotalLiquido,
    totalQuantidadeEntradas,
    totalValorEntradas,
    totalQuantidadeSaidas,
    totalValorSaidas,
  }
}
