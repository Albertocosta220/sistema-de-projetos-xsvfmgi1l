// Espelho da NF-e em leiaute DANFE ("Consultar XML" da fila de documentos).
// Montado a partir do que JÁ foi extraído na importação (doc.espelho, do
// nfeXmlParser) — a consulta real à SEFAZ (NFeDistribuicaoDFe) não é possível
// no navegador e está fora de escopo. Quando o XML bruto foi descartado
// (marcador de cota), o espelho mostra os dados estruturados salvos e mantém o
// aviso de que protocolos/eventos detalhados exigem reimportar o XML.
import { FileWarning, Info } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { DocumentoFiscal, EspelhoNFe as EspelhoNFeTipo, EventoNFe } from '@/types/sigef'
import { MARCADOR_XML_COMPACTADO } from '@/services/storageService'

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const fmt = (v: number | undefined, fallback = '—') =>
  typeof v === 'number' && !Number.isNaN(v) ? brl.format(v) : fallback

const dataHora = (iso?: string) => {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

const fmtQty = (q: number, u: string) =>
  `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 4 }).format(q)} ${u}`

// ---------- Faixas de destaque por evento (pedido central do usuário) ----------

interface FaixaEvento {
  titulo: string
  observacao: string
  classes: string
}

function faixaDoEvento(ev: EventoNFe): FaixaEvento {
  switch (ev.tipo) {
    case 'CANC':
      return {
        titulo: 'NOTA CANCELADA',
        observacao:
          `Nota CANCELADA em ${dataHora(ev.dataEvento)}` +
          `${ev.nProt ? ` — protocolo ${ev.nProt}` : ''}` +
          `${ev.xMotivo ? ` — ${ev.xMotivo}` : ''}` +
          `${ev.descricao && ev.descricao !== ev.xMotivo ? ` (${ev.descricao})` : ''}`,
        classes: 'bg-rose-100 border-rose-500 text-rose-900',
      }
    case 'CCe':
      return {
        titulo: 'CARTA DE CORREÇÃO',
        observacao:
          `Carta de Correção registrada em ${dataHora(ev.dataEvento)}` +
          `${ev.nProt ? ` — protocolo ${ev.nProt}` : ''}` +
          `${ev.descricao ? ` — correção: ${ev.descricao}` : ''}`,
        classes: 'bg-sky-100 border-sky-500 text-sky-900',
      }
    default:
      return {
        titulo: 'EVENTO REGISTRADO',
        observacao:
          `${ev.descricao || 'Evento registrado'} em ${dataHora(ev.dataEvento)}` +
          `${ev.nProt ? ` — protocolo ${ev.nProt}` : ''}`,
        classes: 'bg-amber-100 border-amber-500 text-amber-900',
      }
  }
}

// ---------- Blocos do leiaute DANFE ----------

function QuadroCabecalho({ doc, espelho }: { doc: DocumentoFiscal; espelho?: EspelhoNFeTipo }) {
  const prot = espelho?.protocoloAutorizacao
  return (
    <section className="border-2 border-slate-800">
      {/* Faixa de identificação (identificaçao da NF-e, estilo DANFE) */}
      <div className="flex border-b-2 border-slate-800">
        <div className="flex-1 p-3">
          <div className="text-[10px] uppercase tracking-widest text-slate-500">
            Danfe — Documento Auxiliar da Nota Fiscal Eletrônica
          </div>
          <div className="text-2xl font-black text-slate-900 leading-tight">
            NF-e nº {doc.numero}
          </div>
          <div className="text-xs text-slate-700">
            Série {doc.serie} — {dataHora(doc.dataEmissao)}
          </div>
        </div>
        <div className="w-56 border-l-2 border-slate-800 p-3 space-y-1.5">
          <div>
            <div className="text-[9px] uppercase tracking-wide text-slate-500">Chave de acesso</div>
            <div className="font-mono text-[10px] break-all text-slate-900">
              {doc.chaveAcesso || '—'}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <div>
              <div className="text-[9px] uppercase tracking-wide text-slate-500">Protocolo</div>
              <div className="font-mono text-[10px] text-slate-900">{prot?.nProt || '—'}</div>
            </div>
            <div>
              <div className="text-[9px] uppercase tracking-wide text-slate-500">Autorização</div>
              <div className="text-[10px] text-slate-900">{dataHora(prot?.dhRecbto)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Emitente / Destinatário */}
      <div className="grid grid-cols-1 sm:grid-cols-2">
        <QuadroParticipante
          rotulo="Emitente"
          xNome={espelho?.emitente?.xNome || doc.nomeEmitente}
          cnpjCpf={espelho?.emitente?.cnpjCpf || doc.cnpjEmitente}
          endereco={espelho?.emitente?.endereco}
        />
        <QuadroParticipante
          rotulo="Destinatário"
          xNome={espelho?.destinatario?.xNome || doc.nomeDestinatario}
          cnpjCpf={espelho?.destinatario?.cnpjCpf || doc.cnpjDestinatario}
          endereco={espelho?.destinatario?.endereco}
        />
      </div>

      {/* Natureza da operação / tipo */}
      <div className="grid grid-cols-3 border-t-2 border-slate-800 text-xs">
        <div className="p-2 sm:col-span-2 border-r-2 border-slate-800">
          <div className="text-[9px] uppercase tracking-wide text-slate-500">
            Natureza da operação
          </div>
          <div className="text-slate-900">{espelho?.naturezaOperacao || '—'}</div>
        </div>
        <div className="p-2">
          <div className="text-[9px] uppercase tracking-wide text-slate-500">Tipo</div>
          <div className="text-slate-900">
            {doc.tipoOperacao === 'ENTRADA' ? '0 — Entrada' : '1 — Saída'}
          </div>
        </div>
      </div>
    </section>
  )
}

function QuadroParticipante({
  rotulo,
  xNome,
  cnpjCpf,
  endereco,
}: {
  rotulo: string
  xNome: string
  cnpjCpf: string
  endereco?: EspelhoNFeTipo['emitente']['endereco']
}) {
  const end = endereco
  return (
    <div className="p-2 border-t-2 border-slate-800 sm:border-t-0 first:border-t-0 sm:[&:not(:first-child)]:border-l-2 sm:[&:not(:first-child)]:border-slate-800">
      <div className="text-[9px] uppercase tracking-wide text-slate-500">{rotulo}</div>
      <div className="text-xs font-bold text-slate-900">{xNome || '—'}</div>
      <div className="text-[11px] text-slate-700 font-mono">{cnpjCpf || '—'}</div>
      {end && (
        <div className="text-[10px] text-slate-600">
          {[end.xLgr, end.nro, end.xBairro, end.xMun, end.uf].filter(Boolean).join(', ')}
        </div>
      )}
    </div>
  )
}

export function EspelhoNFeDialogBody({ doc }: { doc: DocumentoFiscal }) {
  const xmlBrutoDisponivel = !!doc.xmlOriginal && !doc.xmlOriginal.includes(MARCADOR_XML_COMPACTADO)
  const espelho = doc.espelho
  const itens = Array.isArray(doc.itens) ? doc.itens : []
  const eventos = espelho?.eventos ?? []

  const totais = espelho?.totais ?? {
    vProd: itens.reduce((s, i) => s + (i.vProd || 0), 0),
    vNF: doc.valorTotal,
  }

  return (
    <div className="space-y-4">
      {/* Aviso quando o XML bruto foi descartado pela cota do localStorage */}
      {!xmlBrutoDisponivel && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-[11px] text-amber-900">
          <FileWarning className="size-4 shrink-0 mt-0.5" aria-hidden="true" />
          <span>
            O XML bruto desta nota foi descartado do armazenamento local para não estourar a cota. O
            espelho abaixo mostra os dados estruturados salvos na importação; protocolos e eventos
            detalhados exigem reimportar o XML original desta NF-e.
          </span>
        </div>
      )}

      {/* Faixas de destaque: um bloco por evento registrado no XML */}
      {eventos.length > 0 && (
        <section aria-label="Eventos registrados na nota" className="space-y-2">
          {eventos.map((ev, i) => {
            const faixa = faixaDoEvento(ev)
            return (
              <div
                key={`${ev.codigoEvento}-${ev.nProt ?? i}-${i}`}
                className={`rounded-lg border-2 p-3 text-xs font-semibold ${faixa.classes}`}
              >
                <div className="flex items-center gap-1.5">
                  <FileWarning className="size-4" aria-hidden="true" />
                  {faixa.titulo}
                </div>
                <div className="mt-1 font-normal text-[11px]">{faixa.observacao}</div>
              </div>
            )
          })}
        </section>
      )}

      {/* Cabeçalho estilo DANFE */}
      <QuadroCabecalho doc={doc} espelho={espelho} />

      {/* Produtos (tabela DANFE) */}
      <section className="border-2 border-slate-800">
        <div className="bg-slate-800 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
          Dados dos produtos / serviços
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-100 hover:bg-slate-100">
                <TableHead className="text-[10px] text-slate-800">#</TableHead>
                <TableHead className="text-[10px] text-slate-800">Código</TableHead>
                <TableHead className="text-[10px] text-slate-800">Descrição</TableHead>
                <TableHead className="text-[10px] text-slate-800">NCM</TableHead>
                <TableHead className="text-[10px] text-slate-800">CFOP</TableHead>
                <TableHead className="text-[10px] text-slate-800 text-right">Qtd</TableHead>
                <TableHead className="text-[10px] text-slate-800 text-right">Vlr unit.</TableHead>
                <TableHead className="text-[10px] text-slate-800 text-right">Vlr total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {itens.map((it) => (
                <TableRow key={it.nItem}>
                  <TableCell className="text-xs font-bold">{it.nItem}</TableCell>
                  <TableCell className="text-xs font-mono">{it.cProd}</TableCell>
                  <TableCell className="text-xs max-w-[240px] truncate" title={it.xProd}>
                    {it.xProd}
                  </TableCell>
                  <TableCell className="text-xs font-mono">{it.ncm}</TableCell>
                  <TableCell className="text-xs font-mono">{it.cfop}</TableCell>
                  <TableCell className="text-xs text-right whitespace-nowrap">
                    {fmtQty(it.qCom, it.uCom)}
                  </TableCell>
                  <TableCell className="text-xs text-right whitespace-nowrap">
                    {fmt(it.vUnCom)}
                  </TableCell>
                  <TableCell className="text-xs text-right font-semibold whitespace-nowrap">
                    {fmt(it.vProd)}
                  </TableCell>
                </TableRow>
              ))}
              {itens.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-xs text-slate-500 text-center py-3">
                    Sem itens registrados neste documento.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      {/* Cálculo do imposto ("totais") */}
      <section className="border-2 border-slate-800 p-3">
        <div className="text-[10px] font-bold uppercase tracking-wide text-slate-700 mb-2">
          Cálculo do imposto
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <CelulaDado rotulo="Produtos" valor={fmt(totais.vProd)} />
          <CelulaDado rotulo="Frete" valor={fmt(totais.vFrete)} />
          <CelulaDado rotulo="Seguro" valor={fmt(totais.vSeg)} />
          <CelulaDado rotulo="Desconto" valor={fmt(totais.vDesc)} />
          <CelulaDado rotulo="ICMS" valor={fmt(totais.vICMS)} />
          <CelulaDado rotulo="IPI" valor={fmt(totais.vIPI)} />
          <CelulaDado rotulo="PIS" valor={fmt(totais.vPIS)} />
          <CelulaDado rotulo="COFINS" valor={fmt(totais.vCOFINS)} />
        </div>
        <div className="mt-2 pt-2 border-t border-slate-300 flex items-baseline justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wide text-slate-700">
            Valor total da nota
          </span>
          <span className="text-base font-black text-slate-900">{fmt(totais.vNF)}</span>
        </div>
      </section>

      {/* Observações: uma linha textual por evento + protocolo de autorização */}
      {(eventos.length > 0 || espelho?.protocoloAutorizacao) && (
        <section className="border-2 border-slate-800 p-3">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-700 mb-2">
            <Info className="size-3.5" aria-hidden="true" />
            Observações
          </div>
          <ul className="space-y-1 text-xs text-slate-800 list-disc list-inside">
            {espelho?.protocoloAutorizacao && (
              <li>
                Autorizada em {dataHora(espelho.protocoloAutorizacao.dhRecbto)}
                {espelho.protocoloAutorizacao.nProt
                  ? ` — protocolo ${espelho.protocoloAutorizacao.nProt}`
                  : ''}
                {espelho.protocoloAutorizacao.xMotivo
                  ? ` — ${espelho.protocoloAutorizacao.xMotivo}`
                  : ''}
                .
              </li>
            )}
            {eventos.map((ev, i) => {
              const faixa = faixaDoEvento(ev)
              return (
                <li key={`obs-${ev.codigoEvento}-${ev.nProt ?? i}-${i}`}>{faixa.observacao}.</li>
              )
            })}
          </ul>
        </section>
      )}

      <p className="text-[10px] text-slate-500">
        Espelho em leiaute DANFE montado a partir do XML importado e armazenado — não há consulta à
        SEFAZ (NFeDistribuicaoDFe) nesta tela.
      </p>
    </div>
  )
}
