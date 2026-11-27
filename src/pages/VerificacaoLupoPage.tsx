import { useState } from 'react'
import { useSigef } from '@/context/SigefContext'
import { PageHead, CardS, Pill, KpiB, num, brl, dataHoraBR } from '@/components/shell'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

type ResultadoStatus = 'ok' | 'falha' | 'alerta'

interface ResultadoVerificacao {
  id: string
  codigo: string
  titulo: string
  descricao: string
  status: ResultadoStatus
  detalhe: string
}

const DESCRICOES: Record<string, string> = {
  saldosNegativos: 'Nenhum movimento de saída pode deixar o saldo físico do item negativo.',
  deParaPendentes: 'Todo item importado precisa estar vinculado a um código do inventário.',
  documentosDuplicados: 'A mesma chave de acesso de NF-e não pode existir duas vezes na base.',
  canceladasSemEstorno: 'Nota cancelada não pode conservar movimentos de estoque ativos.',
  k200VsKardex: 'O saldo final do Kardex precisa bater com o K200 da competência.',
  h010VsInventario: 'O inventário fechado precisa bater com o H010 gerado.',
  produtosSemMovimento: 'Itens cadastrados sem nenhuma movimentação merecem revisão do cadastro.',
  fechamentoAberto: 'Competências com contagem iniciada e não fechada impedem o SPED.',
  ocorrenciasAbertas: 'Ocorrências de auditoria não resolvidas pendem de tratamento.',
}

/**
 * Verificação (Lupo) — bateria de testes automáticos sobre os dados da empresa ativa.
 * Somente leitura: nenhuma regra fiscal é alterada, as checagens leem o contexto.
 */
export default function VerificacaoLupoPage() {
  const { empresaAtiva, produtos, deParaList, documentos, kardex, fechamentos, ocorrencias } =
    useSigef()
  const [executando, setExecutando] = useState(false)
  const [resultados, setResultados] = useState<ResultadoVerificacao[] | null>(null)
  const [ultimaExecucao, setUltimaExecucao] = useState<string | null>(null)

  const executarBateria = () => {
    setExecutando(true)
    // pequena pausa só para o usuário perceber a execução da bateria
    window.setTimeout(() => {
      setResultados(
        rodarBateria({ produtos, deParaList, documentos, kardex, fechamentos, ocorrencias }),
      )
      setUltimaExecucao(new Date().toISOString())
      setExecutando(false)
      toast.success('Bateria de verificações concluída.')
    }, 400)
  }

  const totalOk = resultados?.filter((r) => r.status === 'ok').length ?? 0
  const totalFalha = resultados?.filter((r) => r.status === 'falha').length ?? 0
  const totalAlerta = resultados?.filter((r) => r.status === 'alerta').length ?? 0

  return (
    <div>
      <PageHead
        eyebrow="Sistema"
        titulo="Verificação (Lupo)"
        subtitulo={`Bateria automática de consistência sobre os dados de ${empresaAtiva.nomeFantasia}. Somente leitura — nada é alterado.`}
        acoes={
          <Button
            className="bg-blue-700 hover:bg-blue-800"
            onClick={executarBateria}
            disabled={executando}
            aria-label="Executar bateria de testes de verificação"
          >
            {executando ? 'Executando…' : 'Executar bateria de testes'}
          </Button>
        }
      />

      {resultados ? (
        <div className="grid gap-3 sm:grid-cols-3 mb-4">
          <KpiB
            tone="verde"
            label="Verificações OK"
            value={totalOk}
            hint="consistência confirmada"
          />
          <KpiB tone="ambar" label="Alertas" value={totalAlerta} hint="revisar quando possível" />
          <KpiB
            tone={totalFalha > 0 ? 'vermelho' : 'accent'}
            label="Falhas"
            value={totalFalha}
            hint={totalFalha > 0 ? 'tratar antes do fechamento' : 'nenhuma falha encontrada'}
          />
        </div>
      ) : null}

      <CardS
        titulo="Bateria de verificações"
        sub={
          ultimaExecucao
            ? `Última execução: ${new Date(ultimaExecucao).toLocaleString('pt-BR')}`
            : 'Clique em executar para checar os dados atuais.'
        }
      >
        {!resultados ? (
          <p className="text-sm text-[var(--sig-muted)] m-0">
            A bateria checa saldos negativos, De-Para pendentes, duplicidades, estornos de notas
            canceladas, K200 vs Kardex, H010 vs inventário e pendências de auditoria — sem alterar
            nenhum dado.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table>
              <caption className="sr-only">
                Resultados da bateria de verificações executada em{' '}
                {resultados && ultimaExecucao ? dataHoraBR(ultimaExecucao) : 'agora'}
              </caption>
              <thead>
                <tr>
                  <th scope="col">Verificação</th>
                  <th scope="col">Result</th>
                  <th scope="col">Detalhe</th>
                </tr>
              </thead>
              <tbody>
                {resultados.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <span className="block font-semibold text-[var(--petroleo)]">
                        {r.codigo} — {r.titulo}
                      </span>
                      <span className="block text-xs text-[var(--sig-muted)]">{r.descricao}</span>
                    </td>
                    <td>
                      <Pill
                        tone={
                          r.status === 'ok'
                            ? 't-verde'
                            : r.status === 'alerta'
                              ? 't-ambar'
                              : 't-vermelho'
                        }
                      >
                        {r.status === 'ok' ? 'OK' : r.status === 'alerta' ? 'ALERTA' : 'FALHA'}
                      </Pill>
                    </td>
                    <td>{r.detalhe}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardS>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Motor da bateria — puro, somente leitura do contexto                */
/* ------------------------------------------------------------------ */

interface EntradasBateria {
  produtos: ReturnType<typeof useSigef>['produtos']
  deParaList: ReturnType<typeof useSigef>['deParaList']
  documentos: ReturnType<typeof useSigef>['documentos']
  kardex: ReturnType<typeof useSigef>['kardex']
  fechamentos: ReturnType<typeof useSigef>['fechamentos']
  ocorrencias: ReturnType<typeof useSigef>['ocorrencias']
}

function rodarBateria(dados: EntradasBateria): ResultadoVerificacao[] {
  const { produtos, deParaList, documentos, kardex, fechamentos, ocorrencias } = dados
  const resultados: ResultadoVerificacao[] = []

  // 1. Saldos negativos no Kardex
  const saldosNeg = kardex.filter((k) => k.saldoQuantidade < -0.0001 || k.bloqueadoSaldoNegativo)
  resultados.push({
    id: 'saldosNegativos',
    codigo: 'L01',
    titulo: 'Saldos negativos no Kardex',
    descricao: DESCRICOES.saldosNegativos,
    status: saldosNeg.length === 0 ? 'ok' : 'falha',
    detalhe:
      saldosNeg.length === 0
        ? 'Nenhum saldo negativo encontrado.'
        : `${saldosNeg.length} movimento(s) com saldo negativo — ex.: ${saldosNeg[0].codigoInventario} (${num(saldosNeg[0].saldoQuantidade)}).`,
  })

  // 2. De-Para pendentes
  const itensPendentes = documentos.flatMap((d) =>
    (d?.itens || []).filter(
      (it) => it.pendenteDePara || (!it.codigoInventario && d.status !== 'CANCELADO'),
    ),
  )
  const docsAguardando = documentos.filter((d) => d.status === 'AGUARDANDO_DE_PARA')
  resultados.push({
    id: 'deParaPendentes',
    codigo: 'L02',
    titulo: 'De-Para pendentes',
    descricao: DESCRICOES.deParaPendentes,
    status: itensPendentes.length === 0 ? 'ok' : 'falha',
    detalhe:
      itensPendentes.length === 0
        ? `Todos os itens importados estão vinculados (${deParaList.length} vínculo(s) ativos).`
        : `${itensPendentes.length} item(ns) sem vínculo em ${docsAguardando.length} nota(s) aguardando De-Para — ex.: ${itensPendentes[0]?.cProd ?? '—'} (${itensPendentes[0]?.xProd ?? '—'}).`,
  })

  // 3. Documentos duplicados
  const porChave = new Map<string, number>()
  documentos.forEach((d) => porChave.set(d.chaveAcesso, (porChave.get(d.chaveAcesso) ?? 0) + 1))
  const duplicadas = [...porChave.entries()].filter(([, qtd]) => qtd > 1)
  const emDuplicidade = documentos.filter((d) => d.status === 'DUPLICIDADE')
  resultados.push({
    id: 'documentosDuplicados',
    codigo: 'L03',
    titulo: 'Documentos duplicados',
    descricao: DESCRICOES.documentosDuplicados,
    status: duplicadas.length === 0 && emDuplicidade.length === 0 ? 'ok' : 'falha',
    detalhe:
      duplicadas.length === 0 && emDuplicidade.length === 0
        ? 'Nenhuma chave de acesso repetida ou em status DUPLICIDADE.'
        : `${duplicadas.length} chave(s) repetida(s) e ${emDuplicidade.length} documento(s) em DUPLICIDADE.`,
  })

  // 4. Notas canceladas sem estorno
  const canceladas = documentos.filter((d) => d.status === 'CANCELADO')
  const canceladasSemEstorno = canceladas.filter((d) =>
    kardex.some(
      (k) =>
        k.chaveNFeRef === d.chaveAcesso &&
        k.tipo !== 'ESTORNO_CANCELAMENTO' &&
        !k.estornado &&
        (k.quantidadeEntrada > 0 || k.quantidadeSaida > 0),
    ),
  )
  resultados.push({
    id: 'canceladasSemEstorno',
    codigo: 'L04',
    titulo: 'Notas canceladas sem estorno',
    descricao: DESCRICOES.canceladasSemEstorno,
    status: canceladasSemEstorno.length === 0 ? 'ok' : 'falha',
    detalhe:
      canceladasSemEstorno.length === 0
        ? `${canceladas.length} nota(s) cancelada(s), todas com estorno refletido no Kardex.`
        : `${canceladasSemEstorno.length} nota(s) cancelada(s) conservam movimento ativo no Kardex — ex.: NF ${canceladasSemEstorno[0].numero}/${canceladasSemEstorno[0].serie}.`,
  })

  // 5. K200 vs Kardex (saldo final por item no último movimento)
  const saldoFinalPorItem = new Map<string, number>()
  kardex.forEach((k) => {
    saldoFinalPorItem.set(k.codigoInventario, k.saldoQuantidade)
  })
  const divergenciasK200: string[] = []
  fechamentos
    .filter((f) => f.status === 'FECHADA')
    .forEach((f) => {
      f.itensInventario.forEach((it) => {
        const saldoKardex = saldoFinalPorItem.get(it.codigoInventario)
        if (saldoKardex !== undefined && Math.abs(saldoKardex - it.quantidadeContada) > 0.0001) {
          divergenciasK200.push(
            `${it.codigoInventario}: K200 ${num(it.quantidadeContada)} × Kardex ${num(saldoKardex)} (comp. ${f.competencia})`,
          )
        }
      })
    })
  resultados.push({
    id: 'k200VsKardex',
    codigo: 'L05',
    titulo: 'K200 vs Kardex',
    descricao: DESCRICOES.k200VsKardex,
    status: divergenciasK200.length === 0 ? 'ok' : 'falha',
    detalhe:
      divergenciasK200.length === 0
        ? 'Saldos dos fechamentos batem com o Kardex.'
        : `${divergenciasK200.length} divergência(s): ${divergenciasK200.slice(0, 3).join('; ')}${divergenciasK200.length > 3 ? '…' : ''}`,
  })

  // 6. H010 vs inventário
  const fechadas = fechamentos.filter((f) => f.status === 'FECHADA')
  const divergenciasH010 = fechadas.filter(
    (f) =>
      Math.abs(
        f.itensInventario.reduce((s, it) => s + it.quantidadeContada * it.custoMedioSistema, 0) -
          f.valorTotalEstoque,
      ) > 0.01,
  )
  const valorTotalEstoque = fechadas.reduce((s, f) => s + f.valorTotalEstoque, 0)
  resultados.push({
    id: 'h010VsInventario',
    codigo: 'L06',
    titulo: 'H010 vs inventário fechado',
    descricao: DESCRICOES.h010VsInventario,
    status: divergenciasH010.length === 0 ? 'ok' : 'falha',
    detalhe:
      divergenciasH010.length === 0
        ? `${fechadas.length} competência(s) fechada(s), totais consistentes (R$ ${brl(valorTotalEstoque)}).`
        : `${divergenciasH010.length} competência(s) com total do H010 divergente da soma dos itens.`,
  })

  // 7. Produtos sem movimentação (alerta)
  const comMovimento = new Set(kardex.map((k) => k.codigoInventario))
  const semMovimento = produtos.filter((p) => !comMovimento.has(p.codigoInventario))
  resultados.push({
    id: 'produtosSemMovimento',
    codigo: 'L07',
    titulo: 'Produtos sem movimentação',
    descricao: DESCRICOES.produtosSemMovimento,
    status: semMovimento.length === 0 ? 'ok' : 'alerta',
    detalhe:
      semMovimento.length === 0
        ? 'Todos os produtos cadastrados têm movimento no Kardex.'
        : `${semMovimento.length} produto(s) sem nenhum movimento — ex.: ${semMovimento[0].codigoInventario} (${semMovimento[0].descricao}).`,
  })

  // 8. Competências abertas
  const abertas = fechamentos.filter((f) => f.status === 'ABERTA' || f.status === 'BLOQUEADA')
  resultados.push({
    id: 'fechamentoAberto',
    codigo: 'L08',
    titulo: 'Competências abertas ou bloqueadas',
    descricao: DESCRICOES.fechamentoAberto,
    status: abertas.length === 0 ? 'ok' : 'alerta',
    detalhe:
      abertas.length === 0
        ? 'Nenhuma competência pendente de fechamento.'
        : `${abertas.length} competência(s) em aberto/bloqueada(s): ${abertas.map((f) => f.competencia).join(', ')}.`,
  })

  // 9. Ocorrências de auditoria abertas
  const ocorrenciasAbertas = ocorrencias.filter((o) => !o.resolvido)
  const bloqueantes = ocorrenciasAbertas.filter(
    (o) => o.severidade === 'ERRO' || o.severidade === 'BLOQUEANTE',
  )
  resultados.push({
    id: 'ocorrenciasAbertas',
    codigo: 'L09',
    titulo: 'Ocorrências de auditoria abertas',
    descricao: DESCRICOES.ocorrenciasAbertas,
    status:
      bloqueantes.length === 0 ? (ocorrenciasAbertas.length === 0 ? 'ok' : 'alerta') : 'falha',
    detalhe:
      ocorrenciasAbertas.length === 0
        ? 'Nenhuma ocorrência pendente na régua de auditoria.'
        : `${ocorrenciasAbertas.length} ocorrência(s) aberta(s), sendo ${bloqueantes.length} bloqueante(s)/erro.`,
  })

  return resultados
}
