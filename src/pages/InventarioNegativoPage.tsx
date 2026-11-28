import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useSigef } from '@/context/SigefContext'
import { SeletorCompetencia } from '@/components/SeletorCompetencia'
import { CardS, KpiB, PageHead, Pill, brl, num, dataBR } from '@/components/shell'
import { Button } from '@/components/ui/button'
import {
  montarInventarioNegativo,
  type GrupoSaldoInventario,
  type LinhaSaldoInventario,
} from '@/services/inventarioNegativoService'

export default function InventarioNegativoPage() {
  const { gerarItensInventarioNegativo, kardex, produtos, competenciaAtiva } = useSigef()

  // Lista da competência ativa: a contagem contável + TODO código movimentado
  // (produto sem catálogo ou vínculo desqualificado/"não vincular" também
  // aparece — pedido do usuário). Agrupamento por código de inventário soma os
  // vínculos duplicados (ex.: VB0076) numa única linha.
  const resumo = useMemo(() => {
    const itens = gerarItensInventarioNegativo(competenciaAtiva)
    return montarInventarioNegativo(itens, kardex, competenciaAtiva)
    // produtos.length: itens importados por planilha entram com saldo zero
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [competenciaAtiva, kardex, produtos.length])

  // Linhas com extrato nota a nota abertas (por código de inventário)
  const [expandidos, setExpandidos] = useState<Set<string>>(() => new Set())

  const alternarExpandido = (codigo: string) => {
    setExpandidos((prev) => {
      const next = new Set(prev)
      if (next.has(codigo)) next.delete(codigo)
      else next.add(codigo)
      return next
    })
  }

  const totalItens = resumo.positivo.quantidadeItens + resumo.negativo.quantidadeItens
  // Conferência do card: entradas − saídas deve bater com o líquido (a soma é
  // feita produto a produto, então diferença aqui indica dado inconsistente).
  const conferenciaLiquida =
    resumo.totalValorEntradas - resumo.totalValorSaidas - resumo.valorTotalLiquido

  return (
    <div className="sig-page">
      <PageHead
        eyebrow="Inventário"
        titulo="Inventário Negativo"
        subtitulo="Inventário da competência ativa separado em saldo positivo e saldo negativo, com o saldo real nota a nota (Kardex CMP)."
        acoes={<SeletorCompetencia />}
      />

      {/* Cards de totais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiB
          label="Total de entradas"
          value={brl(resumo.totalValorEntradas)}
          hint={`${num(resumo.totalQuantidadeEntradas)} un. somadas — todas as notas`}
          tone="verde"
        />
        <KpiB
          label="Total de saídas"
          value={brl(resumo.totalValorSaidas)}
          hint={`${num(resumo.totalQuantidadeSaidas)} un. somadas — todas as notas`}
          tone="vermelho"
        />
        <KpiB
          label="Total líquido (entradas − saídas)"
          value={brl(resumo.valorTotalLiquido)}
          hint={`${totalItens} itens com saldo, ${resumo.quantidadeZerados} zerados${
            Math.abs(conferenciaLiquida) > 0.01
              ? ` — verificar: diferença de ${brl(conferenciaLiquida)}`
              : ''
          }`}
          tone="accent"
        />
        <KpiB
          label="Competência"
          value={competenciaAtiva}
          hint="Somas até o último dia do mês — o saldo pode ficar negativo"
          tone="ambar"
        />
      </div>

      <GrupoTabela
        titulo="Saldo positivo"
        sub="Produtos com estoque físico escriturado"
        grupo={resumo.positivo}
        tipo="positivo"
        expandidos={expandidos}
        onAlternar={alternarExpandido}
      />

      <GrupoTabela
        titulo="Saldo negativo"
        sub="Saídas que excederam o saldo escriturado — vale a pena conferir as notas abaixo"
        grupo={resumo.negativo}
        tipo="negativo"
        expandidos={expandidos}
        onAlternar={alternarExpandido}
      />
    </div>
  )
}

interface GrupoTabelaProps {
  titulo: string
  sub: string
  grupo: GrupoSaldoInventario
  tipo: 'positivo' | 'negativo'
  expandidos: Set<string>
  onAlternar: (codigo: string) => void
}

function GrupoTabela({ titulo, sub, grupo, tipo, expandidos, onAlternar }: GrupoTabelaProps) {
  const corSaldo = tipo === 'negativo' ? 'text-rose-700' : 'text-emerald-700'
  const idTabela = `tabela-${tipo}`

  return (
    <CardS
      titulo={`${titulo} (${grupo.quantidadeItens})`}
      sub={sub}
      acoes={
        <Pill tone={tipo === 'negativo' ? 't-vermelho' : 't-verde'}>{brl(grupo.valorTotal)}</Pill>
      }
    >
      {grupo.itens.length === 0 ? (
        <p className="text-sm text-[var(--sig-muted)] py-6 text-center">
          Nenhum produto com saldo {tipo === 'negativo' ? 'negativo' : 'positivo'} nesta
          competência.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs" id={idTabela}>
            <thead>
              <tr className="text-left text-[var(--sig-muted)]">
                <th scope="col" className="py-2 pr-2 w-10">
                  <span className="sr-only">Extrato</span>
                </th>
                <th scope="col" className="py-2 pr-3">
                  Código
                </th>
                <th scope="col" className="py-2 pr-3">
                  Descrição
                </th>
                <th scope="col" className="py-2 pr-3">
                  Un.
                </th>
                <th scope="col" className="py-2 pr-3 text-right">
                  Entradas qtd
                </th>
                <th scope="col" className="py-2 pr-3 text-right">
                  Entradas valor
                </th>
                <th scope="col" className="py-2 pr-3 text-right">
                  Saídas qtd
                </th>
                <th scope="col" className="py-2 pr-3 text-right">
                  Saídas valor
                </th>
                <th scope="col" className="py-2 pr-3 text-right">
                  Saldo qtd
                </th>
                <th scope="col" className="py-2 pr-3 text-right">
                  Custo médio
                </th>
                <th scope="col" className="py-2 text-right">
                  Saldo valor
                </th>
              </tr>
            </thead>
            <tbody>
              {grupo.itens.map((linha) => (
                <LinhaProduto
                  key={linha.codigoInventario}
                  linha={linha}
                  corSaldo={corSaldo}
                  aberta={expandidos.has(linha.codigoInventario)}
                  onAlternar={onAlternar}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </CardS>
  )
}

function LinhaProduto({
  linha,
  corSaldo,
  aberta,
  onAlternar,
}: {
  linha: LinhaSaldoInventario
  corSaldo: string
  aberta: boolean
  onAlternar: (codigo: string) => void
}) {
  const idExtrato = `extrato-${linha.codigoInventario}`
  return (
    <>
      <tr className="border-t border-[var(--sig-line,#e2e8f0)]">
        <td className="py-2 pr-2">
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            aria-expanded={aberta}
            aria-controls={idExtrato}
            aria-label={`${aberta ? 'Ocultar' : 'Ver'} extrato nota a nota do produto ${linha.codigoInventario}`}
            onClick={() => onAlternar(linha.codigoInventario)}
          >
            {aberta ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          </Button>
        </td>
        <td className="py-2 pr-3 font-mono font-bold">{linha.codigoInventario}</td>
        <td className="py-2 pr-3">
          {linha.descricao}
          {linha.descricoesMescladas && linha.descricoesMescladas.length > 0 ? (
            <span
              className="block text-[11px] text-[var(--sig-muted)]"
              title={`Mesclado: ${linha.descricoesMescladas.join(' · ')}`}
            >
              + {linha.descricoesMescladas.length} vínculo(s) do mesmo código
            </span>
          ) : null}
        </td>
        <td className="py-2 pr-3">{linha.unidade || '—'}</td>
        <td className="py-2 pr-3 text-right font-mono text-emerald-700">
          {num(linha.totalQuantidadeEntradas)}
        </td>
        <td className="py-2 pr-3 text-right font-mono text-emerald-700">
          {brl(linha.totalValorEntradas)}
        </td>
        <td className="py-2 pr-3 text-right font-mono text-rose-700">
          {num(linha.totalQuantidadeSaidas)}
        </td>
        <td className="py-2 pr-3 text-right font-mono text-rose-700">
          {brl(linha.totalValorSaidas)}
        </td>
        <td className={`py-2 pr-3 text-right font-mono font-bold ${corSaldo}`}>
          {num(linha.saldoQuantidade)}
        </td>
        <td className="py-2 pr-3 text-right font-mono">{brl(linha.custoMedio)}</td>
        <td className={`py-2 text-right font-mono font-bold ${corSaldo}`}>
          {brl(linha.saldoValor)}
        </td>
      </tr>
      {aberta && (
        <tr id={idExtrato}>
          <td colSpan={10} className="bg-[var(--sig-bg-sub,#f8fafc)] p-3">
            <ExtratoNotaANota linha={linha} />
          </td>
        </tr>
      )}
    </>
  )
}

function ExtratoNotaANota({ linha }: { linha: LinhaSaldoInventario }) {
  if (linha.movimentos.length === 0) {
    return (
      <p className="text-xs text-[var(--sig-muted)]">Nenhuma movimentação até a competência.</p>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[11px]">
        <caption className="text-left font-semibold pb-2">
          Saldo real nota a nota — {linha.codigoInventario}
        </caption>
        <thead>
          <tr className="text-left text-[var(--sig-muted)]">
            <th scope="col" className="py-1 pr-3">
              Data
            </th>
            <th scope="col" className="py-1 pr-3">
              Documento
            </th>
            <th scope="col" className="py-1 pr-3">
              Tipo
            </th>
            <th scope="col" className="py-1 pr-3 text-right">
              Entrada qtd
            </th>
            <th scope="col" className="py-1 pr-3 text-right">
              Entrada valor
            </th>
            <th scope="col" className="py-1 pr-3 text-right">
              Saída qtd
            </th>
            <th scope="col" className="py-1 pr-3 text-right">
              Saída valor
            </th>
            <th scope="col" className="py-1 pr-3 text-right">
              Saldo qtd
            </th>
            <th scope="col" className="py-1 text-right">
              Saldo valor
            </th>
          </tr>
        </thead>
        <tbody>
          {linha.movimentos.map((m) => (
            <tr
              key={m.id}
              className={`border-t border-[var(--sig-line,#e2e8f0)] ${
                m.bloqueadoSaldoNegativo ? 'text-rose-700' : ''
              } ${m.estornado ? 'line-through opacity-60' : ''}`}
            >
              <td className="py-1 pr-3 whitespace-nowrap">{dataBR(m.dataMovimento)}</td>
              <td className="py-1 pr-3">{m.documentoRef}</td>
              <td className="py-1 pr-3">
                {m.tipo.replace(/_/g, ' ')}
                {m.estornado ? ' (estornado)' : ''}
              </td>
              <td className="py-1 pr-3 text-right font-mono">
                {m.quantidadeEntrada > 0 ? num(m.quantidadeEntrada) : '—'}
              </td>
              <td className="py-1 pr-3 text-right font-mono">
                {m.valorTotalEntrada > 0 ? brl(m.valorTotalEntrada) : '—'}
              </td>
              <td className="py-1 pr-3 text-right font-mono">
                {m.quantidadeSaida > 0 ? num(m.quantidadeSaida) : '—'}
              </td>
              <td className="py-1 pr-3 text-right font-mono">
                {m.valorTotalSaida > 0 ? brl(m.valorTotalSaida) : '—'}
              </td>
              <td className="py-1 pr-3 text-right font-mono font-bold">{num(m.saldoQuantidade)}</td>
              <td className="py-1 text-right font-mono font-bold">{brl(m.saldoValorTotal)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-[var(--sig-line,#e2e8f0)] font-bold">
            <td className="py-1 pr-3" colSpan={3}>
              Totais somados (entradas − saídas = saldo)
            </td>
            <td className="py-1 pr-3 text-right font-mono text-emerald-700">
              {num(linha.totalQuantidadeEntradas)}
            </td>
            <td className="py-1 pr-3 text-right font-mono text-emerald-700">
              {brl(linha.totalValorEntradas)}
            </td>
            <td className="py-1 pr-3 text-right font-mono text-rose-700">
              {num(linha.totalQuantidadeSaidas)}
            </td>
            <td className="py-1 pr-3 text-right font-mono text-rose-700">
              {brl(linha.totalValorSaidas)}
            </td>
            <td className="py-1 pr-3 text-right font-mono">{num(linha.saldoQuantidade)}</td>
            <td className="py-1 text-right font-mono">{brl(linha.saldoValor)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
