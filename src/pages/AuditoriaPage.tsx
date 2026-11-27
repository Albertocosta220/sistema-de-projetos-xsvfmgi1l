import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useSigef } from '@/context/SigefContext'
import {
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  FileText,
  Filter,
  Info,
  RefreshCw,
  Scale,
  ShieldAlert,
  ShieldCheck,
  XCircle,
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { REGUAS_AUDITORIA } from '@/data/regrasAuditoria'
import { OcorrenciaAuditoria } from '@/types/sigef'
import { toast } from 'sonner'

export default function AuditoriaPage() {
  const { ocorrencias, reprocessarOcorrencia, resolverOcorrenciaManual, reprocessarNotas } =
    useSigef()

  const [regraFiltro, setRegraFiltro] = useState<string>('TODAS')
  const [apenasPendentes, setApenasPendentes] = useState<boolean>(true)
  const [ocorrenciaDetalhe, setOcorrenciaDetalhe] = useState<OcorrenciaAuditoria | null>(null)

  // Filtragem das ocorrências
  const ocorrenciasFiltradas = ocorrencias.filter((o) => {
    const matchesRegra = regraFiltro === 'TODAS' || o.regraCodigo === regraFiltro
    const matchesStatus = apenasPendentes ? !o.resolvido : true
    return matchesRegra && matchesStatus
  })

  const ocorrenciasBloqueantes = ocorrencias.filter(
    (o) => !o.resolvido && o.severidade === 'BLOQUEANTE',
  ).length

  const getSeveridadeBadge = (severidade: OcorrenciaAuditoria['severidade']) => {
    switch (severidade) {
      case 'BLOQUEANTE':
        return (
          <Badge variant="destructive" className="bg-rose-700 text-[10px] flex items-center gap-1">
            <AlertOctagon className="size-3" />
            BLOQUEANTE
          </Badge>
        )
      case 'ERRO':
        return (
          <Badge variant="destructive" className="text-[10px] flex items-center gap-1">
            <XCircle className="size-3" />
            ERRO
          </Badge>
        )
      case 'AVISO':
        return (
          <Badge
            variant="outline"
            className="text-amber-800 bg-amber-50 border-amber-300 text-[10px] flex items-center gap-1"
          >
            <AlertTriangle className="size-3" />
            AVISO
          </Badge>
        )
      default:
        return (
          <Badge variant="secondary" className="text-[10px] flex items-center gap-1">
            <Info className="size-3" />
            INFO
          </Badge>
        )
    }
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Painel de Auditoria Fiscal — Réguas A01 a A12
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Monitoramento de conformidade fiscal, bases legais, detecção de divergências e
            reprocessamento automático
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => {
              reprocessarNotas()
              toast.success('Todas as 12 réguas foram recalculadas contra a base de dados!')
            }}
            variant="outline"
            size="sm"
            className="text-xs flex items-center gap-1.5"
          >
            <RefreshCw className="size-3.5" />
            <span>Reprocessar Todas as Réguas</span>
          </Button>
        </div>
      </div>

      {/* Alerta Geral de Bloqueio */}
      {ocorrenciasBloqueantes > 0 ? (
        <div
          role="alert"
          className="p-4 bg-rose-50 border border-rose-300 rounded-xl flex items-start gap-3 text-rose-900"
        >
          <AlertOctagon className="size-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="text-xs sm:text-sm">
            <span className="font-bold">
              Atenção: Identificadas {ocorrenciasBloqueantes} ocorrência(s) impeditivas de
              fechamento!
            </span>
            <p className="text-rose-800 mt-0.5">
              O encerramento do inventário e a validação do Bloco H estão bloqueados até que as
              inconsistências de estoque e de-para sejam resolvidas.
            </p>
          </div>
        </div>
      ) : (
        <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl flex items-center gap-3 text-emerald-900">
          <ShieldCheck className="size-5 text-emerald-600 shrink-0" />
          <div className="text-xs sm:text-sm font-semibold">
            Nenhuma ocorrência bloqueante ativa! O estoque escriturado encontra-se em conformidade
            fiscal.
          </div>
        </div>
      )}

      {/* Grid de Réguas A01-A12 com Contadores */}
      <div>
        <h2 className="text-xs font-bold uppercase text-slate-500 tracking-wider mb-3">
          Catálogo das 12 Réguas de Auditoria Fiscal SIGEF-ME
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
          {REGUAS_AUDITORIA.map((regra) => {
            const countNaoResolvidas = ocorrencias.filter(
              (o) => o.regraCodigo === regra.codigo && !o.resolvido,
            ).length
            const isAtiva = regraFiltro === regra.codigo

            return (
              <button
                type="button"
                key={regra.codigo}
                onClick={() => setRegraFiltro(isAtiva ? 'TODAS' : regra.codigo)}
                className={`p-3 rounded-lg border text-left transition-all ${
                  isAtiva
                    ? 'border-blue-600 bg-blue-50/70 ring-1 ring-blue-600'
                    : countNaoResolvidas > 0
                      ? 'border-amber-300 bg-amber-50/40 hover:bg-amber-50'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-xs text-blue-800">{regra.codigo}</span>
                  {countNaoResolvidas > 0 ? (
                    <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4">
                      {countNaoResolvidas}
                    </Badge>
                  ) : (
                    <CheckCircle2 className="size-3.5 text-emerald-600" />
                  )}
                </div>
                <div
                  className="text-[11px] font-semibold text-slate-800 mt-1 line-clamp-1"
                  title={regra.nome}
                >
                  {regra.nome}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Filtros e Tabela de Ocorrências */}
      <Card className="border-slate-200">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <ShieldAlert className="size-4 text-blue-700" />
                Ocorrências Apuradas ({ocorrenciasFiltradas.length})
                {regraFiltro !== 'TODAS' && (
                  <Badge variant="outline" className="text-xs font-mono ml-2">
                    Filtro: {regraFiltro}
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="text-xs">
                Clique sobre qualquer ocorrência para visualizar a base legal e acionar o
                reprocessamento
              </CardDescription>
            </div>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={apenasPendentes}
                  onChange={(e) => setApenasPendentes(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600"
                />
                <span>Ocultar já resolvidas</span>
              </label>

              {regraFiltro !== 'TODAS' && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setRegraFiltro('TODAS')}
                  className="h-7 text-xs text-blue-700"
                >
                  Limpar Filtro
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {ocorrenciasFiltradas.length === 0 ? (
            <div className="text-center py-12 flex flex-col items-center justify-center gap-2">
              <CheckCircle2 className="size-8 text-emerald-600" />
              <div className="font-bold text-slate-800 text-sm">
                Nenhuma ocorrência encontrada para esta régua!
              </div>
              <div className="text-xs text-slate-500">
                Seus lançamentos atendem plenamente às exigências da legislação fiscal vigente.
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="text-xs">
                    <TableHead>Régua</TableHead>
                    <TableHead>Severidade</TableHead>
                    <TableHead>Descrição da Ocorrência</TableHead>
                    <TableHead>Documento / Ref</TableHead>
                    <TableHead>Base Legal</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ocorrenciasFiltradas.map((oco) => (
                    <TableRow
                      key={oco.id}
                      className={`text-xs ${
                        oco.resolvido
                          ? 'opacity-60 bg-slate-50'
                          : oco.severidade === 'BLOQUEANTE'
                            ? 'bg-rose-50/40 hover:bg-rose-50'
                            : undefined
                      }`}
                    >
                      <TableCell className="font-mono font-bold text-blue-800 whitespace-nowrap">
                        {oco.regraCodigo}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {getSeveridadeBadge(oco.severidade)}
                      </TableCell>
                      <TableCell className="max-w-[280px]">
                        <div className="font-medium text-slate-900">{oco.regraNome}</div>
                        <div className="text-[11px] text-slate-600 mt-0.5 line-clamp-2">
                          {oco.descricao}
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap font-mono text-[11px]">
                        {oco.documentoRef
                          ? `NF ${oco.documentoRef}`
                          : oco.codigoInventarioRef || '-'}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-[11px] text-slate-500 font-mono">
                        {oco.baseLegal}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {oco.resolvido ? (
                          <Badge
                            variant="outline"
                            className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]"
                          >
                            RESOLVIDA
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="bg-rose-50 text-rose-700 border-rose-200 text-[10px]"
                          >
                            PENDENTE
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-blue-700"
                            onClick={() => setOcorrenciaDetalhe(oco)}
                          >
                            Ver Detalhes
                          </Button>

                          {!oco.resolvido && oco.podeReprocessar && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs flex items-center gap-1"
                              onClick={() => reprocessarOcorrencia(oco.id)}
                            >
                              <RefreshCw className="size-3" />
                              <span>Reprocessar</span>
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal Detalhes da Ocorrência e Base Legal */}
      {ocorrenciaDetalhe && (
        <Dialog open={!!ocorrenciaDetalhe} onOpenChange={() => setOcorrenciaDetalhe(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="font-mono text-xs font-bold text-blue-800">
                  RÉGUA {ocorrenciaDetalhe.regraCodigo}
                </Badge>
                {getSeveridadeBadge(ocorrenciaDetalhe.severidade)}
              </div>
              <DialogTitle className="text-base mt-1">{ocorrenciaDetalhe.regraNome}</DialogTitle>
              <DialogDescription className="text-xs">
                Identificada em:{' '}
                {new Date(ocorrenciaDetalhe.dataIdentificacao).toLocaleString('pt-BR')}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2 text-xs">
              <div>
                <span className="font-semibold text-slate-500 uppercase tracking-wider text-[10px]">
                  Descrição do Fato Apurado:
                </span>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-slate-800 mt-1">
                  {ocorrenciaDetalhe.descricao}
                </div>
              </div>

              <div>
                <span className="font-semibold text-slate-500 uppercase tracking-wider text-[10px] flex items-center gap-1">
                  <Scale className="size-3" />
                  Base Legal e Fundamentação Tributária:
                </span>
                <div className="p-3 bg-blue-50/70 rounded-lg border border-blue-200 text-blue-950 mt-1 font-mono text-[11px]">
                  {ocorrenciaDetalhe.baseLegal}
                </div>
              </div>

              {ocorrenciaDetalhe.chaveAcessoRef && (
                <div>
                  <span className="font-semibold text-slate-500 text-[10px]">
                    Chave de Acesso Relacionada:
                  </span>
                  <div className="font-mono text-[11px] text-slate-700 break-all">
                    {ocorrenciaDetalhe.chaveAcessoRef}
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="gap-2">
              {!ocorrenciaDetalhe.resolvido && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    resolverOcorrenciaManual(ocorrenciaDetalhe.id)
                    setOcorrenciaDetalhe(null)
                  }}
                  className="text-xs"
                >
                  Marcar como Resolvida Manualmente
                </Button>
              )}

              {ocorrenciaDetalhe.podeReprocessar && (
                <Button
                  size="sm"
                  className="bg-blue-700 hover:bg-blue-800 text-xs flex items-center gap-1.5"
                  onClick={() => {
                    reprocessarOcorrencia(ocorrenciaDetalhe.id)
                    setOcorrenciaDetalhe(null)
                  }}
                >
                  <RefreshCw className="size-3.5" />
                  <span>Reprocessar Régua</span>
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
