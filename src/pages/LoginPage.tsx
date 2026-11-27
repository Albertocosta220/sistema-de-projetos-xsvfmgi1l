import React, { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Lock, LogIn, ShieldCheck, User } from 'lucide-react'

/**
 * Tela de login (primeira barreira do sistema).
 * Sem usuários cadastrados, mostra o onboarding do usuário ADMINISTRADOR.
 * Nenhum usuário de exemplo é criado — produção oficial.
 */
export default function LoginPage() {
  const { pronto, usuarioAtual, precisaOnboarding, entrar, criarAdministrador } = useAuth()
  const navigate = useNavigate()

  // Sessão válida (login recém-feito ou restaurada do boot) → sai da tela de
  // login imediatamente. É isto que faz o entrar "de primeira", sem F5.
  useEffect(() => {
    if (pronto && usuarioAtual) navigate('/', { replace: true })
  }, [pronto, usuarioAtual, navigate])

  if (!pronto)
    return (
      <AuthShell
        icone={<Lock className="size-6" />}
        titulo="Carregando…"
        subtitulo="Preparando o ambiente."
      >
        <div aria-hidden="true" />
      </AuthShell>
    )

  if (precisaOnboarding) {
    return <OnboardingAdmin criarAdministrador={criarAdministrador} />
  }
  return <FormLogin entrar={entrar} />
}

function OnboardingAdmin({
  criarAdministrador,
}: {
  criarAdministrador: (d: { nome: string; login: string; senha: string }) => Promise<void>
}) {
  const [nome, setNome] = useState('')
  const [login, setLogin] = useState('')
  const [senha, setSenha] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  const validar = (): string => {
    if (!nome.trim()) return 'Informe o nome do administrador.'
    if (!login.trim()) return 'Informe o usuário de acesso.'
    if (!/^[a-z0-9._-]{3,}$/i.test(login.trim()))
      return 'O usuário deve ter ao menos 3 caracteres (letras, números, ponto, hífen ou underline).'
    if (senha.length < 6) return 'A senha deve ter ao menos 6 caracteres.'
    if (senha !== confirmar) return 'A confirmação de senha não confere.'
    return ''
  }

  const salvar = async (e: FormEvent) => {
    e.preventDefault()
    const msgErro = validar()
    setErro(msgErro)
    if (msgErro) return
    setSalvando(true)
    try {
      await criarAdministrador({ nome, login, senha })
      toast.success('Administrador cadastrado. Bem-vindo ao SIGEF-ME!')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <AuthShell
      icone={<ShieldCheck className="size-6" />}
      titulo="Bem-vindo ao SIGEF-ME"
      subtitulo="Primeiro acesso: cadastre o usuário ADMINISTRADOR do sistema. Nenhum usuário de exemplo é criado."
    >
      <form onSubmit={salvar} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="adm-nome">Nome completo *</Label>
          <Input
            id="adm-nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            autoComplete="name"
            placeholder="Ex.: Maria Souza"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="adm-login">Usuário de acesso *</Label>
          <Input
            id="adm-login"
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            autoComplete="username"
            placeholder="Ex.: maria.souza"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="adm-senha">Senha *</Label>
            <Input
              id="adm-senha"
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              autoComplete="new-password"
              placeholder="Mínimo 6 caracteres"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="adm-confirmar">Confirmar senha *</Label>
            <Input
              id="adm-confirmar"
              type="password"
              value={confirmar}
              onChange={(e) => setConfirmar(e.target.value)}
              autoComplete="new-password"
            />
          </div>
        </div>
        {erro && <p className="text-xs text-rose-700">{erro}</p>}
        <Button
          type="submit"
          className="bg-[#0E7C86] hover:bg-[#0B636B] text-white w-full"
          disabled={salvando}
        >
          Cadastrar administrador e entrar
        </Button>
        <p className="text-[11px] text-slate-500 m-0">
          A senha é armazenada como hash SHA-256 — nunca em texto puro.
        </p>
      </form>
    </AuthShell>
  )
}

function FormLogin({
  entrar,
}: {
  entrar: (login: string, senha: string) => Promise<{ ok: boolean; motivo?: string }>
}) {
  const [login, setLogin] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [entrando, setEntrando] = useState(false)

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    if (!login.trim() || !senha) {
      setErro('Informe usuário e senha.')
      return
    }
    setErro('')
    setEntrando(true)
    try {
      const res = await entrar(login, senha)
      if (!res.ok) {
        setErro(
          res.motivo === 'USUARIO_INATIVO'
            ? 'Este usuário está desativado. Fale com o administrador.'
            : 'Usuário ou senha inválidos.',
        )
      }
    } finally {
      setEntrando(false)
    }
  }

  return (
    <AuthShell
      icone={<Lock className="size-6" />}
      titulo="Acessar o SIGEF-ME"
      subtitulo="Entre com o seu usuário e senha para continuar."
    >
      <form onSubmit={enviar} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="login-usuario">Usuário</Label>
          <div className="relative">
            <User
              aria-hidden="true"
              className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <Input
              id="login-usuario"
              className="pl-9"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              autoComplete="username"
              placeholder="Seu usuário"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="login-senha">Senha</Label>
          <div className="relative">
            <Lock
              aria-hidden="true"
              className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <Input
              id="login-senha"
              type="password"
              className="pl-9"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              autoComplete="current-password"
              placeholder="Sua senha"
            />
          </div>
        </div>
        {erro && (
          <p className="text-xs text-rose-700" role="alert">
            {erro}
          </p>
        )}
        <Button
          type="submit"
          className="bg-[#0E7C86] hover:bg-[#0B636B] text-white w-full"
          disabled={entrando}
        >
          <LogIn className="size-4 mr-1" />
          {entrando ? 'Entrando…' : 'Entrar'}
        </Button>
      </form>
    </AuthShell>
  )
}

function AuthShell({
  icone,
  titulo,
  subtitulo,
  children,
}: {
  icone: React.ReactNode
  titulo: string
  subtitulo: string
  children: React.ReactNode
}) {
  return (
    <div className="login-bg min-h-dvh flex items-center justify-center p-4">
      <div className="login-card w-full max-w-md">
        <div className="flex items-center gap-3 mb-5">
          <span
            aria-hidden="true"
            className="grid place-items-center size-11 rounded-xl bg-[var(--accent)] text-white"
          >
            {icone}
          </span>
          <div>
            <strong className="block text-lg text-[var(--petroleo)]">SIGEF-ME</strong>
            <span className="text-xs text-[var(--sig-muted)]">Estoque &amp; Fiscal — v2.0</span>
          </div>
        </div>
        <h1 className="text-xl font-bold text-[var(--petroleo)] mb-1">{titulo}</h1>
        <p className="text-[13px] text-[var(--sig-muted)] mb-5">{subtitulo}</p>
        {children}
      </div>
    </div>
  )
}
