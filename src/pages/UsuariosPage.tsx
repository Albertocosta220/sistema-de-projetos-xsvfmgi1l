import { useMemo, useState, type FormEvent } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useSigef } from '@/context/SigefContext'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { UserPlus, Pencil, KeyRound, Power, ShieldCheck, Search } from 'lucide-react'
import { TELAS, ACOES, TELA_POR_ROTA } from '@/types/usuario'
import { useLocation } from 'react-router-dom'
import type { Usuario } from '@/types/usuario'

export default function UsuariosPage() {
  const {
    usuarios,
    perfis,
    usuarioAtual,
    criarUsuario,
    editarUsuario,
    alternarAtivoUsuario,
    redefinirSenha,
  } = useAuth()
  const [busca, setBusca] = useState('')
  const [dialogoCriar, setDialogoCriar] = useState(false)
  const [dialogoEditar, setDialogoEditar] = useState<Usuario | null>(null)
  const [dialogoSenha, setDialogoSenha] = useState<Usuario | null>(null)

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase()
    if (!q) return usuarios
    return usuarios.filter(
      (u) => u.nome.toLowerCase().includes(q) || u.login.toLowerCase().includes(q),
    )
  }, [usuarios, busca])

  return (
    <div>
      <PageHead
        eyebrow="Sistema"
        title="Usuários"
        subtitulo="Cadastre e gerencie os usuários que acessam o sistema e seus perfis de permissão."
      />

      <CardS>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Search
              aria-hidden="true"
              className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--sig-muted)]"
            />
            <Input
              className="pl-9"
              placeholder="Buscar por nome ou usuário…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              aria-label="Buscar usuários"
            />
          </div>
          <Button className="bg-blue-700 hover:bg-blue-800" onClick={() => setDialogoCriar(true)}>
            <UserPlus className="size-4 mr-1.5" />
            Novo usuário
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Usuário</th>
                <th>Perfil</th>
                <th>Situação</th>
                <th>Último login</th>
                <th className="text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {lista.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-[var(--sig-muted)] py-8">
                    Nenhum usuário encontrado.
                  </td>
                </tr>
              )}
              {lista.map((u) => {
                const perfil = perfis.find((p) => p.id === u.perfilId)
                return (
                  <tr key={u.id}>
                    <td className="font-semibold text-[var(--petroleo)]">{u.nome}</td>
                    <td className="font-mono text-xs">{u.login}</td>
                    <td>
                      <Badge
                        variant="outline"
                        className="border-[var(--sig-border)] text-[var(--petroleo)]"
                      >
                        {perfil?.nome ?? '—'}
                      </Badge>
                    </td>
                    <td>
                      <Badge className={u.ativo ? 'bg-emerald-600' : 'bg-red-600'}>
                        {u.ativo ? 'Ativo' : 'Desativado'}
                      </Badge>
                    </td>
                    <td className="text-xs text-[var(--sig-muted)]">
                      {u.ultimoLogin ? new Date(u.ultimoLogin).toLocaleString('pt-BR') : '—'}
                    </td>
                    <td>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 gap-1.5"
                          onClick={() => setDialogoEditar(u)}
                        >
                          <Pencil className="size-3.5" />
                          Editar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 gap-1.5"
                          onClick={() => setDialogoSenha(u)}
                        >
                          <KeyRound className="size-3.5" />
                          Senha
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 gap-1.5"
                          onClick={() => {
                            const res = alternarAtivoUsuario(u.id)
                            if (res.ok) {
                              toast.success(u.ativo ? 'Usuário desativado.' : 'Usuário ativado.')
                            } else {
                              toast.error(
                                res.motivo === 'ULTIMO_ADMIN'
                                  ? 'Este é o único administrador ativo — ative outro admin antes de desativá-lo.'
                                  : 'Não foi possível alterar a situação do usuário.',
                              )
                            }
                          }}
                          disabled={u.id === usuarioAtual?.id}
                        >
                          <Power className="size-3.5" />
                          {u.ativo ? 'Desativar' : 'Ativar'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </CardS>

      <DialogoUsuario
        aberto={dialogoCriar || dialogoEditar !== null}
        onOpenChange={(aberto) => {
          if (!aberto) {
            setDialogoCriar(false)
            setDialogoEditar(null)
          }
        }}
        usuario={dialogoEditar}
        perfis={perfis}
        onSave={(dados) => {
          if (dialogoEditar) {
            const res = editarUsuario(dialogoEditar.id, {
              nome: dados.nome,
              login: dados.login,
              perfilId: dados.perfilId,
            })
            if (!res.ok) {
              toast.error(
                res.motivo === 'LOGIN_DUPLICADO'
                  ? 'Já existe um usuário com esse login.'
                  : res.motivo === 'ULTIMO_ADMIN'
                    ? 'Este é o único administrador — promova outro admin antes de mudar o perfil.'
                    : 'Não foi possível salvar.',
              )
              return false
            }
            toast.success('Usuário atualizado.')
          } else {
            void (async () => {
              const res = await criarUsuario(dados)
              if (!res.ok) {
                toast.error(
                  res.motivo === 'LOGIN_DUPLICADO'
                    ? 'Já existe um usuário com esse login.'
                    : 'Não foi possível criar o usuário.',
                )
                return
              }
              toast.success('Usuário criado.')
              setDialogoCriar(false)
            })()
          }
          return true
        }}
      />

      <DialogoSenha
        usuario={dialogoSenha}
        onOpenChange={(aberto) => {
          if (!aberto) setDialogoSenha(null)
        }}
        onSave={async (novaSenha) => {
          if (!dialogoSenha) return
          const res = await redefinirSenha(dialogoSenha.id, novaSenha)
          if (res.ok) {
            toast.success('Senha redefinida.')
            setDialogoSenha(null)
          } else {
            toast.error('Não foi possível redefinir a senha.')
          }
        }}
      />
    </div>
  )
}
