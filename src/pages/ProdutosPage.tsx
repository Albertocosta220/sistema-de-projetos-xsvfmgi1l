import React, { useState } from 'react'
import { useSigef } from '@/context/SigefContext'
import { useAuth } from '@/context/AuthContext'
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  FileCheck,
  Layers,
  Link as LinkIcon,
  Package,
  Plus,
  Trash2,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { Produto } from '@/types/sigef'
import { CNPJ_REGRA_CFOP_LEGADO } from '@/services/regrasCfopService'
import {
  lerPlanilhaSucatas,
  ResultadoImportacaoPlanilha,
} from '@/services/importacaoPlanilhaService'
import { FileSpreadsheet } from 'lucide-react'
import { useRef } from 'react'

/** Regras CFOP legadas salvas como de-para não pertencem ao catálogo nem à tabela de de-para */
const naoEhRegraCfop = (dp: { cProd: string; cnpjFornecedor: string }) =>
  !(
    dp.cProd.trim().toUpperCase().startsWith('CFOP-') &&
    dp.cnpjFornecedor.replace(/\D/g, '') === CNPJ_REGRA_CFOP_LEGADO
  )

export default function ProdutosPage() {
  const {
    produtos,
    deParaList: deParaListBruta,
    documentos,
    cadastrarProduto,
    editarProduto,
    excluirProduto,
    salvarDePara,
    excluirDePara,
    importarProdutosPlanilha,
  } = useSigef()
  const { temPermissao } = useAuth()
  const podeExcluir = temPermissao('acao-excluir-registros')
  const podeImportar = temPermissao('acao-criar-produto')

  const deParaList = deParaListBruta.filter(naoEhRegraCfop)

  // Importação de planilha (Sucatas Cadastro)
  const inputPlanilhaRef = useRef<HTMLInputElement>(null)
  const [importando, setImportando] = useState(false)
  const [resumoImportacao, setResumoImportacao] = useState<ResultadoImportacaoPlanilha | null>(null)

  const processarArquivoPlanilha = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // permite reimportar o mesmo arquivo
    if (!file) return
    setImportando(true)
    try {
      const resultado = await lerPlanilhaSucatas(file)
      const r = importarProdutosPlanilha(resultado.produtos, {
        itensParaRevisao: resultado.itensParaRevisao,
        abaUtilizada: resultado.abaUtilizada,
      })
      setResumoImportacao(resultado)
      if (r.importados === 0) {
        toast.info(`Nenhum produto novo importado (${r.ignorados} já existente(s)).`)
      }
    } catch (err) {
      console.error(err)
      toast.error(
        err instanceof Error ? err.message : 'Falha ao ler a planilha. Verifique o formato.',
      )
    } finally {
      setImportando(false)
    }
  }

  // Estado para Produto Modal
  const [modalProdutoOpen, setModalProdutoOpen] = useState(false)
  const [produtoEditando, setProdutoEditando] = useState<Produto | null>(null)
  const [formProduto, setFormProduto] = useState<Produto>({
    codigoInventario: '',
    descricao: '',
    ncm: '',
    cstIcms: '000',
    cstPisCofins: '01',
    unidade: 'KG',
    fatorConversaoPadrao: 1.0,
    aliquotaIcms: 18.0,
    aliquotaPis: 1.65,
    aliquotaCofins: 7.6,
    aliquotaIbs: 1.0,
    aliquotaCbs: 0.9,
  })

  // Estado para De-Para Modal
  const [modalDeParaOpen, setModalDeParaOpen] = useState(false)
  const [formDePara, setFormDePara] = useState({
    cnpjFornecedor: '',
    razaoSocialFornecedor: '',
    cProd: '',
    xProd: '',
    uCom: 'UN',
    fatorConversao: 1.0,
    codigoInventario: '',
  })

  // Encontrar itens de NF-e que estão pendentes de De-Para (AGUARDANDO_DE_PARA)
  interface ItemPendente {
    docId: string
    nNF: string
    cnpjEmit: string
    nomeEmit: string
    nItem: number
    cProd: string
    xProd: string
    uCom: string
    qCom: number
  }

  const pendenciasDePara: ItemPendente[] = []
  documentos.forEach((doc) => {
    if (doc.status === 'AGUARDANDO_DE_PARA') {
      doc.itens.forEach((it) => {
        if (!it.codigoInventario) {
          pendenciasDePara.push({
            docId: doc.id,
            nNF: doc.numero,
            cnpjEmit: doc.cnpjEmitente,
            nomeEmit: doc.nomeEmitente,
            nItem: it.nItem,
            cProd: it.cProd,
            xProd: it.xProd,
            uCom: it.uCom,
            qCom: it.qCom,
          })
        }
      })
    }
  })

  const abrirNovoProduto = () => {
    setProdutoEditando(null)
    setFormProduto({
      codigoInventario: '',
      descricao: '',
      ncm: '',
      cstIcms: '000',
      cstPisCofins: '01',
      unidade: 'KG',
      fatorConversaoPadrao: 1.0,
      aliquotaIcms: 18.0,
      aliquotaPis: 1.65,
      aliquotaCofins: 7.6,
      aliquotaIbs: 1.0,
      aliquotaCbs: 0.9,
    })
    setModalProdutoOpen(true)
  }

  const abrirEditarProduto = (p: Produto) => {
    setProdutoEditando(p)
    setFormProduto({ ...p })
    setModalProdutoOpen(true)
  }

  const salvarFormProduto = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formProduto.codigoInventario.trim() || !formProduto.descricao.trim()) {
      toast.error('Informe o código e a descrição do produto.')
      return
    }
    if (produtoEditando) {
      editarProduto(formProduto)
    } else {
      cadastrarProduto(formProduto)
    }
    setModalProdutoOpen(false)
  }

  const abrirDeParaParaPendente = (item: ItemPendente) => {
    setFormDePara({
      cnpjFornecedor: item.cnpjEmit,
      razaoSocialFornecedor: item.nomeEmit,
      cProd: item.cProd,
      xProd: item.xProd,
      uCom: item.uCom,
      fatorConversao: 1.0,
      codigoInventario: produtos[0]?.codigoInventario || '',
    })
    setModalDeParaOpen(true)
  }

  const salvarFormDePara = (e: React.FormEvent) => {
    e.preventDefault()
    if (
      !formDePara.cnpjFornecedor.trim() ||
      !formDePara.cProd.trim() ||
      !formDePara.codigoInventario.trim()
    ) {
      toast.error('Preencha os campos obrigatórios (CNPJ, cProd e Código de Inventário).')
      return
    }
    salvarDePara(formDePara)
    setModalDeParaOpen(false)
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Catálogo de Produtos & De-Para Fiscal
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Mapeamento de 2 campos (CNPJ Fornecedor + cProd → Código Inventário), NCM, CST e fatores
            de conversão
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            ref={inputPlanilhaRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={processarArquivoPlanilha}
            aria-hidden="true"
            tabIndex={-1}
          />
          {podeImportar && (
            <Button
              onClick={() => inputPlanilhaRef.current?.click()}
              size="sm"
              className="bg-[#0E7C86] hover:bg-[#0B636B] text-white text-xs flex items-center gap-1.5"
              disabled={importando}
            >
              <FileSpreadsheet className="size-4" />
              <span>{importando ? 'Importando…' : 'Importar planilha'}</span>
            </Button>
          )}
          <Button
            onClick={abrirNovoProduto}
            size="sm"
            className="bg-blue-700 hover:bg-blue-800 text-xs flex items-center gap-1.5"
          >
            <Plus className="size-4" />
            <span>Novo Produto</span>
          </Button>
          <Button
            onClick={() => {
              setFormDePara({
                cnpjFornecedor: '',
                razaoSocialFornecedor: '',
                cProd: '',
                xProd: '',
                uCom: 'UN',
                fatorConversao: 1.0,
                codigoInventario: produtos[0]?.codigoInventario || '',
              })
              setModalDeParaOpen(true)
            }}
            variant="outline"
            size="sm"
            className="text-xs flex items-center gap-1.5"
          >
            <LinkIcon className="size-3.5" />
            <span>Novo De-Para Manual</span>
          </Button>
        </div>
      </div>

      {/* Resumo da última importação de planilha */}
      {resumoImportacao && (
        <div className="p-4 bg-teal-50 border border-teal-300 rounded-xl flex items-start gap-3 text-teal-900">
          <FileSpreadsheet className="size-5 text-teal-700 shrink-0 mt-0.5" />
          <div className="text-xs sm:text-sm">
            <span className="font-bold">
              Planilha "{resumoImportacao.abaUtilizada}" lida: {resumoImportacao.produtos.length}{' '}
              item(ns) válido(s) de {resumoImportacao.totalLinhas} linha(s).
            </span>
            <p className="text-teal-800 mt-0.5">
              {resumoImportacao.itensParaRevisao > 0
                ? `${resumoImportacao.itensParaRevisao} item(ns) sinalizado(s) para revisão fiscal (marcados "SEM CORRESPONDÊNCIA" ou com NCM/unidade ausentes) — ocorrência registrada na Auditoria (régua A13).`
                : 'Nenhum item sinalizado para revisão.'}
            </p>
          </div>
        </div>
      )}

      {/* Alerta de Pendências de De-Para se existirem */}
      {pendenciasDePara.length > 0 && (
        <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-900">
          <div className="flex items-start gap-3">
            <AlertTriangle className="size-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs sm:text-sm">
              <span className="font-bold">
                Existem {pendenciasDePara.length} item(ns) aguardando vínculo De-Para!
              </span>
              <p className="text-amber-800 mt-0.5">
                Vincule o código do fornecedor ao catálogo interno para que as NF-e sejam liberadas
                e processadas no Kardex.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            className="bg-amber-600 hover:bg-amber-700 text-white text-xs shrink-0"
            onClick={() => abrirDeParaParaPendente(pendenciasDePara[0])}
          >
            Resolver Pendência Agora
          </Button>
        </div>
      )}

      {/* Tabs Principais */}
      <Tabs defaultValue="pendencias" className="space-y-4">
        <TabsList className="bg-slate-200/80 p-1">
          <TabsTrigger value="pendencias" className="text-xs flex items-center gap-1.5">
            <AlertTriangle className="size-3.5 text-amber-600" />
            <span>Pendências de De-Para ({pendenciasDePara.length})</span>
          </TabsTrigger>
          <TabsTrigger value="produtos" className="text-xs flex items-center gap-1.5">
            <Package className="size-3.5" />
            <span>Catálogo de Produtos ({produtos.length})</span>
          </TabsTrigger>
          <TabsTrigger value="depara" className="text-xs flex items-center gap-1.5">
            <LinkIcon className="size-3.5" />
            <span>Tabela De-Para Vigente ({deParaList.length})</span>
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: PENDÊNCIAS */}
        <TabsContent value="pendencias" className="space-y-4">
          <Card className="border-slate-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold">
                Itens de NF-e sem De-Para Mapeado (Regra A02)
              </CardTitle>
              <CardDescription className="text-xs">
                Ao salvar o vínculo (CNPJ + cProd → código de inventário), as notas fiscais
                bloqueadas são automaticamente reenfileiradas e escrituradas no Kardex.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {pendenciasDePara.length === 0 ? (
                <div className="text-center py-12 flex flex-col items-center justify-center gap-2">
                  <CheckCircle2 className="size-10 text-emerald-600" />
                  <div className="font-bold text-slate-800 text-sm">
                    Nenhuma pendência de De-Para!
                  </div>
                  <div className="text-xs text-slate-500 max-w-sm">
                    Todas as mercadorias recebidas dos fornecedores possuem relacionamento com o
                    catálogo de inventário.
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>NF-e</TableHead>
                        <TableHead>Fornecedor (CNPJ)</TableHead>
                        <TableHead>Código Fornecedor (cProd)</TableHead>
                        <TableHead>Descrição da Nota (xProd)</TableHead>
                        <TableHead>Unid.</TableHead>
                        <TableHead className="text-right">Ação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendenciasDePara.map((it, idx) => (
                        <TableRow key={`${it.docId}-${it.cProd}-${idx}`} className="bg-amber-50/30">
                          <TableCell className="font-bold text-xs">NF {it.nNF}</TableCell>
                          <TableCell className="text-xs">
                            <div className="font-medium text-slate-800 truncate max-w-[180px]">
                              {it.nomeEmit}
                            </div>
                            <div className="font-mono text-[10px] text-slate-400">
                              {it.cnpjEmit}
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-xs font-bold text-amber-800">
                            {it.cProd}
                          </TableCell>
                          <TableCell className="text-xs max-w-[220px] truncate">
                            {it.xProd}
                          </TableCell>
                          <TableCell className="text-xs">{it.uCom}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              className="h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white"
                              onClick={() => abrirDeParaParaPendente(it)}
                            >
                              <span>Vincular De-Para</span>
                              <ArrowRight className="size-3 ml-1" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: CATÁLOGO DE PRODUTOS */}
        <TabsContent value="produtos" className="space-y-4">
          <Card className="border-slate-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold">
                Produtos Escriturados no Inventário ({produtos.length})
              </CardTitle>
              <CardDescription className="text-xs">
                Cadastro interno de mercadorias com alíquotas fiscais, NCM, CST e tributos da
                Reforma (IBS/CBS)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código Inventário</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>NCM</TableHead>
                      <TableHead>CST</TableHead>
                      <TableHead>Unid.</TableHead>
                      <TableHead className="text-right">Fator Padrão</TableHead>
                      <TableHead className="text-right">Tributos Dedutíveis</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {produtos.map((p) => (
                      <TableRow key={p.codigoInventario}>
                        <TableCell className="font-mono text-xs font-bold text-blue-800">
                          {p.codigoInventario}
                        </TableCell>
                        <TableCell className="text-xs font-medium max-w-[240px]">
                          <div className="flex flex-col gap-1">
                            <span>{p.descricao}</span>
                            {p.revisar && (
                              <Badge
                                variant="outline"
                                className="w-fit border-amber-400 bg-amber-50 text-amber-800 text-[10px] gap-1"
                                title={p.observacaoImportacao}
                              >
                                <AlertTriangle className="size-3" />
                                <span>Revisar</span>
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-slate-600">{p.ncm}</TableCell>
                        <TableCell className="text-xs">
                          <span className="font-mono text-[11px] text-slate-700">
                            ICMS: {p.cstIcms}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs font-bold">{p.unidade}</TableCell>
                        <TableCell className="text-right text-xs">
                          {p.fatorConversaoPadrao}
                        </TableCell>
                        <TableCell className="text-right text-[11px] text-slate-600">
                          ICMS {p.aliquotaIcms}% • PIS/COF{' '}
                          {(p.aliquotaPis + p.aliquotaCofins).toFixed(2)}%
                          <div className="text-[10px] text-emerald-700">
                            IBS/CBS {(p.aliquotaIbs + p.aliquotaCbs).toFixed(1)}% (Reforma)
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-blue-700"
                              onClick={() => abrirEditarProduto(p)}
                            >
                              Editar
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-rose-600 hover:bg-rose-50"
                              onClick={() => excluirProduto(p.codigoInventario)}
                              disabled={!podeExcluir}
                              aria-label={`Excluir produto ${p.descricao}`}
                              title={
                                podeExcluir
                                  ? 'Excluir produto'
                                  : 'Sem permissão: exige a ação "Excluir registros" no perfil'
                              }
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: DE-PARA VIGENTE */}
        <TabsContent value="depara" className="space-y-4">
          <Card className="border-slate-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold">
                Tabela de De-Para Vigente ({deParaList.length} Relações)
              </CardTitle>
              <CardDescription className="text-xs">
                Mapeamento por CNPJ do Fornecedor + Código cProd do Fornecedor → Código Inventário
                Interno
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>CNPJ Fornecedor</TableHead>
                      <TableHead>Fornecedor</TableHead>
                      <TableHead>Código Fornecedor (cProd)</TableHead>
                      <TableHead>Descrição Fornecedor</TableHead>
                      <TableHead className="text-center">Fator</TableHead>
                      <TableHead>Código Inventário Interno</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deParaList.map((dp) => (
                      <TableRow key={dp.id}>
                        <TableCell className="font-mono text-xs">{dp.cnpjFornecedor}</TableCell>
                        <TableCell className="text-xs font-medium max-w-[180px] truncate">
                          {dp.razaoSocialFornecedor || 'FORNECEDOR CADASTRADO'}
                        </TableCell>
                        <TableCell className="font-mono text-xs font-bold text-amber-900">
                          {dp.cProd}
                        </TableCell>
                        <TableCell className="text-xs max-w-[200px] truncate">{dp.xProd}</TableCell>
                        <TableCell className="text-center text-xs font-mono font-bold">
                          x{dp.fatorConversao}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className="bg-blue-50 text-blue-800 border-blue-200 font-mono text-xs font-bold"
                          >
                            {dp.codigoInventario}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-rose-600 hover:bg-rose-50"
                            onClick={() => excluirDePara(dp.id)}
                            disabled={!podeExcluir}
                            aria-label={`Excluir de-para ${dp.cProd}`}
                            title={
                              podeExcluir
                                ? 'Excluir relação de-para'
                                : 'Sem permissão: exige a ação "Excluir registros" no perfil'
                            }
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal Cadastro/Edição de Produto */}
      <Dialog open={modalProdutoOpen} onOpenChange={setModalProdutoOpen}>
        <DialogContent className="max-w-lg">
          <form onSubmit={salvarFormProduto}>
            <DialogHeader>
              <DialogTitle>
                {produtoEditando ? 'Editar Produto' : 'Cadastrar Novo Produto de Inventário'}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Defina o código interno, NCM, unidade de estoque e parâmetros de cálculo fiscal.
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-2 gap-3 py-3 text-xs">
              <div className="col-span-2 sm:col-span-1">
                <Label htmlFor="codInv">Código Inventário *</Label>
                <Input
                  id="codInv"
                  value={formProduto.codigoInventario}
                  onChange={(e) =>
                    setFormProduto({
                      ...formProduto,
                      codigoInventario: e.target.value.toUpperCase(),
                    })
                  }
                  placeholder="Ex: MET-ALU-001"
                  disabled={!!produtoEditando}
                  required
                  className="font-mono text-xs uppercase mt-1"
                />
              </div>

              <div className="col-span-2 sm:col-span-1">
                <Label htmlFor="unidade">Unidade de Medida *</Label>
                <Input
                  id="unidade"
                  value={formProduto.unidade}
                  onChange={(e) =>
                    setFormProduto({ ...formProduto, unidade: e.target.value.toUpperCase() })
                  }
                  placeholder="KG, UN, MT, TON"
                  required
                  className="text-xs uppercase mt-1"
                />
              </div>

              <div className="col-span-2">
                <Label htmlFor="desc">Descrição Completa da Mercadoria *</Label>
                <Input
                  id="desc"
                  value={formProduto.descricao}
                  onChange={(e) =>
                    setFormProduto({ ...formProduto, descricao: e.target.value.toUpperCase() })
                  }
                  placeholder="Ex: BARRA CHATA DE ALUMINIO EXTRUDADO 6063 T6"
                  required
                  className="text-xs uppercase mt-1"
                />
              </div>

              <div>
                <Label htmlFor="ncm">NCM (8 dígitos) *</Label>
                <Input
                  id="ncm"
                  value={formProduto.ncm}
                  onChange={(e) => setFormProduto({ ...formProduto, ncm: e.target.value })}
                  placeholder="76042919"
                  required
                  className="font-mono text-xs mt-1"
                />
              </div>

              <div>
                <Label htmlFor="cstIcms">CST ICMS *</Label>
                <Input
                  id="cstIcms"
                  value={formProduto.cstIcms}
                  onChange={(e) => setFormProduto({ ...formProduto, cstIcms: e.target.value })}
                  placeholder="000, 020, 040"
                  required
                  className="font-mono text-xs mt-1"
                />
              </div>

              <div>
                <Label htmlFor="fator">Fator de Conversão Padrão</Label>
                <Input
                  id="fator"
                  type="number"
                  step="0.001"
                  min="0.001"
                  value={formProduto.fatorConversaoPadrao}
                  onChange={(e) =>
                    setFormProduto({
                      ...formProduto,
                      fatorConversaoPadrao: parseFloat(e.target.value) || 1.0,
                    })
                  }
                  required
                  className="text-xs mt-1"
                />
              </div>

              <div>
                <Label htmlFor="aliqIcms">Alíquota ICMS (%)</Label>
                <Input
                  id="aliqIcms"
                  type="number"
                  step="0.1"
                  value={formProduto.aliquotaIcms}
                  onChange={(e) =>
                    setFormProduto({
                      ...formProduto,
                      aliquotaIcms: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="text-xs mt-1"
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalProdutoOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="bg-blue-700 hover:bg-blue-800">
                Salvar Produto
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Cadastro de De-Para */}
      <Dialog open={modalDeParaOpen} onOpenChange={setModalDeParaOpen}>
        <DialogContent className="max-w-lg">
          <form onSubmit={salvarFormDePara}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <LinkIcon className="size-5 text-blue-700" />
                Vincular De-Para de Mercadoria
              </DialogTitle>
              <DialogDescription className="text-xs">
                Mapeamento exato de 2 campos: CNPJ do emitente + código cProd do fornecedor →
                produto interno.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-3 text-xs">
              <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-blue-900">
                <span className="font-bold">Efeito Imediato:</span> Ao salvar este vínculo, todas as
                NF-e que estavam aguardando este item serão liberadas e o Kardex será recalculado
                automaticamente.
              </div>

              <div>
                <Label htmlFor="dpCnpj">CNPJ do Fornecedor *</Label>
                <Input
                  id="dpCnpj"
                  value={formDePara.cnpjFornecedor}
                  onChange={(e) => setFormDePara({ ...formDePara, cnpjFornecedor: e.target.value })}
                  placeholder="00.000.000/0000-00"
                  required
                  className="font-mono text-xs mt-1"
                />
              </div>

              <div>
                <Label htmlFor="dpcProd">Código do Fornecedor na NF-e (cProd) *</Label>
                <Input
                  id="dpcProd"
                  value={formDePara.cProd}
                  onChange={(e) => setFormDePara({ ...formDePara, cProd: e.target.value })}
                  placeholder="Ex: INOX-NOVO-COD-99"
                  required
                  className="font-mono text-xs font-bold mt-1"
                />
              </div>

              <div>
                <Label htmlFor="dpxProd">Descrição no Fornecedor (xProd)</Label>
                <Input
                  id="dpxProd"
                  value={formDePara.xProd}
                  onChange={(e) => setFormDePara({ ...formDePara, xProd: e.target.value })}
                  placeholder="Descrição da mercadoria"
                  className="text-xs mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="dpFator">Fator de Conversão</Label>
                  <Input
                    id="dpFator"
                    type="number"
                    step="0.001"
                    min="0.001"
                    value={formDePara.fatorConversao}
                    onChange={(e) =>
                      setFormDePara({
                        ...formDePara,
                        fatorConversao: parseFloat(e.target.value) || 1.0,
                      })
                    }
                    required
                    className="text-xs mt-1"
                  />
                  <span className="text-[10px] text-slate-400">
                    Ex: 1 barra = 6 metros (fator 6.0)
                  </span>
                </div>

                <div>
                  <Label htmlFor="dpCodInv">Produto Interno no Inventário *</Label>
                  <select
                    id="dpCodInv"
                    value={formDePara.codigoInventario}
                    onChange={(e) =>
                      setFormDePara({ ...formDePara, codigoInventario: e.target.value })
                    }
                    className="w-full text-xs h-9 border border-slate-300 rounded-md px-2 bg-white font-mono font-bold mt-1"
                    required
                  >
                    {produtos.map((p) => (
                      <option key={p.codigoInventario} value={p.codigoInventario}>
                        {p.codigoInventario} - {p.descricao.substring(0, 30)}...
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalDeParaOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="bg-blue-700 hover:bg-blue-800">
                Salvar Vínculo & Reenfileirar Notas
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
