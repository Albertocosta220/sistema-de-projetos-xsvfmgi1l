import { Perfil, Sessao, Usuario, montarPerfisPadrao, TODAS_PERMISSOES } from '@/types/usuario'
import { lerJson, gravarJson, removerChave, hidratar } from './bancoService'

const KEY_USUARIOS = 'sigef-usuarios'
const KEY_PERFIS = 'sigef-perfis'
export const KEY_SESSAO = 'sigef-sessao'

/**
 * Id único à prova de contexto: crypto.randomUUID() NÃO existe em contextos
 * não seguros (http fora de localhost — ex.: preview/IP da rede), e chamá-lo
 * derruba a tela de login inteira no ErrorBoundary. Fallback local seguro.
 */
export function novoId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID()
    }
  } catch {
    // segue para o fallback
  }
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10)
}

const SHA256_K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e37c08c, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]

const rotr = (x: number, n: number): number => (x >>> n) | (x << (32 - n))

/**
 * SHA-256 em JavaScript puro (mesmo resultado do Web Crypto). Usado quando
 * crypto.subtle não está disponível (páginas fora de HTTPS/localhost), para que
 * o login funcione e os hashes já gravados continuem válidos.
 */
function sha256Js(bytes: Uint8Array): string {
  const bitLen = bytes.length * 8
  const padLen = ((bytes.length + 9 + 63) >> 6) << 6
  const buf = new Uint8Array(padLen)
  buf.set(bytes)
  buf[bytes.length] = 0x80
  const view = new DataView(buf.buffer)
  view.setUint32(padLen - 8, Math.floor(bitLen / 0x100000000))
  view.setUint32(padLen - 4, bitLen >>> 0)

  const H = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]
  const W = new Uint32Array(64)
  for (let off = 0; off < padLen; off += 64) {
    for (let i = 0; i < 16; i++) W[i] = view.getUint32(off + i * 4)
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(W[i - 15], 7) ^ rotr(W[i - 15], 18) ^ (W[i - 15] >>> 3)
      const s1 = rotr(W[i - 2], 17) ^ rotr(W[i - 2], 19) ^ (W[i - 2] >>> 10)
      W[i] = (W[i - 16] + s0 + W[i - 7] + s1) >>> 0
    }
    let [a, b, c, d, e, f, g, h] = H
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)
      const ch = (e & f) ^ (~e & g)
      const t1 = (h + S1 + ch + SHA256_K[i] + W[i]) >>> 0
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)
      const maj = (a & b) ^ (a & c) ^ (b & c)
      const t2 = (S0 + maj) >>> 0
      h = g
      g = f
      f = e
      e = (d + t1) >>> 0
      d = c
      c = b
      b = a
      a = (t1 + t2) >>> 0
    }
    const v = [a, b, c, d, e, f, g, h]
    for (let i = 0; i < 8; i++) H[i] = (H[i] + v[i]) >>> 0
  }
  return H.map((x) => x.toString(16).padStart(8, '0')).join('')
}

/** Hash SHA-256 — a senha nunca é persistida em texto puro. */
export async function hashSenha(senha: string): Promise<string> {
  const bytes = new TextEncoder().encode(senha)
  if (globalThis.crypto?.subtle) {
    try {
      const digest = await crypto.subtle.digest('SHA-256', bytes)
      return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
    } catch {
      // cai no cálculo em JS abaixo
    }
  }
  return sha256Js(bytes)
}

/**
 * Hashes candidatos da senha digitada: o do Web Crypto e o do cálculo em JS.
 * Os dois devem dar o mesmo resultado; aceitar qualquer um evita recusar uma
 * senha correta gravada por outro caminho de cálculo (ex.: página sem HTTPS).
 */
async function hashesCandidatos(senha: string): Promise<string[]> {
  const bytes = new TextEncoder().encode(senha)
  const candidatos = new Set<string>([sha256Js(bytes)])
  candidatos.add(await hashSenha(senha))
  // Forma Unicode NFC: a mesma senha digitada com acentos decompostos (teclados/SO
  // diferentes) gera bytes diferentes; aceita as duas formas.
  const nfc = senha.normalize('NFC')
  if (nfc !== senha) {
    candidatos.add(sha256Js(new TextEncoder().encode(nfc)))
    candidatos.add(await hashSenha(nfc))
  }
  // Variante sem espaços acidentais de digitação (ex.: espaço no fim do campo).
  const semEspacos = senha.trim()
  if (semEspacos && semEspacos !== senha) {
    candidatos.add(sha256Js(new TextEncoder().encode(semEspacos)))
    candidatos.add(await hashSenha(semEspacos))
  }
  return [...candidatos]
}

// ============ Perfis ============

export function carregarPerfis(): Perfil[] {
  const lista = lerJson<Perfil[]>(KEY_PERFIS)
  return Array.isArray(lista) ? (lista as Perfil[]) : []
}

export function salvarPerfis(perfis: Perfil[]): void {
  gravarJson(KEY_PERFIS, perfis)
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
    const admin = atuais.find((p) => p?.id === 'perfil-administrador')
    if (
      !admin ||
      !Array.isArray(admin.permissoes) ||
      admin.permissoes.length < TODAS_PERMISSOES.length
    ) {
      let corrigidos = atuais.map((p) =>
        p?.id === 'perfil-administrador'
          ? {
              ...p,
              // Perfil corrompido (null ou permissoes não-array) é restaurado,
              // não propagado — o boot do AuthContext roda antes de /login.
              ...(p && typeof p === 'object'
                ? p
                : { id: 'perfil-administrador', nome: 'Administrador' }),
              permissoes: [...TODAS_PERMISSOES],
              sistema: true,
            }
          : p && typeof p === 'object'
            ? p
            : null,
      )
      corrigidos = corrigidos.filter((p): p is Perfil => !!p)
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
  const lista = lerJson<Usuario[]>(KEY_USUARIOS)
  return Array.isArray(lista) ? (lista as Usuario[]) : []
}

export function salvarUsuarios(usuarios: Usuario[]): void {
  gravarJson(KEY_USUARIOS, usuarios)
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
    id: novoId(),
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

/**
 * A sessão vive APENAS no sessionStorage: recarregar a aba (F5) mantém o
 * usuário logado, mas fechar e reabrir o navegador (ou abrir o app de novo)
 * sempre começa pela tela de login.
 * Migração: sessões antigas gravadas no localStorage são descartadas na
 * primeira leitura — obriga novo login uma única vez.
 */
export function carregarSessao(): Sessao | null {
  try {
    const raw = sessionStorage.getItem(KEY_SESSAO)
    if (raw) {
      const parsed = JSON.parse(raw) as Sessao
      if (!parsed?.usuarioId || !parsed?.login) return null
      return parsed
    }
    // Legado: sessão persistida indevidamente no localStorage — descarta.
    if (localStorage.getItem(KEY_SESSAO)) {
      localStorage.removeItem(KEY_SESSAO)
    }
    return null
  } catch {
    return null
  }
}

export function salvarSessao(sessao: Sessao): void {
  try {
    sessionStorage.setItem(KEY_SESSAO, JSON.stringify(sessao))
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
  const candidatos = await hashesCandidatos(senha)
  if (!candidatos.includes(usuario.senhaHash)) {
    return { ok: false, motivo: 'USUARIO_SENHA_INVALIDOS' }
  }
  if (!usuario.ativo) return { ok: false, motivo: 'USUARIO_INATIVO' }

  const atualizado: Usuario = { ...usuario, ultimoLogin: new Date().toISOString() }
  salvarUsuarios(carregarUsuarios().map((u) => (u.id === usuario.id ? atualizado : u)))
  return { ok: true, usuario: atualizado }
}

/** Valida a senha atual de um usuário (ex.: antes de redefinir a própria senha). */
export async function conferirSenha(usuario: Usuario, senha: string): Promise<boolean> {
  return (await hashesCandidatos(senha)).includes(usuario.senhaHash)
}

/**
 * Auto-recuperação de acesso: recadastra a senha de um usuário ADMINISTRADOR
 * já existente (apaga o hash antigo e grava o novo) e reativa o usuário, para
 * que o dono do sistema nunca fique preso fora do SIGEF-ME. Se o login
 * informado não for de um admin e existir exatamente um administrador ativo,
 * usa esse.
 */
export type ResultadoRedefinicaoAdmin =
  | { ok: true; login: string; nome: string }
  | { ok: false; motivo: 'USUARIO_NAO_ENCONTRADO' }

export async function redefinirSenhaAdministrador(
  login: string,
  novaSenha: string,
): Promise<ResultadoRedefinicaoAdmin> {
  const usuarios = carregarUsuarios()
  const admins = usuarios.filter((u) => u.perfilId === 'perfil-administrador')
  const chave = login.trim().toLowerCase()
  const alvo =
    admins.find((u) => u.login === chave) ?? (admins.length === 1 ? admins[0] : undefined)
  if (!alvo) return { ok: false, motivo: 'USUARIO_NAO_ENCONTRADO' }
  const senhaHash = await hashSenha(novaSenha)
  salvarUsuarios(
    usuarios.map((u) =>
      u.id === alvo.id
        ? { ...u, senhaHash, ativo: true, atualizadoEm: new Date().toISOString() }
        : u,
    ),
  )
  return { ok: true, login: alvo.login, nome: alvo.nome }
}

/** Lista de permissões efetivas de um perfil (vazio se o perfil não existir). */
export function permissoesDoPerfil(perfilId: string): string[] {
  if (perfilId === 'perfil-administrador') return [...TODAS_PERMISSOES]
  const perfil = carregarPerfis().find((p) => p?.id === perfilId)
  return Array.isArray(perfil?.permissoes) ? perfil.permissoes : []
}

/** Garante que perfis recém-criados no código tenham todas as permissões novas. */
export function permissoesConhecidas(permissoes: string[]): string[] {
  return permissoes.filter((p) => TODAS_PERMISSOES.includes(p))
}

// hidratar é reexportado para o boot do app (App/main) sem novo import de módulo
export { hidratar }
