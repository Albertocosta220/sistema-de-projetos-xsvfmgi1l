import { useMemo, useState } from 'react'
import { useSigef } from '@/context/SigefContext'
import { PageHead, CardS, Pill, brl, num } from '@/components/shell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { TabBar } from '@/components/shell'

/**
 * Assistente IA — console de perguntas com regras determinísticas
 * sobre os dados locais (sem modelo de linguagem, sem rede).
 */
export default function AssistenteIaPage() {
  const { produtos, kardex, documentos, ocorrencias } = useSigef()

  const [aba, setAba] = useState('consulta')
  const [pergunta, setPergunta] = useState('')
  const [respostas, setRespostas] = useState<{ id: number; q: string; a: string[] }[]>([])

  const saldoProduto = (codigo: string) => {
    const movs = kardex.filter((k) => k.codigoInventario === codigo)
    return movs.length ? movs[movs.length - 1] : null
  }

  const responder = (texto: string) => {
    const q = texto.trim().toLowerCase()
    if (!q) return
    const linhas: string[] = []

    const produtoMencionado = produtos.find((p) => {
      const termos = [p.codigoInventario.toLowerCase(), p.descricao.toLowerCase()]
      return q.includes(termos[0]) || (termos[1] && q.includes(termos[1]))
    })

    if (q.includes('cobre') || produtoMencionado) {
      const alvo =
        produtoMencionado ||
        produtos.find((p) => p.descricao.toLowerCase().includes('cobre')) ||
        produtos[0]
      if (alvo) {
        const ult = saldoProduto(alvo.codigoInventario)
        linhas.push(
          `Produto ${alvo.codigoInventario} — ${alvo.descricao}: saldo ${
            ult ? num(ult.saldoQuantidade) : '0'
          } ${alvo.unidade}, valor ${brl(ult?.saldoValorTotal ?? 0)} (custo médio ${
            ult ? brl(ult.custoMedioUnitario) : '—'
          }).`,
        )
      } else {
        linhas.push('Nenhum produto cadastrado nesta empresa ainda.')
      }
    } else if (q.includes('saldo') || q.includes('estoque')) {
      const totalQtd = produtos.reduce((t, p) => {
        const ult = saldoProduto(p.codigoInventario)
        return t + (ult?.saldoQuantidade ?? 0)
      }, 0)
      const totalVal = produtos.reduce((t, p) => {
        const ult = saldoProduto(p.codigoInventario)
        return t + (ult?.saldoValorTotal ?? 0)
      }, 0)
      linhas.push(
        `Estoque total: ${num(totalQtd)} unidades somadas, valor ${brl(totalVal)} em ${
          produtos.length
        } produto(s).`,
      )
      const negativos = produtos.filter((p) => {
        const ult = saldoProduto(p.codigoInventario)
        return ult && ult.saldoQuantidade < 0
      })
      if (negativos.length) {
        linhas.push(
          `Atenção: ${negativos.length} produto(s) com saldo negativo — ${negativos
            .map((p) => p.codigoInventario)
            .join(', ')}.`,
        )
      }
    } else if (q.includes('nota') || q.includes('documento') || q.includes('importa')) {
      const proc = documentos.filter((d) => d.status === 'PROCESSADO').length
      const pend = documentos.filter((d) => d.status === 'AGUARDANDO_DE_PARA').length
      const canc = documentos.filter((d) => d.status === 'CANCELADO').length
      linhas.push(
        `Documentos: ${documentos.length} no total — ${proc} processados, ${pend} aguardando de-para, ${canc} cancelados.`,
      )
      if (pend) linhas.push('Resolva as pendências em Produtos (De-Para) para destravar a fila.')
    } else if (q.includes('ocorr') || q.includes('auditoria') || q.includes('problema')) {
      const pendentes = ocorrencias.filter((o) => !o.resolvido)
      linhas.push(
        `Auditoria: ${pendentes.length} ocorrência(s) pendente(s) de ${
          ocorrencias.length
        } no total.`,
      )
      const bloqueantes = pendentes.filter((o) => o.severidade === 'BLOQUEANTE')
      if (bloqueantes.length)
        linhas.push(`Bloqueantes: ${bloqueantes.length}. Trate-as antes de gerar o SPED.`)
    } else {
      linhas.push(
        'Não reconheci a pergunta. Tente: "saldo do <código>", "valor total do estoque", "notas pendentes" ou "ocorrências de auditoria".',
      )
    }

    setRespostas((prev) => [{ id: Date.now(), q: texto, a: linhas }, ...prev].slice(0, 10))
  }

  const sugestoes = useMemo(
    () => [
      'valor total do estoque',
      produtos[0] ? `saldo do ${produtos[0].codigoInventario}` : 'saldo do SUC-AL-001',
      'notas aguardando de-para',
      'ocorrências de auditoria',
    ],
    [produtos],
  )

  const passos = [
    'Selecione a empresa no cabeçalho e confira a situação cadastral.',
    'Cadastre o certificado A1 (somente o nome do arquivo) em Empresas.',
    'Cadastre os produtos e os vínculos de de-para de dois campos.',
    'Importe documentos por varredura de pasta ou pelo lote de demonstração.',
    'Processe a fila e trate as pendências de de-para.',
    'Confira o Kardex, a auditoria e o inventário.',
    'Encerre a competência e gere o Bloco K e o SPED TXT.',
    'Faça backup e teste a restauração mensalmente.',
  ]

  return (
    <div>
      <PageHead
        eyebrow="Assistente local"
        titulo="Assistente IA"
        subtitulo="Assistente local baseado em regras, não um modelo de linguagem. Responde com cálculos sobre os dados locais."
      />

      <TabBar
        ariaLabel="Abas do assistente"
        ativa={aba}
        onTrocar={setAba}
        tabs={[
          { id: 'consulta', label: 'Consulta' },
          { id: 'treino', label: 'Treinamento' },
        ]}
      />

      {aba === 'consulta' ? (
        <div className="mt-4 space-y-3">
          <CardS
            titulo="Console de perguntas"
            sub="Exemplos: “quanto tenho de cobre”, “saldo do SUC-AL-001”, “valor total do estoque”."
          >
            <form
              className="flex flex-col sm:flex-row gap-2 sm:items-end"
              onSubmit={(e) => {
                e.preventDefault()
                responder(pergunta)
                setPergunta('')
              }}
            >
              <div className="field flex-1">
                <label htmlFor="ia-input">Pergunta</label>
                <Input
                  id="ia-input"
                  className="sig-input"
                  value={pergunta}
                  autoComplete="off"
                  onChange={(e) => setPergunta(e.target.value)}
                  placeholder="Digite sua pergunta"
                />
              </div>
              <Button type="submit" className="bg-blue-700 hover:bg-blue-800">
                Perguntar
              </Button>
            </form>
            <div className="flex flex-wrap gap-2 mt-2">
              {sugestoes.map((s) => (
                <button
                  key={s}
                  type="button"
                  className="badge-pill t-petroleo cursor-pointer hover:opacity-80"
                  onClick={() => responder(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </CardS>

          {respostas.length === 0 ? (
            <CardS>
              <p className="text-sm text-[var(--sig-muted)]">
                Nenhuma pergunta ainda — o histórico das últimas 10 respostas aparece aqui.
              </p>
            </CardS>
          ) : (
            respostas.map((r) => (
              <CardS key={r.id}>
                <div className="flex items-start gap-2">
                  <Pill tone="t-accent">Pergunta</Pill>
                  <p className="text-sm font-medium m-0">{r.q}</p>
                </div>
                <ul className="prose-step mt-2">
                  {r.a.map((linha, i) => (
                    <li key={i}>{linha}</li>
                  ))}
                </ul>
              </CardS>
            ))
          )}
        </div>
      ) : (
        <CardS
          className="mt-4"
          titulo="Roteiro de 8 passos"
          sub="Use esta sequência para o primeiro uso do sistema."
        >
          <ol className="prose-step">
            {passos.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ol>
        </CardS>
      )}
    </div>
  )
}
