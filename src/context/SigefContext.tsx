import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from 'react'
import {
  BackupHistorico,
  CompetenciaFechamento,
  ConsultaDFeSefaz,
  DadosEmpresaStore,
  DeParaVigente,
  DocumentoFiscal,
  Empresa,
  ItemContagemInventario,
  MovimentoKardex,
  OcorrenciaAuditoria,
  Produto,
  OrigemRegraDesqualificacao,
  RegraCfop,
  RegraDesqualificacao,
} from '@/types/sigef'
import {
  carregarRegrasCfop,
  migrarRegrasCfopLegadas,
  novaRegraCfop,
  salvarRegrasCfop,
} from '@/services/regrasCfopService'
import {
  carregarDadosEmpresa,
  carregarEmpresasCadastradas,
  carregarHistoricoBackups,
  carregarIdEmpresaAtiva,
  registrarBackup,
  salvarDadosEmpresa,
  salvarEmpresasCadastradas,
  salvarIdEmpresaAtiva,
} from '@/services/storageService'
import {
  EMPRESA_PLACEHOLDER,
  limparDadosSeedsOneShot,
  normalizarStore,
} from '@/services/limpezaSeeds'
import { calcularItensInventario, reprocessarKardexCronologico } from '@/services/kardexEngine'
import { parseNFeXml } from '@/services/nfeXmlParser'
import { consultarDFeSimulado } from '@/services/sefazDfeSimulator'
import { useAuth } from '@/context/AuthContext'
import { REGUAS_AUDITORIA } from '@/data/regrasAuditoria'
import { coletarParesUnicos, montarVinculosAutomaticos } from '@/services/vinculoAutomaticoService'
import {
  aplicarRegrasDesqualificacao,
  chaveRegraDesqualificacao,
  itensDocumento,
  novaRegraDesqualificacao,
} from '@/services/desqualificacaoService'
import { certificadoAtivo, formatarCnpj, CertificadoA1 } from '@/services/certificadoService'
import { toast } from 'sonner'

interface SigefContextType {
  // Empresa ativa
  empresas: Empresa[]
  regrasCfop: RegraCfop[]
  salvarRegraCfop: (dados: Omit<RegraCfop, 'id' | 'atualizadoEm'>, idExistente?: string) => void
  excluirRegraCfop: (id: string) => void
  empresaAtiva: Empresa
  trocarEmpresaAtiva: (empresaId: string) => void
  cadastrarOuEditarEmpresa: (empresa: Empresa) => void

  // Dados da empresa ativa
  produtos: Produto[]
  deParaList: DeParaVigente[]
  documentos: DocumentoFiscal[]
  kardex: MovimentoKardex[]
  fechamentos: CompetenciaFechamento[]
  ocorrencias: OcorrenciaAuditoria[]
  consultasDFe: ConsultaDFeSefaz[]
  ultimoNSU: number

  // Ações de Produtos e De-Para
  cadastrarProduto: (produto: Produto) => void
  editarProduto: (produto: Produto) => void
  excluirProduto: (codigoInventario: string) => void
  importarProdutosPlanilha: (
    produtos: Produto[],
    meta?: { itensParaRevisao?: number; abaUtilizada?: string },
  ) => { criados: number; atualizados: number; ignorados: number; sinalizados: number }
  salvarDePara: (vinculo: Omit<DeParaVigente, 'id' | 'atualizadoEm'>) => void
  excluirDePara: (id: string) => void
  vincularFornecedorAutomatico: (params: {
    cnpjFornecedor: string
    razaoSocialFornecedor: string
  }) => { criados: number; atualizados: number; pendentes: number; totalPares: number }

  // Ações de Importação e NF-e
  importarXmlsEmLote: (
    xmlStrings: string[],
    periodo?: { inicio: string; fim: string },
  ) => {
    importados: number
    duplicados: number
    pendentesDePara: number
  }
  cancelarNFe: (docId: string, justificativa: string) => void
  reprocessarNotas: () => void

  // Desqualificação para inventário (marca "não gera inventário") e alias
  // "Não controla estoque" (mesma regra CNPJ+cProd, origem diferente)
  regrasDesqualificacao: RegraDesqualificacao[]
  desqualificarNota: (docId: string) => { regra: RegraDesqualificacao | null; afetados: number }
  marcarNaoControlaEstoque: (docId: string) => {
    regra: RegraDesqualificacao | null
    afetados: number
  }
  /** "Não vincular": grava regra CNPJ+cProd SEM criar o de-para — o item não
   * gera estoque nem inventário; notas futuras do mesmo par já entram marcadas. */
  naoVincularNota: (docId: string) => { regra: RegraDesqualificacao | null; afetados: number }
  requalificarNota: (docId: string) => void

  // Competência ativa (período da última importação — persistido por empresa)
  competenciaAtiva: string
  periodoAtivo: { competencia: string; inicio: string; fim: string }
  definirCompetenciaAtiva: (competencia: string) => void

  // Ações de Inventário e Fechamento
  gerarContagemCompetencia: (competencia: string) => ItemContagemInventario[]
  salvarAjusteContagem: (
    competencia: string,
    codigoInventario: string,
    quantidadeContada: number,
    justificativa?: string,
  ) => void
  fecharCompetencia: (params: {
    competencia: string
    responsavel: string
    itensContagem: ItemContagemInventario[]
  }) => { sucesso: boolean; mensagem: string }

  // Ações de Auditoria
  reprocessarOcorrencia: (ocorrenciaId: string) => void
  resolverOcorrenciaManual: (ocorrenciaId: string) => void
  /** Grava uma ocorrência adicional na empresa ativa (régua A13 — operações administrativas). */
  adicionarOcorrenciaAuditoria: (ocorrencia: OcorrenciaAuditoria) => void

  // Ações SEFAZ DF-e
  executarConsultaDFe: (uf: string, forcarConsumoIndevido?: boolean) => void
  /** Certificado A1 ativo (instalado e não vencido) ou null. Consultas DF-e exigem. */
  certificadoDFe: CertificadoA1 | null
  /** Motivo do bloqueio da consulta sem certificado (mensagem para a tela). */
  bloqueioConsultaDFe: string | null

  // Backup e Restauração
  historicoBackups: BackupHistorico[]
  exportarBackupJson: () => void
  importarBackupJson: (arquivoConteudo: string) => boolean
  restaurarBackupHistorico: (versao: string) => void
}

const SigefContext = createContext<SigefContextType | null>(null)

/** Competência (YYYY-MM) do mês corrente — fallback quando nenhuma importação definiu período. */
function mesAtual(): string {
  const agora = new Date()
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`
}

/**
 * Competência a gravar numa importação: a indicada pelo usuário na tela
 * (data inicial do período) ou, na falta, a da nota mais nova importada —
 * assim o período fica gravado mesmo quando a tela não envia o campo.
 */
function competenciaDoPeriodo(
  periodo: { inicio: string; fim: string } | undefined,
  documentos: DocumentoFiscal[],
): string | undefined {
  if (periodo?.inicio) return periodo.inicio.slice(0, 7)
  const datas = documentos
    .map((d) => d.dataEmissao?.slice(0, 10) || '')
    .filter(Boolean)
    .sort()
  return datas.length ? datas[datas.length - 1].slice(0, 7) : undefined
}

// Produção: remove uma única vez os dados de exemplo da v0.x antes de qualquer leitura
limparDadosSeedsOneShot()

export const SigefProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [empresas, setEmpresas] = useState<Empresa[]>(carregarEmpresasCadastradas)
  const [empresaAtivaId, setEmpresaAtivaId] = useState<string>(carregarIdEmpresaAtiva)

  // Sem empresa cadastrada: placeholder em memória (nunca persistido) para as telas
  // renderizarem; o Painel mostra o onboarding de cadastro da primeira empresa.
  const empresaAtiva =
    empresas.find((e) => e.id === empresaAtivaId) || empresas[0] || EMPRESA_PLACEHOLDER

  const [store, setStore] = useState<DadosEmpresaStore>(() =>
    carregarDadosEmpresa(empresaAtiva ?? undefined),
  )

  const [historicoBackups, setHistoricoBackups] =
    useState<BackupHistorico[]>(carregarHistoricoBackups)

  // Regras CFOP: entidade própria (fora do de-para de produtos)
  const [regrasCfop, setRegrasCfop] = useState<RegraCfop[]>(carregarRegrasCfop)

  // Migração one-shot: converte regras antigas salvas como DeParaVigente e limpa o de-para
  useEffect(() => {
    setStore((prev) => {
      const { regras, deParaLimpo, migradas } = migrarRegrasCfopLegadas(regrasCfop, prev.dePara)
      if (migradas === 0 && deParaLimpo === prev.dePara) return prev
      if (migradas > 0) {
        salvarRegrasCfop(regras)
        setRegrasCfop(regras)
      }
      if (deParaLimpo !== prev.dePara) {
        const atualizado = { ...prev, dePara: deParaLimpo }
        salvarDadosEmpresa(atualizado)
        return atualizado
      }
      return prev
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Ao trocar de empresa, carrega a store correspondente
  useEffect(() => {
    if (!empresaAtiva) return
    const dados = carregarDadosEmpresa(empresaAtiva)
    setStore(dados)
  }, [empresaAtiva.id])

  // Salva store sempre que atualizar
  const atualizarStore = (novosDados: Partial<DadosEmpresaStore>) => {
    setStore((prev) => {
      const atualizado: DadosEmpresaStore = normalizarStore({ ...prev, ...novosDados })
      // Sem empresa real cadastrada, nada é gravado (placeholder nunca persiste)
      if (empresaAtiva.id) salvarDadosEmpresa(atualizado)
      return atualizado
    })
  }

  // ============ Competência ativa (período da importação) ============

  /**
   * Competência ativa (YYYY-MM): definida pela última importação (período
   * informado na tela Importar), persistida na store da empresa e usada pelo
   * Painel (mês ativo), Kardex, Inventário e Bloco K como competência corrente.
   */
  const definirCompetenciaAtiva = (competencia: string) => {
    atualizarStore({ competenciaAtiva: competencia })
  }

  const competenciaAtiva = store.competenciaAtiva || mesAtual()
  const periodoAtivo = useMemo(() => {
    const [ano, mes] = competenciaAtiva.split('-')
    const ultimoDia = new Date(Number(ano), Number(mes), 0).getDate()
    return {
      competencia: competenciaAtiva,
      inicio: `${competenciaAtiva}-01`,
      fim: `${competenciaAtiva}-${String(ultimoDia).padStart(2, '0')}`,
    }
  }, [competenciaAtiva])

  const trocarEmpresaAtiva = (empresaId: string) => {
    salvarIdEmpresaAtiva(empresaId)
    setEmpresaAtivaId(empresaId)
    toast.info(
      `Empresa ativa alternada para: ${empresas.find((e) => e.id === empresaId)?.nomeFantasia || empresaId}`,
    )
  }

  const cadastrarOuEditarEmpresa = (empresa: Empresa) => {
    setEmpresas((prev) => {
      const idx = prev.findIndex((e) => e.id === empresa.id)
      let novaLista: Empresa[]
      if (idx >= 0) {
        novaLista = [...prev]
        novaLista[idx] = empresa
      } else {
        novaLista = [...prev, empresa]
      }
      salvarEmpresasCadastradas(novaLista)
      return novaLista
    })
    // Primeira empresa (ou troca de contexto): torna-se a empresa ativa
    salvarIdEmpresaAtiva(empresa.id)
    setEmpresaAtivaId(empresa.id)
    setStore(carregarDadosEmpresa(empresa))
    toast.success(`Empresa ${empresa.nomeFantasia} atualizada com sucesso.`)
  }

  // Reprocessamento global do Kardex
  const recalcularKardex = (
    produtosAtuais: Produto[],
    documentosAtuais: DocumentoFiscal[],
    deParaAtuais: DeParaVigente[],
  ) => {
    const resultado = reprocessarKardexCronologico(
      produtosAtuais,
      documentosAtuais,
      deParaAtuais,
      [],
      store.regrasDesqualificacao,
    )
    atualizarStore({
      produtos: produtosAtuais,
      documentos: resultado.documentosAtualizados,
      dePara: deParaAtuais,
      kardex: resultado.kardex,
      ocorrencias: resultado.ocorrencias,
    })
  }

  const cadastrarProduto = (produto: Produto) => {
    const novos = [...store.produtos, produto]
    recalcularKardex(novos, store.documentos, store.dePara)
    toast.success(`Produto ${produto.codigoInventario} cadastrado com sucesso.`)
  }

  const editarProduto = (produto: Produto) => {
    const novos = store.produtos.map((p) =>
      p.codigoInventario === produto.codigoInventario ? produto : p,
    )
    recalcularKardex(novos, store.documentos, store.dePara)
    toast.success(`Produto ${produto.codigoInventario} atualizado.`)
  }

  const excluirProduto = (codigoInventario: string) => {
    const novos = store.produtos.filter((p) => p.codigoInventario !== codigoInventario)
    recalcularKardex(novos, store.documentos, store.dePara)
    toast.success(`Produto ${codigoInventario} excluído.`)
  }

  // Salvar De-Para e REENFILEIRAR automaticamente documentos travados
  const salvarDePara = (vinculo: Omit<DeParaVigente, 'id' | 'atualizadoEm'>) => {
    const novoVinculo: DeParaVigente = {
      ...vinculo,
      id: `dp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      atualizadoEm: new Date().toISOString(),
    }

    // Se já existia vínculo para este CNPJ + cProd, substitui
    const outros = store.dePara.filter(
      (dp) =>
        !(
          dp.cnpjFornecedor.replace(/\D/g, '') === vinculo.cnpjFornecedor.replace(/\D/g, '') &&
          dp.cProd.trim().toUpperCase() === vinculo.cProd.trim().toUpperCase()
        ),
    )
    const novosDePara = [...outros, novoVinculo]

    // Reenfileira automaticamente notas que estavam travadas em AGUARDANDO_DE_PARA
    recalcularKardex(store.produtos, store.documentos, novosDePara)
    toast.success(
      `De-Para vinculado: ${vinculo.cProd} → ${vinculo.codigoInventario}. As notas dependentes foram reenfileiradas e processadas!`,
    )
  }

  const excluirDePara = (id: string) => {
    const novosDePara = store.dePara.filter((dp) => dp.id !== id)
    recalcularKardex(store.produtos, store.documentos, novosDePara)
    toast.info('Vínculo De-Para removido. Kardex recalculado.')
  }

  // Cadastro + vínculo automáticos a partir do CNPJ do emitente (tela Fornecedores):
  // 1) registra o fornecedor gravando a razão social nas entradas do de-para;
  // 2) varre todos os itens das notas emitidas por aquele CNPJ, agrupa os pares
  //    únicos cProd + xProd e vincula os que JÁ existem no catálogo (fator 1,
  //    descrição do fornecedor preenchida). Itens sem correspondência ficam
  //    pendentes — nenhum produto é inventado;
  // 3) reenfileira automaticamente as notas do CNPJ que estavam travadas em
  //    AGUARDANDO_DE_PARA (recalcularKardex já faz isso ao gravar o de-para).
  const vincularFornecedorAutomatico = (params: {
    cnpjFornecedor: string
    razaoSocialFornecedor: string
  }): { criados: number; atualizados: number; pendentes: number; totalPares: number } => {
    const cnpjLimpo = params.cnpjFornecedor.replace(/\D/g, '')
    const razaoSocial = (params.razaoSocialFornecedor || '').trim()

    // 1) Pares únicos (cProd + xProd) de todas as notas emitidas pelo CNPJ
    const pares = coletarParesUnicos(store.documentos, cnpjLimpo)
    if (pares.length === 0) {
      toast.info('Nenhum item emitido por este CNPJ para vincular.')
      return { criados: 0, atualizados: 0, pendentes: 0, totalPares: 0 }
    }

    // 2) Monta os vínculos contra o catálogo de produtos (não inventa produto)
    const { vinculos, pendentes, totalPares } = montarVinculosAutomaticos({
      cnpjFornecedor: cnpjLimpo,
      razaoSocialFornecedor: razaoSocial,
      pares,
      produtos: store.produtos,
      deParaAtuais: store.dePara,
    })

    // "Cadastro" do fornecedor = a razão social nas entradas do de-para dele
    const novosDePara: DeParaVigente[] = vinculos.map((v) => ({
      ...v,
      id: `dp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      atualizadoEm: new Date().toISOString(),
    }))
    const deParaFinal = [...store.dePara, ...novosDePara]

    // Ocorrência de auditoria (régua A13): cadastro/vínculo automáticos com AUTOR
    const nomeAutor = usuarioAtual?.nome ?? usuarioAtual?.login ?? '—'
    const ocorrencia: OcorrenciaAuditoria = {
      id: `oco-a13-vincauto-${Date.now()}`,
      regraCodigo: 'A13',
      regraNome: 'Importação de planilha — itens para revisão',
      severidade: 'INFO',
      descricao: `Vínculo automático de fornecedor ${cnpjLimpo} (${razaoSocial}) por ${nomeAutor}: ${
        novosDePara.length
      } vínculo(s) criado(s), ${pendentes.length} item(ns) sem correspondência no catálogo (cadastrar produto): ${pendentes
        .map((p) => p.cProd)
        .join(', ')}.`,
      baseLegal: REGUAS_AUDITORIA.find((r) => r.codigo === 'A13')?.baseLegal || '',
      dataIdentificacao: new Date().toISOString(),
      resolvido: false,
      podeReprocessar: false,
    }

    // 3) Reenfileira as notas AGUARDANDO_DE_PARA daquele CNPJ com os novos vínculos
    // (gravação única: o reprocessamento já devolve as ocorrências da régua —
    // a ocorrência A13 do vínculo automático entra junto, sem leitura de estado obsoleto)
    const resultado = reprocessarKardexCronologico(
      store.produtos,
      store.documentos,
      deParaFinal,
      [],
      store.regrasDesqualificacao,
    )
    atualizarStore({
      produtos: store.produtos,
      documentos: resultado.documentosAtualizados,
      dePara: deParaFinal,
      kardex: resultado.kardex,
      ocorrencias: [...resultado.ocorrencias, ocorrencia],
    })

    toast.success(
      `Fornecedor ${razaoSocial} cadastrado. ${novosDePara.length} vínculo(s) criado(s), ${pendentes.length} item(ns) pendente(s) de cadastro de produto.`,
    )
    return {
      criados: novosDePara.length,
      atualizados: 0,
      pendentes: pendentes.length,
      totalPares,
    }
  }

  // ============ Regras CFOP (entidade própria) ============

  const salvarRegraCfop = (dados: Omit<RegraCfop, 'id' | 'atualizadoEm'>, idExistente?: string) => {
    setRegrasCfop((prev) => {
      let novas: RegraCfop[]
      if (idExistente) {
        novas = prev.map((r) =>
          r.id === idExistente
            ? { ...dados, id: idExistente, atualizadoEm: new Date().toISOString() }
            : r,
        )
      } else {
        novas = [...prev, novaRegraCfop(dados)]
      }
      salvarRegrasCfop(novas)
      return novas
    })
  }

  const excluirRegraCfop = (id: string) => {
    setRegrasCfop((prev) => {
      const novas = prev.filter((r) => r.id !== id)
      salvarRegrasCfop(novas)
      return novas
    })
  }

  // Importar XMLs em lote (colados ou pastas). O período informado na tela
  // (ex.: 01/11/2026 a 30/11/2026) define a competência ativa — persistida na
  // store e exibida no Painel (mês ativo), Kardex, Inventário e Bloco K.
  const importarXmlsEmLote = (xmlStrings: string[], periodo?: { inicio: string; fim: string }) => {
    let importados = 0
    let duplicados = 0
    let pendentesDePara = 0

    const novosDocs: DocumentoFiscal[] = []
    xmlStrings.forEach((xml) => {
      if (!xml || !xml.trim()) return
      const doc = parseNFeXml(xml, empresaAtiva.cnpj)
      novosDocs.push(doc)
    })

    // O marcador XML_COMPACTADO_QUOTA no xmlOriginal significa "dados estruturados
    // íntegros, XML bruto descartado" — o documento já está completo no storage e
    // NUNCA deve ser re-parseado (reparsear geraria documento vazio: chave '',
    // número 'S/N', itens [], valor 0).
    const todosDocumentos = [...store.documentos, ...novosDocs]

    const resultado = reprocessarKardexCronologico(
      store.produtos,
      todosDocumentos,
      store.dePara,
      [],
      store.regrasDesqualificacao,
    )

    resultado.documentosAtualizados.forEach((d) => {
      if (novosDocs.some((n) => n.id === d.id || n.chaveAcesso === d.chaveAcesso)) {
        if (d.status === 'DUPLICIDADE') duplicados++
        else if (d.status === 'AGUARDANDO_DE_PARA') pendentesDePara++
        else importados++
      }
    })

    atualizarStore({
      documentos: resultado.documentosAtualizados,
      kardex: resultado.kardex,
      ocorrencias: resultado.ocorrencias,
      competenciaAtiva: competenciaDoPeriodo(periodo, resultado.documentosAtualizados),
    })

    return { importados, duplicados, pendentesDePara }
  }

  // Cancelamento de NF-e com estorno e recálculo
  const cancelarNFe = (docId: string, justificativa: string) => {
    const docsAtualizados = store.documentos.map((d) => {
      if (d.id === docId || d.chaveAcesso === docId) {
        return {
          ...d,
          status: 'CANCELADO' as const,
          canceladoEm: new Date().toISOString(),
          justificativaCancelamento: justificativa,
        }
      }
      return d
    })

    recalcularKardex(store.produtos, docsAtualizados, store.dePara)
    toast.warning(
      `NF-e estornada com sucesso. Os saldos e custos posteriores foram recalculados cronologicamente.`,
    )
  }

  const reprocessarNotas = () => {
    recalcularKardex(store.produtos, store.documentos, store.dePara)
    toast.success('Reprocessamento de todos os documentos concluído.')
  }

  // ============ Desqualificação para inventário ("não gera inventário") ============
  //
  // A regra é persistida por empresa (CNPJ emitente + cProd normalizado) e a marca
  // no documento é DERIVADA dela em toda leitura/reação da store — assim a marca
  // sobrevive a logout/F5 e qualquer importação futura do mesmo CNPJ + produto já
  // entra desqualificada. Requalificar (excluir a regra) desmarca todos de uma vez.

  /** Documentos com a marca desqualificadaParaInventario derivada das regras. */
  const documentosComRegras = useMemo(
    () => aplicarRegrasDesqualificacao(store.documentos, store.regrasDesqualificacao),
    [store.documentos, store.regrasDesqualificacao],
  )

  /**
   * Desqualifica a nota para o inventário: cria/usa a regra por item (CNPJ
   * emitente + cProd) e propaga a marca para TODAS as notas do mesmo CNPJ com
   * o mesmo produto. Grava ocorrência A13 com o autor (usuário logado) e
   * recalcula o Kardex — os itens desqualificados ficam fora do Bloco H.
   */
  const desqualificarNota = (docId: string) => aplicarMarcaDesqualificacao(docId, 'DESQUALIFICACAO')

  /** Alias "Não controla estoque": mesma regra CNPJ+cProd, origem CONTROLE_ESTOQUE. */
  const marcarNaoControlaEstoque = (docId: string) =>
    aplicarMarcaDesqualificacao(docId, 'CONTROLE_ESTOQUE')

  /**
   * "Não vincular" (aba Produtos → Pendências de De-Para, e aba Importar):
   * grava a regra CNPJ emitente + cProd SEM criar vínculo de de-para — o item
   * NÃO gera estoque e NÃO gera inventário. Notas futuras do mesmo CNPJ + item
   * já entram marcadas (marca derivada em documentosComRegras) e ficam fora do
   * Kardex e do Bloco H. Desfazer = Requalificar (exclui a regra e reprocessa).
   */
  const naoVincularNota = (docId: string) =>
    aplicarMarcaDesqualificacao(docId, 'NAO_VINCULA_ESTOQUE')

  const aplicarMarcaDesqualificacao = (
    docId: string,
    origem: OrigemRegraDesqualificacao,
  ): { regra: RegraDesqualificacao | null; afetados: number } => {
    const doc = store.documentos.find((d) => d.id === docId || d.chaveAcesso === docId)
    if (!doc) return { regra: null, afetados: 0 }

    const modoEstoque = origem === 'CONTROLE_ESTOQUE'
    const modoNaoVincula = origem === 'NAO_VINCULA_ESTOQUE'
    const cnpjLimpo = (doc.cnpjEmitente || '').replace(/\D/g, '')
    const itens = itensDocumento(doc)
    if (!cnpjLimpo || itens.length === 0) {
      toast.error(
        'Não foi possível desqualificar: documento sem emitente ou sem itens com código de produto.',
      )
      return { regra: null, afetados: 0 }
    }

    const agora = new Date().toISOString()
    const nomeAutor = usuarioAtual?.nome ?? usuarioAtual?.login ?? '—'
    const chavesExistentes = new Set(
      store.regrasDesqualificacao.map((r) => chaveRegraDesqualificacao(r.cnpjEmitente, r.cProd)),
    )

    const novasRegras = [...store.regrasDesqualificacao]
    itens.forEach((it) => {
      if (chavesExistentes.has(chaveRegraDesqualificacao(cnpjLimpo, it.cProd))) return
      novasRegras.push(
        novaRegraDesqualificacao({
          cnpjEmitente: cnpjLimpo,
          razaoSocialEmitente: doc.nomeEmitente,
          cProd: it.cProd,
          xProd: it.xProd,
          criadoPor: nomeAutor,
          chaveDocOrigem: doc.chaveAcesso,
          origem,
        }),
      )
    })

    if (novasRegras.length === store.regrasDesqualificacao.length) {
      toast.info(
        modoNaoVincula
          ? 'Todos os itens desta nota já estão gravados como "não vincular" (não geram estoque).'
          : modoEstoque
            ? 'Todos os itens desta nota já estão marcados como "não controla estoque"/"não gera inventário".'
            : 'Todos os itens desta nota já estão desqualificados para o inventário.',
      )
      return { regra: null, afetados: 0 }
    }

    const documentosMarcados = aplicarRegrasDesqualificacao(store.documentos, novasRegras)
    const afetados = documentosMarcados.filter(
      (d) => d.desqualificadaParaInventario || d.naoControlaEstoque || d.naoVinculaEstoque,
    ).length

    // Passa as regras ATUALIZADAS (novasRegras): os itens "não vincular" saem da
    // fila de de-para e a nota com todos os itens nessa regra vira PROCESSADO.
    const resultado = reprocessarKardexCronologico(
      store.produtos,
      documentosMarcados,
      store.dePara,
      [],
      novasRegras,
    )

    const ocorrencia: OcorrenciaAuditoria = {
      id: modoNaoVincula
        ? `oco-a13-naovincula-${Date.now()}`
        : modoEstoque
          ? `oco-a13-estoque-${Date.now()}`
          : `oco-a13-desqual-${Date.now()}`,
      regraCodigo: 'A13',
      regraNome: modoNaoVincula
        ? '"Não vincular" — CNPJ + item sem de-para, fora do estoque/inventário'
        : modoEstoque
          ? 'Marca "Não controla estoque" — itens fora do Kardex/Bloco H'
          : 'Desqualificação para inventário — itens fora do Bloco H',
      severidade: 'INFO',
      descricao: modoNaoVincula
        ? `"Não vincular" pela NF-e nº ${doc.numero} (série ${doc.serie}, chave ${doc.chaveAcesso}) por ${nomeAutor}: emitente ${cnpjLimpo} + produto(s) ${itens
            .map((i) => i.cProd)
            .join(
              ', ',
            )} gravado(s) como "não gera estoque" (sem de-para) — ${afetados} documento(s) fora do Kardex/Bloco H.`
        : modoEstoque
          ? `Marca "Não controla estoque" pela NF-e nº ${doc.numero} (série ${doc.serie}, chave ${doc.chaveAcesso}) por ${nomeAutor}: emitente ${cnpjLimpo} + produto(s) ${itens
              .map((i) => i.cProd)
              .join(', ')} — ${afetados} documento(s) marcado(s) "não controla estoque".`
          : `Desqualificação para inventário pela NF-e nº ${doc.numero} (série ${doc.serie}, chave ${doc.chaveAcesso}) por ${nomeAutor}: emitente ${cnpjLimpo} + produto(s) ${itens
              .map((i) => i.cProd)
              .join(', ')} — ${afetados} documento(s) marcado(s) "não gera inventário".`,
      baseLegal: REGUAS_AUDITORIA.find((r) => r.codigo === 'A13')?.baseLegal || '',
      documentoRef: doc.numero,
      chaveAcessoRef: doc.chaveAcesso,
      dataIdentificacao: agora,
      resolvido: false,
      podeReprocessar: false,
    }

    atualizarStore({
      regrasDesqualificacao: novasRegras,
      documentos: resultado.documentosAtualizados,
      kardex: resultado.kardex,
      ocorrencias: [...resultado.ocorrencias, ocorrencia],
    })

    toast.success(
      modoNaoVincula
        ? `"Não vincular" gravado para o emitente ${cnpjLimpo}: ${afetados} documento(s) com o(s) mesmo(s) item(ns) não geram estoque nem inventário (fora do Kardex e do Bloco H).`
        : modoEstoque
          ? `Nota ${doc.numero} marcada como "não controla estoque": ${afetados} documento(s) do emitente ${cnpjLimpo} com o(s) mesmo(s) produto(s) ficam fora do Kardex e do Bloco H.`
          : `Nota desqualificada para o inventário: ${afetados} documento(s) do emitente ${cnpjLimpo} com o(s) mesmo(s) produto(s) ficam fora do Bloco H.`,
    )
    return { regra: novasRegras[novasRegras.length - 1] ?? null, afetados }
  }

  /** Requalifica: exclui as regras ligadas à nota e a desmarca em todos os documentos. */
  const requalificarNota = (docId: string) => {
    const doc = store.documentos.find((d) => d.id === docId || d.chaveAcesso === docId)
    if (!doc) return
    const cnpjLimpo = (doc.cnpjEmitente || '').replace(/\D/g, '')
    const itens = itensDocumento(doc)
    if (!cnpjLimpo || itens.length === 0) return

    const chavesDaNota = new Set(itens.map((it) => chaveRegraDesqualificacao(cnpjLimpo, it.cProd)))
    const restantes = store.regrasDesqualificacao.filter(
      (r) => !chavesDaNota.has(chaveRegraDesqualificacao(r.cnpjEmitente, r.cProd)),
    )
    if (restantes.length === store.regrasDesqualificacao.length) {
      toast.info('Nenhuma regra de desqualificação ligada a esta nota.')
      return
    }

    const documentosMarcados = aplicarRegrasDesqualificacao(store.documentos, restantes)
    const resultado = reprocessarKardexCronologico(
      store.produtos,
      documentosMarcados,
      store.dePara,
      [],
      restantes,
    )

    const nomeAutor = usuarioAtual?.nome ?? usuarioAtual?.login ?? '—'
    const ocorrencia: OcorrenciaAuditoria = {
      id: `oco-a13-requal-${Date.now()}`,
      regraCodigo: 'A13',
      regraNome: 'Requalificação — desmarcar "não gera estoque/inventário"',
      severidade: 'INFO',
      descricao: `Requalificação pela NF-e nº ${doc.numero} (chave ${doc.chaveAcesso}) por ${nomeAutor}: regra(s) do emitente ${cnpjLimpo} removida(s) — documentos voltam ao Kardex, ao inventário e ao Bloco H.`,
      baseLegal: REGUAS_AUDITORIA.find((r) => r.codigo === 'A13')?.baseLegal || '',
      documentoRef: doc.numero,
      chaveAcessoRef: doc.chaveAcesso,
      dataIdentificacao: new Date().toISOString(),
      resolvido: false,
      podeReprocessar: false,
    }

    atualizarStore({
      regrasDesqualificacao: restantes,
      documentos: resultado.documentosAtualizados,
      kardex: resultado.kardex,
      ocorrencias: [...resultado.ocorrencias, ocorrencia],
    })

    toast.success('Regras removidas: os documentos voltam a gerar inventário (Bloco H).')
  }

  // Importação de cadastro de itens por planilha (Sucatas Cadastro)
  // Upsert por código de inventário: existente → atualiza, novo → cria.
  const importarProdutosPlanilha = (
    produtosImportados: Produto[],
    meta?: { itensParaRevisao?: number; abaUtilizada?: string },
  ): { criados: number; atualizados: number; ignorados: number; sinalizados: number } => {
    const criarOuAtualizar = (
      anteriores: Produto[],
    ): { lista: Produto[]; criados: number; atualizados: number; ignorados: number } => {
      const mapa = new Map(
        anteriores.map((p) => [p.codigoInventario.trim().toUpperCase(), p] as const),
      )
      let criados = 0
      let atualizados = 0
      let ignorados = 0
      produtosImportados.forEach((p) => {
        const chave = p.codigoInventario.trim().toUpperCase()
        const existente = mapa.get(chave)
        if (existente) {
          // Item idêntico (mesmos campos fiscais): preserva o cadastro atual
          const igual =
            existente.descricao === p.descricao &&
            existente.ncm === p.ncm &&
            existente.unidade === p.unidade &&
            existente.cstIcms === p.cstIcms &&
            existente.cstPisCofins === p.cstPisCofins
          if (igual) {
            ignorados++
          } else {
            mapa.set(chave, { ...p }) // atualiza com os dados da planilha
            atualizados++
          }
        } else {
          mapa.set(chave, { ...p })
          criados++
        }
      })
      return { lista: [...mapa.values()], criados, atualizados, ignorados }
    }

    const {
      lista: novosProdutos,
      criados,
      atualizados,
      ignorados,
    } = criarOuAtualizar(store.produtos)

    if (criados === 0 && atualizados === 0) {
      toast.info(
        `Nenhuma alteração: todos os ${ignorados} código(s) da planilha já existem idênticos no catálogo.`,
      )
      return { criados: 0, atualizados: 0, ignorados, sinalizados: 0 }
    }

    const sinalizados = produtosImportados.filter((p) => p.revisar).length
    const nomeAutor = usuarioAtual?.nome ?? usuarioAtual?.login ?? '—'
    const codigosRevisao = produtosImportados
      .filter((p) => p.revisar)
      .map((p) => p.codigoInventario)
      .join(', ')

    // Ocorrência de auditoria A13: importa/revisa com AUTOR (usuário logado)
    const ocorrenciaA13: OcorrenciaAuditoria = {
      id: `oco-a13-import-${Date.now()}`,
      regraCodigo: 'A13',
      regraNome: 'Importação de planilha — itens para revisão',
      severidade: 'AVISO',
      descricao: `Importação de planilha${
        meta?.abaUtilizada ? ` (aba "${meta.abaUtilizada}")` : ''
      } por ${nomeAutor}: ${criados} item(ns) criado(s), ${atualizados} atualizado(s)${
        sinalizados > 0
          ? `, ${sinalizados} com campo "SEM CORRESPONDÊNCIA" ou dados incompletos: ${codigosRevisao}`
          : ''
      }.`,
      baseLegal:
        'Lei 11.196/2005 arts. 47/48; TIPI (Decreto 11.158/2022); Guia Prático EFD Reg. 0200',
      dataIdentificacao: new Date().toISOString(),
      resolvido: false,
      podeReprocessar: false,
      resolvidoPor: undefined,
    }

    // Kardex e de-para recalculados com o catálogo ampliado (produtos novos não
    // têm movimento; entram no inventário com saldo zero via calcularItensInventario,
    // SEM apagar saldos/contagens já existentes dos demais)
    const resultado = reprocessarKardexCronologico(
      novosProdutos,
      store.documentos,
      store.dePara,
      [],
      store.regrasDesqualificacao,
    )

    atualizarStore({
      produtos: novosProdutos,
      documentos: resultado.documentosAtualizados,
      kardex: resultado.kardex,
      ocorrencias: [...resultado.ocorrencias, ocorrenciaA13],
      // Inventário (Bloco H): a competência em aberto passa a listar os itens
      // importados com quantidade zero — fechamentos existentes são preservados
      fechamentos: store.fechamentos.map((f) =>
        f.status === 'ABERTA'
          ? {
              ...f,
              itensInventario: [
                ...f.itensInventario,
                ...produtosImportados
                  .filter(
                    (p) =>
                      !f.itensInventario.some(
                        (it) => it.codigoInventario === p.codigoInventario.trim().toUpperCase(),
                      ),
                  )
                  .map((p) => ({
                    codigoInventario: p.codigoInventario,
                    descricao: p.descricao,
                    unidade: p.unidade,
                    quantidadeSistema: 0,
                    custoMedioSistema: 0,
                    valorTotalSistema: 0,
                    quantidadeContada: 0,
                    diferencaQuantidade: 0,
                    diferencaValor: 0,
                    statusAjuste: 'SEM_DIVERGENCIA' as const,
                  })),
              ],
            }
          : f,
      ),
    })

    toast.success(
      `Importação concluída: ${criados} produto(s) criado(s), ${atualizados} atualizado(s)${
        ignorados > 0 ? `, ${ignorados} já existente(s) preservado(s)` : ''
      }${sinalizados > 0 ? `, ${sinalizados} para revisão (régua A13)` : ''}.`,
    )
    return { criados, atualizados, ignorados, sinalizados }
  }

  // Inventário e Fechamento de Competência
  const gerarContagemCompetencia = (competencia: string): ItemContagemInventario[] => {
    // Se já tiver fechamento anterior registrado, retorna itens salvos
    const fechado = store.fechamentos.find((f) => f.competencia === competencia)
    if (fechado) {
      return fechado.itensInventario
    }
    // Itens com par CNPJ+cProd desqualificado / "não vincular" / "não controla
    // estoque" não fazem parte da contagem física — o produto existe no
    // catálogo mas o estoque dele não é escriturado (Bloco H).
    const chavesLiberadas = chavesNaoVinculaEstoque(store.regrasDesqualificacao)
    const produtosContaveis = store.produtos.filter(
      (p) => !chavesLiberadas.has(chaveProduto(p.cnpjFornecedorOrigem, p.codigoFornecedor)),
    )
    return calcularItensInventario(produtosContaveis, store.kardex)
  }

  const salvarAjusteContagem = (
    _competencia: string,
    codigoInventario: string,
    quantidadeContada: number,
    justificativa?: string,
  ) => {
    // Ajuste em tempo de contagem
    toast.info(`Contagem de ${codigoInventario} atualizada para ${quantidadeContada}.`)
  }

  const fecharCompetencia = (params: {
    competencia: string
    responsavel: string
    itensContagem: ItemContagemInventario[]
  }): { sucesso: boolean; mensagem: string } => {
    const { competencia, responsavel, itensContagem } = params

    // 1. Bloqueio por empresa inapta (Regra A09)
    if (empresaAtiva.bloquearFechamento || empresaAtiva.situacaoCadastral !== 'ATIVA') {
      const msg =
        empresaAtiva.motivoBloqueio ||
        'Fechamento bloqueado: Empresa encontra-se INAPTA na RFB (Art. 40 da IN RFB nº 2.119/2022).'
      toast.error(msg)
      return { sucesso: false, mensagem: msg }
    }

    // 2. Bloqueio por pendências de documentos em aberto (Regra A08)
    const docsPendentes = store.documentos.filter(
      (d) => d.status === 'PENDENTE' || d.status === 'AGUARDANDO_DE_PARA',
    )
    if (docsPendentes.length > 0) {
      const msg = `Fechamento bloqueado: Existem ${docsPendentes.length} documento(s) com status PENDENTE ou AGUARDANDO_DE_PARA na competência. Resolva os vínculos antes de encerrar.`
      toast.error(msg)
      return { sucesso: false, mensagem: msg }
    }

    // 3. Bloqueio por duplicidades ativas (Regra A01)
    const docsDuplicados = store.documentos.filter((d) => d.status === 'DUPLICIDADE')
    if (docsDuplicados.length > 0) {
      const msg = `Fechamento bloqueado: Identificados ${docsDuplicados.length} documento(s) em duplicidade não resolvidos.`
      toast.error(msg)
      return { sucesso: false, mensagem: msg }
    }

    // 4. Bloqueio por saldo negativo no Kardex (Regra A03)
    const movsBloqueados = store.kardex.filter((k) => k.bloqueadoSaldoNegativo)
    if (movsBloqueados.length > 0) {
      const msg = `Fechamento bloqueado: Há saídas fiscais que gerariam saldo físico negativo não corrigidas no Kardex.`
      toast.error(msg)
      return { sucesso: false, mensagem: msg }
    }

    // Se houver divergências entre contagem física e escrituração, aprova e gera movimentos de ajuste no Kardex
    const ajustesParaKardex: Array<{
      dataMovimento: string
      codigoInventario: string
      quantidadeAjuste: number
      motivo: string
    }> = []

    itensContagem.forEach((item) => {
      const dif = item.quantidadeContada - item.quantidadeSistema
      if (Math.abs(dif) > 0.0001) {
        ajustesParaKardex.push({
          dataMovimento: `${competencia}-28T23:59:59Z`,
          codigoInventario: item.codigoInventario,
          quantidadeAjuste: dif,
          motivo: item.justificativa || `Ajuste aprovado no fechamento de ${competencia}`,
        })
      }
    })

    // Reprocessa com os ajustes aprovados
    const res = reprocessarKardexCronologico(
      store.produtos,
      store.documentos,
      store.dePara,
      ajustesParaKardex,
      store.regrasDesqualificacao,
    )

    const valorTotalEstoque = itensContagem.reduce(
      (s, it) => s + it.quantidadeContada * it.custoMedioSistema,
      0,
    )

    const novoFechamento: CompetenciaFechamento = {
      id: `fech-${competencia}-${Date.now()}`,
      competencia,
      dataFechamento: new Date().toISOString(),
      responsavel,
      status: 'FECHADA',
      itensInventario: itensContagem.map((it) => ({
        ...it,
        statusAjuste:
          Math.abs(it.quantidadeContada - it.quantidadeSistema) > 0.0001
            ? 'APROVADO'
            : 'SEM_DIVERGENCIA',
      })),
      valorTotalEstoque,
    }

    const outrosFechamentos = store.fechamentos.filter((f) => f.competencia !== competencia)

    atualizarStore({
      documentos: res.documentosAtualizados,
      kardex: res.kardex,
      ocorrencias: res.ocorrencias,
      fechamentos: [...outrosFechamentos, novoFechamento],
    })

    toast.success(
      `Competência ${competencia} fechada com sucesso! Bloco H e K totalizados em R$ ${valorTotalEstoque.toFixed(2)}.`,
    )
    return { sucesso: true, mensagem: `Competência ${competencia} encerrada com sucesso.` }
  }

  // Auditoria — usa o usuário logado para gravar resolvidoPor (AuthProvider envolve o SigefProvider)
  const { usuarioAtual } = useAuth()
  const reprocessarOcorrencia = (_ocorrenciaId: string) => {
    recalcularKardex(store.produtos, store.documentos, store.dePara)
    toast.success('Régua reprocessada e verificada contra os registros atuais.')
  }

  const resolverOcorrenciaManual = (ocorrenciaId: string) => {
    const agora = new Date().toISOString()
    const atualizadas = store.ocorrencias.map((o) =>
      o.id === ocorrenciaId
        ? { ...o, resolvido: true, resolvidoPor: usuarioAtual?.nome ?? '—', resolvidoEm: agora }
        : o,
    )
    atualizarStore({ ocorrencias: atualizadas })
    toast.success('Ocorrência de auditoria marcada como resolvida.')
  }

  const adicionarOcorrenciaAuditoria = (ocorrencia: OcorrenciaAuditoria) => {
    atualizarStore({ ocorrencias: [ocorrencia, ...store.ocorrencias] })
  }

  // SEFAZ DF-e — exige certificado A1 ativo (instalado e não vencido);
  // a consulta simulada registra qual certificado foi usado na operação.
  const certificadoDFe = certificadoAtivo()
  const bloqueioConsultaDFe = certificadoDFe
    ? null
    : 'Certificado digital A1 necessário para consultar. Instale um certificado A1 (.pfx) na tela Sistema → Certificado Digital.'

  const executarConsultaDFe = (uf: string, forcarConsumoIndevido?: boolean) => {
    if (bloqueioConsultaDFe) {
      toast.error(bloqueioConsultaDFe)
      return
    }
    const cert = certificadoDFe as CertificadoA1
    const resultado = consultarDFeSimulado({
      empresa: empresaAtiva,
      uf,
      ultimoNSUAtual: store.ultimoNSU,
      forcarConsumoIndevido,
      documentosImportados: store.documentos,
      certificadoUsado: {
        subjectCN: cert.subjectCN,
        cnpj: cert.cnpj,
        vencido: cert.vencido,
      },
    })

    const novasConsultas = [resultado.consulta, ...store.consultasDFe]

    if (resultado.tipo === 'ERRO_CONSUMO_INDEVIDO') {
      atualizarStore({ consultasDFe: novasConsultas })
      toast.error(resultado.mensagem)
      return
    }

    if (resultado.tipo === 'SUCESSO_DOC' && resultado.documentosNovos.length > 0) {
      // Importa documento retornado
      const todosDocs = [...store.documentos, ...resultado.documentosNovos]
      const resKardex = reprocessarKardexCronologico(
        store.produtos,
        todosDocs,
        store.dePara,
        [],
        store.regrasDesqualificacao,
      )

      atualizarStore({
        consultasDFe: novasConsultas,
        ultimoNSU: resultado.consulta.novoUltNSU,
        documentos: resKardex.documentosAtualizados,
        kardex: resKardex.kardex,
        ocorrencias: resKardex.ocorrencias,
      })
      toast.success(resultado.mensagem)
    } else {
      atualizarStore({
        consultasDFe: novasConsultas,
        ultimoNSU: resultado.consulta.novoUltNSU,
      })
      toast.info(resultado.mensagem)
    }
  }

  // Backup e Restauração
  const exportarBackupJson = () => {
    const dados = {
      empresa: empresaAtiva,
      store,
      dataExportacao: new Date().toISOString(),
      versaoSigef: '2.0-web',
    }
    const bkp = registrarBackup(`Backup manual ${empresaAtiva.nomeFantasia}`, dados)
    setHistoricoBackups(carregarHistoricoBackups())

    const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `backup_sigef_${empresaAtiva.id}_${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    toast.success(`Backup gerado e registrado no histórico (${bkp.versao}).`)
  }

  const importarBackupJson = (arquivoConteudo: string): boolean => {
    try {
      const parsed = JSON.parse(arquivoConteudo)
      if (!parsed.store || !parsed.store.empresa) {
        toast.error('Arquivo JSON não possui estrutura válida de backup do SIGEF-ME.')
        return false
      }
      salvarDadosEmpresa(parsed.store)
      registrarBackup(`Restauração de backup externo: ${parsed.store.empresa.nomeFantasia}`, parsed)
      setHistoricoBackups(carregarHistoricoBackups())
      setStore(parsed.store)
      toast.success('Backup restaurado com sucesso! Os dados foram atualizados no navegador.')
      return true
    } catch (e) {
      console.error(e)
      toast.error('Falha ao processar arquivo JSON de backup.')
      return false
    }
  }

  const restaurarBackupHistorico = (versao: string) => {
    const bkp = historicoBackups.find((b) => b.versao === versao)
    if (!bkp) return
    try {
      const parsed = JSON.parse(bkp.dadosJson)
      if (parsed.store) {
        salvarDadosEmpresa(parsed.store)
        setStore(parsed.store)
        toast.success(`Versão ${versao} restaurada com sucesso.`)
      }
    } catch (e) {
      console.error(e)
      toast.error('Erro ao restaurar versão do histórico.')
    }
  }

  return (
    <SigefContext.Provider
      value={{
        empresas,
        empresaAtiva,
        regrasCfop,
        salvarRegraCfop,
        excluirRegraCfop,
        trocarEmpresaAtiva,
        cadastrarOuEditarEmpresa,
        produtos: store.produtos,
        deParaList: store.dePara,
        documentos: documentosComRegras,
        kardex: store.kardex,
        regrasDesqualificacao: store.regrasDesqualificacao,
        desqualificarNota,
        marcarNaoControlaEstoque,
        naoVincularNota,
        requalificarNota,
        fechamentos: store.fechamentos,
        ocorrencias: store.ocorrencias,
        consultasDFe: store.consultasDFe,
        ultimoNSU: store.ultimoNSU,
        competenciaAtiva,
        periodoAtivo,
        definirCompetenciaAtiva,
        cadastrarProduto,
        editarProduto,
        excluirProduto,
        importarProdutosPlanilha,
        salvarDePara,
        excluirDePara,
        vincularFornecedorAutomatico,
        importarXmlsEmLote,
        cancelarNFe,
        reprocessarNotas,
        gerarContagemCompetencia,
        salvarAjusteContagem,
        fecharCompetencia,
        reprocessarOcorrencia,
        resolverOcorrenciaManual,
        adicionarOcorrenciaAuditoria,
        executarConsultaDFe,
        certificadoDFe,
        bloqueioConsultaDFe,
        historicoBackups,
        exportarBackupJson,
        importarBackupJson,
        restaurarBackupHistorico,
      }}
    >
      {children}
    </SigefContext.Provider>
  )
}

export function useSigef(): SigefContextType {
  const ctx = useContext(SigefContext)
  if (!ctx) {
    throw new Error('useSigef deve ser utilizado dentro de SigefProvider')
  }
  return ctx
}
