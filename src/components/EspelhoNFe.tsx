// Espelho da NF-e exibido ao clicar em um XML da fila de documentos.
// É montado a partir do que JÁ foi extraído na importação (doc.espelho,
// preenchido pelo nfeXmlParser) — a consulta real à SEFAZ
// (NFeDistribuicaoDFe) não é possível no navegador e está fora de escopo.
// Quando o XML bruto foi descartado (marcador de cota), o espelho mostra os
// dados estruturados salvos e avisa que protocolos/eventos detalhados exigem
// reimportar o XML.
import {
  BadgeCheck,
  Building2,
  FileText,
  History,
  Package,
  ScrollText,
  ShieldAlert,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { DocumentoFiscal, EventoNFe } from '@/types/sigef'
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

function Linha({
  rotulo,
  valor,
  mono = false,
}: {
  rotulo: string
  valor?: string | number
  mono?: boolean
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-teal-700/80">
        {rotulo}
      </span>
      <span className={`text-xs text-slate-800 ${mono ? 'font-mono break-all' : ''}`}>
        {valor ?? '—'}
      </span>
    </div>
  )
}

function CartaoParticipante({
  titulo,
  participante,
}: {
  titulo: string
  participante?: DocumentoFiscal['espelho'] extends never
    ? never
    : NonNullable<DocumentoFiscal['espelho']>['emitente']
}) {
  if (!participante) return null
  const end = participante.endereco
  return (
    <div className="rounded-xl border border-teal-200 bg-teal-50/40 p-3 space-y-2">
      <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-teal-800">
        {titulo === 'Emitente' ? (
          <Building2 className="size-3.5" aria-hidden="true" />
        ) : (
          <FileText className="size-3.5" aria-hidden="true" />
        )}
        {titulo}
      </div>
      <div className="text-xs font-semibold text-slate-900">{participante.xNome}</div>
      <div className="grid grid-cols-2 gap-2 text-xs text-slate-700">
        <span className="font-mono">{participante.cnpjCpf || '—'}</span>
        <span>IE: {participante.ie || '—'}</span>
      </div>
      {end && (
        <div className="text-[11px] text-slate-600">
          {[end.xLgr, end.nro, end.xBairro, end.xMun, end.uf, end.cep && `CEP ${end.cep}`]
            .filter(Boolean)
            .join(', ')}
        </div>
      )}
    </div>
  )
}

const badgeEvento = (ev: EventoNFe) => {
  switch (ev.tipo) {
    case 'CANC':
      return (
        <Badge className="bg-rose-100 text-rose-800 border border-rose-200 text-[10px]">
          Cancelamento
        </Badge>
      )
    case 'CCe':
      return (
        <Badge className="bg-amber-100 text-amber-800 border border-amber-200 text-[10px]">
          Carta de correção
        </Badge>
      )
    case 'MANIFESTACAO':
      return (
        <Badge className="bg-sky-100 text-sky-800 border border-sky-200 text-[10px]">
          Manifestação
        </Badge>
      )
    default:
      return (
        <Badge variant="outline" className="text-[10px]">
          Evento
        </Badge>
      )
  }
}

export function EspelhoNFeDialogBody({ doc }: { doc: DocumentoFiscal }) {
  const xmlBrutoDisponivel = !!doc.xmlOriginal && !doc.xmlOriginal.includes(MARCADOR_XML_COMPACTADO)
  const espelho = doc.espelho
  const itens = Array.isArray(doc.itens) ? doc.itens : []

  const totais = espelho?.totais ?? {
    vProd: itens.reduce((s, i) => s + (i.vProd || 0), 0),
    vNF: doc.valorTotal,
  }

  return (
    <div className="space-y-4">
      {/* Aviso quando o XML bruto foi descartado pela cota do localStorage */}
      {!xmlBrutoDisponivel && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-[11px] text-amber-900">
          <ShieldAlert className="size-4 shrink-0 mt-0.5" aria-hidden="true" />
          <span>
            O XML bruto desta nota foi descartado do armazenamento local para não estourar a cota. O
            espelho abaixo mostra os dados estruturados salvos na importação; protocolos e eventos
            detalhados exigem reimportar o XML original desta NF-e.
          </span>
        </div>
      )}

      {/* Dados gerais */}
      <section className="rounded-xl border border-teal-200 p-3">
        <div className="flex items-center gap-1.5 mb-2 text-[11px] font-bold uppercase tracking-wide text-teal-800">
          <ScrollText className="size-3.5" aria-hidden="true" />
          Dados da nota
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Linha rotulo="Chave de acesso" valor={doc.chaveAcesso} mono />
          <Linha rotulo="Número / Série" valor={`${doc.numero} / ${doc.serie}`} />
          <Linha rotulo="Data de emissão" valor={dataHora(doc.dataEmissao)} />
          <Linha rotulo="Natureza da operação" valor={espelho?.naturezaOperacao || '—'} />
          <Linha rotulo="Tipo de operação" valor={doc.tipoOperacao} />
          <Linha rotulo="Status na fila" valor={doc.status} />
        </div>
      </section>

      {/* Emitente e destinatário */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <CartaoParticipante titulo="Emitente" participante={espelho?.emitente} />
        <CartaoParticipante titulo="Destinatário" participante={espelho?.destinatario} />
      </div>

      {/* Produtos */}
      <section>
        <div className="flex items-center gap-1.5 mb-2 text-[11px] font-bold uppercase tracking-wide text-teal-800">
          <Package className="size-3.5" aria-hidden="true" />
          Produtos ({itens.length})
        </div>
        <div className="rounded-xl border border-teal-200 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-teal-50/60">
                <TableHead className="text-[10px]">#</TableHead>
                <TableHead className="text-[10px]">Código</TableHead>
                <TableHead className="text-[10px]">Descrição</TableHead>
                <TableHead className="text-[10px]">NCM</TableHead>
                <TableHead className="text-[10px]">CFOP</TableHead>
                <TableHead className="text-[10px] text-right">Quantidade</TableHead>
                <TableHead className="text-[10px] text-right">Vlr unitário</TableHead>
                <TableHead className="text-[10px] text-right">Vlr total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {itens.map((it) => (
                <TableRow key={it.nItem}>
                  <TableCell className="text-xs font-bold">{it.nItem}</TableCell>
                  <TableCell className="text-xs font-mono text-teal-800">{it.cProd}</TableCell>
                  <TableCell className="text-xs max-w-[220px] truncate" title={it.xProd}>
                    {it.xProd}
                  </TableCell>
                  <TableCell className="text-xs font-mono">{it.ncm}</TableCell>
                  <TableCell className="text-xs font-mono">{it.cfop}</TableCell>
                  <TableCell className="text-xs text-right whitespace-nowrap">
                    {it.qCom} {it.uCom}
                  </TableCell>
                  <TableCell className="text-xs text-right whitespace-nowrap">
                    {fmt(it.vUnCom)}
                  </TableCell>
                  <TableCell className="text-xs text-right font-semibold whitespace-nowrap">
                    {fmt(it.vProd)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      {/* Totais */}
      <section className="rounded-xl border border-teal-200 bg-teal-50/40 p-3">
        <div className="flex items-center gap-1.5 mb-2 text-[11px] font-bold uppercase tracking-wide text-teal-800">
          <BadgeCheck className="size-3.5" aria-hidden="true" />
          Totais da nota
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Linha rotulo="Produtos" valor={fmt(totais.vProd)} />
          <Linha rotulo="Frete" valor={fmt(totais.vFrete)} />
          <Linha rotulo="Desconto" valor={fmt(totais.vDesc)} />
          <Linha rotulo="ICMS" valor={fmt(totais.vICMS)} />
          <Linha rotulo="IPI" valor={fmt(totais.vIPI)} />
          <Linha rotulo="PIS" valor={fmt(totais.vPIS)} />
          <Linha rotulo="COFINS" valor={fmt(totais.vCOFINS)} />
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-teal-800">
              Valor total da nota
            </span>
            <span className="text-sm font-bold text-teal-900">{fmt(totais.vNF)}</span>
          </div>
        </div>
      </section>

      {/* Histórico de protocolos e eventos */}
      <section>
        <div className="flex items-center gap-1.5 mb-2 text-[11px] font-bold uppercase tracking-wide text-teal-800">
          <History className="size-3.5" aria-hidden="true" />
          Histórico de protocolos e eventos registrados
        </div>
        <div className="rounded-xl border border-teal-200 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-teal-50/60">
                <TableHead className="text-[10px]">Tipo</TableHead>
                <TableHead className="text-[10px]">Código</TableHead>
                <TableHead className="text-[10px]">Descrição</TableHead>
                <TableHead className="text-[10px]">Protocolo</TableHead>
                <TableHead className="text-[10px]">Data do evento</TableHead>
                <TableHead className="text-[10px]">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {espelho?.protocoloAutorizacao && (
                <TableRow>
                  <TableCell className="text-xs">
                    <Badge className="bg-teal-100 text-teal-900 border border-teal-300 text-[10px]">
                      Autorização
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs font-mono">—</TableCell>
                  <TableCell className="text-xs">
                    {espelho.protocoloAutorizacao.xMotivo || 'Autorização de uso da NF-e'}
                  </TableCell>
                  <TableCell className="text-xs font-mono">
                    {espelho.protocoloAutorizacao.nProt || '—'}
                  </TableCell>
                  <TableCell className="text-xs whitespace-nowrap">
                    {dataHora(espelho.protocoloAutorizacao.dhRecbto)}
                  </TableCell>
                  <TableCell className="text-xs whitespace-nowrap">
                    {espelho.protocoloAutorizacao.cStat
                      ? `${espelho.protocoloAutorizacao.cStat}${espelho.protocoloAutorizacao.xMotivo ? ` — ${espelho.protocoloAutorizacao.xMotivo}` : ''}`
                      : '—'}
                  </TableCell>
                </TableRow>
              )}
              {(espelho?.eventos ?? []).map((ev, i) => (
                <TableRow key={`${ev.codigoEvento}-${ev.nProt ?? i}-${i}`}>
                  <TableCell className="text-xs">{badgeEvento(ev)}</TableCell>
                  <TableCell className="text-xs font-mono">{ev.codigoEvento || '—'}</TableCell>
                  <TableCell className="text-xs">
                    {ev.descricao || '—'}
                    {ev.sequencial ? ` (seq. ${ev.sequencial})` : ''}
                  </TableCell>
                  <TableCell className="text-xs font-mono">{ev.nProt || '—'}</TableCell>
                  <TableCell className="text-xs whitespace-nowrap">
                    {dataHora(ev.dataEvento)}
                  </TableCell>
                  <TableCell className="text-xs whitespace-nowrap">
                    {ev.cStat ? `${ev.cStat}${ev.xMotivo ? ` — ${ev.xMotivo}` : ''}` : '—'}
                  </TableCell>
                </TableRow>
              ))}
              {!espelho?.protocoloAutorizacao && (espelho?.eventos ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-xs text-slate-500 py-4 text-center">
                    Nenhum protocolo ou evento registrado no XML desta nota
                    {xmlBrutoDisponivel
                      ? '.'
                      : ' — protocolos/eventos detalhados exigem reimportar o XML original.'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <p className="text-[10px] text-slate-500 mt-1.5">
          Espelho montado a partir do XML importado e armazenado — não há consulta à SEFAZ
          (NFeDistribuicaoDFe) nesta tela.
        </p>
      </section>
    </div>
  )
}
