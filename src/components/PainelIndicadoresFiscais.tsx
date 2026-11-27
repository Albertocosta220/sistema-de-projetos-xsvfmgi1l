// Dashboard de Indicadores Fiscais (Painel) — componentização
// Cálculo derivado dos dados já existentes (Kardex, Inventário, Importar):
// nada é gravado no localStorage e nenhum serviço externo é chamado.
import { Link } from 'react-router-dom'
import { useSigef } from '@/context/SigefContext'
import { AlertCircle, BarChart3, Coins, Layers, Package } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { brl, num } from '@/components/shell'
import { calcularIndicadoresFiscais } from '@/services/indicadoresFiscais'

export function PainelIndicadoresFiscais() {
  const { empresaAtiva, produtos, documentos, kardex, fechamentos, competenciaAtiva } = useSigef()

  const indicadores = calcularIndicadoresFiscais({
    competencia: competenciaAtiva,
    produtos,
    documentos,
    kardex,
    fechamentos,
  })

  const maxEvolucao = Math.max(
    1,
    ...indicadores.evolucao.map((p) => (p.valorHomologado ?? p.saldoEscriturado) || 0),
  )

  const temPendencia = indicadores.pendencias.total > 0
  const semTributos =
    indicadores.totaisFiscais.icms === 0 &&
    indicadores.totaisFiscais.ipi === 0 &&
    indicadores.totaisFiscais.pis === 0 &&
    indicadores.totaisFiscais.cofins === 0 &&
    !indicadores.totaisFiscais.temIbsCbs

  return (
    <section aria-label="Indicadores fiscais" className="space-y-4">
      {/* Cartões de resumo */}
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
              {brl(indicadores.valorTotalEstoque)}
            </div>
            <p className="text-xs text-slate-500 mt-1">Saldos do Kardex (custo médio ponderado)</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Itens Ativos no Catálogo
            </CardTitle>
            <Package className="size-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-extrabold text-slate-900">
              {indicadores.itensCadastrados}
            </div>
            <p className="text-xs text-slate-500 mt-1">Produtos cadastrados nesta empresa</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Notas Processadas (Competência)
            </CardTitle>
            <Layers className="size-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-extrabold text-slate-900">
              {indicadores.notasProcessadasPeriodo}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              NF-e válidas em {competenciaAtiva} (canceladas fora)
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Pendências na Fila
            </CardTitle>
            <AlertCircle
              className={`size-4 ${temPendencia ? 'text-amber-600' : 'text-slate-400'}`}
            />
          </CardHeader>
          <CardContent className="space-y-1.5">
            {temPendencia ? (
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded bg-amber-50 border border-amber-200 py-1.5">
                  <div className="text-lg font-extrabold text-amber-700 leading-none">
                    {indicadores.pendencias.aguardandoDePara}
                  </div>
                  <div className="text-[10px] text-amber-700 mt-0.5">De-Para</div>
                </div>
                <div className="rounded bg-rose-50 border border-rose-200 py-1.5">
                  <div className="text-lg font-extrabold text-rose-700 leading-none">
                    {indicadores.pendencias.erro}
                  </div>
                  <div className="text-[10px] text-rose-700 mt-0.5">Erro</div>
                </div>
                <div className="rounded bg-rose-50 border border-rose-200 py-1.5">
                  <div className="text-lg font-extrabold text-rose-700 leading-none">
                    {indicadores.pendencias.duplicidade}
                  </div>
                  <div className="text-[10px] text-rose-700 mt-0.5">Duplicid.</div>
                </div>
              </div>
            ) : (
              <div className="text-2xl font-extrabold text-slate-900">0</div>
            )}
            <p className="text-xs text-slate-500">
              {temPendencia ? (
                <Link to="/importar" className="text-amber-700 underline font-medium">
                  Resolver na fila de documentos →
                </Link>
              ) : (
                'Nenhuma pendência a resolver na fila'
              )}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Totais fiscais do período */}
      <Card className="border-slate-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold">Totais Fiscais da Competência</CardTitle>
          <CardDescription className="text-xs">
            Tributos destacados nas NF-e de ENTRADA válidas de {competenciaAtiva} — notas
            canceladas, desqualificadas e em pendência ficam fora
          </CardDescription>
        </CardHeader>
        <CardContent>
          {semTributos ? (
            <p className="text-xs text-slate-500 text-center py-4">
              Nenhum tributo destacado nas entradas válidas desta competência.
            </p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {[
                { rotulo: 'ICMS', valor: indicadores.totaisFiscais.icms },
                { rotulo: 'IPI', valor: indicadores.totaisFiscais.ipi },
                { rotulo: 'PIS', valor: indicadores.totaisFiscais.pis },
                { rotulo: 'COFINS', valor: indicadores.totaisFiscais.cofins },
                ...(indicadores.totaisFiscais.temIbsCbs
                  ? [
                      { rotulo: 'IBS', valor: indicadores.totaisFiscais.ibs },
                      { rotulo: 'CBS', valor: indicadores.totaisFiscais.cbs },
                    ]
                  : []),
              ].map((t) => (
                <div key={t.rotulo} className="rounded-lg border border-slate-200 p-3 bg-slate-50">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    {t.rotulo}
                  </div>
                  <div className="text-sm font-extrabold text-slate-900 mt-1">{brl(t.valor)}</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Gráfico de evolução + ranking de produtos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <BarChart3 className="size-4 text-blue-600" />
              Evolução do Valor do Estoque por Competência
            </CardTitle>
            <CardDescription className="text-xs">
              Saldos finais gravados nos fechamentos de estoque (Bloco H)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {indicadores.evolucao.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-8">
                Nenhuma competência fechada ainda — o gráfico aparece quando houver inventário
                homologado.
              </p>
            ) : (
              <div
                className="flex items-end gap-2 h-40"
                role="img"
                aria-label="Gráfico de barras: evolução do valor do estoque por competência"
              >
                {indicadores.evolucao.map((ponto) => {
                  const valorPonto = ponto.valorHomologado ?? ponto.saldoEscriturado
                  const h = valorPonto > 0 ? Math.max(4, (valorPonto / maxEvolucao) * 100) : 2
                  return (
                    <div
                      key={ponto.competencia}
                      className="flex-1 flex flex-col items-center gap-1 min-w-0"
                    >
                      <span className="text-[10px] font-bold text-slate-700 truncate max-w-full">
                        {num(Math.round(ponto.valorHomologado ?? ponto.saldoEscriturado), 0)}
                      </span>
                      <div
                        className="w-full rounded-t bg-blue-600/80 motion-safe:transition-all"
                        style={{ height: `${h}%` }}
                        title={`${ponto.competencia}: ${brl(ponto.valorHomologado ?? ponto.saldoEscriturado)}`}
                      />
                      <span className="text-[10px] text-slate-500 font-mono">
                        {ponto.competencia}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold">
              Top 10 Produtos por Valor em Estoque
            </CardTitle>
            <CardDescription className="text-xs">
              Saldo físico × custo médio ponderado do Kardex
            </CardDescription>
          </CardHeader>
          <CardContent>
            {indicadores.ranking.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-8">
                Nenhum produto com saldo em estoque.
              </p>
            ) : (
              <div className="space-y-2">
                {indicadores.ranking.map((r, i) => (
                  <div key={r.codigoInventario} className="flex items-center gap-3 text-xs">
                    <span className="w-5 h-5 shrink-0 rounded-full bg-blue-700 text-white text-[10px] font-bold flex items-center justify-center">
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="font-mono font-bold text-blue-800 text-[11px]">
                        {r.codigoInventario}
                      </div>
                      <div className="truncate text-slate-600 max-w-[240px]" title={r.descricao}>
                        {r.descricao}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-slate-900">{brl(r.valorTotal)}</div>
                      <div className="text-[10px] text-slate-400">
                        {num(r.quantidade)} {r.unidade}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  )
}
