// Inventário Negativo: separa o inventário da competência em saldo positivo e
// saldo negativo, com o extrato nota a nota que compõe cada saldo.
// Fonte: Kardex cronológico (replay CMP) — o mesmo que o Bloco H usa.

import type { ItemContagemInventario, MovimentoKardex } from '@/types/sigef'

export interface LinhaSaldoInventario {
  codigoInventario: string
  descricao: string
  unidade: string
  saldoQuantidade: number
  custoMedio: number
  saldoValor: number
  /** Movimentos do Kardex até o fim da competência, em ordem cronológica. */
  movimentos: MovimentoKardex[]
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
 * Monta o resumo a partir dos itens do inventário da competência (já filtrados
 * pelas regras de desqualificação e pelo fechamento) e do Kardex. O saldo de
 * cada produto é o do último movimento até o fim da competência ativa.
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

  for (const item of itens) {
    const movimentos = porProduto.get(item.codigoInventario) ?? []
    const ultimo = movimentos[movimentos.length - 1]
    const saldoQuantidade = ultimo ? ultimo.saldoQuantidade : 0
    const saldoValor = ultimo ? ultimo.saldoValorTotal : 0
    const custoMedio = ultimo ? ultimo.custoMedioUnitario : 0

    valorTotalLiquido += saldoValor

    if (Math.abs(saldoQuantidade) < TOLERANCIA) {
      quantidadeZerados++
      continue
    }

    const linha: LinhaSaldoInventario = {
      codigoInventario: item.codigoInventario,
      descricao: item.descricao,
      unidade: item.unidade,
      saldoQuantidade,
      custoMedio,
      saldoValor,
      movimentos,
    }

    const grupo = saldoQuantidade > 0 ? positivo : negativo
    grupo.itens.push(linha)
    grupo.quantidadeItens++
    grupo.valorTotal += saldoValor
  }

  // Ordena: maior saldo absoluto primeiro (negativos: o mais negativo no topo)
  positivo.itens.sort((a, b) => b.saldoValor - a.saldoValor)
  negativo.itens.sort((a, b) => a.saldoValor - b.saldoValor)

  return { positivo, negativo, quantidadeZerados, valorTotalLiquido }
}
