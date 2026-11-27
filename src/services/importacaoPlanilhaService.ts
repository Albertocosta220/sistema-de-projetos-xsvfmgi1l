// Importador de planilha de cadastro de itens (Sucatas) — SIGEF-ME
// Lê a aba "Sucatas Cadastro" (fallback: primeira aba) de um XLSX/CSV e mapeia
// colunas por cabeçalho tolerante, gerando produtos prontos para upsert no catálogo.
import * as XLSX from 'xlsx'
import { Produto } from '@/types/sigef'

export interface ResultadoImportacaoPlanilha {
  produtos: Produto[]
  totalLinhas: number
  itensParaRevisao: number
  abaUtilizada: string
  colunasIgnoradas: string[]
}

/** Resultado da comparação da planilha com o catálogo existente (prévia do importador). */
export interface ComparacaoCatalogo {
  novos: Produto[]
  atualizados: Produto[]
  inalterados: number
}

/**
 * Compara os produtos lidos da planilha com o catálogo (por código de inventário):
 * novo → cria; existente com dados divergentes → atualiza; idêntico → preserva.
 * Usada tanto na prévia (UI) quanto no upsert do SigefContext.
 */
export function compararComCatalogo(
  produtosImportados: Produto[],
  catalogo: Produto[],
): ComparacaoCatalogo {
  const mapa = new Map(catalogo.map((p) => [p.codigoInventario.trim().toUpperCase(), p] as const))
  const novos: Produto[] = []
  const atualizados: Produto[] = []
  let inalterados = 0

  produtosImportados.forEach((p) => {
    const chave = p.codigoInventario.trim().toUpperCase()
    const existente = mapa.get(chave)
    if (!existente) {
      novos.push(p)
    } else {
      const igual =
        existente.descricao === p.descricao &&
        existente.ncm === p.ncm &&
        existente.unidade === p.unidade &&
        existente.cstIcms === p.cstIcms &&
        existente.cstPisCofins === p.cstPisCofins
      if (igual) inalterados++
      else atualizados.push(p)
    }
  })

  return { novos, atualizados, inalterados }
}

export const ABA_SUCATAS = 'Sucatas Cadastro'

/** Marcadores (em qualquer coluna) que marcam o item para revisão manual. */
const MARCADORES_REVISAO = ['SEM CORRESPONDÊNCIA', 'SEM CORRESPONDENCIA', 'REVISAR']

const MARCADORES_VAZIOS = ['', '-', 'SEM GTIN', 'N/A', 'NAO', 'NÃO', 'NULL', 'UNDEFINED']

/** Normaliza texto de cabeçalho: sem acentos, sem espaços/pontuação, maiúsculo. */
function normalizar(texto: unknown): string {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase()
    .trim()
}

function texto(valor: unknown): string {
  const t = String(valor ?? '').trim()
  return MARCADORES_VAZIOS.includes(t.toUpperCase()) ? '' : t
}

function numero(valor: unknown): number {
  if (valor === null || valor === undefined || valor === '') return 0
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : 0
  const t = String(valor).trim().replace(/\s/g, '').replace(',', '.')
  const n = parseFloat(t)
  return Number.isFinite(n) ? n : 0
}

/** Procura em uma linha qualquer célula com marcador de revisão ("SEM CORRESPONDÊNCIA" etc.). */
function linhaPedeRevisao(linha: Record<string, unknown>): string | null {
  for (const valor of Object.values(linha)) {
    const t = String(valor ?? '')
      .trim()
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
    for (const marcador of MARCADORES_REVISAO) {
      const m = normalizar(marcador)
      if (t.includes(m)) return String(marcador)
    }
  }
  return null
}

/** Aceita variações com/sem acento, abreviação e prefixo (ex: "CST_PIS_COFINS_ENTRADA"). */
function casarCabecalho(alvo: string[], disponiveis: string[]): string | undefined {
  return alvo
    .map((a) => normalizar(a))
    .map((n) => disponiveis.find((d) => d === n || d.startsWith(n)))
    .find((d) => d !== undefined)
}

export async function lerPlanilhaSucatas(file: File): Promise<ResultadoImportacaoPlanilha> {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array' })

  const nomeAba =
    workbook.SheetNames.find((n) => normalizar(n) === normalizar(ABA_SUCATAS)) ||
    workbook.SheetNames[0]
  if (!nomeAba) {
    throw new Error('A planilha não possui abas legíveis.')
  }
  const planilha = workbook.Sheets[nomeAba]
  const linhas = XLSX.utils.sheet_to_json<Record<string, unknown>>(planilha, { defval: '' })
  if (linhas.length === 0) {
    throw new Error(`A aba "${nomeAba}" está vazia.`)
  }

  const disponiveis = Object.keys(linhas[0]).map((k) => ({
    original: k,
    norm: normalizar(k),
  }))
  const nomesNorm = disponiveis.map((d) => d.norm)

  const campo = (alvos: string[]): string | undefined => {
    const achado = casarCabecalho(alvos, nomesNorm)
    return achado ? disponiveis.find((d) => d.norm === achado)?.original : undefined
  }

  const colCodigo = campo(['COD_ITEM', 'Código', 'CODIGO_ITEM', 'COD_PROD'])
  const colDescricao = campo(['DESCR_ITEM', 'Descrição', 'DESCRICAO', 'XPROD'])
  const colUnidade = campo(['UNID_INV', 'Unidade', 'UNIDADE_INV', 'UN'])
  const colNcm = campo(['COD_NCM', 'NCM', 'NCM_padronizado', 'NCM padronizado'])
  const colCstIcms = campo(['CST_ICMS', 'CST ICMS entrada', 'CSTICMS'])
  const colCstPisCofins = campo([
    'CST_PIS_COFINS_ENTRADA',
    'CST_PIS_COFINS',
    'CST PIS/COFINS entrada',
    'CSTPISCOFINSENT',
  ])
  const colNatRec = campo(['NAT_REC', 'NAT_REC_PIS_COFINS', 'Natureza da Receita (código)'])
  const colAliqIcms = campo(['ALIQ_ICMS', 'Alíquota interna ICMS-ES (%)', 'ALIQICMS'])
  const colAliqPis = campo(['ALIQ_PIS', 'ALIQ_PIS_PERCENT', 'PIS'])
  const colAliqCofins = campo(['ALIQ_COFINS', 'ALIQ_COFINS_PERCENT', 'COFINS'])

  if (!colCodigo || !colDescricao) {
    throw new Error(
      'Não encontrei as colunas COD_ITEM e DESCR_ITEM na aba. Confira se a aba correta foi selecionada.',
    )
  }

  const produtos: Produto[] = []
  let itensParaRevisao = 0
  const codigosVistos = new Set<string>()

  for (const linha of linhas) {
    const codigo = texto(linha[colCodigo])
    const descricao = texto(linha[colDescricao])
    if (!codigo || !descricao) continue // linha em branco/truncada

    const codigoNorm = codigo.toUpperCase()
    if (codigosVistos.has(codigoNorm)) continue // dedup dentro da própria planilha
    codigosVistos.add(codigoNorm)

    const ncmBruto = colNcm ? texto(linha[colNcm]) : ''
    const ncm = ncmBruto.replace(/\D/g, '').slice(0, 8)

    const pendencias: string[] = []
    const marcador = linhaPedeRevisao(linha)
    if (marcador) pendencias.push(marcador)
    if (!ncm) pendencias.push('NCM ausente')
    if (!colUnidade || !texto(linha[colUnidade])) pendencias.push('Unidade ausente')

    const unidade = (colUnidade ? texto(linha[colUnidade]) : 'KG').toUpperCase() || 'KG'
    const cstIcms = (colCstIcms ? texto(linha[colCstIcms]) : '000') || '000'
    const cstPisCofins = (colCstPisCofins ? texto(linha[colCstPisCofins]) : '50') || '50'
    const natRec = colNatRec ? texto(linha[colNatRec]) : ''

    const produto: Produto = {
      codigoInventario: codigoNorm,
      descricao,
      ncm,
      cstIcms,
      cstPisCofins,
      unidade,
      fatorConversaoPadrao: 1.0,
      aliquotaIcms: colAliqIcms ? numero(linha[colAliqIcms]) : 17,
      aliquotaPis: colAliqPis ? numero(linha[colAliqPis]) : 1.65,
      aliquotaCofins: colAliqCofins ? numero(linha[colAliqCofins]) : 7.6,
      // Reforma Tributária: sem base na planilha; entra zerada para revisão do fiscal
      aliquotaIbs: 0,
      aliquotaCbs: 0,
    }

    if (pendencias.length > 0) {
      produto.revisar = true
      produto.observacaoImportacao = pendencias.join(' • ')
      if (natRec) produto.observacaoImportacao += ` • NAT_REC ${natRec}`
      itensParaRevisao++
    }

    produtos.push(produto)
  }

  if (produtos.length === 0) {
    throw new Error(
      'Nenhuma linha válida encontrada (linhas precisam de COD_ITEM e DESCR_ITEM preenchidos).',
    )
  }

  return {
    produtos,
    totalLinhas: linhas.length,
    itensParaRevisao,
    abaUtilizada: nomeAba,
    colunasIgnoradas: nomesNorm.filter((n) => n.startsWith('EXIPI') || n.startsWith('CSOSN')),
  }
}
