import React, { useMemo, useState } from 'react'
import { useSigef } from '@/context/SigefContext'
import {
  CheckCircle2,
  Copy,
  Download,
  FileCode,
  FileSpreadsheet,
  FileText,
  Info,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { gerarSpedTxt } from '@/services/spedGenerator'
import { toast } from 'sonner'

export default function SpedPage() {
  const { empresaAtiva, produtos, kardex, fechamentos } = useSigef()

  const [competencia, setCompetencia] = useState('2025-01')

  const fechamentoAtual = fechamentos.find((f) => f.competencia === competencia)

  // Gera o arquivo SPED TXT completo
  const arquivoSpedTxt = useMemo(() => {
    return gerarSpedTxt({
      empresa: empresaAtiva,
      competencia,
      produtos,
      kardex,
      fechamento: fechamentoAtual,
    })
  }, [empresaAtiva, competencia, produtos, kardex, fechamentoAtual])

  // Download do arquivo TXT
  const baixarArquivoSped = () => {
    const blob = new Blob([arquivoSpedTxt], { type: 'text/plain;charset=windows-1252' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `SPED_${empresaAtiva.cnpj.replace(/\D/g, '')}_${competencia.replace('-', '')}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success('Arquivo SPED EFD-ICMS/IPI (Blocos 0, H e K) baixado com sucesso!')
  }

  const copiarTxtParaClipboard = () => {
    navigator.clipboard.writeText(arquivoSpedTxt)
    toast.success('Conteúdo do arquivo SPED copiado para a área de transferência!')
  }

  // Registros K200 para a prévia
  const itensK200 = produtos.map((p) => {
    const movs = kardex.filter((k) => k.codigoInventario === p.codigoInventario)
    const ultimo = movs[movs.length - 1]
    const qtd = ultimo ? ultimo.saldoQuantidade : 0
    return {
      codigo: p.codigoInventario,
      descricao: p.descricao,
      unidade: p.unidade,
      quantidade: qtd,
    }
  })

  // Registros H010 para a prévia
  const itensH010 = produtos.map((p) => {
    const itemFechado = fechamentoAtual?.itensInventario.find(
      (it) => it.codigoInventario === p.codigoInventario,
    )
    const movs = kardex.filter((k) => k.codigoInventario === p.codigoInventario)
    const ultimo = movs[movs.length - 1]

    const qtd = itemFechado ? itemFechado.quantidadeContada : ultimo ? ultimo.saldoQuantidade : 0
    const custo = ultimo ? ultimo.custoMedioUnitario : 0
    const total = qtd * custo

    return {
      codigo: p.codigoInventario,
      descricao: p.descricao,
      unidade: p.unidade,
      quantidade: qtd,
      custoMedio: custo,
      valorTotal: total,
    }
  })

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            SPED Fiscal — Blocos 0, H e K
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Geração oficial do leiaute EFD-ICMS/IPI: Bloco 0 (Cadastros), Bloco H (Inventário
            Físico) e Bloco K (K010/K200 Controle de Estoque)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={copiarTxtParaClipboard}
            variant="outline"
            size="sm"
            className="text-xs flex items-center gap-1.5"
          >
            <Copy className="size-3.5" />
            <span>Copiar TXT</span>
          </Button>

          <Button
            onClick={baixarArquivoSped}
            size="sm"
            className="bg-blue-700 hover:bg-blue-800 text-xs font-semibold flex items-center gap-1.5"
          >
            <Download className="size-4" />
            <span>Baixar Arquivo SPED (.TXT)</span>
          </Button>
        </div>
      </div>

      {/* Seletor de Competência e Status do Bloco H */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-slate-600">Período de Apuração:</span>
          <select
            value={competencia}
            onChange={(e) => setCompetencia(e.target.value)}
            className="text-xs h-8 border border-slate-300 rounded-md px-2.5 font-bold bg-slate-50"
            aria-label="Selecionar período de apuração SPED"
          >
            <option value="2025-01">01/01/2025 a 31/01/2025 (2025-01)</option>
            <option value="2024-12">01/12/2024 a 31/12/2024 (2024-12)</option>
          </select>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500">Status Bloco H:</span>
          {fechamentoAtual ? (
            <Badge className="bg-emerald-600 text-white flex items-center gap-1 text-[11px]">
              <CheckCircle2 className="size-3" />
              Inventário Fechado
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="text-amber-700 border-amber-300 bg-amber-50 text-[11px]"
            >
              Kardex em Aberto (Valores em Tempo Real)
            </Badge>
          )}
        </div>
      </div>

      {/* Visualizador de Blocos e TXT */}
      <Tabs defaultValue="preview-blocos" className="space-y-4">
        <TabsList className="bg-slate-200/80 p-1">
          <TabsTrigger value="preview-blocos" className="text-xs flex items-center gap-1.5">
            <FileSpreadsheet className="size-3.5" />
            <span>Prévia dos Registros (Blocos H e K)</span>
          </TabsTrigger>
          <TabsTrigger value="txt-completo" className="text-xs flex items-center gap-1.5">
            <FileCode className="size-3.5" />
            <span>Visualizador do Arquivo TXT Oficial</span>
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: Prévia em Tabelas dos Blocos */}
        <TabsContent value="preview-blocos" className="space-y-6">
          {/* Bloco K - Controle de Estoque (K010 e K200) */}
          <Card className="border-slate-200">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <Badge className="bg-purple-700 text-white text-[10px]">BLOCO K</Badge>
                    Controle da Produção e do Estoque — Registros K010 e K200
                  </CardTitle>
                  <CardDescription className="text-xs mt-1">
                    Estoque escriturado na data de encerramento do período de apuração (Ato
                    COTEPE/ICMS nº 44/2018)
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="text-xs">
                      <TableHead>Registro</TableHead>
                      <TableHead>Data Estoque (DT_EST)</TableHead>
                      <TableHead>Código Item (COD_ITEM)</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Unid.</TableHead>
                      <TableHead className="text-right">Qtd Escriturada (QTD)</TableHead>
                      <TableHead>Indicador Propriedade (IND_EST)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {itensK200.map((it) => (
                      <TableRow key={it.codigo} className="text-xs font-medium">
                        <TableCell className="font-mono font-bold text-purple-800">
                          |K200|
                        </TableCell>
                        <TableCell className="font-mono text-slate-600">31/01/2025</TableCell>
                        <TableCell className="font-mono font-bold text-blue-700">
                          {it.codigo}
                        </TableCell>
                        <TableCell className="max-w-[220px] truncate">{it.descricao}</TableCell>
                        <TableCell className="font-bold">{it.unidade}</TableCell>
                        <TableCell className="text-right font-mono font-bold">
                          {it.quantidade.toFixed(3)}
                        </TableCell>
                        <TableCell className="text-slate-600">
                          0 - Próprio em poder do declarante
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Bloco H - Inventário Físico (H005 e H010) */}
          <Card className="border-slate-200">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <Badge className="bg-emerald-700 text-white text-[10px]">BLOCO H</Badge>
                    Inventário Físico Escriturado — Registros H005 e H010
                  </CardTitle>
                  <CardDescription className="text-xs mt-1">
                    Totalização e valoração ao Custo Médio Ponderado para encerramento fiscal do
                    período
                  </CardDescription>
                </div>
                <div className="text-right font-bold text-emerald-800 text-sm">
                  Total:{' '}
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                    itensH010.reduce((s, it) => s + it.valorTotal, 0),
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="text-xs">
                      <TableHead>Registro</TableHead>
                      <TableHead>Código do Item</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Unid.</TableHead>
                      <TableHead className="text-right">Qtd Inventariada</TableHead>
                      <TableHead className="text-right">Custo Unitário (CMP)</TableHead>
                      <TableHead className="text-right">Valor Total do Item</TableHead>
                      <TableHead>Ind. Propriedade</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {itensH010.map((it) => (
                      <TableRow key={it.codigo} className="text-xs font-medium">
                        <TableCell className="font-mono font-bold text-emerald-800">
                          |H010|
                        </TableCell>
                        <TableCell className="font-mono font-bold text-blue-700">
                          {it.codigo}
                        </TableCell>
                        <TableCell className="max-w-[220px] truncate">{it.descricao}</TableCell>
                        <TableCell className="font-bold">{it.unidade}</TableCell>
                        <TableCell className="text-right font-mono font-bold">
                          {it.quantidade.toFixed(3)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {new Intl.NumberFormat('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          }).format(it.custoMedio)}
                        </TableCell>
                        <TableCell className="text-right font-mono font-bold text-emerald-900">
                          {new Intl.NumberFormat('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          }).format(it.valorTotal)}
                        </TableCell>
                        <TableCell className="text-slate-600">0 - Em seu poder</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: Visualizador de TXT Puro */}
        <TabsContent value="txt-completo">
          <Card className="border-slate-200">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <FileText className="size-4 text-slate-700" />
                  Arquivo EFD-ICMS/IPI Gerado em Leiaute Oficial Guia Prático
                </CardTitle>
                <CardDescription className="text-xs">
                  Separador por barras (|), codificação Windows-1252 / UTF-8 compatível com o
                  Validador PVA RFB
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={copiarTxtParaClipboard}
                  className="text-xs"
                >
                  <Copy className="size-3.5 mr-1" />
                  Copiar
                </Button>
                <Button
                  size="sm"
                  onClick={baixarArquivoSped}
                  className="bg-blue-700 hover:bg-blue-800 text-xs"
                >
                  <Download className="size-3.5 mr-1" />
                  Baixar TXT
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="bg-slate-900 text-emerald-400 p-4 rounded-lg font-mono text-xs overflow-x-auto max-h-[500px] border border-slate-800">
                <pre>{arquivoSpedTxt}</pre>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
