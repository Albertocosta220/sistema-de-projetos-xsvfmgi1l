import { useMemo, useState } from 'react'
import { useSigef } from '@/context/SigefContext'
import { useAuth } from '@/context/AuthContext'
import { PageHead, CardS, Pill } from '@/components/shell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
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
import type { RegraCfop } from '@/types/sigef'

type FormRegra = Omit<RegraCfop, 'id' | 'atualizadoEm'>

const CFOP_SUGERIDOS = [
  {
    cfop: '5102',
    natureza: 'Venda de mercadoria',
    descricao: 'Venda própria — saída',
    tipoOperacao: 'SAIDA',
  },
  {
    cfop: '1102',
    natureza: 'Compra p/ industrialização',
    descricao: 'Compra de entrada',
    tipoOperacao: 'ENTRADA',
  },
  {
    cfop: '2102',
    natureza: 'Compra interestadual',
    descricao: 'Entrada interestadual',
    tipoOperacao: 'ENTRADA',
  },
  {
    cfop: '5405',
    natureza: 'Venda com ST',
    descricao: 'Saída com substituição tributária',
    tipoOperacao: 'SAIDA',
  },
  {
    cfop: '1556',
    natureza: 'Compra p/ comercialização',
    descricao: 'Entrada para comercialização',
    tipoOperacao: 'ENTRADA',
  },
  {
    cfop: '6108',
    natureza: 'Venda interestadual',
    descricao: 'Saída interestadual',
    tipoOperacao: 'SAIDA',
  },
]

const padraoRegra = (): FormRegra => ({
  cfop: '',
  naturezaMovimento: '',
  descricao: '',
  tipoOperacao: 'ENTRADA',
  gerarBlocoK: true,
  ativa: true,
})

export default function RegrasCfopPage() {
  const { regrasCfop, salvarRegraCfop, excluirRegraCfop } = useSigef()
  const { temPermissao } = useAuth()
  const podeExcluir = temPermissao('acao-excluir-registros')

  const [dialogo, setDialogo] = useState(false)
  const [form, setForm] = useState<FormRegra>(padraoRegra())
  const [idEditando, setIdEditando] = useState<string | undefined>(undefined)

  const ordenadas = useMemo(
    () => [...regrasCfop].sort((a, b) => a.cfop.localeCompare(b.cfop)),
    [regrasCfop],
  )

  const abrirNova = () => {
    setForm(padraoRegra())
    setIdEditando(undefined)
    setDialogo(true)
  }

  const abrirEdicao = (r: RegraCfop) => {
    setForm({
      cfop: r.cfop,
      naturezaMovimento: r.naturezaMovimento,
      descricao: r.descricao,
      tipoOperacao: r.tipoOperacao,
      gerarBlocoK: r.gerarBlocoK,
      ativa: r.ativa,
    })
    setIdEditando(r.id)
    setDialogo(true)
  }

  const salvar = () => {
    const cfopLimpo = form.cfop.replace(/\D/g, '')
    if (cfopLimpo.length !== 4) {
      toast.error('CFOP deve ter 4 dígitos.')
      return
    }
    if (!form.naturezaMovimento.trim()) {
      toast.error('Informe a natureza de movimento.')
      return
    }
    const existente = regrasCfop.find((r) => r.cfop === cfopLimpo)
    if (existente && existente.id !== idEditando) {
      toast.error(`Já existe uma regra para o CFOP ${cfopLimpo}.`)
      return
    }
    salvarRegraCfop({ ...form, cfop: cfopLimpo }, idEditando)
    toast.success(`Regra CFOP ${cfopLimpo} salva.`)
    setDialogo(false)
  }

  return (
    <div>
      <PageHead
        eyebrow="Matriz fiscal"
        titulo="Regras CFOP"
        subtitulo="Define se cada natureza de movimento entra no Bloco K e qual o tratamento fiscal."
        acoes={
          <Button className="bg-[#0E7C86] hover:bg-[#0B636B] text-white" onClick={abrirNova}>
            Nova regra
          </Button>
        }
      />

      <CardS
        titulo={`Matriz CFOP (${ordenadas.length} regras)`}
        sub="CFOP sem regra ativa faz o documento ficar fora do Bloco K, com ocorrência explicada na Auditoria."
      >
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>CFOP</TableHead>
                <TableHead>Natureza de movimento</TableHead>
                <TableHead>Operação</TableHead>
                <TableHead>Bloco K</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ordenadas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-[var(--sig-muted)]">
                    Nenhuma regra cadastrada — cadastre a matriz fiscal antes de processar a fila.
                  </TableCell>
                </TableRow>
              ) : (
                ordenadas.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono font-semibold">{r.cfop}</TableCell>
                    <TableCell>{r.naturezaMovimento}</TableCell>
                    <TableCell>
                      <Pill tone={r.tipoOperacao === 'ENTRADA' ? 't-accent' : 't-petroleo'}>
                        {r.tipoOperacao}
                      </Pill>
                    </TableCell>
                    <TableCell>
                      <Pill tone={r.gerarBlocoK ? 't-verde' : 't-muted'}>
                        {r.gerarBlocoK ? 'Gera' : 'Não gera'}
                      </Pill>
                    </TableCell>
                    <TableCell>
                      <Pill tone={r.ativa ? 't-verde' : 't-vermelho'}>
                        {r.ativa ? 'Ativa' : 'Inativa'}
                      </Pill>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1.5">
                        <Button variant="outline" size="sm" onClick={() => abrirEdicao(r)}>
                          Editar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-rose-600 hover:bg-rose-50"
                          onClick={() => {
                            excluirRegraCfop(r.id)
                            toast.success('Regra removida.')
                          }}
                          disabled={!podeExcluir}
                          title={
                            podeExcluir
                              ? 'Remover regra CFOP'
                              : 'Sem permissão: exige a ação "Excluir registros" no perfil'
                          }
                        >
                          Remover
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardS>

      <CardS
        titulo="CFOP sugeridos para atacadista"
        sub="Comece por esta matriz mínima e ajuste conforme a operação real."
      >
        <div className="flex flex-wrap gap-2">
          {CFOP_SUGERIDOS.map((s) => (
            <button
              key={s.cfop}
              type="button"
              className="badge-pill t-accent cursor-pointer hover:opacity-80"
              onClick={() => {
                setForm({
                  ...padraoRegra(),
                  cfop: s.cfop,
                  naturezaMovimento: s.natureza,
                  descricao: s.descricao,
                  tipoOperacao: s.tipoOperacao as FormRegra['tipoOperacao'],
                })
                setIdEditando(undefined)
                setDialogo(true)
              }}
            >
              {s.cfop} — {s.natureza}
            </button>
          ))}
        </div>
      </CardS>

      <Dialog open={dialogo} onOpenChange={setDialogo}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{idEditando ? 'Editar regra CFOP' : 'Nova regra CFOP'}</DialogTitle>
            <DialogDescription>
              Natureza de movimento, operação e participação no Bloco K.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="cfop-num">CFOP *</Label>
                <Input
                  id="cfop-num"
                  className="sig-input"
                  inputMode="numeric"
                  maxLength={4}
                  autoComplete="off"
                  value={form.cfop}
                  onChange={(e) => setForm({ ...form, cfop: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="cfop-op">Operação</Label>
                <select
                  id="cfop-op"
                  className="sig-input"
                  value={form.tipoOperacao}
                  onChange={(e) =>
                    setForm({ ...form, tipoOperacao: e.target.value as FormRegra['tipoOperacao'] })
                  }
                >
                  <option value="ENTRADA">Entrada</option>
                  <option value="SAIDA">Saída</option>
                </select>
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="cfop-nat">Natureza de movimento *</Label>
              <Input
                id="cfop-nat"
                className="sig-input"
                autoComplete="off"
                value={form.naturezaMovimento}
                onChange={(e) => setForm({ ...form, naturezaMovimento: e.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="cfop-desc">Descrição</Label>
              <Input
                id="cfop-desc"
                className="sig-input"
                autoComplete="off"
                value={form.descricao}
                onChange={(e) => setForm({ ...form, descricao: e.target.value })}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-[var(--sig-border)] px-3 py-2">
              <Label htmlFor="cfop-blocok" className="font-normal">
                Participa do Bloco K
              </Label>
              <Switch
                id="cfop-blocok"
                checked={form.gerarBlocoK}
                onCheckedChange={(v) => setForm({ ...form, gerarBlocoK: v })}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-[var(--sig-border)] px-3 py-2">
              <Label htmlFor="cfop-ativa" className="font-normal">
                Regra ativa
              </Label>
              <Switch
                id="cfop-ativa"
                checked={form.ativa}
                onCheckedChange={(v) => setForm({ ...form, ativa: v })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogo(false)}>
              Cancelar
            </Button>
            <Button className="bg-blue-700 hover:bg-blue-800" onClick={salvar}>
              Salvar regra
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
