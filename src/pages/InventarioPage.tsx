import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSigef } from '@/context/SigefContext'
import {
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Download,
  FileCheck,
  FileSpreadsheet,
  Lock,
  Plus,
  RefreshCw,
  Scale,
  ShieldAlert,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { ItemContagemInventario } from '@/types/sigef'
import { SeletorCompetencia } from '@/components/SeletorCompetencia'
import { brl, num, num as fmtQtd } from '@/components/shell'
import { TabelaWrap, Th, Td, TdNum, TrTotais, TdTotal } from '@/components/tabelaPadrao'
import { useAuth } from '@/context/AuthContext'
import { toast } from 'sonner'

export default function InventarioPage() {
  const {
    empresaAtiva,
    documentos,
    kardex,
    fechamentos,
    produtos,
    gerarContagemCompetencia,
    fecharCompetencia,
  } = useSigef()
  const { temPermissao, usuarioAtual } = useAuth()
  const podeAprovar = temPermissao('acao-aprovar-ajuste')
  const podeFechar = temPermissao('acao-fechar-competencia')

  // A competência é a ATIVA da empresa (fonte única no SigefContext): trocá-la
  // aqui muda o período de todas as outras abas ao mesmo tempo.
  const { competenciaAtiva, definirCompetenciaAtiva } = useSigef()
  const competenciaSelecionada = competenciaAtiva
  const setCompetenciaSelecionada = definirCompetenciaAtiva
  const [responsavel, setResponsavel] = useState(usuarioAtual?.nome ?? '')
  const [itensContagem, setItensContagem] = useState<ItemContagemInventario[]>([])
  const [modalConfirmarFechamento, setModalConfirmarFechamento] = useState(false)

  // Verifica se a competência já está fechada
  const fechamentoExistente = fechamentos.find((f) => f.competencia === competenciaSelecionada)
  const isCompetenciaFechada = !!fechamentoExistente

  // Carrega contagem inicial da competência
  // (produtos.length na dependência: itens importados por planilha entram com saldo zero)
  useEffect(() => {
    const itens = gerarContagemCompetencia(competenciaSelecionada)
    setItensContagem(itens)
  }, [competenciaSelecionada, kardex.length, produtos.length])

  // Atualizar contagem digitada pelo usuário
  const atualizarQtdContada = (codigoInventario: string, novaQtd: number) => {
    setItensContagem((prev) =>
      prev.map((it) => {
        if (it.codigoInventario === codigoInventario) {
          const difQtd = novaQtd - it.quantidadeSistema
          const difValor = difQtd * it.custoMedioSistema
          return {
            ...it,
            quantidadeContada: novaQtd,
            diferencaQuantidade: difQtd,
            diferencaValor: difValor,
            statusAjuste: Math.abs(difQtd) > 0.0001 ? 'PENDENTE' : 'SEM_DIVERGENCIA',
          }
        }
        return it
      }),
    )
  }

  // Validações impeditivas de Fechamento
  // Mesmo filtro defensivo do Painel/indicadoresFiscais: documentos com marca
  // derivada de desqualificação / "não controla estoque" / "não vincular" não
  // são pendência — bloqueariam o fechamento sem motivo real.
  const pendenciasDocumentos = documentos.filter(
    (d) =>
      (d.status === 'PENDENTE' || d.status === 'AGUARDANDO_DE_PARA') &&
      !d.desqualificadaParaInventario &&
      !d.naoControlaEstoque &&
      !d.naoVinculaEstoque,
  ).length

  const duplicidades = documentos.filter((d) => d.status === 'DUPLICIDADE').length
  const saídasBloqueadas = kardex.filter((k) => k.bloqueadoSaldoNegativo).length
  const isInapta = empresaAtiva.bloquearFechamento || empresaAtiva.situacaoCadastral !== 'ATIVA'

  const temBloqueio =
    isInapta || pendenciasDocumentos > 0 || duplicidades > 0 || saídasBloqueadas > 0

  const totalQtdSistema = itensContagem.reduce((s, it) => s + it.quantidadeSistema, 0)
  const totalDivergQtd = itensContagem.reduce((s, it) => s + it.diferencaQuantidade, 0)
  const totalValorSistema = itensContagem.reduce((s, it) => s + it.valorTotalSistema, 0)
  const totalValorContado = itensContagem.reduce(
    (s, it) => s + it.quantidadeContada * it.custoMedioSistema,
    0,
  )
  const totalDiferencaValor = totalValorContado - totalValorSistema
  const divergenciasCount = itensContagem.filter(
    (it) => Math.abs(it.diferencaQuantidade) > 0.0001,
  ).length

  const handleExecutarFechamento = () => {
    const res = fecharCompetencia({
      competencia: competenciaSelecionada,
      responsavel,
      itensContagem,
    })
    if (res.sucesso) {
      setModalConfirmarFechamento(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Inventário Físico & Fechamento de Competência (Bloco H)
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Conferência física vs escriturada, apuração de divergências, aprovação de ajustes e
            geração do Bloco H do SPED
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button asChild variant="secondary" size="sm" className="text-xs">
            <Link to="/sped">
              <FileSpreadsheet className="size-3.5 mr-1" />
              Ver Bloco H & K no SPED
            </Link>
          </Button>
        </div>
      </div>

      {/* Barra de Competência e Status */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <SeletorCompetencia />

          <div>
            {isCompetenciaFechada ? (
              <Badge className="bg-emerald-600 text-white flex items-center gap-1 text-xs">
                <CheckCircle2 className="size-3" />
                FECHAMENTO HOMOLOGADO
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="text-amber-700 border-amber-300 bg-amber-50 text-xs"
              >
                COMPETÊNCIA EM ABERTO
              </Badge>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isCompetenciaFechada ? (
            <Button
              onClick={() => setModalConfirmarFechamento(true)}
              disabled={!podeFechar}
              title={
                podeFechar
                  ? 'Validar réguas e encerrar a competência (Bloco H)'
                  : 'Sem permissão: exige a ação "Fechar competência" no perfil'
              }
              className="bg-[#0E7C86] hover:bg-[#0B636B] text-white text-xs font-semibold"
            >
              <Lock className="size-3.5 mr-1.5" />
              Validar & Fechar Bloco H
            </Button>
          ) : (
            <div className="text-xs text-slate-500 font-medium">
              Encerrado em:{' '}
              {new Date(fechamentoExistente.dataFechamento).toLocaleDateString('pt-BR')} por{' '}
              {fechamentoExistente.responsavel}
            </div>
          )}
        </div>
      </div>

      {/* Avisos e Bloqueios Legais do Fechamento */}
      {temBloqueio && !isCompetenciaFechada && (
        <div
          role="alert"
          className="p-4 bg-rose-50 border border-rose-300 rounded-xl space-y-2 text-rose-900"
        >
          <div className="flex items-center gap-2 font-bold text-sm">
            <AlertOctagon className="size-5 text-rose-600" />
            <span>Fechamento Fiscal Bloqueado — Pendências Críticas Identificadas:</span>
          </div>
          <ul className="list-disc list-inside text-xs space-y-1 text-rose-800 ml-1">
            {isInapta && (
              <li>
                <strong>Regra A09:</strong> A empresa {empresaAtiva.nomeFantasia} encontra-se{' '}
                {empresaAtiva.situacaoCadastral} perante a Receita Federal. O encerramento fiscal é
                vedado.
              </li>
            )}
            {pendenciasDocumentos > 0 && (
              <li>
                <strong>Regra A08:</strong> Existem {pendenciasDocumentos} documento(s) com status
                PENDENTE ou AGUARDANDO_DE_PARA na fila. Resolva os vínculos antes de fechar o mês.
              </li>
            )}
            {duplicidades > 0 && (
              <li>
                <strong>Regra A01:</strong> Identificada(s) {duplicidades} chave(s) de NF-e em
                duplicidade não resolvidas.
              </li>
            )}
            {saídasBloqueadas > 0 && (
              <li>
                <strong>Regra A03:</strong> Existem saídas que gerariam saldo negativo não ajustadas
                no Kardex.
              </li>
            )}
          </ul>
        </div>
      )}

      {/* Cards de Totais da Contagem */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase">
              Estoque Sistema (Escriturado)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-slate-900">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                totalValorSistema,
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">Base apurada pelo Kardex cronológico</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase">
              Estoque Físico (Contagem)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-blue-700">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                totalValorContado,
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">Valor final que compõe o Bloco H</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase">
              Divergência Total / Ajustes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`text-xl font-bold ${
                divergenciasCount > 0 ? 'text-amber-700' : 'text-emerald-700'
              }`}
            >
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                totalDiferencaValor,
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {divergenciasCount > 0
                ? `${divergenciasCount} item(ns) com ajuste a aprovar`
                : '100% conciliado com o físico'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de Contagem e Ajustes */}
      <Card className="border-slate-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Scale className="size-4 text-blue-700" />
            Planilha de Contagem Física de Inventário ({itensContagem.length} Itens)
          </CardTitle>
          <CardDescription className="text-xs">
            Altere a Quantidade Contada para registrar sobras ou quebras verificadas na contagem de
            piso de fábrica. Ao fechar a competência, os ajustes aprovados são lançados no Kardex e
            escriturados no Bloco H do SPED.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TabelaWrap>
            <table>
              <thead>
                <tr>
                  <Th>Código</Th>
                  <Th>Descrição da Mercadoria</Th>
                  <Th>Unid.</Th>
                  <Th className="text-right">Qtd Sistema</Th>
                  <Th className="text-right">Custo Médio Unit.</Th>
                  <Th className="text-right">Total Sistema</Th>
                  <Th className="text-right">Qtd Contada (Físico)</Th>
                  <Th className="text-right">Divergência (Qtd)</Th>
                  <Th className="text-right">Divergência (R$)</Th>
                  <Th>Status Ajuste</Th>
                </tr>
              </thead>
              <tbody>
                {itensContagem.map((it) => {
                  const temDivergencia = Math.abs(it.diferencaQuantidade) > 0.0001
                  // Itens importados por planilha com pendência fiscal ganham badge REVISAR
                  const produtoOrigem = produtos.find(
                    (p) => p.codigoInventario === it.codigoInventario,
                  )
                  const revisar = produtoOrigem?.revisar
                  return (
                    <tr
                      key={it.codigoInventario}
                      className={`border-t border-[var(--sig-line,#e2e8f0)] ${
                        temDivergencia ? 'bg-amber-50/40' : ''
                      }`}
                    >
                      <Td className="font-mono font-bold text-blue-800 whitespace-nowrap">
                        {it.codigoInventario}
                      </Td>
                      <Td title={it.descricao} className="font-medium">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate max-w-[200px]">{it.descricao}</span>
                          {revisar && (
                            <Badge
                              variant="outline"
                              className="w-fit border-amber-400 bg-amber-50 text-amber-800 text-[10px] gap-1 shrink-0"
                              title={produtoOrigem?.observacaoImportacao}
                            >
                              <AlertTriangle className="size-3" />
                              <span>REVISAR</span>
                            </Badge>
                          )}
                        </div>
                      </Td>
                      <Td className="font-bold whitespace-nowrap">{it.unidade}</Td>
                      <TdNum>{num(it.quantidadeSistema)}</TdNum>
                      <TdNum>{brl(it.custoMedioSistema)}</TdNum>
                      <TdNum className="font-bold">{brl(it.valorTotalSistema)}</TdNum>

                      {/* Input de Contagem Física */}
                      <td className="py-1.5 pr-3 text-right">
                        <Input
                          type="number"
                          step="0.001"
                          disabled={isCompetenciaFechada || !podeAprovar}
                          title={
                            podeAprovar
                              ? undefined
                              : 'Sem permissão: exige a ação "Aprovar ajuste de inventário" no perfil'
                          }
                          value={it.quantidadeContada}
                          onChange={(e) =>
                            atualizarQtdContada(
                              it.codigoInventario,
                              parseFloat(e.target.value) || 0,
                            )
                          }
                          aria-label={`Quantidade contada de ${it.codigoInventario}`}
                          className="h-7 text-xs font-mono font-bold text-right w-24 inline-block"
                        />
                      </td>

                      {/* Divergência em Quantidade */}
                      <TdNum
                        className={`font-bold ${
                          temDivergencia
                            ? it.diferencaQuantidade > 0
                              ? 'text-emerald-700'
                              : 'text-rose-700'
                            : 'text-slate-400'
                        }`}
                      >
                        {it.diferencaQuantidade > 0 ? '+' : ''}
                        {num(it.diferencaQuantidade)}
                      </TdNum>

                      {/* Divergência em Valor */}
                      <TdNum
                        className={`font-bold ${
                          temDivergencia
                            ? it.diferencaValor > 0
                              ? 'text-emerald-700'
                              : 'text-rose-700'
                            : 'text-slate-400'
                        }`}
                      >
                        {brl(it.diferencaValor)}
                      </TdNum>

                      {/* Status */}
                      <Td>
                        {temDivergencia ? (
                          <Badge
                            variant="outline"
                            className="bg-amber-100 text-amber-800 border-amber-300 text-[10px]"
                          >
                            AJUSTE REQUERIDO
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]"
                          >
                            CONCILIADO
                          </Badge>
                        )}
                      </Td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <TrTotais titulo={`Totais da contagem (${itensContagem.length} itens)`} colSpan={3}>
                  <TdTotal valor={totalQtdSistema} fmt={fmtQtd} />
                  <td aria-hidden="true" />
                  <TdTotal valor={totalValorSistema} fmt={brl} />
                  <td aria-hidden="true" />
                  <TdTotal valor={totalDivergQtd} fmt={fmtQtd} />
                  <TdTotal valor={totalDiferencaValor} fmt={brl} />
                  <td aria-hidden="true" />
                </TrTotais>
              </tfoot>
            </table>
          </TabelaWrap>
        </CardContent>
      </Card>

      {/* Modal de Homologação e Fechamento */}
      <Dialog open={modalConfirmarFechamento} onOpenChange={setModalConfirmarFechamento}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="size-5 text-blue-700" />
              Fechar Competência {competenciaSelecionada}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Validação das réguas de auditoria, encerramento do inventário físico e geração do
              Bloco H oficial.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            {temBloqueio ? (
              <div className="p-3 bg-rose-50 border border-rose-300 rounded-lg text-rose-900">
                <span className="font-bold">Ação Impedida:</span> Existem regras impeditivas ativas
                (situação cadastral inapta, pendências de de-para ou saldos negativos). O sistema
                não permite gerar o Bloco H com inconsistências fiscais.
              </div>
            ) : (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-900">
                <span className="font-bold">Pronto para Encerramento:</span> Não há documentos
                pendentes nem bloqueios. O valor total do inventário apurado é de{' '}
                <strong>
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                    totalValorContado,
                  )}
                </strong>
                .
              </div>
            )}

            <div>
              <Label htmlFor="respFechamento" className="text-xs font-semibold">
                Responsável pelo Fechamento *
              </Label>
              <Input
                id="respFechamento"
                value={responsavel}
                onChange={(e) => setResponsavel(e.target.value)}
                className="text-xs mt-1"
                required
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalConfirmarFechamento(false)}>
              Cancelar
            </Button>
            <Button
              disabled={temBloqueio || !podeFechar}
              onClick={handleExecutarFechamento}
              className="bg-[#0E7C86] hover:bg-[#0B636B] text-white"
            >
              Homologar e Fechar Bloco H
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
