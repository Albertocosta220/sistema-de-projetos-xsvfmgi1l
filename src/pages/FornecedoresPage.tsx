import { useMemo, useState } from 'react'
import { useSigef } from '@/context/SigefContext'
import { PageHead, CardS, Pill, brl } from '@/components/shell'
import { TrTotais, TdTotal } from '@/components/tabelaPadrao'
import { SeletorCompetencia } from '@/components/SeletorCompetencia'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { toast } from 'sonner'
import { DeParaVigente, DocumentoFiscal } from '@/types/sigef'
import {
  coletarParesUnicos,
  encontrarProdutoPorCProd,
  ParItemFornecedor,
} from '@/services/vinculoAutomaticoService'
import {
  DialogoResumoVinculo,
  DialogoPendenciasProduto,
  ResumoVinculoAutomatico,
  PendenciaFornecedor,
} from './fornecedores-dialogs'

/**
 * Fornecedores — emitentes ideais derivados dos documentos importados
 * (cnpj → razão social) e dos vínculos de de-para cadastrados.
 * A lista é somente leitura: o cadastro fiscal real acontece no de-para.
 */
export default function FornecedoresPage() {
  const {
    produtos,
    documentos,
    deParaList,
    salvarDePara,
    excluirDePara,
    vincularFornecedorAutomatico,
  } = useSigef()

  const [busca, setBusca] = useState('')
  const [dialogoAberto, setDialogoAberto] = useState(false)
  const [editando, setEditando] = useState<DeParaVigente | null>(null)
  const [form, setForm] = useState({
    cnpjFornecedor: '',
    razaoSocialFornecedor: '',
    cProd: '',
    xProd: '',
    uCom: 'UN',
    fatorConversao: '1',
    codigoInventario: '',
  })
  // Estado do vínculo automático (um clique): execução + pendências + resumo
  const [processando, setProcessando] = useState<string | null>(null)
  const [pendencias, setPendencias] = useState<PendenciaFornecedor | null>(null)
  const [resumo, setResumo] = useState<ResumoVinculoAutomatico | null>(null)
  const [dialogoPendenciasAberto, setDialogoPendenciasAberto] = useState(false)

  const fornecedores = useMemo(() => {
    const mapa = new Map<
      string,
      {
        cnpj: string
        razaoSocial: string
        totalNotas: number
        valorTotal: number
        ultimaNota: string | null
        vinculos: number
      }
    >()

    documentos.forEach((d) => {
      const cnpj = d.cnpjEmitente.replace(/\D/g, '')
      if (!cnpj) return
      const atual = mapa.get(cnpj) || {
        cnpj,
        razaoSocial: d.nomeEmitente,
        totalNotas: 0,
        valorTotal: 0,
        ultimaNota: null as string | null,
        vinculos: 0,
      }
      atual.totalNotas += 1
      if (d.status !== 'CANCELADO') atual.valorTotal += d.valorTotal
      if (!atual.ultimaNota || d.dataEmissao > atual.ultimaNota) atual.ultimaNota = d.dataEmissao
      if (atual.razaoSocial.length < d.nomeEmitente.length) atual.razaoSocial = d.nomeEmitente
      mapa.set(cnpj, atual)
    })

    deParaList.forEach((dp) => {
      const cnpj = dp.cnpjFornecedor.replace(/\D/g, '')
      const atual = mapa.get(cnpj)
      if (atual) atual.vinculos += 1
      else
        mapa.set(cnpj, {
          cnpj,
          razaoSocial: dp.razaoSocialFornecedor || 'Fornecedor de de-para',
          totalNotas: 0,
          valorTotal: 0,
          ultimaNota: null,
          vinculos: 1,
        })
    })

    return Array.from(mapa.values()).sort((a, b) => b.totalNotas - a.totalNotas)
  }, [documentos, deParaList])

  /**
   * Cadastro + vínculo automáticos a partir do CNPJ do emitente (um clique):
   * grava o fornecedor com a razão social das notas, cria os vínculos de-para
   * dos itens que JÁ existem no catálogo e lista as pendências "cadastrar
   * produto" para os itens sem correspondência (nenhum produto é inventado).
   */
  const vincularAutomatico = (cnpj: string) => {
    const fornecedor = fornecedores.find((f) => f.cnpj === cnpj)
    const razaoSocial = fornecedor?.razaoSocial || cnpj
    setProcessando(cnpj)
    try {
      const antesPendentes = documentos.filter(
        (d) =>
          (d?.cnpjEmitente || '').replace(/\D/g, '') === cnpj && d.status === 'AGUARDANDO_DE_PARA',
      ).length
      const r = vincularFornecedorAutomatico({
        cnpjFornecedor: cnpj,
        razaoSocialFornecedor: razaoSocial,
      })
      if (r.totalPares === 0) {
        // Nada para fazer (sem itens ou tudo já vinculado) — contexto dado pelo toast
        return
      }
      if (r.criados === 0 && r.pendentes === 0) {
        // Havia itens, mas todos já possuem vínculo idêntico — nada muda e o
        // toast do contexto já explicou. Não abre resumo vazio.
        return
      }
      setResumo({
        cnpj,
        razaoSocial,
        criados: r.criados,
        pendentes: r.pendentes,
        reenfileiradas: antesPendentes,
        quando: new Date().toISOString(),
      })
      if (r.pendentes > 0) {
        const cnpjLimpo = cnpj.replace(/\D/g, '')
        const itens = coletarParesUnicos(documentos, cnpjLimpo).filter((par) => {
          const produto = encontrarProdutoPorCProd(produtos, par.cProd)
          return !produto
        })
        setPendencias({ cnpj, razaoSocial, itens })
      } else {
        setPendencias(null)
      }
    } catch (e) {
      // O vínculo nunca deve falhar em silêncio: qualquer erro (storage cheio,
      // documento inesperado) aparece para o usuário.
      console.error('Erro no vínculo automático de fornecedor:', e)
      toast.error(
        'Não foi possível concluir o vínculo automático. Veja o console para detalhes e tente novamente.',
      )
    } finally {
      setProcessando(null)
    }
  }

  const fornecedoresFiltrados = useMemo(
    () =>
      fornecedores.filter(
        (f) =>
          f.cnpj.includes(busca.replace(/\D/g, '')) ||
          f.razaoSocial.toLowerCase().includes(busca.toLowerCase()),
      ),
    [fornecedores, busca],
  )

  const abrirNovo = () => {
    setEditando(null)
    setForm({
      cnpjFornecedor: '',
      razaoSocialFornecedor: '',
      cProd: '',
      xProd: '',
      uCom: 'UN',
      fatorConversao: '1',
      codigoInventario: '',
    })
    setDialogoAberto(true)
  }

  const abrirEdicao = (cnpj: string) => {
    const vinculo = deParaList.find((dp) => dp.cnpjFornecedor.replace(/\D/g, '') === cnpj)
    if (!vinculo) {
      toast.info('Este fornecedor ainda não tem vínculo de de-para cadastrado — preencha o novo.')
      abrirNovo()
      return
    }
    setEditando(vinculo)
    setForm({
      cnpjFornecedor: vinculo.cnpjFornecedor,
      razaoSocialFornecedor: vinculo.razaoSocialFornecedor || '',
      cProd: vinculo.cProd,
      xProd: vinculo.xProd,
      uCom: vinculo.uCom,
      fatorConversao: String(vinculo.fatorConversao),
      codigoInventario: vinculo.codigoInventario,
    })
    setDialogoAberto(true)
  }

  const salvar = () => {
    if (!form.cnpjFornecedor.trim() || !form.cProd.trim() || !form.codigoInventario.trim()) {
      toast.error('CNPJ, código no fornecedor e código de inventário são obrigatórios.')
      return
    }
    salvarDePara({
      cnpjFornecedor: form.cnpjFornecedor,
      razaoSocialFornecedor: form.razaoSocialFornecedor,
      cProd: form.cProd,
      xProd: form.xProd,
      uCom: form.uCom,
      fatorConversao: Number(form.fatorConversao.replace(',', '.')) || 1,
      codigoInventario: form.codigoInventario,
    })
    setDialogoAberto(false)
  }

  return (
    <div>
      <PageHead
        eyebrow="Parceiros"
        titulo="Fornecedores"
        subtitulo="Emitentes ideais detectados nas NF-e importadas, com atalho para o de-para de dois campos."
        acoes={
          <div className="flex flex-wrap items-center gap-2">
            <SeletorCompetencia />
            <Button onClick={abrirNovo} className="bg-blue-700 hover:bg-blue-800">
              Novo vínculo de de-para
            </Button>
          </div>
        }
      />

      <CardS
        titulo={`Emitentes ideais (${fornecedoresFiltrados.length})`}
        sub="Contagem e valor consideram somente notas não canceladas."
        acoes={
          <div className="field !min-w-0">
            <span className="sr-only">Buscar fornecedor</span>
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por CNPJ ou razão social"
              className="sig-input !w-64"
              aria-label="Buscar fornecedor"
            />
          </div>
        }
      >
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>CNPJ</TableHead>
                <TableHead>Razão social</TableHead>
                <TableHead className="text-right">Notas</TableHead>
                <TableHead className="text-right">Valor (s/ canceladas)</TableHead>
                <TableHead>Última nota</TableHead>
                <TableHead className="text-right">Vínculos de-para</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fornecedoresFiltrados.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-[var(--sig-muted)]">
                    Nenhum emitente detectado ainda — importe NF-e para popular esta lista.
                  </TableCell>
                </TableRow>
              ) : (
                fornecedoresFiltrados.map((f) => (
                  <TableRow key={f.cnpj}>
                    <TableCell className="font-mono text-xs">{f.cnpj}</TableCell>
                    <TableCell className="max-w-[240px] truncate font-medium">
                      {f.razaoSocial}
                    </TableCell>
                    <TableCell className="text-right">{f.totalNotas}</TableCell>
                    <TableCell className="text-right font-mono">{brl(f.valorTotal)}</TableCell>
                    <TableCell className="text-xs">
                      {f.ultimaNota ? new Date(f.ultimaNota).toLocaleDateString('pt-BR') : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Pill tone={f.vinculos > 0 ? 't-verde' : 't-ambar'}>
                        {f.vinculos > 0 ? `${f.vinculos} vínculo(s)` : 'sem vínculo'}
                      </Pill>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-teal-600 text-teal-700 hover:bg-teal-50 disabled:opacity-60"
                          disabled={processando === f.cnpj}
                          aria-label={`Cadastrar e vincular automaticamente os itens do emitente ${f.cnpj}`}
                          onClick={() => vincularAutomatico(f.cnpj)}
                        >
                          {processando === f.cnpj
                            ? 'Vinculando…'
                            : 'Cadastrar e vincular automaticamente'}
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => abrirEdicao(f.cnpj)}>
                          {f.vinculos > 0 ? 'Editar vínculo' : 'Vincular'}
                        </Button>
                        {f.vinculos > 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-rose-600 hover:bg-rose-50"
                            onClick={() => {
                              const v = deParaList.find(
                                (dp) => dp.cnpjFornecedor.replace(/\D/g, '') === f.cnpj,
                              )
                              if (v) {
                                excluirDePara(v.id)
                                toast.success('Vínculo removido e Kardex recalculado.')
                              }
                            }}
                          >
                            Remover
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
            <TrTotais
              titulo={`Totais (${fornecedoresFiltrados.length} fornecedores — sem canceladas)`}
              colSpan={2}
            >
              <TdTotal
                valor={fornecedoresFiltrados.reduce((s, f) => s + f.totalNotas, 0)}
                fmt={(v) => String(v)}
                className="pr-6"
              />
              <TdTotal
                valor={fornecedoresFiltrados.reduce((s, f) => s + f.valorTotal, 0)}
                fmt={brl}
                className="pr-6"
              />
              <td className="px-3" aria-hidden="true" />
              <td className="px-3" aria-hidden="true" />
              <td className="px-3" aria-hidden="true" />
            </TrTotais>
          </Table>
        </div>
      </CardS>

      <Dialog open={dialogoAberto} onOpenChange={setDialogoAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editando ? 'Editar vínculo' : 'Novo vínculo de de-para'}</DialogTitle>
            <DialogDescription>
              Vínculo por CNPJ + código do fornecedor → código de inventário, com fator de conversão
              da unidade de compra.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-1">
            <div className="grid gap-1.5">
              <Label htmlFor="forn-cnpj">CNPJ do fornecedor *</Label>
              <Input
                id="forn-cnpj"
                className="sig-input"
                value={form.cnpjFornecedor}
                autoComplete="off"
                onChange={(e) => setForm({ ...form, cnpjFornecedor: e.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="forn-razao">Razão social</Label>
              <Input
                id="forn-razao"
                className="sig-input"
                value={form.razaoSocialFornecedor}
                autoComplete="off"
                onChange={(e) => setForm({ ...form, razaoSocialFornecedor: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="forn-cprod">Código no fornecedor *</Label>
                <Input
                  id="forn-cprod"
                  className="sig-input"
                  value={form.cProd}
                  autoComplete="off"
                  onChange={(e) => setForm({ ...form, cProd: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="forn-codinv">Código de inventário *</Label>
                <Input
                  id="forn-codinv"
                  className="sig-input"
                  value={form.codigoInventario}
                  autoComplete="off"
                  onChange={(e) => setForm({ ...form, codigoInventario: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="forn-xprod">Descrição no fornecedor</Label>
                <Input
                  id="forn-xprod"
                  className="sig-input"
                  value={form.xProd}
                  autoComplete="off"
                  onChange={(e) => setForm({ ...form, xProd: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="forn-ucom">Unid. compra</Label>
                  <Input
                    id="forn-ucom"
                    className="sig-input"
                    value={form.uCom}
                    autoComplete="off"
                    onChange={(e) => setForm({ ...form, uCom: e.target.value })}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="forn-fator">Fator conv.</Label>
                  <Input
                    id="forn-fator"
                    className="sig-input"
                    inputMode="decimal"
                    value={form.fatorConversao}
                    autoComplete="off"
                    onChange={(e) => setForm({ ...form, fatorConversao: e.target.value })}
                  />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogoAberto(false)}>
              Cancelar
            </Button>
            <Button className="bg-blue-700 hover:bg-blue-800" onClick={salvar}>
              Salvar vínculo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DialogoResumoVinculo
        resumo={resumo}
        onFechar={() => setResumo(null)}
        onVerPendencias={() => {
          setResumo(null)
          if (pendencias) setDialogoPendenciasAberto(true)
        }}
      />
      <DialogoPendenciasProduto
        pendencias={dialogoPendenciasAberto ? pendencias : null}
        onFechar={() => setDialogoPendenciasAberto(false)}
      />
    </div>
  )
}
