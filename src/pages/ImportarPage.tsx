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
  FolderOpen,
  Info,
  RefreshCw,
  Search,
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
import { toast } from 'sonner'
import { DocumentoFiscal } from '@/types/sigef'

export default function ImportarPage() {
  const { documentos, importarXmlsEmLote, cancelarNFe, reprocessarNotas } = useSigef()

  const [textoXmlColado, setTextoXmlColado] = useState('')
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<string>('TODOS')

  // Modais
  const [docSelecionado, setDocSelecionado] = useState<DocumentoFiscal | null>(null)
  const [docParaCancelar, setDocParaCancelar] = useState<DocumentoFiscal | null>(null)
  const [justificativaCancelamento, setJustificativaCancelamento] = useState('')

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
      const res = importarXmlsEmLote(xmlStrings)
      toast.success(
        `Processamento finalizado: ${res.importados} importado(s), ${res.duplicados} em duplicidade (A01), ${res.pendentesDePara} aguardando de-para (A02).`,
      )
    })
  }

  const handleImportarTextoColado = () => {
    if (!textoXmlColado.trim()) {
      toast.error('Cole o conteúdo XML da NF-e para importar.')
      return
    }
    const res = importarXmlsEmLote([textoXmlColado])
    setTextoXmlColado('')
    toast.success(
      `XML importado! Processados: ${res.importados}, Aguardando De-Para: ${res.pendentesDePara}, Duplicados: ${res.duplicados}`,
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
    <div className="space-y-6">
      {/* Título da tela */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Importação & Fila de Documentos Fiscais
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Varredura recursiva de pasta, upload em lote de XMLs de NF-e e gerenciamento da fila
            cronológica
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={reprocessarNotas}
            className="flex items-center gap-1.5"
          >
            <RefreshCw className="size-3.5" />
            <span>Reprocessar Fila</span>
          </Button>
        </div>
      </div>

      {/* Áreas de Importação */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upload em lote e Varredura de Pasta */}
        <Card className="lg:col-span-2 border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Upload className="size-4 text-blue-700" />
              Upload de Arquivos XML de NF-e
            </CardTitle>
            <CardDescription className="text-xs">
              Selecione múltiplos arquivos XML ou aponte uma pasta inteira de notas do seu
              computador
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Botão Upload em Lote */}
              <div
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') fileInputLoteRef.current?.click()
                }}
                onClick={() => fileInputLoteRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-xl p-5 text-center cursor-pointer transition-colors bg-slate-50 hover:bg-blue-50/50 flex flex-col items-center justify-center gap-2"
              >
                <div className="size-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center">
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
                className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-xl p-5 text-center cursor-pointer transition-colors bg-slate-50 hover:bg-emerald-50/50 flex flex-col items-center justify-center gap-2"
              >
                <div className="size-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
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
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <FileCode className="size-4 text-slate-700" />
              Colar XML de NF-e
            </CardTitle>
            <CardDescription className="text-xs">
              Cole o texto cru da tag &lt;nfeProc&gt; ou &lt;NFe&gt;
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              value={textoXmlColado}
              onChange={(e) => setTextoXmlColado(e.target.value)}
              placeholder="Cole o código XML da NF-e aqui..."
              className="text-[11px] font-mono h-32 resize-none"
            />
            <Button
              type="button"
              onClick={handleImportarTextoColado}
              size="sm"
              className="w-full bg-slate-900 hover:bg-slate-800 text-xs"
            >
              Processar XML Colado
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Fila de Documentos Fiscais */}
      <Card className="border-slate-200">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-bold">
                Fila de Processamento Cronológico ({documentos.length} Documentos)
              </CardTitle>
              <CardDescription className="text-xs">
                Status: PENDENTE, PROCESSADO, AGUARDANDO_DE_PARA, DUPLICIDADE, CANCELADO ou ERRO
              </CardDescription>
            </div>

            {/* Filtros e Busca */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-48 sm:w-60">
                <Search className="size-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                <Input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar NF, Chave, Emitente..."
                  className="pl-8 text-xs h-8"
                />
              </div>

              <select
                value={filtroStatus}
                onChange={(e) => setFiltroStatus(e.target.value)}
                className="text-xs h-8 border border-slate-300 rounded-md px-2 bg-white"
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
        <CardContent>
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
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Operação</TableHead>
                    <TableHead>NF-e / Série</TableHead>
                    <TableHead>Emissão</TableHead>
                    <TableHead>Emitente / Fornecedor</TableHead>
                    <TableHead className="text-right">Valor Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {docsFiltrados.map((doc) => {
                    const isAguardando = doc.status === 'AGUARDANDO_DE_PARA'
                    return (
                      <TableRow
                        key={doc.id}
                        className={isAguardando ? 'bg-amber-50/40' : undefined}
                      >
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`text-[10px] font-bold ${
                              doc.tipoOperacao === 'ENTRADA'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : 'bg-blue-50 text-blue-800 border-blue-200'
                            }`}
                          >
                            {doc.tipoOperacao}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="font-bold text-xs text-slate-900">
                            Nº {doc.numero} (série {doc.serie})
                          </div>
                          <div className="font-mono text-[10px] text-slate-400 truncate max-w-[150px]">
                            {doc.chaveAcesso}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs whitespace-nowrap text-slate-600">
                          {new Date(doc.dataEmissao).toLocaleDateString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </TableCell>
                        <TableCell className="text-xs">
                          <div className="font-medium text-slate-800 truncate max-w-[200px]">
                            {doc.nomeEmitente}
                          </div>
                          <div className="text-[10px] text-slate-400">{doc.cnpjEmitente}</div>
                        </TableCell>
                        <TableCell className="text-right text-xs font-bold text-slate-900 whitespace-nowrap">
                          {new Intl.NumberFormat('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          }).format(doc.valorTotal)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {getStatusBadge(doc.status)}
                          {doc.motivoErro && (
                            <div className="text-[10px] text-rose-600 mt-0.5 truncate max-w-[160px]">
                              {doc.motivoErro}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            {isAguardando && (
                              <Button
                                asChild
                                size="sm"
                                className="h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white"
                              >
                                <Link to="/produtos">
                                  <span>Resolver De-Para</span>
                                  <ArrowRight className="size-3 ml-1" />
                                </Link>
                              </Button>
                            )}

                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => setDocSelecionado(doc)}
                            >
                              Ver Detalhes
                            </Button>

                            {doc.status !== 'CANCELADO' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs text-rose-600 hover:text-rose-800 hover:bg-rose-50"
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
                  Itens do Documento Fiscal ({docSelecionado.itens.length}):
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
                      {docSelecionado.itens.map((it) => (
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
