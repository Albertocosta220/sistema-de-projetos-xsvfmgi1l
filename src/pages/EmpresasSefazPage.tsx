import React, { useState } from 'react'
import { useSigef } from '@/context/SigefContext'
import {
  AlertOctagon,
  AlertTriangle,
  Building2,
  CheckCircle2,
  Clock,
  Globe,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Zap,
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
import { Empresa, SituacaoCadastral } from '@/types/sigef'
import { toast } from 'sonner'

export default function EmpresasSefazPage() {
  const {
    empresas,
    empresaAtiva,
    trocarEmpresaAtiva,
    cadastrarOuEditarEmpresa,
    consultasDFe,
    ultimoNSU,
    executarConsultaDFe,
  } = useSigef()

  // Estado para cadastro/edição de empresa
  const [modalEmpresaOpen, setModalEmpresaOpen] = useState(false)
  const [empresaEditando, setEmpresaEditando] = useState<Empresa | null>(null)
  const [formEmpresa, setFormEmpresa] = useState<Empresa>({
    id: '',
    razaoSocial: '',
    nomeFantasia: '',
    cnpj: '',
    inscricaoEstadual: '',
    uf: 'SP',
    situacaoCadastral: 'ATIVA',
    bloquearFechamento: false,
    motivoBloqueio: '',
  })

  // UF para consulta simulada DF-e
  const [ufConsulta, setUfConsulta] = useState(empresaAtiva.uf || 'SP')
  const [consultando, setConsultando] = useState(false)

  const abrirNovaEmpresa = () => {
    setEmpresaEditando(null)
    setFormEmpresa({
      id: `emp-${Date.now()}`,
      razaoSocial: '',
      nomeFantasia: '',
      cnpj: '',
      inscricaoEstadual: '',
      uf: 'SP',
      situacaoCadastral: 'ATIVA',
      bloquearFechamento: false,
      motivoBloqueio: '',
    })
    setModalEmpresaOpen(true)
  }

  const abrirEditarEmpresa = (emp: Empresa) => {
    setEmpresaEditando(emp)
    setFormEmpresa({ ...emp })
    setModalEmpresaOpen(true)
  }

  const salvarFormEmpresa = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formEmpresa.nomeFantasia.trim() || !formEmpresa.cnpj.trim()) {
      toast.error('Preencha os campos obrigatórios da empresa.')
      return
    }

    const bloqueioAuto =
      formEmpresa.situacaoCadastral !== 'ATIVA' ? true : formEmpresa.bloquearFechamento

    const motivoFinal =
      formEmpresa.situacaoCadastral !== 'ATIVA' && !formEmpresa.motivoBloqueio
        ? `Empresa com situação cadastral ${formEmpresa.situacaoCadastral} perante a Receita Federal (Art. 40 da IN RFB nº 2.119/2022). Fechamento bloqueado.`
        : formEmpresa.motivoBloqueio

    cadastrarOuEditarEmpresa({
      ...formEmpresa,
      bloquearFechamento: bloqueioAuto,
      motivoBloqueio: motivoFinal,
    })
    setModalEmpresaOpen(false)
  }

  const dispararConsultaDFe = (forcarConsumoIndevido?: boolean) => {
    setConsultando(true)
    setTimeout(() => {
      executarConsultaDFe(ufConsulta, forcarConsumoIndevido)
      setConsultando(false)
    }, 400)
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Empresas & Consulta DF-e SEFAZ (Simulada)
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Isolamento multiempresa, controle de NSU por UF e retornos simulados (137, 138, 656)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={abrirNovaEmpresa}
            size="sm"
            className="bg-blue-700 hover:bg-blue-800 text-xs flex items-center gap-1.5"
          >
            <Plus className="size-4" />
            <span>Cadastrar Empresa</span>
          </Button>
        </div>
      </div>

      {/* Grid Multiempresa */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {empresas.map((emp) => {
          const isAtiva = emp.id === empresaAtiva.id
          const isInapta = emp.situacaoCadastral !== 'ATIVA'

          return (
            <Card
              key={emp.id}
              className={`border-2 transition-all ${
                isAtiva
                  ? 'border-blue-600 bg-blue-50/20 shadow-sm'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base font-bold text-slate-900">
                      {emp.nomeFantasia}
                    </CardTitle>
                    <CardDescription className="text-xs mt-0.5 line-clamp-1">
                      {emp.razaoSocial}
                    </CardDescription>
                  </div>
                  <Badge
                    variant={isInapta ? 'destructive' : 'outline'}
                    className={
                      isInapta
                        ? 'text-[10px]'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]'
                    }
                  >
                    {emp.situacaoCadastral}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div className="space-y-1 text-slate-600">
                  <div>
                    <span className="font-semibold text-slate-500">CNPJ:</span>{' '}
                    <span className="font-mono">{emp.cnpj}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-500">Inscrição Estadual:</span>{' '}
                    <span className="font-mono">{emp.inscricaoEstadual}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-500">UF / Domicílio:</span>{' '}
                    <span className="font-bold text-slate-800">{emp.uf}</span>
                  </div>
                </div>

                {isInapta && (
                  <div className="p-2 bg-rose-50 border border-rose-200 rounded text-rose-800 text-[11px] flex items-start gap-1.5">
                    <AlertOctagon className="size-3.5 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <strong>Fechamento Bloqueado:</strong> {emp.motivoBloqueio}
                    </div>
                  </div>
                )}

                <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => abrirEditarEmpresa(emp)}
                    className="h-7 text-xs text-slate-600 hover:text-slate-900"
                  >
                    Editar Cadastro
                  </Button>

                  {isAtiva ? (
                    <Badge className="bg-blue-600 text-white text-[10px]">EMPRESA ATIVA</Badge>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => trocarEmpresaAtiva(emp.id)}
                      className="h-7 text-xs text-blue-700 hover:bg-blue-50 border-blue-200"
                    >
                      Selecionar Empresa
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Seção Consulta DF-e SEFAZ Simulada */}
      <Card className="border-slate-200">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Globe className="size-4 text-blue-700" />
                Consulta SEFAZ DF-e Simulada — NFeDistribuicaoDFe
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                A consulta real exige servidor com Certificado Digital A1. Aqui o comportamento é
                100% simulado no navegador com controle de NSU e retornos oficiais (137, 138 e 656).
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-medium">Último NSU Local:</span>
              <Badge variant="outline" className="font-mono text-xs font-bold bg-slate-100">
                NSU {ultimoNSU}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <div className="flex items-center gap-2">
                <Label htmlFor="ufSelect" className="text-xs font-semibold">
                  UF da SEFAZ:
                </Label>
                <select
                  id="ufSelect"
                  value={ufConsulta}
                  onChange={(e) => setUfConsulta(e.target.value)}
                  className="text-xs h-8 border border-slate-300 rounded-md px-2.5 font-bold bg-white"
                >
                  <option value="SP">SP (São Paulo)</option>
                  <option value="MG">MG (Minas Gerais)</option>
                  <option value="RJ">RJ (Rio de Janeiro)</option>
                  <option value="PR">PR (Paraná)</option>
                </select>
              </div>

              <div className="text-xs text-slate-500">
                Empresa Consultante: <strong>{empresaAtiva.nomeFantasia}</strong> (
                {empresaAtiva.cnpj})
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
              <Button
                onClick={() => dispararConsultaDFe(false)}
                disabled={consultando}
                size="sm"
                className="bg-blue-700 hover:bg-blue-800 text-xs font-semibold flex items-center gap-1.5"
              >
                <RefreshCw className={`size-3.5 ${consultando ? 'animate-spin' : ''}`} />
                <span>Consultar SEFAZ (Próximo NSU)</span>
              </Button>

              <Button
                onClick={() => dispararConsultaDFe(true)}
                disabled={consultando}
                variant="outline"
                size="sm"
                className="text-xs text-amber-700 border-amber-300 hover:bg-amber-50 flex items-center gap-1.5"
                title="Simula a rejeição 656 de consumo indevido por requisições muito rápidas"
              >
                <Zap className="size-3.5 text-amber-600" />
                <span>Simular Rejeição 656 (Consumo Indevido)</span>
              </Button>
            </div>
          </div>

          {/* Histórico de Consultas DF-e */}
          <div>
            <h3 className="text-xs font-bold uppercase text-slate-500 tracking-wider mb-2 flex items-center gap-1.5">
              <Clock className="size-3.5" />
              Histórico de Consultas Web Service DF-e ({consultasDFe.length})
            </h3>
            {consultasDFe.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs">
                Nenhuma consulta DF-e realizada ainda nesta sessão.
              </div>
            ) : (
              <div className="border border-slate-200 rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="text-xs">
                      <TableHead>Data / Hora</TableHead>
                      <TableHead>UF</TableHead>
                      <TableHead className="text-center">NSU Consultado</TableHead>
                      <TableHead className="text-center">Novo ultNSU</TableHead>
                      <TableHead>cStat / Retorno SEFAZ</TableHead>
                      <TableHead>Mensagem Retornada</TableHead>
                      <TableHead className="text-right">Docs Baixados</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {consultasDFe.map((c) => {
                      const isSucesso = c.codigoStatus === 138
                      const isVazio = c.codigoStatus === 137
                      const isConsumoIndevido = c.codigoStatus === 656

                      return (
                        <TableRow key={c.id} className="text-xs">
                          <TableCell className="font-mono whitespace-nowrap text-slate-600">
                            {new Date(c.dataConsulta).toLocaleDateString('pt-BR', {
                              day: '2-digit',
                              month: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })}
                          </TableCell>
                          <TableCell className="font-bold text-slate-800">{c.uf}</TableCell>
                          <TableCell className="text-center font-mono">{c.nsuConsultado}</TableCell>
                          <TableCell className="text-center font-mono font-bold text-blue-700">
                            {c.novoUltNSU}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                isSucesso
                                  ? 'outline'
                                  : isConsumoIndevido
                                    ? 'destructive'
                                    : 'secondary'
                              }
                              className={`text-[10px] font-bold ${
                                isSucesso ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : ''
                              }`}
                            >
                              cStat {c.codigoStatus}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-[260px] truncate text-slate-700">
                            {c.xMotivo}
                          </TableCell>
                          <TableCell className="text-right font-bold text-slate-900">
                            {c.documentosRetornados}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Modal Cadastro/Edição Empresa */}
      <Dialog open={modalEmpresaOpen} onOpenChange={setModalEmpresaOpen}>
        <DialogContent className="max-w-md">
          <form onSubmit={salvarFormEmpresa}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Building2 className="size-5 text-blue-700" />
                {empresaEditando ? 'Editar Dados da Empresa' : 'Cadastrar Nova Empresa'}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Controle multiempresa com isolamento total de estoques e movimentações fiscais.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-3 text-xs">
              <div>
                <Label htmlFor="nomeFantasia">Nome Fantasia *</Label>
                <Input
                  id="nomeFantasia"
                  value={formEmpresa.nomeFantasia}
                  onChange={(e) => setFormEmpresa({ ...formEmpresa, nomeFantasia: e.target.value })}
                  placeholder="Nome da empresa"
                  required
                  className="text-xs mt-1"
                />
              </div>

              <div>
                <Label htmlFor="razaoSocial">Razão Social *</Label>
                <Input
                  id="razaoSocial"
                  value={formEmpresa.razaoSocial}
                  onChange={(e) => setFormEmpresa({ ...formEmpresa, razaoSocial: e.target.value })}
                  placeholder="Razão Social Completa Ltda"
                  required
                  className="text-xs mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="cnpj">CNPJ *</Label>
                  <Input
                    id="cnpj"
                    value={formEmpresa.cnpj}
                    onChange={(e) => setFormEmpresa({ ...formEmpresa, cnpj: e.target.value })}
                    placeholder="00.000.000/0001-00"
                    required
                    className="font-mono text-xs mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="ufEmp">UF *</Label>
                  <Input
                    id="ufEmp"
                    value={formEmpresa.uf}
                    onChange={(e) =>
                      setFormEmpresa({ ...formEmpresa, uf: e.target.value.toUpperCase() })
                    }
                    placeholder="SP"
                    maxLength={2}
                    required
                    className="font-mono text-xs uppercase mt-1"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="ie">Inscrição Estadual *</Label>
                <Input
                  id="ie"
                  value={formEmpresa.inscricaoEstadual}
                  onChange={(e) =>
                    setFormEmpresa({ ...formEmpresa, inscricaoEstadual: e.target.value })
                  }
                  placeholder="000.000.000.000"
                  required
                  className="font-mono text-xs mt-1"
                />
              </div>

              <div>
                <Label htmlFor="situacao">Situação Cadastral RFB *</Label>
                <select
                  id="situacao"
                  value={formEmpresa.situacaoCadastral}
                  onChange={(e) =>
                    setFormEmpresa({
                      ...formEmpresa,
                      situacaoCadastral: e.target.value as SituacaoCadastral,
                      bloquearFechamento: e.target.value !== 'ATIVA',
                    })
                  }
                  className="w-full text-xs h-9 border border-slate-300 rounded-md px-2 bg-white mt-1"
                >
                  <option value="ATIVA">ATIVA (Operações e Fechamento Liberados)</option>
                  <option value="INAPTA">INAPTA (Fechamento Fiscal Bloqueado)</option>
                  <option value="SUSPENSA">SUSPENSA (Fechamento Fiscal Bloqueado)</option>
                  <option value="BAIXADA">BAIXADA (Fechamento Fiscal Bloqueado)</option>
                </select>
              </div>

              {formEmpresa.situacaoCadastral !== 'ATIVA' && (
                <div>
                  <Label htmlFor="motivoBloq" className="text-rose-700">
                    Motivo do Bloqueio de Fechamento
                  </Label>
                  <Input
                    id="motivoBloq"
                    value={formEmpresa.motivoBloqueio || ''}
                    onChange={(e) =>
                      setFormEmpresa({ ...formEmpresa, motivoBloqueio: e.target.value })
                    }
                    placeholder="Ex: Art. 40 da IN RFB nº 2.119/2022"
                    className="text-xs border-rose-300 mt-1"
                  />
                </div>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalEmpresaOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="bg-blue-700 hover:bg-blue-800">
                Salvar Empresa
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
