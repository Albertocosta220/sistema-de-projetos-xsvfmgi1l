import React, { useState } from 'react'
import { useSigef } from '@/context/SigefContext'
import {
  AlertOctagon,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Ban,
  Calendar,
  CheckCircle2,
  Coins,
  Download,
  FileSpreadsheet,
  Filter,
  History,
  Package,
  RotateCcw,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export default function KardexPage() {
  const { produtos, kardex, cancelarNFe, reprocessarNotas } = useSigef()

  // Filtro por produto
  const [produtoSelecionado, setProdutoSelecionado] = useState<string>(
    produtos[0]?.codigoInventario || 'TODOS',
  )

  const movsFiltrados = kardex.filter((m) => {
    if (produtoSelecionado === 'TODOS') return true
    return m.codigoInventario === produtoSelecionado
  })

  // Produto em destaque
  const prodAtual = produtos.find((p) => p.codigoInventario === produtoSelecionado)

  // Estatísticas do produto selecionado
  const ultimoMov = movsFiltrados[movsFiltrados.length - 1]
  const saldoQtdAtual = ultimoMov ? ultimoMov.saldoQuantidade : 0
  const custoMedioAtual = ultimoMov ? ultimoMov.custoMedioUnitario : 0
  const saldoValorAtual = ultimoMov ? ultimoMov.saldoValorTotal : 0

  const saídasBloqueadasProd = movsFiltrados.filter((m) => m.bloqueadoSaldoNegativo).length

  // Exportar extrato Kardex em CSV
  const exportarKardexCsv = () => {
    const cabecalho = [
      'Data Movimento',
      'Codigo Produto',
      'Tipo Operacao',
      'Documento',
      'Historico',
      'Qtd Entrada',
      'Custo Unit Entrada',
      'Valor Total Entrada',
      'Qtd Saida',
      'Custo Unit Saida',
      'Valor Total Saida',
      'Saldo Quantidade',
      'Custo Medio Ponderado',
      'Saldo Valor Total',
    ]

    const linhas = movsFiltrados.map((m) => [
      `"${m.dataMovimento}"`,
      `"${m.codigoInventario}"`,
      `"${m.tipo}"`,
      `"${m.documentoRef}"`,
      `"${m.historico}"`,
      m.quantidadeEntrada.toFixed(4).replace('.', ','),
      m.custoUnitarioEntrada.toFixed(4).replace('.', ','),
      m.valorTotalEntrada.toFixed(2).replace('.', ','),
      m.quantidadeSaida.toFixed(4).replace('.', ','),
      m.custoUnitarioSaida.toFixed(4).replace('.', ','),
      m.valorTotalSaida.toFixed(2).replace('.', ','),
      m.saldoQuantidade.toFixed(4).replace('.', ','),
      m.custoMedioUnitario.toFixed(4).replace('.', ','),
      m.saldoValorTotal.toFixed(2).replace('.', ','),
    ])

    const csvContent =
      '\uFEFF' + [cabecalho.join(';'), ...linhas.map((l) => l.join(';'))].join('\r\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `kardex_${produtoSelecionado}_${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Kardex Fiscal — Custo Médio Ponderado (CMP)
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Extrato cronológico com replay de movimentações, dedução de tributos, bloqueio de saídas
            negativas e recálculo após estorno
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={reprocessarNotas}
            className="text-xs flex items-center gap-1.5"
          >
            <RotateCcw className="size-3.5" />
            <span>Recalcular Kardex</span>
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={exportarKardexCsv}
            className="text-xs flex items-center gap-1.5"
          >
            <Download className="size-3.5" />
            <span>Exportar CSV</span>
          </Button>
        </div>
      </div>

      {/* Barra de Filtro e Resumo do Produto */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Filter className="size-4 text-slate-500 shrink-0" />
          <div className="w-full sm:w-80">
            <Select value={produtoSelecionado} onValueChange={setProdutoSelecionado}>
              <SelectTrigger className="text-xs font-medium" aria-label="Filtrar por produto">
                <SelectValue placeholder="Selecione o produto" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TODOS" className="text-xs font-bold">
                  Todos os Produtos (Visão Geral)
                </SelectItem>
                {produtos.map((p) => (
                  <SelectItem
                    key={p.codigoInventario}
                    value={p.codigoInventario}
                    className="text-xs"
                  >
                    <span className="font-mono font-bold text-blue-700 mr-2">
                      {p.codigoInventario}
                    </span>
                    <span>{p.descricao.substring(0, 35)}...</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {prodAtual && produtoSelecionado !== 'TODOS' && (
          <div className="flex flex-wrap items-center gap-4 text-xs">
            <div className="bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg">
              <span className="text-slate-500">Saldo Físico:</span>{' '}
              <strong className="text-slate-900 font-mono">
                {saldoQtdAtual.toLocaleString('pt-BR', { maximumFractionDigits: 3 })}{' '}
                {prodAtual.unidade}
              </strong>
            </div>

            <div className="bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg">
              <span className="text-slate-500">Custo Médio Vigente:</span>{' '}
              <strong className="text-blue-700 font-mono">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                  custoMedioAtual,
                )}
              </strong>
            </div>

            <div className="bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg">
              <span className="text-slate-500">Valor Total Escriturado:</span>{' '}
              <strong className="text-emerald-700 font-mono">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                  saldoValorAtual,
                )}
              </strong>
            </div>
          </div>
        )}
      </div>

      {/* Alerta de Saídas Bloqueadas */}
      {saídasBloqueadasProd > 0 && (
        <div
          role="alert"
          className="p-4 bg-rose-50 border border-rose-300 rounded-xl flex items-start gap-3 text-rose-900"
        >
          <AlertOctagon className="size-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="text-xs sm:text-sm">
            <span className="font-bold">
              Atenção: Identificada(s) {saídasBloqueadasProd} tentativa(s) de saída com saldo
              insuficiente (Regra A03)!
            </span>
            <p className="text-rose-800 mt-0.5">
              Conforme Parecer Normativo CST nº 26/1976 e RIR/2018 Art. 304, estoques fiscais não
              podem operar com saldo negativo. As saídas excedentes foram bloqueadas no Kardex e
              impedem o encerramento do inventário.
            </p>
          </div>
        </div>
      )}

      {/* Tabela do Kardex */}
      <Card className="border-slate-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <FileSpreadsheet className="size-4 text-blue-700" />
            Extrato de Movimentações Cronológicas ({movsFiltrados.length} lançamentos)
          </CardTitle>
          <CardDescription className="text-xs">
            Cada entrada recalcula o Custo Médio Unitário com base no valor líquido de tributos
            recuperáveis. Cada saída baixa quantidade mantendo o custo médio ponderado.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {movsFiltrados.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-xs">
              Nenhuma movimentação para o produto selecionado.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="text-xs">
                    <TableHead>Data / Hora</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead>Tipo / Documento</TableHead>
                    <TableHead>Histórico do Movimento</TableHead>
                    <TableHead className="text-right bg-emerald-50/50">Qtd Entrada</TableHead>
                    <TableHead className="text-right bg-emerald-50/50">Custo Unit</TableHead>
                    <TableHead className="text-right bg-emerald-50/50 font-bold">
                      Total Entrada
                    </TableHead>
                    <TableHead className="text-right bg-blue-50/50">Qtd Saída</TableHead>
                    <TableHead className="text-right bg-blue-50/50 font-bold">
                      Total Saída
                    </TableHead>
                    <TableHead className="text-right bg-slate-100 font-bold">
                      Saldo Físico
                    </TableHead>
                    <TableHead className="text-right bg-slate-100 font-bold text-blue-800">
                      Custo Médio (CMP)
                    </TableHead>
                    <TableHead className="text-right bg-slate-100 font-bold">
                      Saldo Valor Total
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movsFiltrados.map((m) => {
                    const isEntrada =
                      m.tipo === 'ENTRADA_COMPRA' || m.tipo === 'AJUSTE_INVENTARIO_ENTRADA'
                    const isSaida = m.tipo === 'SAIDA_VENDA' || m.tipo === 'AJUSTE_INVENTARIO_SAIDA'
                    const isBloqueado = m.bloqueadoSaldoNegativo
                    const isEstornado = m.estornado

                    return (
                      <TableRow
                        key={m.id}
                        className={`text-xs ${
                          isBloqueado
                            ? 'bg-rose-50/80 hover:bg-rose-100/80 border-l-4 border-l-rose-600'
                            : isEstornado
                              ? 'bg-slate-100/60 line-through text-slate-400'
                              : isEntrada
                                ? 'hover:bg-emerald-50/30'
                                : 'hover:bg-blue-50/30'
                        }`}
                      >
                        {/* Data */}
                        <TableCell className="whitespace-nowrap font-mono text-[11px]">
                          {new Date(m.dataMovimento).toLocaleDateString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </TableCell>

                        {/* Produto */}
                        <TableCell className="font-mono font-bold text-blue-800">
                          {m.codigoInventario}
                        </TableCell>

                        {/* Documento */}
                        <TableCell className="whitespace-nowrap">
                          <div className="font-semibold text-slate-800">{m.documentoRef}</div>
                          <Badge
                            variant={
                              isBloqueado ? 'destructive' : isEntrada ? 'outline' : 'secondary'
                            }
                            className="text-[9px] px-1 py-0 uppercase"
                          >
                            {isBloqueado ? 'BLOQUEADO' : m.tipo.replace('_', ' ')}
                          </Badge>
                        </TableCell>

                        {/* Histórico */}
                        <TableCell
                          className="max-w-[200px] truncate text-slate-700"
                          title={m.historico}
                        >
                          {m.historico}
                        </TableCell>

                        {/* Entrada */}
                        <TableCell className="text-right font-mono bg-emerald-50/30 text-emerald-800">
                          {m.quantidadeEntrada > 0 ? m.quantidadeEntrada.toFixed(2) : '-'}
                        </TableCell>
                        <TableCell className="text-right font-mono bg-emerald-50/30 text-slate-600">
                          {m.custoUnitarioEntrada > 0 ? m.custoUnitarioEntrada.toFixed(4) : '-'}
                        </TableCell>
                        <TableCell className="text-right font-mono font-bold bg-emerald-50/30 text-emerald-900">
                          {m.valorTotalEntrada > 0
                            ? new Intl.NumberFormat('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                              }).format(m.valorTotalEntrada)
                            : '-'}
                        </TableCell>

                        {/* Saída */}
                        <TableCell
                          className={`text-right font-mono bg-blue-50/30 ${
                            isBloqueado ? 'text-rose-700 font-bold' : 'text-blue-800'
                          }`}
                        >
                          {m.quantidadeSaida > 0 ? m.quantidadeSaida.toFixed(2) : '-'}
                        </TableCell>
                        <TableCell className="text-right font-mono font-bold bg-blue-50/30 text-blue-900">
                          {m.valorTotalSaida > 0
                            ? new Intl.NumberFormat('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                              }).format(m.valorTotalSaida)
                            : '-'}
                        </TableCell>

                        {/* Saldo Resultante CMP */}
                        <TableCell className="text-right font-mono font-bold bg-slate-100/70 text-slate-900">
                          {m.saldoQuantidade.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right font-mono font-bold bg-slate-100/70 text-blue-900">
                          {new Intl.NumberFormat('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          }).format(m.custoMedioUnitario)}
                        </TableCell>
                        <TableCell className="text-right font-mono font-extrabold bg-slate-100/70 text-slate-900">
                          {new Intl.NumberFormat('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          }).format(m.saldoValorTotal)}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
