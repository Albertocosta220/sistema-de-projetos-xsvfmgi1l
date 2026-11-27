import React from 'react'
import { Link } from 'react-router-dom'
import { useSigef } from '@/context/SigefContext'
import {
  AlertOctagon,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  CheckCircle2,
  Clock,
  Coins,
  FileSpreadsheet,
  Package,
  ShieldCheck,
  TrendingUp,
  Upload,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { OnboardingPrimeiraEmpresa } from '@/components/OnboardingPrimeiraEmpresa'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

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

  // Cálculos consolidados para o Painel
  const saldoTotalValor = produtos.reduce((total, p) => {
    const movs = kardex.filter((k) => k.codigoInventario === p.codigoInventario)
    const ultimo = movs[movs.length - 1]
    return total + (ultimo ? ultimo.saldoValorTotal : 0)
  }, 0)

  const saldoTotalQuantidade = produtos.reduce((total, p) => {
    const movs = kardex.filter((k) => k.codigoInventario === p.codigoInventario)
    const ultimo = movs[movs.length - 1]
    return total + (ultimo ? ultimo.saldoQuantidade : 0)
  }, 0)

  const documentosProcessados = documentos.filter((d) => d.status === 'PROCESSADO').length
  const documentosAguardandoDePara = documentos.filter(
    (d) => d.status === 'AGUARDANDO_DE_PARA',
  ).length
  const documentosDuplicidade = documentos.filter((d) => d.status === 'DUPLICIDADE').length
  const saídasBloqueadas = kardex.filter((k) => k.bloqueadoSaldoNegativo).length

  const ocorrenciasPendentes = ocorrencias.filter((o) => !o.resolvido)
  const ocorrenciasBloqueantes = ocorrenciasPendentes.filter(
    (o) => o.severidade === 'BLOQUEANTE',
  ).length

  const ultimoFechamento = fechamentos[fechamentos.length - 1]

  return (
    <div className="space-y-6">
      {/* Cabeçalho da Empresa */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
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

      {/* Métricas Principais (Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Valor Total do Estoque
            </CardTitle>
            <Coins className="size-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-extrabold text-slate-900">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                saldoTotalValor,
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
              <TrendingUp className="size-3 text-emerald-600" />
              Custo Médio Ponderado (CMP) ativo
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Volume Físico Escriturado
            </CardTitle>
            <Package className="size-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-extrabold text-slate-900">
              {saldoTotalQuantidade.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}{' '}
              <span className="text-sm font-normal text-slate-500">un/kg/mt</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Distribuído em {produtos.length} produtos cadastrados
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Pendências de De-Para
            </CardTitle>
            <Clock
              className={`size-4 ${
                documentosAguardandoDePara > 0 ? 'text-amber-600' : 'text-slate-400'
              }`}
            />
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-extrabold ${
                documentosAguardandoDePara > 0 ? 'text-amber-700' : 'text-slate-900'
              }`}
            >
              {documentosAguardandoDePara}{' '}
              <span className="text-sm font-normal text-slate-500">NF-e(s)</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {documentosAguardandoDePara > 0 ? (
                <Link to="/produtos" className="text-amber-700 underline font-medium">
                  Resolver vínculos pendentes →
                </Link>
              ) : (
                'Todos os itens de fornecedores mapeados'
              )}
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Auditoria Fiscal (A01-A12)
            </CardTitle>
            <ShieldCheck
              className={`size-4 ${
                ocorrenciasBloqueantes > 0 ? 'text-rose-600' : 'text-emerald-600'
              }`}
            />
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-extrabold ${
                ocorrenciasBloqueantes > 0 ? 'text-rose-700' : 'text-slate-900'
              }`}
            >
              {ocorrenciasPendentes.length}{' '}
              <span className="text-sm font-normal text-slate-500">ocorrência(s)</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {ocorrenciasBloqueantes > 0 ? (
                <span className="text-rose-600 font-semibold">
                  {ocorrenciasBloqueantes} bloqueante(s) de fechamento
                </span>
              ) : (
                'Nenhuma infração impeditiva'
              )}
            </p>
          </CardContent>
        </Card>
      </div>

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

        {/* Coluna Lateral: Resumo de Alertas, Documentos e Fechamento */}
        <div className="space-y-4">
          {/* Status dos Documentos na Fila */}
          <Card className="border-slate-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold">Fila de Documentos NF-e</CardTitle>
              <CardDescription className="text-xs">
                {documentos.length} notas escrituradas ou na fila
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-xs p-2 rounded bg-slate-50 border">
                <span className="font-medium text-slate-700">Processadas</span>
                <Badge
                  variant="outline"
                  className="bg-emerald-50 text-emerald-700 border-emerald-200"
                >
                  {documentosProcessados}
                </Badge>
              </div>

              <div className="flex items-center justify-between text-xs p-2 rounded bg-slate-50 border">
                <span className="font-medium text-slate-700">Aguardando De-Para</span>
                <Badge
                  variant={documentosAguardandoDePara > 0 ? 'destructive' : 'outline'}
                  className={documentosAguardandoDePara > 0 ? '' : 'text-slate-600'}
                >
                  {documentosAguardandoDePara}
                </Badge>
              </div>

              <div className="flex items-center justify-between text-xs p-2 rounded bg-slate-50 border">
                <span className="font-medium text-slate-700">Duplicidades (A01)</span>
                <Badge
                  variant={documentosDuplicidade > 0 ? 'destructive' : 'outline'}
                  className={documentosDuplicidade > 0 ? '' : 'text-slate-600'}
                >
                  {documentosDuplicidade}
                </Badge>
              </div>

              <div className="flex items-center justify-between text-xs p-2 rounded bg-slate-50 border">
                <span className="font-medium text-slate-700">Saídas Bloqueadas (A03)</span>
                <Badge
                  variant={saídasBloqueadas > 0 ? 'destructive' : 'outline'}
                  className={saídasBloqueadas > 0 ? '' : 'text-slate-600'}
                >
                  {saídasBloqueadas}
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
