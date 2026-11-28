import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react'
import {
  hashSenha,
  novoId,
  garantirPerfisPadrao,
  carregarUsuarios,
  salvarUsuarios,
  carregarPerfis,
  salvarPerfis,
  entrar,
  conferirSenha,
  redefinirSenhaAdministrador,
  carregarSessao,
  salvarSessao,
  limparSessao,
  existeAdministrador,
  cadastrarAdministrador,
} from '@/services/authService'
import type { Sessao, Usuario, Perfil } from '@/types/usuario'
import { TODAS_PERMISSOES } from '@/types/usuario'

export interface NovoUsuario {
  nome: string
  login: string
  senha: string
  perfilId: string
  ativo?: boolean
}

/**
 * Estado de autenticação do SIGEF-ME.
 *
 * Boot blindado (v0.0.47+): toda a inicialização roda em try/catch/finally —
 * localStorage corrompido, usuários/perfis null ou perfis quebrados NUNCA
 * derrubam a aplicação nem deixam /login travado; `pronto` é sempre setado.
 * A sessão vive no sessionStorage (recarregar mantém login; fechar o navegador
 * pede login de novo). Persistência real: authService grava usuários/perfis no
 * PocketBase via bancoService (espelho local para uso offline).
 */

interface AuthContextValor {
  pronto: boolean
  sessao: Sessao | null
  usuarios: Usuario[]
  perfis: Perfil[]
  existeAdmin: boolean
  entrar: (login: string, senha: string) => Promise<ResultadoLoginTipo>
  sair: () => void
  cadastrarAdministrador: (dados: NovoUsuarioAdminTipo) => Promise<Usuario>
  existeAdministrador: () => boolean
  criarUsuario: (dados: NovoUsuario) => Promise<Usuario>
  atualizarUsuario: (id: string, dados: Partial<Usuario>) => Promise<void>
  alternarAtivoUsuario: (id: string) => Promise<void>
  redefinirSenha: (id: string, novaSenha: string) => Promise<void>
  trocarPropriaSenha: (
    id: string,
    senhaAtual: string,
    novaSenha: string,
  ) => Promise<ResultadoTrocaSenha>
  redefinirSenhaAdmin: (login: string, novaSenha: string) => Promise<ResultadoRedefinicaoTipo>
  criarPerfil: (dados: { nome: string; descricao: string; permissoes: string[] }) => Perfil
  atualizarPerfil: (id: string, dados: Partial<Perfil>) => Promise<void>
  excluirPerfil: (id: string) => Promise<void>
  temPermissao: (codigo: string) => boolean
}

import type { ResultadoLogin, ResultadoRedefinicaoAdmin } from '@/services/authService'

type ResultadoLoginTipo = ResultadoLogin
type ResultadoRedefinicaoTipo = ResultadoRedefinicaoAdmin
type ResultadoTrocaSenha = { ok: true } | { ok: false; motivo: 'SENHA_ATUAL_INVALIDA' }
type NovoUsuarioAdminTipo = { nome: string; login: string; senha: string }

const AuthContext = createContext<AuthContextValor | undefined>(undefined)

function montarSessao(usuario: Usuario): Sessao {
  return {
    usuarioId: usuario.id,
    login: usuario.login,
    nome: usuario.nome,
    perfilId: usuario.perfilId,
    iniciadaEm: new Date().toISOString(),
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [pronto, setPronto] = useState(false)
  const [sessao, setSessao] = useState<Sessao | null>(null)
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [perfis, setPerfis] = useState<Perfil[]>([])
  const [existeAdmin, setExisteAdmin] = useState(false)

  useEffect(() => {
    let ativo = true
    const carregar = async () => {
      try {
        const perfisGarantidos = garantirPerfisPadrao()
        const listaUsuarios = carregarUsuarios().filter(
          (u): u is Usuario => !!u && typeof u === 'object' && !!u.id,
        )
        if (!ativo) return
        setPerfis(perfisGarantidos)
        setUsuarios(listaUsuarios)
        setExisteAdmin(existeAdministrador())
        const atual = carregarSessao()
        if (atual && listaUsuarios.some((u) => u.id === atual.usuarioId && u.ativo)) {
          setSessao(atual)
        } else if (atual) {
          limparSessao()
        }
      } catch (e) {
        // Dado corrompido NUNCA derruba o boot: estado limpo e /login normal.
        console.error('[SIGEF] falha no boot de autenticação; estado limpo:', e)
        if (ativo) {
          try {
            limparSessao()
            const padroes = garantirPerfisPadrao()
            setPerfis(padroes)
            setUsuarios([])
          } catch {
            // nem os padrões: segue com listas vazias
          }
          setSessao(null)
        }
      } finally {
        if (ativo) setPronto(true)
      }
    }
    void carregar()
    return () => {
      ativo = false
    }
  }, [])

  const sessaoAtual = useMemo(() => sessao, [sessao])

  const efetuarLogin = async (login: string, senha: string) => {
    let resultado: ResultadoLoginTipo
    try {
      resultado = await entrar(login, senha)
    } catch (e) {
      // Rede/parse quebrado nunca derruba /login: volta como credencial inválida.
      console.error('[SIGEF] falha no entrar():', e)
      resultado = { ok: false, motivo: 'USUARIO_SENHA_INVALIDOS' }
    }
    if (resultado.ok) {
      const nova = montarSessao(resultado.usuario)
      salvarSessao(nova)
      setSessao(nova)
      setUsuarios(carregarUsuarios())
    }
    return resultado
  }

  const sair = () => {
    limparSessao()
    setSessao(null)
  }

  const cadastrarPrimeiroAdmin = async (dados: NovoUsuarioAdminTipo) => {
    const usuario = await cadastrarAdministrador(dados)
    setUsuarios(carregarUsuarios())
    setExisteAdmin(true)
    const nova = montarSessao(usuario)
    salvarSessao(nova)
    setSessao(nova)
    return usuario
  }

  const criarUsuario = async (dados: NovoUsuario): Promise<Usuario> => {
    const agora = new Date().toISOString()
    const novo: Usuario = {
      id: novoId(),
      nome: dados.nome.trim(),
      login: dados.login.trim().toLowerCase(),
      senhaHash: await hashSenha(dados.senha),
      perfilId: dados.perfilId,
      ativo: dados.ativo ?? true,
      criadoEm: agora,
      atualizadoEm: agora,
    }
    salvarUsuarios([...carregarUsuarios(), novo])
    setUsuarios(carregarUsuarios())
    return novo
  }

  const atualizarUsuario = async (id: string, dados: Partial<Usuario>) => {
    salvarUsuarios(
      carregarUsuarios().map((u) =>
        u.id === id ? { ...u, ...dados, atualizadoEm: new Date().toISOString() } : u,
      ),
    )
    setUsuarios(carregarUsuarios())
    if (sessaoAtual?.usuarioId === id && dados.perfilId) {
      setSessao({ ...sessaoAtual, perfilId: dados.perfilId })
    }
  }

  const alternarAtivoUsuario = async (id: string) => {
    salvarUsuarios(
      carregarUsuarios().map((u) =>
        u.id === id ? { ...u, ativo: !u.ativo, atualizadoEm: new Date().toISOString() } : u,
      ),
    )
    setUsuarios(carregarUsuarios())
    if (sessaoAtual?.usuarioId === id && !carregarUsuarios().find((u) => u.id === id)?.ativo) {
      sair()
    }
  }

  const redefinirSenha = async (id: string, novaSenha: string) => {
    const senhaHash = await hashSenha(novaSenha)
    salvarUsuarios(
      carregarUsuarios().map((u) =>
        u.id === id ? { ...u, senhaHash, atualizadoEm: new Date().toISOString() } : u,
      ),
    )
    setUsuarios(carregarUsuarios())
  }

  const trocarPropriaSenha = async (
    id: string,
    senhaAtual: string,
    novaSenha: string,
  ): Promise<ResultadoTrocaSenha> => {
    const alvo = carregarUsuarios().find((u) => u.id === id)
    if (!alvo || !(await conferirSenha(alvo, senhaAtual))) {
      return { ok: false, motivo: 'SENHA_ATUAL_INVALIDA' }
    }
    await redefinirSenha(id, novaSenha)
    return { ok: true }
  }

  const redefinirSenhaAdmin = async (login: string, novaSenha: string) =>
    redefinirSenhaAdministrador(login, novaSenha)

  const criarPerfil = (dados: {
    nome: string
    descricao: string
    permissoes: string[]
  }): Perfil => {
    const novo: Perfil = {
      id: novoId(),
      nome: dados.nome.trim(),
      descricao: dados.descricao.trim(),
      permissoes: dados.permissoes,
      sistema: false,
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString(),
    }
    salvarPerfis([...carregarPerfis(), novo])
    setPerfis(carregarPerfis())
    return novo
  }

  const atualizarPerfil = async (id: string, dados: Partial<Perfil>) => {
    if (id === 'perfil-administrador') return // acesso total inalienável
    salvarPerfis(
      carregarPerfis().map((p) =>
        p.id === id
          ? {
              ...p,
              ...dados,
              ...(dados.permissoes !== undefined ? { permissoes: dados.permissoes } : {}),
              atualizadoEm: new Date().toISOString(),
            }
          : p,
      ),
    )
    setPerfis(carregarPerfis())
  }

  const excluirPerfil = async (id: string) => {
    if (id === 'perfil-administrador') return // inalienável
    salvarPerfis(carregarPerfis().filter((p) => p.id !== id))
    setPerfis(carregarPerfis())
  }

  const temPermissao = (codigo: string): boolean => {
    if (!sessaoAtual) return false
    if (sessaoAtual.perfilId === 'perfil-administrador') return true
    const perfil = perfis.find((p) => p?.id === sessaoAtual.perfilId)
    return Array.isArray(perfil?.permissoes) && perfil.permissoes.includes(codigo)
  }

  const valor: AuthContextValor = {
    pronto,
    sessao: sessaoAtual,
    usuarios,
    perfis,
    existeAdmin,
    entrar: efetuarLogin,
    sair,
    cadastrarAdministrador: cadastrarPrimeiroAdmin,
    existeAdministrador: () => existeAdmin,
    criarUsuario,
    atualizarUsuario,
    alternarAtivoUsuario,
    redefinirSenha,
    trocarPropriaSenha,
    redefinirSenhaAdmin,
    criarPerfil,
    atualizarPerfil,
    excluirPerfil,
    temPermissao,
  }

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValor {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider')
  return ctx
}
