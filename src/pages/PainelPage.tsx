import React from 'react'
import { Link } from 'react-router-dom'
import { useSigef } from '@/context/SigefContext'
import { calcularTotaisDashboard } from '@/services/totaisDashboardService'
import {
  AlertOctagon,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  CheckCircle2,
  Clock,
  FileSpreadsheet,
  Package,
  ShieldCheck,
  Upload,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PainelIndicadoresFiscais } from '@/components/PainelIndicadoresFiscais'
import { SeletorCompetencia } from '@/components/SeletorCompetencia'
import { OnboardingPrimeiraEmpresa } from '@/components/OnboardingPrimeiraEmpresa'
import { brl, num } from '@/components/shell'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

/** KPI clicável do dashboard de totais (estilo kpi-b do shell, com navegação). */
function KpiTotal({
  label,
  value,
  hint,
  to,
  tone = 'accent',
  toneValue,
}: {
  label: string
  value: React.ReactNode
  hint?: React.ReactNode
  to: string
  tone?: 'accent' | 'verde' | 'ambar' | 'vermelho'
  toneValue?: string
}) {
  return (
    <Link
      to={to}
      className={`kpi-b tone-${tone} block group focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]`}
    >
      <span className="kpi-label">{label}</span>
      <span className={`kpi-value block group-hover:text-[var(--accent-text)] ${toneValue ?? ''}`}>
        {value}
      </span>
      {hint ? <span className="kpi-hint block">{hint}</span> : null}
    </Link>
  )
}

export default function PainelPage() {
  const { empresaAtiva, produtos, documentos, kardex, ocorrencias, fechamentos, periodoAtivo } =
    useSigef()

  // Produção sem empresa cadastrada: onboarding da primeira empresa
  if (!empresaAtiva.id) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Bem-vindo ao SIGEF-ME
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Sistema de controle fiscal de estoque em produção oficial — comece cadastrando a sua
            empresa.
          </p>
        </div>
        <OnboardingPrimeiraEmpresa />
      </div>
    )
  }

  // Dashboard de totais — derivado dos dados reais da empresa ativa
  // (isolamento multiempresa: o contexto só expõe a store da empresa ativa).
  const totais = calcularTotaisDashboard({ produtos, documentos, kardex, ocorrencias })
  const { documentos: docs, movimentacao, alertas } = totais

  const ultimoFechamento = fechamentos[fechamentos.length - 1]

  // Resumo compacto dos status da fila (mostra só o que existe nos dados).
  const partesStatus: string[] = []
  if (docs.processado > 0) partesStatus.push(`Processadas: ${docs.processado}`)
  if (docs.pendente > 0) partesStatus.push(`Pendentes: ${docs.pendente}`)
  if (docs.aguardandoDePara > 0) partesStatus.push(`Aguardando De-Para: ${docs.aguardandoDePara}`)
  if (docs.erro > 0) partesStatus.push(`Erro: ${docs.erro}`)
  if (docs.duplicidade > 0) partesStatus.push(`Duplicidade: ${docs.duplicidade}`)
  if (docs.cancelado > 0) partesStatus.push(`Canceladas: ${docs.cancelado}`)

  return (
    <div className="space-y-6">
      {/* Cabeçalho da Empresa */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 card-s">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              {empresaAtiva.nomeFantasia || empresaAtiva.razaoSocial || 'Minha empresa'}
            </h1>
            <Badge
              variant={empresaAtiva.situacaoCadastral === 'ATIVA' ? 'outline' : 'destructive'}
              className="text-xs"
            >
              {empresaAtiva.situacaoCadastral}
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            CNPJ: {empresaAtiva.cnpj} • IE: {empresaAtiva.inscricaoEstadual} • UF: {empresaAtiva.uf}{' '}
            • {empresaAtiva.razaoSocial}
          </p>
          <p className="text-xs text-blue-800 mt-1.5 font-medium flex items-center gap-1.5">
            <Calendar className="size-3.5 text-blue-600" aria-hidden="true" />
            Mês ativo de trabalho (competência):{' '}
            <strong className="font-mono">{periodoAtivo.competencia}</strong> — período{' '}
            {periodoAtivo.inicio} a {periodoAtivo.fim}, definido na última importação
          </p>
        </div>

        <SeletorCompetencia />

        <div className="flex flex-wrap items-center gap-2">
          <Button asChild size="sm" className="bg-blue-700 hover:bg-blue-800">
            <Link to="/importar">
              <Upload className="size-4 mr-1.5" />
              Importar NF-e
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/inventario">
              <CheckCircle2 className="size-4 mr-1.5" />
              Fechar Competência
            </Link>
          </Button>
          <Button asChild variant="secondary" size="sm">
            <Link to="/sped">
              <FileSpreadsheet className="size-4 mr-1.5" />
              Gerar SPED TXT
            </Link>
          </Button>
        </div>
      </div>

      {/* Alerta de Empresa Inapta ou Bloqueio */}
      {empresaAtiva.bloquearFechamento && (
        <div
          role="alert"
          className="p-4 bg-rose-50 border border-rose-300 rounded-xl flex items-start gap-3 text-rose-900"
        >
          <AlertOctagon className="size-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="text-sm">
            <div className="font-bold">Atenção: Fechamento Fiscal Bloqueado (Regra A09)</div>
            <div className="mt-0.5 text-rose-800">
              {empresaAtiva.motivoBloqueio ||
                'Esta empresa possui pendências cadastrais na Receita Federal que impedem a homologação e fechamento de competências.'}
            </div>
          </div>
        </div>
      )}

      {/* ===== Dashboard de totais (cartões clicáveis) ===== */}
      <section aria-labelledby="titulo-totais">
        <h2 id="titulo-totais" className="text-lg font-bold text-slate-900 mb-3">
          Dashboard de totais
        </h2>
        <div className="kpi-grid">
          <KpiTotal
            label="Valor total do estoque"
            value={brl(totais.valorTotalEstoque)}
            hint={`CMP ativo sobre ${totais.itensComEstoque} item(ns) com saldo`}
            to="/kardex"
            tone="accent"
          />
          <KpiTotal
            label="Produtos cadastrados"
            value={num(totais.totalProdutos, 0)}
            hint={`Volume físico escriturado: ${num(totais.quantidadeTotalEstoque, 2)}`}
            to="/produtos"
            tone="verde"
          />
          <KpiTotal
            label="Documentos importados"
            value={num(docs.total, 0)}
            hint={partesStatus.length > 0 ? partesStatus.join(' · ') : 'Nenhuma NF-e na fila'}
            to="/importar"
            tone="accent"
          />
          <KpiTotal
            label="Total de entradas"
            value={num(movimentacao.entradasQtd, 2)}
            hint={
              movimentacao.temMovimentos
                ? `${brl(movimentacao.entradasValor)} em valor de entrada`
                : 'Sem movimentações no Kardex'
            }
            to="/kardex"
            tone="verde"
          />
          <KpiTotal
            label="Total de saídas"
            value={num(movimentacao.saidasQtd, 2)}
            hint={
              movimentacao.temMovimentos
                ? `${brl(movimentacao.saidasValor)} em valor de saída`
                : 'Sem movimentações no Kardex'
            }
            to="/kardex"
            tone="accent"
          />
          <KpiTotal
            label="Pendências de De-Para"
            value={num(totais.pendenciasDePara, 0)}
            hint={
              totais.pendenciasDePara > 0
                ? 'NF-e(s) aguardando vínculo de itens'
                : 'Todos os itens de fornecedores mapeados'
            }
            to="/produtos"
            tone={totais.pendenciasDePara > 0 ? 'ambar' : 'verde'}
            toneValue={totais.pendenciasDePara > 0 ? 'text-[var(--ambar)]' : undefined}
          />
          <KpiTotal
            label="Alertas ativos"
            value={num(alertas.total, 0)}
            hint={
              alertas.total > 0
                ? `${alertas.ocorrenciasPendentes} ocorrência(s) · ${alertas.saldosNegativos} saldo(s) negativo(s)`
                : 'Nenhuma ocorrência ou saldo negativo'
            }
            to="/auditoria"
            tone={alertas.total > 0 ? 'vermelho' : 'verde'}
            toneValue={alertas.total > 0 ? 'text-[var(--vermelho)]' : undefined}
          />
        </div>
      </section>

      {/* Dashboard de Indicadores Fiscais (resumo, totais, evolução e ranking) */}
      <PainelIndicadoresFiscais />

      {/* Grid com Tabela de Produtos e Alertas Críticos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Posição de Estoque por Produto */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="border-slate-200">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-base font-bold">Posição Atual de Estoque</CardTitle>
                <CardDescription className="text-xs">
                  Saldos físicos e custos médios unitários calculados
                </CardDescription>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link to="/kardex">Ver Kardex Detalhado</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {produtos.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-sm">
                  Nenhum produto cadastrado para esta empresa.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Código</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead className="text-right">Saldo Físico</TableHead>
                        <TableHead className="text-right">Custo Médio</TableHead>
                        <TableHead className="text-right">Valor Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {produtos.map((p) => {
                        const movs = kardex.filter((k) => k.codigoInventario === p.codigoInventario)
                        const ultimo = movs[movs.length - 1]
                        const qtd = ultimo ? ultimo.saldoQuantidade : 0
                        const custo = ultimo ? ultimo.custoMedioUnitario : 0
                        const valTotal = ultimo ? ultimo.saldoValorTotal : 0

                        return (
                          <TableRow key={p.codigoInventario}>
                            <TableCell className="font-mono text-xs font-bold text-blue-800">
                              {p.codigoInventario}
                            </TableCell>
                            <TableCell className="text-xs font-medium max-w-[220px] truncate">
                              {p.descricao}
                            </TableCell>
                            <TableCell className="text-right text-xs font-bold">
                              {qtd.toLocaleString('pt-BR', { maximumFractionDigits: 3 })}{' '}
                              <span className="text-[10px] text-slate-400 font-normal">
                                {p.unidade}
                              </span>
                            </TableCell>
                            <TableCell className="text-right text-xs">
                              {new Intl.NumberFormat('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                              }).format(custo)}
                            </TableCell>
                            <TableCell className="text-right text-xs font-bold text-slate-900">
                              {new Intl.NumberFormat('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                              }).format(valTotal)}
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

          {/* Últimas Movimentações */}
          <Card className="border-slate-200">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-base font-bold">Últimas Movimentações Fiscais</CardTitle>
                <CardDescription className="text-xs">
                  Entradas, saídas e estornos processados na linha do tempo
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {kardex.length === 0 ? (
                <div className="text-center py-6 text-slate-400 text-xs">
                  Nenhuma movimentação registrada no Kardex.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {kardex
                    .slice(-5)
                    .reverse()
                    .map((m) => {
                      const isEntrada =
                        m.tipo === 'ENTRADA_COMPRA' || m.tipo === 'AJUSTE_INVENTARIO_ENTRADA'
                      const isBloqueado = m.bloqueadoSaldoNegativo
                      return (
                        <div
                          key={m.id}
                          className={`flex items-center justify-between p-2.5 rounded-lg border text-xs ${
                            isBloqueado ? 'bg-rose-50 border-rose-200' : 'bg-white border-slate-200'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className={`size-7 rounded-full flex items-center justify-center ${
                                isBloqueado
                                  ? 'bg-rose-200 text-rose-800'
                                  : isEntrada
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-blue-100 text-blue-800'
                              }`}
                            >
                              {isBloqueado ? (
                                <AlertTriangle className="size-3.5" />
                              ) : isEntrada ? (
                                <ArrowDownRight className="size-3.5" />
                              ) : (
                                <ArrowUpRight className="size-3.5" />
                              )}
                            </div>
                            <div>
                              <div className="font-bold text-slate-800">
                                {m.codigoInventario} • {m.documentoRef}
                              </div>
                              <div className="text-[11px] text-slate-500 truncate max-w-[280px]">
                                {m.historico}
                              </div>
                            </div>
                          </div>

                          <div className="text-right">
                            <div
                              className={`font-bold ${
                                isBloqueado
                                  ? 'text-rose-700'
                                  : isEntrada
                                    ? 'text-emerald-700'
                                    : 'text-blue-700'
                              }`}
                            >
                              {isEntrada ? '+' : '-'}{' '}
                              {(isEntrada ? m.quantidadeEntrada : m.quantidadeSaida).toFixed(2)}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              Saldo: {m.saldoQuantidade.toFixed(2)}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Coluna Lateral: Fila de Documentos, Alertas e Fechamento */}
        <div className="space-y-4">
          {/* Status dos Documentos na Fila */}
          <Card className="border-slate-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold">Fila de Documentos NF-e</CardTitle>
              <CardDescription className="text-xs">
                {docs.total} notas escrituradas ou na fila
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {(
                [
                  ['Processadas', docs.processado, 'emerald'],
                  ['Pendentes', docs.pendente, 'slate'],
                  ['Aguardando De-Para', docs.aguardandoDePara, 'ambar'],
                  ['Com erro', docs.erro, 'rose'],
                  ['Duplicidades (A01)', docs.duplicidade, 'rose'],
                  ['Canceladas', docs.cancelado, 'slate'],
                ] as [string, number, string][]
              ).map(([rotulo, quantidade, cor]) => (
                <div
                  key={rotulo}
                  className="flex items-center justify-between text-xs p-2 rounded bg-slate-50 border"
                >
                  <span className="font-medium text-slate-700">{rotulo}</span>
                  <Badge
                    variant={quantidade > 0 && cor !== 'emerald' ? 'destructive' : 'outline'}
                    className={
                      cor === 'emerald' && quantidade > 0
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : quantidade === 0
                          ? 'text-slate-600'
                          : ''
                    }
                  >
                    {quantidade}
                  </Badge>
                </div>
              ))}

              <div className="flex items-center justify-between text-xs p-2 rounded bg-slate-50 border">
                <span className="font-medium text-slate-700">Saídas Bloqueadas (A03)</span>
                <Badge
                  variant={movimentacao.movimentosBloqueados > 0 ? 'destructive' : 'outline'}
                  className={movimentacao.movimentosBloqueados === 0 ? 'text-slate-600' : ''}
                >
                  {movimentacao.movimentosBloqueados}
                </Badge>
              </div>

              <Button asChild variant="outline" size="sm" className="w-full text-xs mt-2">
                <Link to="/importar">Gerenciar Fila de Documentos</Link>
              </Button>
            </CardContent>
          </Card>

          {/* Último Fechamento Homologado */}
          <Card className="border-slate-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold">Último Fechamento Homologado</CardTitle>
            </CardHeader>
            <CardContent>
              {ultimoFechamento ? (
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b">
                    <span className="text-slate-500">Competência:</span>
                    <span className="font-bold text-slate-900">{ultimoFechamento.competencia}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b">
                    <span className="text-slate-500">Status:</span>
                    <Badge
                      variant="outline"
                      className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]"
                    >
                      {ultimoFechamento.status}
                    </Badge>
                  </div>
                  <div className="flex justify-between py-1 border-b">
                    <span className="text-slate-500">Valor Homologado:</span>
                    <span className="font-bold text-slate-900">
                      {new Intl.NumberFormat('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      }).format(ultimoFechamento.valorTotalEstoque)}
                    </span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500">Responsável:</span>
                    <span className="text-slate-700 truncate max-w-[140px]">
                      {ultimoFechamento.responsavel}
                    </span>
                  </div>
                  <Button asChild variant="secondary" size="sm" className="w-full text-xs mt-3">
                    <Link to="/inventario">Acessar Inventário / Bloco H</Link>
                  </Button>
                </div>
              ) : (
                <div className="text-xs text-slate-500 text-center py-4">
                  Nenhuma competência encerrada ainda.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
