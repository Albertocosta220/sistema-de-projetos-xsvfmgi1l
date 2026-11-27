import { useEffect, useState, type FormEvent } from 'react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { useAuth } from '@/context/AuthContext'
import type { Perfil, Usuario } from '@/types/usuario'
import { ShieldCheck } from 'lucide-react'

export interface DadosDialogoUsuario {
  nome: string
  login: string
  senha: string
  perfilId: string
  ativo: boolean
}

/** Diálogo de criar/editar usuário (sem senha ao editar — usar "Senha"). */
export function DialogoUsuario({
  aberto,
  onOpenChange,
  usuario,
  onSave,
}: {
  aberto: boolean
  onOpenChange: (aberto: boolean) => void
  usuario: Usuario | null
  onSave: (dados: DadosDialogoUsuario) => boolean
}) {
  const { perfis } = useAuth()
  const editando = usuario !== null
  const [nome, setNome] = useState('')
  const [login, setLogin] = useState('')
  const [senha, setSenha] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [perfilId, setPerfilId] = useState('')
  const [ativo, setAtivo] = useState(true)
  const [erro, setErro] = useState('')

  useEffect(() => {
    if (aberto) {
      setNome(usuario?.nome ?? '')
      setLogin(usuario?.login ?? '')
      setSenha('')
      setConfirmar('')
      setPerfilId(usuario?.perfilId ?? perfis[0]?.id ?? '')
      setAtivo(usuario?.ativo ?? true)
      setErro('')
    }
  }, [aberto, usuario, perfis])

  const enviar = (e: FormEvent) => {
    e.preventDefault()
    if (!nome.trim()) return setErro('Informe o nome.')
    if (!/^[a-z0-9._-]{3,}$/i.test(login.trim()))
      return setErro(
        'O usuário deve ter ao menos 3 caracteres (letras, números, ponto, hífen ou underline).',
      )
    if (!editando) {
      if (senha.length < 6) return setErro('A senha deve ter ao menos 6 caracteres.')
      if (senha !== confirmar) return setErro('A confirmação de senha não confere.')
    }
    if (!perfilId) return setErro('Selecione o perfil de acesso.')
    setErro('')
    const ok = onSave({ nome, login, senha, perfilId, ativo })
    if (ok) onOpenChange(false)
  }

  return (
    <Dialog open={aberto} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editando ? 'Editar usuário' : 'Novo usuário'}</DialogTitle>
          <DialogDescription>
            {editando
              ? 'Altere nome, login e perfil. A senha é redefinida pelo botão "Senha".'
              : 'Cadastre um novo usuário com login, senha e perfil de acesso.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={enviar} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="usu-nome">Nome *</Label>
            <Input
              id="usu-nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              autoComplete="off"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="usu-login">Usuário (login) *</Label>
            <Input
              id="usu-login"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              autoComplete="off"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="usu-perfil">Perfil de acesso *</Label>
            <Select value={perfilId} onValueChange={setPerfilId}>
              <SelectTrigger id="usu-perfil">
                <SelectValue placeholder="Selecione o perfil" />
              </SelectTrigger>
              <SelectContent>
                {perfis.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {!editando && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="usu-senha">Senha *</Label>
                <Input
                  id="usu-senha"
                  type="password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="usu-confirmar">Confirmar senha *</Label>
                <Input
                  id="usu-confirmar"
                  type="password"
                  value={confirmar}
                  onChange={(e) => setConfirmar(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
            </div>
          )}
          <div className="flex items-center gap-3">
            <Switch id="usu-ativo" checked={ativo} onCheckedChange={setAtivo} />
            <Label htmlFor="usu-ativo" className="font-normal">
              Usuário ativo (pode entrar no sistema)
            </Label>
          </div>
          {erro && (
            <p className="text-xs text-rose-700" role="alert">
              {erro}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" className="bg-blue-700 hover:bg-blue-800">
              {editando ? 'Salvar alterações' : 'Criar usuário'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** Diálogo de redefinição de senha (admin redefine a senha de qualquer usuário). */
export function DialogoSenha({
  usuario,
  onOpenChange,
  onSave,
}: {
  usuario: Usuario | null
  onOpenChange: (aberto: boolean) => void
  onSave: (novaSenha: string) => Promise<void>
}) {
  const [senha, setSenha] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (usuario) {
      setSenha('')
      setConfirmar('')
      setErro('')
    }
  }, [usuario])

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    if (senha.length < 6) return setErro('A senha deve ter ao menos 6 caracteres.')
    if (senha !== confirmar) return setErro('A confirmação de senha não confere.')
    setErro('')
    setSalvando(true)
    try {
      await onSave(senha)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Dialog open={usuario !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck aria-hidden="true" className="size-5 text-[var(--accent)]" />
            Redefinir senha
          </DialogTitle>
          <DialogDescription>
            Defina uma nova senha para <strong>{usuario?.nome}</strong> (usuário{' '}
            <span className="font-mono">{usuario?.login}</span>).
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={enviar} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="rs-senha">Nova senha *</Label>
            <Input
              id="rs-senha"
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rs-confirmar">Confirmar nova senha *</Label>
            <Input
              id="rs-confirmar"
              type="password"
              value={confirmar}
              onChange={(e) => setConfirmar(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          {erro && (
            <p className="text-xs text-rose-700" role="alert">
              {erro}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" className="bg-blue-700 hover:bg-blue-800" disabled={salvando}>
              {salvando ? 'Salvando…' : 'Redefinir senha'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
