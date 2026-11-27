import { useMemo } from 'react'
import { useSigef } from '@/context/SigefContext'
import { PageHead, CardS, KpiB, Pill, brl, num } from '@/components/shell'
import { SeletorCompetencia } from '@/components/SeletorCompetencia'
import { montarBlocoC } from '@/services/spedBlocoC'

/** Prévia do Bloco K (perfil atacadista) e comparação com o Bloco H. */
export default function BlocoKPage() {
  const { empresaAtiva, produtos, documentos, kardex, fechamentos, competenciaAtiva } = useSigef()
  const competencia = competenciaAtiva

  const blocoC = useMemo(
    () =>
      montarBlocoC({
        empresa: empresaAtiva,
        competencia,
        produtos,
        documentos,
      }),
    [empresaAtiva, competencia, produtos, documentos],
  )

  const fechamento = useMemo(
    () => fechamentos.find((f) => f.competencia === competencia),
    [fechamentos, competencia],
  )

  const movimentosCompetencia = useMemo(
    () => kardex.filter((k) => (k.dataMovimento || '').slice(0, 7) === competencia),
    [kardex, competencia],
  )

  const totalEntradas = movimentosCompetencia.reduce((s, m) => s + (m.valorTotalEntrada || 0), 0)
  const totalSaidas = movimentosCompetencia.reduce((s, m) => s + (m.valorTotalSaida || 0), 0)
  const saldoH = fechamento?.valorTotalEstoque ?? 0
  const saldoK = produtos.reduce((t, p) => {
    const movs = kardex.filter((k) => k.codigoInventario === p.codigoInventario)
    const ult = movs[movs.length - 1]
    return t + (ult?.saldoValorTotal ?? 0)
  }, 0)
  const divergencia = saldoK - saldoH

  return (
    <div>
      <PageHead
        eyebrow="Bloco K — perfil atacadista"
        titulo="Bloco K"
        subtitulo="Prévia dos registros K100/K200 (produção e estoque) e conciliação com o Bloco H da competência."
        acoes={<SeletorCompetencia />}
      />

      <div className="kpi-grid">
        <KpiB
          label="Docs no Bloco C (K100 base)"
          value={blocoC.registros.length}
          tone="accent"
          hint="Somente PROCESSADO (COD_SIT 00)"
        />
        <KpiB
          label="Entradas no período"
          value={brl(totalEntradas)}
          tone="verde"
          hint={`${num(movimentosCompetencia.filter((m) => m.valorTotalEntrada > 0).length, 0)} movimento(s)`}
        />
        <KpiB
          label="Saídas no período"
          value={brl(totalSaidas)}
          tone="ambar"
          hint="Vendas e ajustes"
        />
        <KpiB
          label="Divergência H × K"
          value={brl(divergencia)}
          tone={Math.abs(divergencia) < 0.01 ? 'verde' : 'vermelho'}
          hint={`Bloco H ${brl(saldoH)} × Kardex ${brl(saldoK)}`}
        />
      </div>

      <CardS
        className="mt-4"
        titulo={`K100 — período apurado ${competencia}`}
        sub={`Empresa: ${empresaAtiva.razaoSocial} — CNPJ ${empresaAtiva.cnpj} / IE ${empresaAtiva.inscricaoEstadual} — UF ${empresaAtiva.uf}`}
        acoes={
          <Pill tone={fechamento ? 't-verde' : 't-ambar'}>
            {fechamento ? 'Competência fechada' : 'Competência aberta'}
          </Pill>
        }
      >
        <p className="text-xs m-0 text-[var(--sig-muted)]">
          A competência acompanha o seletor global — trocá-la aqui muda o período do Painel, do
          Inventário e do SPED ao mesmo tempo.
        </p>
      </CardS>

      <CardS
        titulo="K200 — estoque escriturado (por item)"
        sub="Saldo final por código de inventário, comparado com a contagem do Bloco H quando houver."
      >
        <div className="overflow-x-auto">
          <table>
            <caption className="sr-only">Registros K200 por código de inventário</caption>
            <thead>
              <tr>
                <th scope="col">Código</th>
                <th scope="col">Descrição</th>
                <th scope="col">Un.</th>
                <th scope="col" className="text-right">
                  Qtd. Kardex
                </th>
                <th scope="col" className="text-right">
                  Qtd. Bloco H
                </th>
                <th scope="col" className="text-right">
                  Valor total
                </th>
              </tr>
            </thead>
            <tbody>
              {produtos.map((p) => {
                const movs = kardex.filter((k) => k.codigoInventario === p.codigoInventario)
                const ult = movs[movs.length - 1]
                const itemH = fechamento?.itensInventario.find(
                  (i) => i.codigoInventario === p.codigoInventario,
                )
                const qtdK = ult?.saldoQuantidade ?? 0
                const div = itemH ? qtdK - itemH.quantidadeContada : null
                return (
                  <tr key={p.codigoInventario}>
                    <td className="font-mono text-xs whitespace-nowrap">{p.codigoInventario}</td>
                    <td className="max-w-[280px] truncate" title={p.descricao}>
                      {p.descricao}
                    </td>
                    <td className="whitespace-nowrap">{p.unidade}</td>
                    <td className="text-right tabular-nums whitespace-nowrap">{num(qtdK)}</td>
                    <td className="text-right tabular-nums whitespace-nowrap">
                      {itemH ? num(itemH.quantidadeContada) : '—'}
                      {div !== null && Math.abs(div) > 0.0001 ? (
                        <Pill tone="t-vermelho">{num(div)}</Pill>
                      ) : null}
                    </td>
                    <td className="text-right tabular-nums whitespace-nowrap">
                      {brl(ult?.saldoValorTotal ?? 0)}
                    </td>
                  </tr>
                )
              })}
              {produtos.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-sm">
                    Nenhum produto cadastrado nesta empresa.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardS>
    </div>
  )
}
