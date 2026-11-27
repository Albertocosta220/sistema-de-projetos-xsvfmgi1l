import { Perfil, Sessao, Usuario, montarPerfisPadrao, TODAS_PERMISSOES } from '@/types/usuario'

const KEY_USUARIOS = 'sigef-usuarios'
const KEY_PERFIS = 'sigef-perfis'
export const KEY_SESSAO = 'sigef-sessao'

/** Hash SHA-256 (Web Crypto) — a senha nunca é persistida em texto puro. */
export async function hashSenha(senha: string): Promise<string> {
  const bytes = new TextEncoder().encode(senha)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function ler<T>(chave: string): T | null {
  try {
    const raw = localStorage.getItem(chave)
    return raw ? (JSON.parse(raw) as T) : null
  } catch (e) {
    console.error(`Erro ao ler ${chave} do localStorage:`, e)
    return null
  }
}

function gravar(chave: string, valor: unknown): void {
  try {
    localStorage.setItem(chave, JSON.stringify(valor))
  } catch (e) {
    console.error(`Erro ao salvar ${chave} no localStorage:`, e)
  }
}

// ============ Perfis ============

export function carregarPerfis(): Perfil[] {
  const lista = ler<Perfil[]>(KEY_PERFIS)
  return Array.isArray(lista) ? lista : []
}

export function salvarPerfis(perfis: Perfil[]): void {
  gravar(KEY_PERFIS, perfis)
}

/**
 * Perfis padrão do sistema (Administrador, Fiscal, Operacional, Consulta).
 * Criados apenas quando não existem — nenhum usuário de exemplo é criado.
 * Anti-deadlock: se o perfil Administrador não existir ou tiver perdido
 * permissões, ele é restaurado com acesso total a cada boot.
 */
export function garantirPerfisPadrao(): Perfil[] {
  const atuais = carregarPerfis()
  if (atuais.length > 0) {
    const admin = atuais.find((p) => p.id === 'perfil-administrador')
    if (!admin || admin.permissoes.length < TODAS_PERMISSOES.length) {
      let corrigidos = atuais.map((p) =>
        p.id === 'perfil-administrador'
          ? { ...p, permissoes: [...TODAS_PERMISSOES], sistema: true }
          : p,
      )
      if (!admin) {
        corrigidos = [
          {
            id: 'perfil-administrador',
            nome: 'Administrador',
            descricao: 'Acesso total ao sistema, incluindo usuários e perfis',
            permissoes: [...TODAS_PERMISSOES],
            sistema: true,
            atualizadoEm: new Date().toISOString(),
          },
          ...corrigidos,
        ]
      }
      salvarPerfis(corrigidos)
      return corrigidos
    }
    return atuais
  }
  const padroes = montarPerfisPadrao(new Date().toISOString())
  salvarPerfis(padroes)
  return padroes
}

// ============ Usuários ============

export function carregarUsuarios(): Usuario[] {
  const lista = ler<Usuario[]>(KEY_USUARIOS)
  return Array.isArray(lista) ? lista : []
}

export function salvarUsuarios(usuarios: Usuario[]): void {
  gravar(KEY_USUARIOS, usuarios)
}

export function existeAdministrador(): boolean {
  return carregarUsuarios().some((u) => u.perfilId === 'perfil-administrador' && u.ativo)
}

export interface NovoUsuarioAdmin {
  nome: string
  login: string
  senha: string
}

/** Onboarding: cadastra o primeiro usuário com o perfil Administrador. */
export async function cadastrarAdministrador(dados: NovoUsuarioAdmin): Promise<Usuario> {
  const senhaHash = await hashSenha(dados.senha)
  const agora = new Date().toISOString()
  const usuario: Usuario = {
    id: crypto.randomUUID(),
    nome: dados.nome.trim(),
    login: dados.login.trim().toLowerCase(),
    senhaHash,
    perfilId: 'perfil-administrador',
    ativo: true,
    criadoEm: agora,
    atualizadoEm: agora,
  }
  salvarUsuarios([usuario])
  return usuario
}

// ============ Sessão ============

export function carregarSessao(): Sessao | null {
  try {
    const raw = sessionStorage.getItem(KEY_SESSAO) ?? localStorage.getItem(KEY_SESSAO)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Sessao
    if (!parsed?.usuarioId || !parsed?.login) return null
    return parsed
  } catch {
    return null
  }
}

export function salvarSessao(sessao: Sessao): void {
  try {
    sessionStorage.setItem(KEY_SESSAO, JSON.stringify(sessao))
    localStorage.setItem(KEY_SESSAO, JSON.stringify(sessao))
  } catch (e) {
    console.error('Erro ao salvar sessão:', e)
  }
}

export function limparSessao(): void {
  try {
    sessionStorage.removeItem(KEY_SESSAO)
    localStorage.removeItem(KEY_SESSAO)
  } catch {
    // silencioso
  }
}

// ============ Autenticação ============

export type ResultadoLogin =
  | { ok: true; usuario: Usuario }
  | { ok: false; motivo: 'USUARIO_SENHA_INVALIDOS' | 'USUARIO_INATIVO' }

export async function entrar(login: string, senha: string): Promise<ResultadoLogin> {
  const chave = login.trim().toLowerCase()
  const usuario = carregarUsuarios().find((u) => u.login === chave)
  if (!usuario) return { ok: false, motivo: 'USUARIO_SENHA_INVALIDOS' }
  const hash = await hashSenha(senha)
  if (hash !== usuario.senhaHash) return { ok: false, motivo: 'USUARIO_SENHA_INVALIDOS' }
  if (!usuario.ativo) return { ok: false, motivo: 'USUARIO_INATIVO' }

  const atualizado: Usuario = { ...usuario, ultimoLogin: new Date().toISOString() }
  salvarUsuarios(carregarUsuarios().map((u) => (u.id === usuario.id ? atualizado : u)))
  return { ok: true, usuario: atualizado }
}

/** Valida a senha atual de um usuário (ex.: antes de redefinir a própria senha). */
export async function conferirSenha(usuario: Usuario, senha: string): Promise<boolean> {
  const hash = await hashSenha(senha)
  return hash === usuario.senhaHash
}

/** Lista de permissões efetivas de um perfil (vazio se o perfil não existir). */
export function permissoesDoPerfil(perfilId: string): string[] {
  if (perfilId === 'perfil-administrador') return [...TODAS_PERMISSOES]
  return carregarPerfis().find((p) => p.id === perfilId)?.permissoes ?? []
}

/** Garante que perfis recém-criados no código tenham todas as permissões novas. */
export function permissoesConhecidas(permissoes: string[]): string[] {
  return permissoes.filter((p) => TODAS_PERMISSOES.includes(p))
}
