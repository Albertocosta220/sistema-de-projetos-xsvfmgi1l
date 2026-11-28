import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useSigef } from '@/context/SigefContext'
import { SeletorCompetencia } from '@/components/SeletorCompetencia'
import { CardS, KpiB, PageHead, Pill, brl, num, dataBR } from '@/components/shell'
import { Button } from '@/components/ui/button'
import { Th, TdNum, TabelaWrap, TrTotais, TdTotal } from '@/components/tabelaPadrao'
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
  const totalQtd = grupo.itens.reduce((s, l) => s + l.saldoQuantidade, 0)
  const totalValor = grupo.itens.reduce((s, l) => s + l.saldoValor, 0)

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
        <TabelaWrap>
          <table className="w-full text-xs" id={idTabela}>
            <thead>
              <tr>
                <Th className="w-10">
                  <span className="sr-only">Extrato</span>
                </Th>
                <Th>Código</Th>
                <Th>Descrição</Th>
                <Th>Un.</Th>
                <Th className="text-right">Entradas qtd</Th>
                <Th className="text-right">Entradas valor</Th>
                <Th className="text-right">Saídas qtd</Th>
                <Th className="text-right">Saídas valor</Th>
                <Th className="text-right">Saldo qtd</Th>
                <Th className="text-right">Custo médio</Th>
                <Th className="text-right">Saldo valor</Th>
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
            <tfoot>
              <tr className="border-t-2 border-[var(--sig-line,#e2e8f0)] bg-[var(--sig-bg-sub,#f8fafc)] font-bold">
                <td className="py-1.5 pr-2 text-xs" colSpan={4}>
                  Total do grupo ({grupo.itens.length})
                </td>
                <TdTotal valor={sumEntradasQtd(grupo)} fmt={(v) => num(v)} />
                <TdTotal valor={sumEntradasValor(grupo)} fmt={brl} />
                <TdTotal valor={sumSaidasQtd(grupo)} fmt={(v) => num(v)} />
                <TdTotal valor={sumSaidasValor(grupo)} fmt={brl} />
                <TdTotal valor={totalQtd} fmt={(v) => num(v)} className={corSaldo} />
                <td className="py-1.5 pr-3 text-right font-mono text-xs text-[var(--sig-muted)]">
                  —
                </td>
                <TdTotal valor={totalValor} fmt={brl} className={corSaldo} />
              </tr>
            </tfoot>
          </table>
        </TabelaWrap>
      )}
    </CardS>
  )
}

const sumEntradasQtd = (g: GrupoSaldoInventario) =>
  g.itens.reduce((s, l) => s + l.totalQuantidadeEntradas, 0)
const sumEntradasValor = (g: GrupoSaldoInventario) =>
  g.itens.reduce((s, l) => s + l.totalValorEntradas, 0)
const sumSaidasQtd = (g: GrupoSaldoInventario) =>
  g.itens.reduce((s, l) => s + l.totalQuantidadeSaidas, 0)
const sumSaidasValor = (g: GrupoSaldoInventario) =>
  g.itens.reduce((s, l) => s + l.totalValorSaidas, 0)

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
        <td className="py-1.5 pr-2">
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
        <td className="py-1.5 pr-3 font-mono font-bold text-xs" title={linha.codigoInventario}>
          {linha.codigoInventario}
        </td>
        <td className="py-1.5 pr-3 text-xs">
          <div className="truncate max-w-[260px]" title={linha.descricao}>
            {linha.descricao}
          </div>
          {linha.descricoesMescladas && linha.descricoesMescladas.length > 0 ? (
            <span
              className="block text-[11px] text-[var(--sig-muted)]"
              title={`Mesclado: ${linha.descricoesMescladas.join(' · ')}`}
            >
              + {linha.descricoesMescladas.length} vínculo(s) do mesmo código
            </span>
          ) : null}
        </td>
        <td className="py-1.5 pr-3 text-xs whitespace-nowrap">{linha.unidade || '—'}</td>
        <TdNum className="text-emerald-700">{num(linha.totalQuantidadeEntradas)}</TdNum>
        <TdNum className="text-emerald-700">{brl(linha.totalValorEntradas)}</TdNum>
        <TdNum className="text-rose-700">{num(linha.totalQuantidadeSaidas)}</TdNum>
        <TdNum className="text-rose-700">{brl(linha.totalValorSaidas)}</TdNum>
        <TdNum className={`font-bold ${corSaldo}`}>{num(linha.saldoQuantidade)}</TdNum>
        <TdNum>{brl(linha.custoMedio)}</TdNum>
        <TdNum className={`font-bold ${corSaldo}`}>{brl(linha.saldoValor)}</TdNum>
      </tr>
      {aberta && (
        <tr id={idExtrato}>
          <td colSpan={11} className="bg-[var(--sig-bg-sub,#f8fafc)] p-3">
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
    <TabelaWrap>
      <table className="w-full text-[11px]">
        <caption className="text-left font-semibold pb-2">
          Saldo real nota a nota — {linha.codigoInventario}
        </caption>
        <thead>
          <tr>
            <Th>Data</Th>
            <Th>Documento</Th>
            <Th>Tipo</Th>
            <Th className="text-right">Entrada qtd</Th>
            <Th className="text-right">Entrada valor</Th>
            <Th className="text-right">Saída qtd</Th>
            <Th className="text-right">Saída valor</Th>
            <Th className="text-right">Saldo qtd</Th>
            <Th className="text-right">Saldo valor</Th>
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
              <td className="py-1 pr-3 text-[11px]" title={m.documentoRef}>
                <span className="block truncate max-w-[140px]">{m.documentoRef}</span>
              </td>
              <td className="py-1 pr-3 text-[11px] whitespace-nowrap">
                {m.tipo.replace(/_/g, ' ')}
                {m.estornado ? ' (estornado)' : ''}
              </td>
              <TdNum className="text-[11px]">
                {m.quantidadeEntrada > 0 ? num(m.quantidadeEntrada) : '—'}
              </TdNum>
              <TdNum className="text-[11px]">
                {m.valorTotalEntrada > 0 ? brl(m.valorTotalEntrada) : '—'}
              </TdNum>
              <TdNum className="text-[11px]">
                {m.quantidadeSaida > 0 ? num(m.quantidadeSaida) : '—'}
              </TdNum>
              <TdNum className="text-[11px]">
                {m.valorTotalSaida > 0 ? brl(m.valorTotalSaida) : '—'}
              </TdNum>
              <TdNum className="text-[11px] font-bold">{num(m.saldoQuantidade)}</TdNum>
              <TdNum className="text-[11px] font-bold">{brl(m.saldoValorTotal)}</TdNum>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-[var(--sig-line,#e2e8f0)] bg-[var(--sig-bg-sub,#f8fafc)] font-bold">
            <td className="py-1 pr-3 text-[11px] whitespace-nowrap" colSpan={3}>
              Totais somados (entradas − saídas = saldo)
            </td>
            <TdTotal
              valor={linha.totalQuantidadeEntradas}
              fmt={(v) => num(v)}
              className="text-[11px] text-emerald-700"
            />
            <TdTotal
              valor={linha.totalValorEntradas}
              fmt={brl}
              className="text-[11px] text-emerald-700"
            />
            <TdTotal
              valor={linha.totalQuantidadeSaidas}
              fmt={(v) => num(v)}
              className="text-[11px] text-rose-700"
            />
            <TdTotal
              valor={linha.totalValorSaidas}
              fmt={brl}
              className="text-[11px] text-rose-700"
            />
            <TdTotal valor={linha.saldoQuantidade} fmt={(v) => num(v)} className="text-[11px]" />
            <TdTotal valor={linha.saldoValor} fmt={brl} className="text-[11px]" />
          </tr>
        </tfoot>
      </table>
    </TabelaWrap>
  )
}
