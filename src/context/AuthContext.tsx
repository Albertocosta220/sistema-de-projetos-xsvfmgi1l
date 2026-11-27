import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Perfil, Sessao, Usuario } from '@/types/usuario'
import type { ResultadoLogin } from '@/services/authService'
import {
  KEY_SESSAO,
  carregarPerfis,
  carregarSessao,
  carregarUsuarios,
  cadastrarAdministrador,
  garantirPerfisPadrao,
  entrar as entrarService,
  existeAdministrador,
  hashSenha,
  redefinirSenhaAdministrador as redefinirSenhaAdministradorService,
  limparSessao,
  permissoesConhecidas,
  salvarPerfis,
  salvarSessao,
  salvarUsuarios,
} from '@/services/authService'
import { toast } from 'sonner'

export interface NovoUsuario {
  nome: string
  login: string
  senha: string
  perfilId: string
  ativo: boolean
}

/**
 * Auto-recuperação de acesso: recadastra a senha do usuário administrador
 * (apaga o hash antigo e grava o novo), reativando-o. Usada na tela de login
 * quando a senha é recusada — o dono do sistema nunca fica preso fora.
 */
interface AuthContextType {
  // Estado
  pronto: boolean // terminou de carregar usuários/perfis/sessão
  precisaOnboarding: boolean // nenhum usuário cadastrado ainda
  usuarioAtual: Usuario | null
  sessao: Sessao | null
  usuarios: Usuario[]
  perfis: Perfil[]

  // Autenticação
  entrar: (login: string, senha: string) => Promise<{ ok: boolean; motivo?: string }>
  sair: () => void
  criarAdministrador: (dados: { nome: string; login: string; senha: string }) => Promise<void>
  /** Auto-recuperação: recadastra a senha do admin existente (tela de login). */
  redefinirSenhaAdmin: (
    login: string,
    novaSenha: string,
  ) => Promise<{ ok: boolean; motivo?: string }>

  // Usuários (ação acao-gerenciar-usuarios)
  criarUsuario: (dados: NovoUsuario) => Promise<{ ok: boolean; motivo?: string }>
  editarUsuario: (
    id: string,
    dados: { nome: string; login: string; perfilId: string },
  ) => { ok: boolean; motivo?: string }
  alternarAtivoUsuario: (id: string) => { ok: boolean; motivo?: string }
  redefinirSenha: (id: string, novaSenha: string) => Promise<{ ok: boolean; motivo?: string }>

  // Perfis (ação acao-gerenciar-perfis)
  criarPerfil: (nome: string, descricao: string) => Perfil | null
  editarPerfil: (
    id: string,
    dados: { nome: string; descricao: string; permissoes: string[] },
  ) => void
  salvarPerfil: (dados: {
    id: string
    nome: string
    descricao: string
    permissoes: string[]
  }) => void
  excluirPerfil: (id: string) => { ok: boolean; motivo?: string }

  // Permissões
  temPermissao: (chave: string) => boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate()
  const [pronto, setPronto] = useState(false)
  const [usuarioAtual, setUsuarioAtual] = useState<Usuario | null>(null)
  const [sessao, setSessao] = useState<Sessao | null>(null)
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [perfis, setPerfis] = useState<Perfil[]>([])

  const iniciarSessao = useCallback((usuario: Usuario) => {
    const nova: Sessao = {
      usuarioId: usuario.id,
      nome: usuario.nome,
      login: usuario.login,
      perfilId: usuario.perfilId,
      iniciadaEm: new Date().toISOString(),
    }
    salvarSessao(nova)
    setSessao(nova)
  }, [])

  // Boot: garante perfis padrão (estrutura, não dados de exemplo) e restaura a sessão
  useEffect(() => {
    garantirPerfisPadrao()
    const lista = carregarUsuarios()
    setUsuarios(lista)
    setPerfis(carregarPerfis())

    const sessaoSalva = carregarSessao()
    if (sessaoSalva) {
      const usuario = lista.find((u) => u.id === sessaoSalva.usuarioId && u.ativo)
      if (usuario) {
        setUsuarioAtual(usuario)
        setSessao(sessaoSalva)
      } else {
        limparSessao()
      }
    }
    setPronto(true)
  }, [])

  const precisaOnboarding = !existeAdministrador()

  const entrar = useCallback(
    async (login: string, senha: string) => {
      const res = await entrarService(login, senha)
      if (res.ok === false) {
        return { ok: false, motivo: res.motivo }
      }
      const usuario = res.usuario
      setUsuarioAtual(usuario)
      setUsuarios(carregarUsuarios())
      // Reflui os perfis do localStorage (podem ter mudado em outra aba/boot)
      setPerfis(carregarPerfis())
      iniciarSessao(usuario)
      return { ok: true }
    },
    [iniciarSessao],
  )

  // Auto-recuperação de acesso: recadastra a senha do administrador existente
  // (apaga o hash antigo, grava o novo e reativa) e já inicia a sessão.
  const redefinirSenhaAdmin = useCallback(
    async (login: string, novaSenha: string) => {
      const res = await redefinirSenhaAdministradorService(login, novaSenha)
      if (!res.ok) return { ok: false, motivo: res.motivo }
      const usuario = carregarUsuarios().find((u) => u.login === res.login)
      if (usuario) {
        setUsuarioAtual(usuario)
        setUsuarios(carregarUsuarios())
        iniciarSessao(usuario)
      }
      return { ok: true }
    },
    [iniciarSessao],
  )

  // Encerra a sessão e leva o usuário à tela de login. O navigate garante a
  // troca de tela imediata (o redirect passivo das rotas protegidas só
  // aconteceria na próxima renderização de cada rota).
  const sair = useCallback(() => {
    limparSessao()
    setUsuarioAtual(null)
    setSessao(null)
    navigate('/login', { replace: true })
  }, [navigate])

  const criarAdministrador = useCallback(
    async (dados: { nome: string; login: string; senha: string }) => {
      garantirPerfisPadrao()
      await cadastrarAdministrador(dados)
      setPerfis(carregarPerfis())
      const usuario = carregarUsuarios().find((u) => u.login === dados.login.trim().toLowerCase())
      if (usuario) {
        setUsuarioAtual(usuario)
        setUsuarios(carregarUsuarios())
        iniciarSessao(usuario)
      }
    },
    [iniciarSessao],
  )

  // ============ Usuários ============

  const criarUsuario = useCallback(
    async (dados: NovoUsuario) => {
      const login = dados.login.trim().toLowerCase()
      if (usuarios.some((u) => u.login === login)) {
        return { ok: false, motivo: 'LOGIN_DUPLICADO' }
      }
      const agora = new Date().toISOString()
      const novo: Usuario = {
        id: crypto.randomUUID(),
        nome: dados.nome.trim(),
        login,
        senhaHash: await hashSenha(dados.senha),
        perfilId: dados.perfilId,
        ativo: dados.ativo,
        criadoEm: agora,
        atualizadoEm: agora,
      }
      const novos = [...usuarios, novo]
      salvarUsuarios(novos)
      setUsuarios(novos)
      return { ok: true }
    },
    [usuarios],
  )

  const editarUsuario = useCallback(
    (id: string, dados: { nome: string; login: string; perfilId: string }) => {
      const login = dados.login.trim().toLowerCase()
      if (usuarios.some((u) => u.login === login && u.id !== id)) {
        return { ok: false, motivo: 'LOGIN_DUPLICADO' }
      }
      const alvo = usuarios.find((u) => u.id === id)
      if (alvo?.perfilId === 'perfil-administrador' && dados.perfilId !== 'perfil-administrador') {
        // Impede o único admin de perder o acesso administrativo
        const outrosAdmins = usuarios.filter(
          (u) => u.perfilId === 'perfil-administrador' && u.id !== id && u.ativo,
        )
        if (outrosAdmins.length === 0) {
          return { ok: false, motivo: 'ULTIMO_ADMIN' }
        }
      }
      const novos = usuarios.map((u) =>
        u.id === id
          ? {
              ...u,
              nome: dados.nome.trim(),
              login,
              perfilId: dados.perfilId,
              atualizadoEm: new Date().toISOString(),
            }
          : u,
      )
      salvarUsuarios(novos)
      setUsuarios(novos)
      if (usuarioAtual?.id === id) {
        setUsuarioAtual(novos.find((u) => u.id === id) ?? null)
      }
      return { ok: true }
    },
    [usuarios, usuarioAtual],
  )

  const alternarAtivoUsuario = useCallback(
    (id: string) => {
      const alvo = usuarios.find((u) => u.id === id)
      if (!alvo) return { ok: false, motivo: 'NAO_ENCONTRADO' }
      if (alvo.ativo && alvo.perfilId === 'perfil-administrador') {
        const outrosAdminsAtivos = usuarios.filter(
          (u) => u.perfilId === 'perfil-administrador' && u.id !== id && u.ativo,
        )
        if (outrosAdminsAtivos.length === 0) {
          return { ok: false, motivo: 'ULTIMO_ADMIN' }
        }
      }
      const novos = usuarios.map((u) =>
        u.id === id ? { ...u, ativo: !u.ativo, atualizadoEm: new Date().toISOString() } : u,
      )
      salvarUsuarios(novos)
      setUsuarios(novos)
      return { ok: true }
    },
    [usuarios],
  )

  const redefinirSenha = useCallback(
    async (id: string, novaSenha: string) => {
      const alvo = usuarios.find((u) => u.id === id)
      if (!alvo) return { ok: false, motivo: 'NAO_ENCONTRADO' }
      const senhaHash = await hashSenha(novaSenha)
      const novos = usuarios.map((u) =>
        u.id === id ? { ...u, senhaHash, atualizadoEm: new Date().toISOString() } : u,
      )
      salvarUsuarios(novos)
      setUsuarios(novos)
      return { ok: true }
    },
    [usuarios],
  )

  // ============ Perfis ============

  const criarPerfil = useCallback(
    (nome: string, descricao: string): Perfil | null => {
      const nomeLimpo = nome.trim()
      if (!nomeLimpo) return null
      if (perfis.some((p) => p.nome.toLowerCase() === nomeLimpo.toLowerCase())) return null
      const novo: Perfil = {
        id: `perfil-${crypto.randomUUID()}`,
        nome: nomeLimpo,
        descricao: descricao.trim(),
        permissoes: [],
        sistema: false,
        atualizadoEm: new Date().toISOString(),
      }
      const novos = [...perfis, novo]
      salvarPerfis(novos)
      setPerfis(novos)
      return novo
    },
    [perfis],
  )

  const editarPerfil = useCallback(
    (id: string, dados: { nome: string; descricao: string; permissoes: string[] }) => {
      const novos = perfis.map((p) =>
        p.id === id
          ? {
              ...p,
              nome: dados.nome.trim(),
              descricao: dados.descricao.trim(),
              permissoes: dados.permissoes,
              atualizadoEm: new Date().toISOString(),
            }
          : p,
      )
      salvarPerfis(novos)
      setPerfis(novos)
      toast.success(`Perfil "${dados.nome.trim()}" atualizado.`)
    },
    [perfis],
  )

  const excluirPerfil = useCallback(
    (id: string) => {
      const alvo = perfis.find((p) => p.id === id)
      if (!alvo) return { ok: false, motivo: 'NAO_ENCONTRADO' }
      if (alvo.sistema) return { ok: false, motivo: 'PERFIL_SISTEMA' }
      if (usuarios.some((u) => u.perfilId === id)) {
        return { ok: false, motivo: 'PERFIL_EM_USO' }
      }
      const novos = perfis.filter((p) => p.id !== id)
      salvarPerfis(novos)
      setPerfis(novos)
      return { ok: true }
    },
    [perfis, usuarios],
  )

  /** Salva (cria ou atualiza) um perfil — usado pela tela de Perfis. */
  const salvarPerfil = useCallback(
    (dados: { id: string; nome: string; descricao: string; permissoes: string[] }) => {
      if (dados.id) {
        editarPerfil(dados.id, dados)
        return
      }
      const novo: Perfil = {
        id: `perfil-${crypto.randomUUID()}`,
        nome: dados.nome.trim(),
        descricao: dados.descricao.trim(),
        permissoes: permissoesConhecidas(dados.permissoes),
        sistema: false,
        atualizadoEm: new Date().toISOString(),
      }
      const novos = [...perfis, novo]
      salvarPerfis(novos)
      setPerfis(novos)
    },
    [perfis, editarPerfil],
  )

  // ============ Permissões ============

  const temPermissao = useCallback(
    (chave: string) => {
      if (!usuarioAtual) return false
      // 'painel' é a home: sempre visível para quem está logado
      if (chave === 'tela-painel') return true
      // O Administrador (perfil do onboarding) tem acesso total INALIENÁVEL,
      // garantido por código — nem uma matriz corrompida bloqueia o admin.
      if (usuarioAtual.perfilId === 'perfil-administrador') return true
      const doPerfil = perfis.find((p) => p.id === usuarioAtual.perfilId)?.permissoes ?? []
      return doPerfil.includes(chave)
    },
    [usuarioAtual, perfis],
  )

  const value = useMemo<AuthContextType>(
    () => ({
      pronto,
      precisaOnboarding,
      usuarioAtual,
      sessao,
      usuarios,
      perfis,
      entrar,
      sair,
      criarAdministrador,
      redefinirSenhaAdmin,
      criarUsuario,
      editarUsuario,
      alternarAtivoUsuario,
      redefinirSenha,
      criarPerfil,
      editarPerfil,
      salvarPerfil,
      excluirPerfil,
      temPermissao,
    }),
    [
      pronto,
      precisaOnboarding,
      usuarioAtual,
      sessao,
      usuarios,
      perfis,
      entrar,
      sair,
      criarAdministrador,
      redefinirSenhaAdmin,
      criarUsuario,
      editarUsuario,
      alternarAtivoUsuario,
      redefinirSenha,
      criarPerfil,
      editarPerfil,
      salvarPerfil,
      excluirPerfil,
      temPermissao,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth deve ser utilizado dentro de AuthProvider')
  }
  return ctx
}

// Reexporta para quem só precisa da chave da sessão
export { KEY_SESSAO }
