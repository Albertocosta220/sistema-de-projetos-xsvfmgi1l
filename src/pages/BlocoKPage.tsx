import { useMemo, useState } from 'react'
import { useSigef } from '@/context/SigefContext'
import { PageHead, CardS, KpiB, Pill, brl, num } from '@/components/shell'
import { montarBlocoC } from '@/services/spedBlocoC'

/** Prévia do Bloco K (perfil atacadista) e comparação com o Bloco H. */
export default function BlocoKPage() {
  const { empresaAtiva, produtos, documentos, kardex, fechamentos } = useSigef()
  const [competencia, setCompetencia] = useState(() => new Date().toISOString().slice(0, 7))

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
      />

      <div className="field-row mb-4">
        <div className="field">
          <label htmlFor="bk-competencia">Competência (AAAA-MM)</label>
          <input
            id="bk-competencia"
            className="sig-input !w-40"
            value={competencia}
            onChange={(e) => setCompetencia(e.target.value)}
            placeholder="2025-01"
          />
          <small>Use a competência encerrada no Inventário.</small>
        </div>
      </div>

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
          hint={`${num(totalEntradas ? movimentosCompetencia.filter((m) => m.valorTotalEntrada > 0).length : 0, 0)} movimento(s)`}
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
        sub="Registro de identificação do período. Empresa: "
        acoes={
          <Pill tone={fechamento ? 't-verde' : 't-ambar'}>
            {fechamento ? 'Competência fechada' : 'Competência aberta'}
          </Pill>
        }
      >
        <p className="text-sm m-0">
          <strong>{empresaAtiva.razaoSocial}</strong> — CNPJ {empresaAtiva.cnpj} / IE{' '}
          {empresaAtiva.inscricaoEstadual} — UF {empresaAtiva.uf}
        </p>
      </CardS>

      <CardS
        titulo="K200 — estoque escriturado (por item)"
        sub="Saldo final por código de inventário, comparado com a contagem do Bloco H quando houver."
      >
        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Descrição</th>
                <th>Un.</th>
                <th className="text-right">Qtd. Kardex</th>
                <th className="text-right">Qtd. Bloco H</th>
                <th className="text-right">Valor total</th>
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
                    <td className="font-mono text-xs">{p.codigoInventario}</td>
                    <td>{p.descricao}</td>
                    <td>{p.unidade}</td>
                    <td className="text-right tabular-nums">{num(qtdK)}</td>
                    <td className="text-right tabular-nums">
                      {itemH ? num(itemH.quantidadeContada) : '—'}
                      {div !== null && Math.abs(div) > 0.0001 ? (
                        <Pill tone="t-vermelho">{num(div)}</Pill>
                      ) : null}
                    </td>
                    <td className="text-right tabular-nums">{brl(ult?.saldoValorTotal ?? 0)}</td>
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
