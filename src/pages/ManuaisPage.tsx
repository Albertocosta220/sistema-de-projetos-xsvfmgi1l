import { useState } from 'react'
import { PageHead, TabBar, Pill } from '@/components/shell'
import { CardS } from '@/components/shell'
import { useSigef } from '@/context/SigefContext'

interface Passo {
  titulo: string
  texto: string
  codigo?: string
}

interface Rotina {
  id: string
  label: string
  resumo: string
  tempo: string
  preRequisitos: string[]
  passos: Passo[]
  referencia?: string
}

const ROTINAS: Rotina[] = [
  {
    id: 'importar',
    label: 'Importação de XML',
    resumo:
      'Como trazer NF-e de entrada e saída para o sistema, resolver vínculos de produto e acompanhar a fila de processamento.',
    tempo: '≈ 10 minutos',
    preRequisitos: [
      'Arquivos XML de NF-e autorizados (download da SEFAZ ou envio do fornecedor).',
      'Produtos cadastrados no inventário ou vínculos De-Para definidos.',
    ],
    passos: [
      {
        titulo: 'Abrir a tela Importar',
        texto:
          'No menu Operacional, clique em Importar. A tela aceita XMLs colados na caixa de texto ou arquivos em lote.',
      },
      {
        titulo: 'Colar ou selecionar os XMLs',
        texto:
          'Use "Colar XML" para notas individuais ou a seleção de arquivos para processar vários de uma vez. O sistema identifica automaticamente emitente, número, série, chave de acesso e itens.',
      },
      {
        titulo: 'Aguardar a fila de processamento',
        texto:
          'Cada nota entra na fila com um status. PROCESSADO significa que os itens foram vinculados e o Kardex foi recalculado.',
      },
      {
        titulo: 'Resolver pendências de De-Para',
        texto:
          'Notas com itens cujo código do fornecedor (cProd) não tem vínculo ficam em AGUARDANDO_DE_PARA. Vá em Produtos (De-Para), crie o vínculo e a nota é reenfileirada automaticamente.',
      },
      {
        titulo: 'Tratar duplicidades',
        texto:
          'Chaves de acesso já importadas geram status DUPLICIDADE — o sistema nunca lança a mesma nota duas vezes. Resolva na Auditoria mantendo a versão correta.',
      },
    ],
    referencia:
      'O estorno de nota cancelada devolve as quantidades ao Kardex e recalcula o custo médio das entradas posteriores.',
  },
  {
    id: 'kardex',
    label: 'Kardex / Custo Médio',
    resumo: 'Como o sistema calcula o custo médio ponderado e como auditar saldos item a item.',
    tempo: '≈ 8 minutos',
    preRequisitos: [
      'Pelo menos uma nota de entrada processada para cada item que será consultado.',
    ],
    passos: [
      {
        titulo: 'Abrir a tela Kardex',
        texto:
          'No menu Operacional, clique em Kardex. A tela lista os movimentos em ordem cronológica por produto.',
      },
      {
        titulo: 'Filtrar por produto e período',
        texto:
          'Selecione o código de inventário e o intervalo de datas. Os saldos são recalculados sempre em ordem cronológica — qualquer alteração reprocessa os movimentos posteriores.',
      },
      {
        titulo: 'Entender o custo médio',
        texto:
          'Cada entrada atualiza o custo médio ponderado: (saldo anterior + valor da entrada) ÷ (quantidade anterior + quantidade entrando). As saídas saem sempre pelo custo médio vigente.',
        codigo:
          'Custo médio = (saldo valor anterior + valor entrada) ÷ (saldo qtd anterior + qtd entrada)',
      },
      {
        titulo: 'Conferir bloqueios de saldo negativo',
        texto:
          'Uma saída maior que o saldo disponível é marcada com bloqueio de saldo negativo. Corrija a sequência das notas ou o estoque inicial antes do fechamento.',
      },
    ],
    referencia:
      'Ajustes de inventário aparecem como AJUSTE_INVENTARIO_ENTRADA ou SAIDA, e cancelamentos como ESTORNO_CANCELAMENTO.',
  },
  {
    id: 'inventario',
    label: 'Inventário',
    resumo:
      'Como gerar a contagem, registrar divergências e fechar a competência com ajustes aprovados.',
    tempo: '≈ 15 minutos',
    preRequisitos: [
      'Todas as notas da competência importadas e sem pendências.',
      'Kardex sem bloqueios de saldo negativo não resolvidos.',
    ],
    passos: [
      {
        titulo: 'Gerar a contagem da competência',
        texto:
          'Na tela Inventário, informe a competência (AAAA-MM) e clique em gerar. O sistema traz a quantidade e o custo médio do sistema para cada item.',
      },
      {
        titulo: 'Lançar as quantidades contadas',
        texto:
          'Informe a quantidade física contada em cada item. A diferença (contada − sistema) é calculada automaticamente, em quantidade e valor.',
      },
      {
        titulo: 'Justificar divergências',
        texto:
          'Itens com diferença exigem justificativa (quebra, avaria, erro de lançamento). Ela acompanha o ajuste no fechamento.',
      },
      {
        titulo: 'Fechar a competência',
        texto:
          'Ao fechar, o sistema bloqueia se houver notas pendentes, duplicidades ativas ou saldo negativo. Aprovadas as divergências, os ajustes entram no Kardex e o Bloco H é totalizado.',
      },
    ],
    referencia:
      'O valor total do estoque do fechamento alimenta o H010 do SPED e a validação H010 vs Kardex da Verificação (Lupo).',
  },
  {
    id: 'sped',
    label: 'SPED TXT',
    resumo: 'Como gerar o arquivo SPED Fiscal (EFD ICMS/IPI) com os Blocos 0, C, H e K.',
    tempo: '≈ 6 minutos',
    preRequisitos: [
      'Competência com fechamento concluído.',
      'Certificado digital da empresa válido (somente para transmissão, não para gerar o TXT).',
    ],
    passos: [
      {
        titulo: 'Abrir a tela SPED TXT',
        texto: 'No menu Operacional, clique em SPED TXT. Escolha a competência e a empresa ativa.',
      },
      {
        titulo: 'Conferir a prévia dos blocos',
        texto:
          'O sistema mostra um resumo de cada bloco: 0000 (abertura), 0150/0200 (cadastros), C100/C170 (documentos), H010 (inventário) e K100/K200 (produção e estoque).',
      },
      {
        titulo: 'Gerar e baixar o arquivo',
        texto:
          'Clique em gerar SPED TXT e baixe o arquivo. Ele segue o leiaute com registro 9999/0990 de encerramento e pode ser validado no PVA da SEFAZ.',
      },
      {
        titulo: 'Regras do Bloco C',
        texto:
          'Somente notas PROCESSADO geram C100 com código de situação 00 e C170 detalhado. Notas CANCELADO geram C100 com código 02, sem itens. Pendências ficam fora do arquivo.',
      },
    ],
    referencia:
      'Antes de transmitir, rode a Verificação (Lupo) — ela confere H010 vs inventário e K200 vs Kardex.',
  },
  {
    id: 'backup',
    label: 'Backup',
    resumo: 'Como exportar, importar e restaurar a base local da empresa ativa.',
    tempo: '≈ 5 minutos',
    preRequisitos: ['Nada — a rotina funciona com os dados que já estão no navegador.'],
    passos: [
      {
        titulo: 'Exportar o backup',
        texto:
          'Na tela Backup (menu Sistema), clique em Exportar backup JSON. O arquivo contém toda a base da empresa ativa e é registrado no histórico.',
      },
      {
        titulo: 'Guardar o arquivo fora do navegador',
        texto:
          'Os dados vivem no navegador (localStorage). Guarde o JSON em pasta segura ou nuvem — limpar os dados do navegador apaga a base.',
      },
      {
        titulo: 'Restaurar a partir do histórico',
        texto:
          'As 10 versões mais recentes ficam no histórico. Clique em Restaurar na versão desejada para voltar a ela.',
      },
      {
        titulo: 'Importar um arquivo externo',
        texto:
          'Use Importar backup e confira a prévia antes de aplicar. A importação substitui a base atual da empresa ativa.',
      },
    ],
    referencia: 'Recomendado exportar um backup antes de cada fechamento de competência.',
  },
]

export default function ManuaisPage() {
  const { empresaAtiva } = useSigef()
  const [abaAtiva, setAbaAtiva] = useState(ROTINAS[0].id)
  const rotina = ROTINAS.find((r) => r.id === abaAtiva) ?? ROTINAS[0]

  return (
    <div>
      <PageHead
        eyebrow="Sistema"
        titulo="Manuais"
        subtitulo={`Rotinas operacionais e fiscais do SIGEF-ME passo a passo — base de apoio da equipe de ${empresaAtiva.nomeFantasia}.`}
      />

      <TabBar
        ariaLabel="Rotinas do manual"
        tabs={ROTINAS.map((r) => ({ id: r.id, label: r.label }))}
        ativa={abaAtiva}
        onTrocar={setAbaAtiva}
      />

      <CardS
        titulo={`Rotina: ${rotina.label}`}
        sub={rotina.resumo}
        acoes={<Pill tone="t-accent">{rotina.tempo}</Pill>}
      >
        <div className="grid gap-4 md:grid-cols-[1fr_260px] md:items-start">
          <div>
            <h3 className="text-sm font-semibold text-[var(--petroleo)] mb-2">Passo a passo</h3>
            <ol className="prose-step list-none m-0 p-0 flex flex-col gap-3">
              {rotina.passos.map((p, i) => (
                <li key={i} className="flex gap-3">
                  <span
                    className="badge-pill t-accent shrink-0 h-7 w-7 flex items-center justify-center"
                    aria-hidden="true"
                  >
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="m-0 text-sm font-semibold text-[var(--petroleo)]">{p.titulo}</p>
                    <p className="m-0 text-sm text-[var(--sig-muted)]">{p.texto}</p>
                    {p.codigo ? <pre className="codeblock mt-2">{p.codigo}</pre> : null}
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <aside className="card-s p-4 gap-3">
            <h3 className="text-sm font-semibold text-[var(--petroleo)] m-0">Antes de começar</h3>
            <ul className="m-0 pl-4 text-sm text-[var(--sig-muted)] flex flex-col gap-1">
              {rotina.preRequisitos.map((req, i) => (
                <li key={i}>{req}</li>
              ))}
            </ul>
            {rotina.referencia ? (
              <p className="m-0 text-xs text-[var(--sig-muted)] border-t pt-3">
                <strong className="text-[var(--petroleo)]">Nota:</strong> {rotina.referencia}
              </p>
            ) : null}
          </aside>
        </div>
      </CardS>
    </div>
  )
}
