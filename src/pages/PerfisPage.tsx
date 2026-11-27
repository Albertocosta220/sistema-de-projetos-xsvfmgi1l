import { useMemo, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { PageHead, CardS } from '@/components/shell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Plus, Pencil, ShieldCheck, Users } from 'lucide-react'
import { TELAS, ACOES } from '@/types/usuario'
import type { Perfil } from '@/types/usuario'

export default function PerfisPage() {
  const { perfis, usuarios, salvarPerfil } = useAuth()
  const [editando, setEditando] = useState<Perfil | null>(null)
  const [criando, setCriando] = useState(false)
  const [nome, setNome] = useState('')
  const [descricao, setDescricao] = useState('')
  const [permissoes, setPermissoes] = useState<Set<string>>(new Set())
  const [erro, setErro] = useState('')

  const abreNovo = () => {
    setEditando(null)
    setNome('')
    setDescricao('')
    setPermissoes(new Set(ACOES.map((a) => a.key)))
    setErro('')
    setCriando(true)
  }

  const abreEdicao = (p: Perfil) => {
    setEditando(p)
    setNome(p.nome)
    setDescricao(p.descricao)
    setPermissoes(new Set(p.permissoes))
    setErro('')
    setCriando(false)
  }

  const salva = () => {
    if (!nome.trim()) {
      setErro('Informe o nome do perfil.')
      return
    }
    if (permissoes.size === 0) {
      setErro('Selecione ao menos uma permissão — um perfil sem permissão não acessa nada.')
      return
    }
    const duplicado = perfis.some(
      (p) => p.nome.trim().toLowerCase() === nome.trim().toLowerCase() && p.id !== editando?.id,
    )
    if (duplicado) {
      setErro('Já existe um perfil com esse nome.')
      return
    }
    salvarPerfil({ id: editando?.id ?? '', nome, descricao, permissoes: [...permissoes] })
    toast.success(editando ? 'Perfil atualizado.' : 'Perfil criado.')
    setCriando(false)
    setEditando(null)
  }

  const usuariosNoPerfil = useMemo(() => {
    const mapa = new Map<string, number>()
    for (const u of usuarios) mapa.set(u.perfilId, (mapa.get(u.perfilId) ?? 0) + 1)
    return mapa
  }, [usuarios])

  const aberto = criando || editando !== null
  const fechar = () => {
    setCriando(false)
    setEditando(null)
  }

  return (
    <div>
      <PageHead
        eyebrow="Sistema"
        title="Perfis de acesso"
        subtitulo="Defina quais telas e ações cada perfil pode usar. O perfil Administrador sempre tem acesso total."
      />

      <CardS>
        <div className="flex items-center justify-between gap-3 mb-4">
          <p className="text-sm text-[var(--sig-muted)]">
            {perfis.length} perfil(is) cadastrado(s)
          </p>
          <Button onClick={abreNovo}>
            <Plus className="size-4 mr-1.5" />
            Novo perfil
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {perfis.map((p) => (
            <div key={p.id} className="rounded-lg border border-[var(--sig-border)] p-4 bg-white">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-semibold text-[var(--petroleo)] flex items-center gap-1.5">
                    {p.id === 'perfil-admin' && (
                      <ShieldCheck
                        aria-hidden="true"
                        className="size-4 text-[var(--accent)] flex-none"
                      />
                    )}
                    {p.nome}
                  </h3>
                  <p className="text-xs text-[var(--sig-muted)]">{p.descricao || '—'}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => abreEdicao(p)}
                  aria-label={`Editar perfil ${p.nome}`}
                >
                  <Pencil className="size-3.5" />
                </Button>
              </div>
              <div className="mt-3 flex items-center gap-1.5 text-xs text-[var(--sig-muted)]">
                <Users aria-hidden="true" className="size-3.5" />
                {usuariosNoPerfil.get(p.id) ?? 0} usuário(s)
                <span aria-hidden="true">·</span>
                {p.id === 'perfil-admin'
                  ? 'todas as permissões'
                  : `${p.permissoes.length} permissões`}
              </div>
            </div>
          ))}
        </div>
      </CardS>

      <Dialog open={aberto} onOpenChange={(o) => !o && fechar()}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editando ? `Editar perfil: ${editando.nome}` : 'Novo perfil'}
            </DialogTitle>
            <DialogDescription>
              Marque as telas e ações liberadas. O Administrador tem sempre acesso total.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="perf-nome">Nome *</Label>
                <Input
                  id="perf-nome"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  autoComplete="off"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="perf-desc">Descrição</Label>
                <Input
                  id="perf-desc"
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  autoComplete="off"
                />
              </div>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-[var(--petroleo)] mb-2">Telas</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {TELAS.map((t) => (
                  <label
                    key={t.key}
                    className="flex items-center gap-2 rounded-md border border-[var(--sig-border)] px-2.5 py-1.5 text-xs cursor-pointer hover:bg-[var(--sig-bg)]"
                  >
                    <input
                      type="checkbox"
                      className="accent-[var(--accent)]"
                      checked={permissoes.has(t.key)}
                      onChange={(e) => {
                        const prox = new Set(permissoes)
                        if (e.target.checked) prox.add(t.key)
                        else prox.delete(t.key)
                        setPermissoes(prox)
                      }}
                    />
                    {t.label}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-[var(--petroleo)] mb-2">Ações sensíveis</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {ACOES.map((a) => (
                  <label
                    key={a.key}
                    className="flex items-center gap-2 rounded-md border border-[var(--sig-border)] px-2.5 py-1.5 text-xs cursor-pointer hover:bg-[var(--sig-bg)]"
                  >
                    <input
                      type="checkbox"
                      className="accent-[var(--accent)]"
                      checked={permissoes.has(a.key)}
                      onChange={(e) => {
                        const prox = new Set(permissoes)
                        if (e.target.checked) prox.add(a.key)
                        else prox.delete(a.key)
                        setPermissoes(prox)
                      }}
                    />
                    {a.label}
                  </label>
                ))}
              </div>
            </div>
            {erro && (
              <p className="text-xs text-rose-700" role="alert">
                {erro}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={fechar}>
              Cancelar
            </Button>
            <Button type="button" onClick={salva}>
              Salvar perfil
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
