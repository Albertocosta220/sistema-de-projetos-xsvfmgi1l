import React, { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSigef } from '@/context/SigefContext'

import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Ban,
  CheckCircle,
  Copy,
  FileCode,
  FileSearch,
  FolderOpen,
  Info,
  MoreVertical,
  PackageX,
  RefreshCw,
  Link2Off,
  Search,
  ShieldOff,
  Trash2,
  Upload,
} from 'lucide-react'
// Nota: nenhum dado de exemplo nesta tela — em produção os XMLs vêm apenas de arquivos reais.
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
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
import { Label } from '@/components/ui/label'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import { DocumentoFiscal } from '@/types/sigef'
import { itemNaoVinculado } from '@/services/desqualificacaoService'
import { useAuth } from '@/context/AuthContext'
import { EspelhoNFeDialogBody } from '@/components/EspelhoNFe'
import { DialogoDesqualificarNota } from '@/components/DialogoDesqualificarNota'
import { MARCADOR_XML_COMPACTADO } from '@/services/storageService'

export default function ImportarPage() {
  const {
    documentos,
    importarXmlsEmLote,
    cancelarNFe,
    reprocessarNotas,
    periodoAtivo,
    desqualificarNota,
    marcarNaoControlaEstoque,
    naoVincularNota,
    requalificarNota,
    regrasDesqualificacao,
  } = useSigef()
  const { temPermissao, usuarioAtual } = useAuth()
  const podeProcessar = temPermissao('acao-processar-notas')

  // Período da importação (bug 2): o que o usuário informar aqui fica gravado
  // na competência ativa da empresa e passa a valer para Painel, Kardex,
  // Inventário e Bloco K.
  const [periodoInicio, setPeriodoInicio] = useState('')
  const [periodoFim, setPeriodoFim] = useState('')
  const [textoXmlColado, setTextoXmlColado] = useState('')
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<string>('TODOS')

  // Modais
  const [docSelecionado, setDocSelecionado] = useState<DocumentoFiscal | null>(null)
  const [docParaCancelar, setDocParaCancelar] = useState<DocumentoFiscal | null>(null)
  const [justificativaCancelamento, setJustificativaCancelamento] = useState('')
  const [docParaDesqualificar, setDocParaDesqualificar] = useState<DocumentoFiscal | null>(null)
  const [modoDesqualificacao, setModoDesqualificacao] = useState<'inventario' | 'estoque'>(
    'inventario',
  )
  const [docEspelho, setDocEspelho] = useState<DocumentoFiscal | null>(null)
  /** Confirmação do "Não vincular" (não gera estoque, regra CNPJ+item gravada). */
  const [docParaNaoVincular, setDocParaNaoVincular] = useState<DocumentoFiscal | null>(null)

  /** Abre o diálogo de marcação no modo escolhido (inventário ou controle de estoque). */
  const abrirDialogoDesqualificar = (doc: DocumentoFiscal, modo: 'inventario' | 'estoque') => {
    setModoDesqualificacao(modo)
    setDocParaDesqualificar(doc)
  }

  const fileInputLoteRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  // Upload em lote ou pasta
  const processarArquivos = (files: FileList | null) => {
    if (!files || files.length === 0) return
    const xmlPromises: Promise<string>[] = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      if (file.name.toLowerCase().endsWith('.xml') || file.type.includes('xml')) {
        xmlPromises.push(
          new Promise((resolve) => {
            const reader = new FileReader()
            reader.onload = (e) => resolve((e.target?.result as string) || '')
            reader.readAsText(file)
          }),
        )
      }
    }

    if (xmlPromises.length === 0) {
      toast.warning('Nenhum arquivo .xml válido encontrado.')
      return
    }

    Promise.all(xmlPromises).then((xmlStrings) => {
      const res = importarXmlsEmLote(xmlStrings, {
        inicio: periodoInicio,
        fim: periodoFim,
      })
      // Deduplicação na entrada: chaves já importadas são descartadas ANTES de
      // enfileirar — o documento tratado fica intacto e nada novo entra na fila.
      if (res.descartados > 0) {
        toast.info(
          `${res.descartados} arquivo(s) descartado(s): chave de acesso já importada e tratada (régua A01) — nada foi sobrescrito.`,
        )
      }
      if (res.importados === 0 && res.descartados > 0) {
        toast.success(
          `Nenhum arquivo novo: todas as ${res.descartados} nota(s) já constam na escrituração (A01). Documentos existentes preservados.`,
        )
        return
      }
      toast.success(
        `Processamento finalizado: ${res.importados} importado(s), ${res.descartados} já existente(s) descartado(s) (A01), ${res.pendentesDePara} aguardando de-para (A02).`,
      )
    })
  }

  const handleImportarTextoColado = () => {
    if (!textoXmlColado.trim()) {
      toast.error('Cole o conteúdo XML da NF-e para importar.')
      return
    }
    const res = importarXmlsEmLote([textoXmlColado], { inicio: periodoInicio, fim: periodoFim })
    setTextoXmlColado('')
    if (res.importados === 0 && res.descartados > 0) {
      toast.info(
        'Esta NF-e já consta na escrituração (chave de acesso em duplicidade — régua A01). O documento já tratado foi preservado.',
      )
      return
    }
    toast.success(
      `XML importado! Processados: ${res.importados}, Aguardando De-Para: ${res.pendentesDePara}${
        res.descartados > 0 ? `, Duplicados descartados: ${res.descartados}` : ''
      }`,
    )
  }

  const confirmarCancelamento = () => {
    if (!docParaCancelar) return
    if (!justificativaCancelamento.trim()) {
      toast.error('Informe a justificativa do cancelamento/estorno.')
      return
    }
    cancelarNFe(docParaCancelar.id, justificativaCancelamento)
    setDocParaCancelar(null)
    setJustificativaCancelamento('')
  }

  const confirmarDesqualificacao = () => {
    if (!docParaDesqualificar) return
    const res =
      modoDesqualificacao === 'estoque'
        ? marcarNaoControlaEstoque(docParaDesqualificar.id)
        : desqualificarNota(docParaDesqualificar.id)
    setDocParaDesqualificar(null)
    if (!res.regra) {
      toast.error(
        'Não foi possível marcar: a nota não possui itens com código identificável (ou já estava marcada).',
      )
      return
    }
    toast.success(
      modoDesqualificacao === 'estoque'
        ? `Nota ${docParaDesqualificar.numero} marcada como "não controla estoque" — ${res.afetados} documento(s) do mesmo emitente/produto fora do Kardex e do Bloco H.`
        : `Nota ${docParaDesqualificar.numero} desqualificada para o Inventário — ${res.afetados} documento(s) do mesmo emitente/produto marcado(s) como "não gera inventário".`,
    )
  }

  const confirmarRequalificacao = (doc: DocumentoFiscal) => {
    requalificarNota(doc.id)
    toast.success(
      `Nota ${doc.numero} requalificada — volta a gerar Inventário/Kardex (regras do emitente/produto removidas).`,
    )
  }

  /** Confirma o "Não vincular": regra CNPJ+item gravada, sem de-para, fora do estoque. */
  const confirmarNaoVincular = () => {
    if (!docParaNaoVincular) return
    const res = naoVincularNota(docParaNaoVincular.id)
    setDocParaNaoVincular(null)
    if (!res.regra) {
      toast.error(
        'Não foi possível gravar: a nota não possui itens com código identificável (ou já estava gravada).',
      )
      return
    }
  }

  // Filtragem
  const docsFiltrados = documentos.filter((d) => {
    const matchesBusca =
      d.numero.toLowerCase().includes(busca.toLowerCase()) ||
      d.chaveAcesso.toLowerCase().includes(busca.toLowerCase()) ||
      d.nomeEmitente.toLowerCase().includes(busca.toLowerCase()) ||
      d.nomeDestinatario.toLowerCase().includes(busca.toLowerCase())

    const matchesStatus = filtroStatus === 'TODOS' ? true : d.status === filtroStatus

    return matchesBusca && matchesStatus
  })

  const getStatusBadge = (status: DocumentoFiscal['status']) => {
    switch (status) {
      case 'PROCESSADO':
        return (
          <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1">
            <CheckCircle className="size-3" />
            PROCESSADO
          </Badge>
        )
      case 'AGUARDANDO_DE_PARA':
        return (
          <Badge className="bg-amber-600 hover:bg-amber-700 text-white flex items-center gap-1">
            <AlertTriangle className="size-3" />
            AGUARDANDO_DE_PARA
          </Badge>
        )
      case 'DUPLICIDADE':
        return (
          <Badge variant="destructive" className="flex items-center gap-1">
            <Copy className="size-3" />
            DUPLICIDADE (A01)
          </Badge>
        )
      case 'CANCELADO':
        return (
          <Badge
            variant="secondary"
            className="text-slate-600 line-through flex items-center gap-1"
          >
            <Ban className="size-3" />
            CANCELADO / ESTORNADO
          </Badge>
        )
      case 'ERRO':
        return (
          <Badge variant="destructive" className="flex items-center gap-1">
            <AlertCircle className="size-3" />
            ERRO
          </Badge>
        )
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <div className="space-y-3">
      {/* Título da tela */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-slate-900">
            Importação & Fila de Documentos Fiscais
          </h1>
          <p className="text-[11px] text-slate-500">
            Varredura recursiva de pasta, upload em lote de XMLs de NF-e e gerenciamento da fila
            cronológica
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={reprocessarNotas}
            disabled={!podeProcessar}
            title={
              podeProcessar
                ? 'Reprocessar a fila cronológica de documentos'
                : 'Sem permissão: exige a ação "Processar notas" no perfil'
            }
            className="flex items-center gap-1.5"
          >
            <RefreshCw className="size-3.5" />
            <span>Reprocessar Fila</span>
          </Button>
        </div>
      </div>

      {/* Áreas de Importação */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Upload em lote e Varredura de Pasta */}
        <Card className="lg:col-span-2 border-slate-200">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Upload className="size-4 text-blue-700" />
              Upload de Arquivos XML de NF-e
            </CardTitle>
            <CardDescription className="text-[11px]">
              Selecione múltiplos arquivos XML ou aponte uma pasta inteira de notas do seu
              computador
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 px-4 pb-4">
            {/* Período da importação — definido uma vez e usado por toda importação da tela */}
            <div className="p-3 bg-blue-50/50 border border-blue-200 rounded-xl flex flex-col sm:flex-row sm:items-end gap-3">
              <div className="flex-1 space-y-1">
                <Label htmlFor="periodoInicio" className="text-xs font-semibold text-slate-700">
                  Período da importação — início
                </Label>
                <Input
                  id="periodoInicio"
                  type="date"
                  value={periodoInicio}
                  onChange={(e) => setPeriodoInicio(e.target.value)}
                  className="text-xs h-8 bg-white"
                />
              </div>
              <div className="flex-1 space-y-1">
                <Label htmlFor="periodoFim" className="text-xs font-semibold text-slate-700">
                  Período da importação — fim
                </Label>
                <Input
                  id="periodoFim"
                  type="date"
                  value={periodoFim}
                  onChange={(e) => setPeriodoFim(e.target.value)}
                  className="text-xs h-8 bg-white"
                />
              </div>
              <div className="text-[11px] text-slate-600 pb-0.5">
                Competência ativa:{' '}
                <strong className="font-mono text-blue-800">{periodoAtivo.competencia}</strong> (
                {periodoAtivo.inicio} a {periodoAtivo.fim}) — vale para o Painel, Kardex, Inventário
                e Bloco K.
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Botão Upload em Lote */}
              <div
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') fileInputLoteRef.current?.click()
                }}
                onClick={() => fileInputLoteRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-lg p-3 text-center cursor-pointer transition-colors bg-slate-50 hover:bg-blue-50/50 flex flex-col items-center justify-center gap-1"
              >
                <div className="size-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center">
                  <Upload className="size-5" />
                </div>
                <div className="text-xs font-bold text-slate-800">Selecionar XMLs em Lote</div>
                <div className="text-[11px] text-slate-500">
                  Arquivos .xml individuais ou múltiplos
                </div>
                <input
                  ref={fileInputLoteRef}
                  type="file"
                  multiple
                  accept=".xml"
                  className="hidden"
                  onChange={(e) => processarArquivos(e.target.files)}
                />
              </div>

              {/* Botão Varredura de Pasta (webkitdirectory) */}
              <div
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') folderInputRef.current?.click()
                }}
                onClick={() => folderInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-lg p-3 text-center cursor-pointer transition-colors bg-slate-50 hover:bg-emerald-50/50 flex flex-col items-center justify-center gap-1"
              >
                <div className="size-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <FolderOpen className="size-5" />
                </div>
                <div className="text-xs font-bold text-slate-800">Varredura de Pasta Completa</div>
                <div className="text-[11px] text-slate-500">
                  Lê recursivamente todos os XMLs da pasta
                </div>
                <input
                  ref={folderInputRef}
                  type="file"
                  {...({
                    webkitdirectory: '',
                    directory: '',
                  } as React.InputHTMLAttributes<HTMLInputElement> & Record<string, string>)}
                  className="hidden"
                  onChange={(e) => processarArquivos(e.target.files)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Colar XML Diretamente */}
        <Card className="border-slate-200">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <FileCode className="size-4 text-slate-700" />
              Colar XML de NF-e
            </CardTitle>
            <CardDescription className="text-[11px]">
              Cole o texto cru da tag &lt;nfeProc&gt; ou &lt;NFe&gt;
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 px-4 pb-4">
            <Textarea
              value={textoXmlColado}
              onChange={(e) => setTextoXmlColado(e.target.value)}
              placeholder="Cole o código XML da NF-e aqui..."
              className="text-[11px] font-mono h-32 resize-none"
            />
            {podeProcessar && (
              <Button
                type="button"
                onClick={handleImportarTextoColado}
                size="sm"
                className="w-full bg-slate-900 hover:bg-slate-800 text-xs"
              >
                Processar XML Colado
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Fila de Documentos Fiscais */}
      <Card className="border-slate-200">
        <CardHeader className="pb-2 pt-4 px-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-sm font-bold">
                Fila de Processamento Cronológico ({documentos.length} Documentos)
              </CardTitle>
              <CardDescription className="text-[11px]">
                Status: PENDENTE, PROCESSADO, AGUARDANDO_DE_PARA, DUPLICIDADE, CANCELADO ou ERRO
              </CardDescription>
            </div>

            {/* Filtros e Busca */}
            <div className="flex flex-wrap items-center gap-1.5">
              <div className="relative w-40 sm:w-52">
                <Search className="size-3.5 absolute left-2.5 top-2 text-slate-400" />
                <Input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar NF, Chave, Emitente..."
                  className="pl-8 text-[11px] h-7"
                />
              </div>

              <select
                value={filtroStatus}
                onChange={(e) => setFiltroStatus(e.target.value)}
                className="text-[11px] h-7 border border-slate-300 rounded-md px-1.5 bg-white"
                aria-label="Filtrar por status"
              >
                <option value="TODOS">Todos os Status</option>
                <option value="PROCESSADO">Processados</option>
                <option value="AGUARDANDO_DE_PARA">Aguardando De-Para</option>
                <option value="DUPLICIDADE">Duplicidade</option>
                <option value="CANCELADO">Cancelados</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-2 pb-2">
          {documentos.length === 0 ? (
            <div className="text-center py-10 px-4">
              <FileCode className="size-8 mx-auto text-slate-300 mb-2" aria-hidden="true" />
              <p className="text-sm font-semibold text-slate-700">Nenhuma NF-e escriturada</p>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                Importe o XML de uma NF-e real (arquivo, pasta ou colado acima) para começar a
                escrituração desta empresa. Os documentos aparecerão aqui com o status de
                processamento.
              </p>
            </div>
          ) : docsFiltrados.length === 0 ? (
            <div className="text-center py-10 text-slate-500 text-xs">
              Nenhum documento encontrado com os filtros informados.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="text-[11px]">
                <TableHeader>
                  <TableRow className="h-7">
                    <TableHead className="h-7 px-1.5 text-[10px]">Operação</TableHead>
                    <TableHead className="h-7 px-1.5 text-[10px]">NF-e / Série</TableHead>
                    <TableHead className="h-7 px-1.5 text-[10px]">Emissão</TableHead>
                    <TableHead className="h-7 px-1.5 text-[10px]">Emitente / Fornecedor</TableHead>
                    <TableHead className="h-7 px-1.5 text-[10px] text-right">Valor Total</TableHead>
                    <TableHead className="h-7 px-1.5 text-[10px]">Status</TableHead>
                    <TableHead className="h-7 px-1.5 text-[10px] text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {docsFiltrados.map((doc) => {
                    const isAguardando = doc.status === 'AGUARDANDO_DE_PARA'
                    const tituloEmitente = `${doc.nomeEmitente} (${doc.cnpjEmitente})`
                    return (
                      <TableRow
                        key={doc.id}
                        className={isAguardando ? 'bg-amber-50/40' : undefined}
                      >
                        <TableCell className="px-1.5 py-1">
                          <Badge
                            variant="outline"
                            className={`text-[9px] px-1 py-0 font-bold ${
                              doc.tipoOperacao === 'ENTRADA'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : 'bg-blue-50 text-blue-800 border-blue-200'
                            }`}
                          >
                            {doc.tipoOperacao}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-1.5 py-1">
                          <div className="font-bold text-[11px] text-slate-900 whitespace-nowrap">
                            Nº {doc.numero} (série {doc.serie})
                          </div>
                          <div
                            className="font-mono text-[9px] text-slate-400 truncate max-w-[110px]"
                            title={doc.chaveAcesso}
                          >
                            {doc.chaveAcesso}
                          </div>
                        </TableCell>
                        <TableCell className="px-1.5 py-1 text-[11px] whitespace-nowrap text-slate-600">
                          {new Date(doc.dataEmissao).toLocaleDateString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </TableCell>
                        <TableCell className="px-1.5 py-1 text-[11px]" title={tituloEmitente}>
                          <div
                            className="font-medium text-slate-800 truncate max-w-[130px]"
                            title={doc.nomeEmitente}
                          >
                            {doc.nomeEmitente}
                          </div>
                          <div className="text-[9px] text-slate-400">{doc.cnpjEmitente}</div>
                        </TableCell>
                        <TableCell className="px-1.5 py-1 text-right text-[11px] font-bold text-slate-900 whitespace-nowrap">
                          {new Intl.NumberFormat('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          }).format(doc.valorTotal)}
                        </TableCell>
                        <TableCell className="px-1.5 py-1 whitespace-nowrap">
                          {getStatusBadge(doc.status)}
                          {doc.desqualificadaParaInventario && (
                            <div className="mt-0.5">
                              {doc.naoVinculaEstoque ? (
                                <Badge
                                  className="bg-violet-100 text-violet-800 border border-violet-300 text-[9px] px-1 py-0 flex items-center gap-0.5 w-fit"
                                  title="Item(ns) gravado(s) como “não vincular”: não geram estoque nem inventário e não entram na pendência de de-para."
                                >
                                  <Link2Off className="size-2.5" aria-hidden="true" />
                                  Não vincular (não gera estoque)
                                </Badge>
                              ) : doc.naoControlaEstoque ? (
                                <Badge className="bg-amber-100 text-amber-800 border border-amber-300 text-[9px] px-1 py-0 flex items-center gap-0.5 w-fit">
                                  <PackageX className="size-2.5" aria-hidden="true" />
                                  Não controla estoque
                                </Badge>
                              ) : (
                                <Badge className="bg-teal-100 text-teal-800 border border-teal-300 text-[9px] px-1 py-0 flex items-center gap-0.5 w-fit">
                                  <ShieldOff className="size-2.5" aria-hidden="true" />
                                  Desqualificada p/ Inventário
                                </Badge>
                              )}
                              {doc.desqualificadaPor && (
                                <div className="text-[9px] text-teal-700/80 mt-0.5">
                                  por {doc.desqualificadaPor}
                                </div>
                              )}
                            </div>
                          )}
                          {doc.motivoErro && (
                            <div
                              className="text-[9px] text-rose-600 mt-0.5 truncate max-w-[140px]"
                              title={doc.motivoErro}
                            >
                              {doc.motivoErro}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="px-1.5 py-1 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-0.5">
                            {isAguardando && (
                              <Button
                                asChild
                                size="sm"
                                className="h-6 px-1.5 text-[10px] bg-amber-600 hover:bg-amber-700 text-white"
                              >
                                <Link to="/produtos">
                                  <span>Resolver De-Para</span>
                                  <ArrowRight className="size-2.5 ml-0.5" />
                                </Link>
                              </Button>
                            )}

                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-1.5 text-[10px]"
                              onClick={() => setDocSelecionado(doc)}
                              title="Ver detalhes da nota (itens, valores e vínculos)"
                            >
                              Detalhes
                            </Button>

                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-1.5 text-[10px]"
                              onClick={() => setDocEspelho(doc)}
                              title="Consultar o XML: espelho completo da NF-e com protocolos e eventos"
                            >
                              <FileSearch className="size-3 mr-0.5" aria-hidden="true" />
                              XML
                            </Button>

                            {doc.desqualificadaParaInventario ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={!podeProcessar}
                                className="h-6 px-1.5 text-[10px] text-teal-700 hover:text-teal-800 hover:bg-teal-50"
                                onClick={() => confirmarRequalificacao(doc)}
                                title={
                                  podeProcessar
                                    ? 'Desfazer: remover as regras gravadas e reprocessar (nota volta ao Kardex/Bloco H)'
                                    : 'Sem permissão: exige a ação "Processar notas" no perfil'
                                }
                              >
                                Requalificar
                              </Button>
                            ) : (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    disabled={!podeProcessar}
                                    className="h-6 px-1.5 text-[10px] text-teal-700 hover:text-teal-800 hover:bg-teal-50"
                                    title={
                                      podeProcessar
                                        ? 'Marcar a nota: fora do Bloco H (inventário), fora do Kardex (não controla estoque) ou não vincular (não gera estoque)'
                                        : 'Sem permissão: exige a ação "Processar notas" no perfil'
                                    }
                                  >
                                    <ShieldOff className="size-3 mr-0.5" aria-hidden="true" />
                                    Marcar
                                    <MoreVertical className="size-2.5 ml-0.5" aria-hidden="true" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onClick={() => abrirDialogoDesqualificar(doc, 'inventario')}
                                  >
                                    <ShieldOff className="size-3.5 mr-1.5" aria-hidden="true" />
                                    Desqualificar p/ Inventário (Bloco H)
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => abrirDialogoDesqualificar(doc, 'estoque')}
                                  >
                                    <PackageX className="size-3.5 mr-1.5" aria-hidden="true" />
                                    Não controla estoque (Kardex/Bloco H)
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => setDocParaNaoVincular(doc)}>
                                    <Link2Off className="size-3.5 mr-1.5" aria-hidden="true" />
                                    Não vincular (não gera estoque)
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}

                            {doc.status !== 'CANCELADO' && podeProcessar && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-1.5 text-[10px] text-rose-600 hover:text-rose-800 hover:bg-rose-50"
                                onClick={() => setDocParaCancelar(doc)}
                                title="Cancelar NF-e com Estorno Cronológico no Kardex"
                              >
                                Cancelar
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal Detalhes da Nota Fiscal */}
      {docSelecionado && (
        <Dialog open={!!docSelecionado} onOpenChange={() => setDocSelecionado(null)}>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                <span>Detalhes da NF-e nº {docSelecionado.numero}</span>
                {getStatusBadge(docSelecionado.status)}
              </DialogTitle>
              <DialogDescription className="font-mono text-xs break-all">
                Chave: {docSelecionado.chaveAcesso}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div>
                  <span className="text-slate-500 font-semibold">Emitente:</span>
                  <div className="font-medium text-slate-900">{docSelecionado.nomeEmitente}</div>
                  <div className="text-slate-500">{docSelecionado.cnpjEmitente}</div>
                </div>
                <div>
                  <span className="text-slate-500 font-semibold">Destinatário:</span>
                  <div className="font-medium text-slate-900">
                    {docSelecionado.nomeDestinatario}
                  </div>
                  <div className="text-slate-500">{docSelecionado.cnpjDestinatario}</div>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-slate-800 mb-2">
                  Itens do Documento Fiscal ({(docSelecionado.itens || []).length}):
                </h4>
                <div className="border border-slate-200 rounded-lg overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead>Código Fornec.</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead className="text-right">Qtd Com</TableHead>
                        <TableHead className="text-right">Custo Líquido</TableHead>
                        <TableHead>De-Para Vinculado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(docSelecionado.itens || []).map((it) => (
                        <TableRow key={it.nItem}>
                          <TableCell className="font-bold">{it.nItem}</TableCell>
                          <TableCell className="font-mono text-blue-700">{it.cProd}</TableCell>
                          <TableCell className="max-w-[200px] truncate">{it.xProd}</TableCell>
                          <TableCell className="text-right">
                            {it.qCom} {it.uCom}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {new Intl.NumberFormat('pt-BR', {
                              style: 'currency',
                              currency: 'BRL',
                            }).format(it.custoLiquidoAquisicao || it.vProd)}
                          </TableCell>
                          <TableCell>
                            {it.codigoInventario ? (
                              <Badge
                                variant="outline"
                                className="bg-emerald-50 text-emerald-800 border-emerald-200 font-mono text-[10px]"
                              >
                                {it.codigoInventario} (x{it.fatorConversaoAplicado})
                              </Badge>
                            ) : itemNaoVinculado(
                                regrasDesqualificacao,
                                docSelecionado.cnpjEmitente,
                                it.cProd,
                              ) ? (
                              <Badge
                                variant="outline"
                                className="bg-violet-50 text-violet-800 border-violet-300 text-[10px]"
                                title='Item gravado como "não vincular": não gera estoque nem inventário.'
                              >
                                NÃO VINCULAR
                              </Badge>
                            ) : (
                              <Badge variant="destructive" className="text-[10px]">
                                SEM VÍNCULO
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="secondary" onClick={() => setDocSelecionado(null)}>
                Fechar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Modal Espelho da NF-e ("consulta do xml") */}
      {docEspelho && (
        <Dialog open={!!docEspelho} onOpenChange={(aberto) => !aberto && setDocEspelho(null)}>
          <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between gap-2">
                <span className="text-teal-800">Espelho da NF-e nº {docEspelho.numero}</span>
                {getStatusBadge(docEspelho.status)}
              </DialogTitle>
              <DialogDescription className="font-mono text-xs break-all">
                Chave: {docEspelho.chaveAcesso}
              </DialogDescription>
            </DialogHeader>

            <EspelhoNFeDialogBody doc={docEspelho} />

            <DialogFooter>
              <Button variant="secondary" onClick={() => setDocEspelho(null)}>
                Fechar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Modal de confirmação da desqualificação p/ inventário ou "não controla estoque" */}
      <DialogoDesqualificarNota
        doc={docParaDesqualificar}
        modo={modoDesqualificacao}
        onConfirm={() => confirmarDesqualificacao()}
        onCancel={() => setDocParaDesqualificar(null)}
      />

      {/* Confirmação do "Não vincular": regra CNPJ+item gravada, sem de-para */}
      <Dialog
        open={!!docParaNaoVincular}
        onOpenChange={(aberto) => {
          if (!aberto) setDocParaNaoVincular(null)
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Link2Off className="size-4 text-violet-700" aria-hidden="true" />
              Não vincular — NF-e nº {docParaNaoVincular?.numero}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Grava a regra <strong>CNPJ do emitente + item</strong> como "não gera estoque": o
              de-para NÃO é criado, o item NÃO gera estoque e NÃO entra no inventário (fora do
              Kardex e do Bloco H). Notas futuras do mesmo CNPJ + item entram automaticamente
              marcadas.
            </DialogDescription>
          </DialogHeader>
          <div className="text-xs space-y-1 p-3 bg-slate-50 rounded-lg border border-slate-200">
            <div>
              <span className="text-slate-500 font-semibold">Emitente:</span>{' '}
              {docParaNaoVincular?.nomeEmitente} ({docParaNaoVincular?.cnpjEmitente})
            </div>
            <div>
              <span className="text-slate-500 font-semibold">Item(ns):</span>{' '}
              {(docParaNaoVincular?.itens || [])
                .map((i) => i.cProd)
                .filter((v, i, a) => a.indexOf(v) === i)
                .join(', ')}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDocParaNaoVincular(null)}>
              Voltar
            </Button>
            <Button
              size="sm"
              className="bg-violet-700 hover:bg-violet-800 text-white"
              onClick={confirmarNaoVincular}
            >
              Confirmar "Não vincular"
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Modal Cancelamento com Estorno */}
      {docParaCancelar && (
        <Dialog open={!!docParaCancelar} onOpenChange={() => setDocParaCancelar(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-rose-700 flex items-center gap-2">
                <Ban className="size-5" />
                Cancelar e Estornar NF-e nº {docParaCancelar.numero}
              </DialogTitle>
              <DialogDescription className="text-xs">
                O cancelamento gera um evento de estorno imediato no Kardex, com recálculo
                automático de todo o Custo Médio Ponderado e saldos cronológicos posteriores.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2">
              <div>
                <Label htmlFor="motivoCancelamento" className="text-xs font-semibold">
                  Justificativa Legal do Cancelamento *
                </Label>
                <Textarea
                  id="motivoCancelamento"
                  value={justificativaCancelamento}
                  onChange={(e) => setJustificativaCancelamento(e.target.value)}
                  placeholder="Ex: Cancelamento homologado na SEFAZ pelo fornecedor dentro do prazo legal..."
                  className="text-xs mt-1"
                />
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setDocParaCancelar(null)}>
                Desistir
              </Button>
              <Button
                variant="destructive"
                onClick={confirmarCancelamento}
                className="bg-rose-700 hover:bg-rose-800"
              >
                Confirmar Cancelamento e Estorno
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
