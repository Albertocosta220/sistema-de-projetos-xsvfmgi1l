import pb from '@/lib/pocketbase/client'

/**
 * Camada de persistência no PocketBase (Skip Cloud) com espelho local.
 *
 * Todo o sistema continua lendo/escrevendo por chaves string (mesmas assinaturas
 * síncronas de antes — as telas não mudam), mas agora:
 *   1. na carga, `hidratar()` busca o estado do banco e sobrescreve o cache;
 *   2. cada gravação atualiza o cache + espelho no localStorage e enfileira a
 *      escrita no PocketBase (debounce curto);
 *   3. se o banco está vazio e o navegador tem dados (primeira migração), tudo
 *      é COPIADO para o banco — os dados locais nunca são apagados.
 *
 * Sem rede, o app segue funcionando pelo espelho local e reenvia na próxima
 * gravação (estado 'erro'/'offline' fica observável para a UI).
 */

export type EstadoSync = 'sincronizado' | 'salvando' | 'offline' | 'erro'

/** Chaves que ficam APENAS neste navegador (preferência/sessão/flags one-shot). */
const CHAVES_LOCAIS = new Set([
  'sigef-sessao',
  'sigef_empresa_ativa_id',
  'sigef-seeds-removidos',
  'sigef_dedup_v40',
])

const PREFIXO = 'sigef'
const ehChaveSincronizavel = (chave: string) =>
  chave.startsWith(PREFIXO) && !CHAVES_LOCAIS.has(chave)

// ============ Cache em memória (inicializado do localStorage) ============

const mem = new Map<string, string>()
let memIniciada = false

function iniciarMem() {
  if (memIniciada) return
  memIniciada = true
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith(PREFIXO)) {
        const v = localStorage.getItem(k)
        if (v != null) mem.set(k, v)
      }
    }
  } catch {
    // localStorage indisponível: segue só em memória
  }
}

/** Lê o valor BRUTO (string) da chave — do cache hidratado do banco. */
export function lerRaw(chave: string): string | null {
  iniciarMem()
  const v = mem.get(chave)
  return v === undefined ? null : v
}

/** Lê e faz JSON.parse com proteção — null/undefined em caso de lixo. */
export function lerJson<T>(chave: string): T | null {
  const raw = lerRaw(chave)
  if (raw == null) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    console.error(`[SIGEF] conteúdo inválido para ${chave}; ignorado`)
    return null
  }
}

/** Grava no cache + espelho local + fila de sincronização com o banco. */
export function gravarRaw(chave: string, valor: string): void {
  iniciarMem()
  mem.set(chave, valor)
  try {
    localStorage.setItem(chave, valor)
  } catch {
    // cota/privacidade: segue em memória e no banco
  }
  if (ehChaveSincronizavel(chave)) enfileirar(chave)
}

export function gravarJson(chave: string, valor: unknown): void {
  gravarRaw(chave, JSON.stringify(valor))
}

export function removerChave(chave: string): void {
  iniciarMem()
  mem.delete(chave)
  try {
    localStorage.removeItem(chave)
  } catch {
    // silencioso
  }
}

/**
 * Medida de emergência do boot: apaga TODAS as chaves do sistema (lixo
 * corrompido que derrubaria a inicialização) — usada só quando o boot falha.
 */
export function limparChavesSigef(): void {
  iniciarMem()
  const chaves: string[] = []
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith(PREFIXO)) chaves.push(k)
    }
  } catch {
    // sem storage: nada a limpar
  }
  mem.clear()
  chaves.forEach((k) => {
    try {
      localStorage.removeItem(k)
    } catch {
      // silencioso
    }
  })
}

// ============ Estado de sincronização (observável p/ UI) ============

let estado: EstadoSync = 'sincronizado'
const ouvintes = new Set<(e: EstadoSync) => void>()

export function estadoSync(): EstadoSync {
  return estado
}

export function observarSync(fn: (e: EstadoSync) => void): () => void {
  ouvintes.add(fn)
  fn(estado)
  return () => ouvintes.delete(fn)
}

function mudarEstado(novo: EstadoSync) {
  if (estado === novo) return
  estado = novo
  ouvintes.forEach((fn) => {
    try {
      fn(novo)
    } catch {
      // ouvinte quebrado não derruba a sincronização
    }
  })
}

// ============ Escritas no banco (coleção por tipo de chave) ============

interface MapeamentoColecao {
  colecao: string
  campoChave: string
  campoJson: string
  extrairChave: (registro: any) => string
}

const CHAVE_EMPRESA_STORE = 'sigef_store_empresa_'

function mapeamentoDaChave(chave: string): MapeamentoColecao | null {
  if (chave === 'sigef-usuarios')
    return {
      colecao: 'usuarios',
      campoChave: 'login',
      campoJson: 'dadosJson',
      extrairChave: (r) => r?.login ?? '',
    }
  if (chave === 'sigef-perfis')
    return {
      colecao: 'perfis',
      campoChave: 'nome',
      campoJson: 'dadosJson',
      extrairChave: (r) => r?.nome ?? '',
    }
  if (chave === 'sigef_empresas_lista')
    return {
      colecao: 'empresas',
      campoChave: 'localId',
      campoJson: 'dadosJson',
      extrairChave: (r) => r?.localId ?? '',
    }
  if (chave.startsWith(CHAVE_EMPRESA_STORE))
    return {
      colecao: 'empresa_stores',
      campoChave: 'empresaId',
      campoJson: 'dadosJson',
      extrairChave: (r) => r?.empresaId ?? '',
    }
  return null
}

/** ids dos registros remotos por coleção/chave — populado na hidratação. */
const idsRemotos = new Map<string, Map<string, string>>() // colecao → (valorChave → recordId)

function registroRemoto(m: MapeamentoColecao, valorChave: string): string | undefined {
  return idsRemotos.get(m.colecao)?.get(valorChave)
}

function registrarIdRemoto(m: MapeamentoColecao, valorChave: string, id: string) {
  if (!idsRemotos.has(m.colecao)) idsRemotos.set(m.colecao, new Map())
  idsRemotos.get(m.colecao)!.set(valorChave, id)
}

async function escreverChaveNoBanco(chave: string): Promise<void> {
  const raw = mem.get(chave)
  if (raw === undefined) return
  const m = mapeamentoDaChave(chave)

  if (!m) {
    // Chave simples → kv_sigef (chave → valorJson)
    const existente = registroRemoto(
      { colecao: 'kv_sigef', campoChave: 'chave', campoJson: 'valorJson', extrairChave: (r) => r?.chave ?? '' },
      chave,
    )
    const dados = { chave, valorJson: raw }
    if (existente) {
      await pb.collection('kv_sigef').update(existente, dados)
    } else {
      const criado = await pb.collection('kv_sigef').create(dados)
      registrarIdRemoto(
        { colecao: 'kv_sigef', campoChave: 'chave', campoJson: 'valorJson', extrairChave: (r) => r?.chave ?? '' },
        chave,
        criado.id,
      )
    }
    return
  }

  // Coleção "lista": cada elemento do array vira um registro (upsert por chave;
  // elementos removidos do array são apagados do banco).
  let lista: any[] = []
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) lista = parsed
  } catch {
    return // conteúdo inválido: não sobrescreve o banco com lixo
  }
  const valorChave = chave.startsWith(CHAVE_EMPRESA_STORE)
    ? chave.slice(CHAVE_EMPRESA_STORE.length)
    : ''

  if (m.colecao === 'empresa_stores') {
    // A store inteira da empresa é UM registro (documento fiscal único).
    const existente = registroRemoto(m, valorChave)
    const dados = { empresaId: valorChave, dadosJson: raw }
    if (existente) {
      await pb.collection(m.colecao).update(existente, dados)
    } else {
      const criado = await pb.collection(m.colecao).create(dados)
      registrarIdRemoto(m, valorChave, criado.id)
    }
    return
  }

  const chavesAtuais = new Set<string>()
  for (const item of lista) {
    const vk = m.extrairChave(item)
    if (!vk) continue
    chavesAtuais.add(vk)
    const existente = registroRemoto(m, vk)
    const dados = { [m.campoChave]: vk, [m.campoJson]: JSON.stringify(item) }
    if (existente) {
      await pb.collection(m.colecao).update(existente, dados)
    } else {
      const criado = await pb.collection(m.colecao).create(dados)
      registrarIdRemoto(m, vk, criado.id)
    }
  }
  // Remove do banco registros que saíram da lista local
  const remotos = idsRemotos.get(m.colecao)
  if (remotos) {
    for (const [vk, id] of [...remotos.entries()]) {
      if (!chavesAtuais.has(vk)) {
        try {
          await pb.collection(m.colecao).delete(id)
        } catch {
          // já removido em outro lugar
        }
        remotos.delete(vk)
      }
    }
  }
}

// ============ Fila de gravação (debounce) ============

const fila = new Set<string>()
let timer: ReturnType<typeof setTimeout> | null = null

function enfileirar(chave: string) {
  fila.add(chave)
  mudarEstado('salvando')
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    void descarregar()
  }, 700)
}

async function descarregar(): Promise<void> {
  timer = null
  const pendentes = [...fila]
  fila.clear()
  if (pendentes.length === 0) {
    if (estado === 'salvando') mudarEstado('sincronizado')
    return
  }
  try {
    for (const chave of pendentes) {
      await escreverChaveNoBanco(chave)
    }
    mudarEstado('sincronizado')
  } catch (e) {
    console.error('[SIGEF] falha ao sincronizar com o banco:', e)
    // Devolve à fila: a próxima gravação (ou recarga) tenta de novo
    pendentes.forEach((k) => fila.add(k))
    mudarEstado('erro')
  }
}

// ============ Hidratação: banco → cache, e migração local → banco ============

const KVMAP: MapeamentoColecao = {
  colecao: 'kv_sigef',
  campoChave: 'chave',
  campoJson: 'valorJson',
  extrairChave: (r) => r?.chave ?? '',
}

async function buscarTodos(colecao: string): Promise<any[]> {
  return pb.collection(colecao).getFullList({ sort: '-created', batch: 500 } as any)
}

/** Reconstrói o JSON de lista (usuarios/perfis/empresas) a partir dos registros. */
function reconstruirLista(m: MapeamentoColecao, registros: any[]): string {
  const itens: unknown[] = []
  for (const r of registros) {
    try {
      itens.push(JSON.parse(r[m.campoJson]))
    } catch {
      // registro corrompido no banco: ignorado
    }
  }
  return JSON.stringify(itens)
}

let hidratada = false

/**
 * Carrega o estado do PocketBase para o cache. Depois:
 * - se o banco está VAZIO e o navegador tem dados → copia tudo para o banco
 *   (migração one-shot do localStorage existente; nada é apagado localmente);
 * - se falhou a rede → mantém o espelho local (o app funciona como antes).
 */
export async function hidratar(): Promise<void> {
  iniciarMem()
  if (hidratada) return
  hidratada = true

  let remotoOk = false
  try {
    const [empresas, usuarios, perfis, stores, kvs] = await Promise.all([
      buscarTodos('empresas'),
      buscarTodos('usuarios'),
      buscarTodos('perfis'),
      buscarTodos('empresa_stores'),
      buscarTodos('kv_sigef'),
    ])

    const vazios = empresas.length + usuarios.length + perfis.length + stores.length + kvs.length
    remotoOk = true

    if (vazios === 0) {
      // Banco vazio: semeia com o que existe neste navegador (migração one-shot)
      const locais = [...mem.keys()].filter(ehChaveSincronizavel)
      if (locais.length > 0) {
        locais.forEach((k) => fila.add(k))
        await descarregar()
      }
      return
    }

    // Remoto tem dados: sobrescreve o cache/local com o estado do banco
    idsRemotos.clear()
    registrarIds('empresas', empresas, 'localId')
    registrarIds('usuarios', usuarios, 'login')
    registrarIds('perfis', perfis, 'nome')
    registrarIds('kv_sigef', kvs, 'chave')

    aplicarChave('sigef_empresas_lista', reconstruirLista(
      { colecao: 'empresas', campoChave: 'localId', campoJson: 'dadosJson', extrairChave: (r) => r?.localId ?? '' },
      empresas,
    ))
    aplicarChave('sigef-usuarios', reconstruirLista(
      { colecao: 'usuarios', campoChave: 'login', campoJson: 'dadosJson', extrairChave: (r) => r?.login ?? '' },
      usuarios,
    ))
    aplicarChave('sigef-perfis', reconstruirLista(
      { colecao: 'perfis', campoChave: 'nome', campoJson: 'dadosJson', extrairChave: (r) => r?.nome ?? '' },
      perfis,
    ))
    for (const s of stores) {
      if (!s?.empresaId) continue
      registrarIds('empresa_stores', [s], 'empresaId')
      aplicarChave(`${CHAVE_EMPRESA_STORE}${s.empresaId}`, s.dadosJson ?? '')
    }
    for (const kv of kvs) {
      if (!kv?.chave) continue
      aplicarChave(kv.chave, kv.valorJson ?? '')
    }
    mudarEstado('sincronizado')
  } catch (e) {
    console.error('[SIGEF] banco indisponível na hidratação; usando espelho local:', e)
    mudarEstado('offline')
    hidratada = remotoOk // permite nova tentativa em gravações futuras
    if (!remotoOk) hidratada = false
  }
}

function registrarIds(colecao: string, registros: any[], campo: string) {
  if (!idsRemotos.has(colecao)) idsRemotos.set(colecao, new Map())
  const mapa = idsRemotos.get(colecao)!
  registros.forEach((r) => {
    const vk = r?.[campo]
    if (vk) mapa.set(String(vk), r.id)
  })
}

/** Aplica o valor remoto ao cache e ao espelho local (SEM reenfileirar). */
function aplicarChave(chave: string, valor: string) {
  mem.set(chave, valor)
  try {
    localStorage.setItem(chave, valor)
  } catch {
    // espelho local cheio: o banco é a fonte
  }
}
