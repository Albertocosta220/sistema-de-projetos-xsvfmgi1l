import React, { createContext, useContext, useEffect, useState, useTransition } from 'react'
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
  RegraCfop,
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
import { EMPRESA_PLACEHOLDER, limparDadosSeedsOneShot } from '@/services/limpezaSeeds'
import { calcularItensInventario, reprocessarKardexCronologico } from '@/services/kardexEngine'
import { parseNFeXml } from '@/services/nfeXmlParser'
import { consultarDFeSimulado } from '@/services/sefazDfeSimulator'
import { useAuth } from '@/context/AuthContext'
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

  // Ações de Importação e NF-e
  importarXmlsEmLote: (xmlStrings: string[]) => {
    importados: number
    duplicados: number
    pendentesDePara: number
  }
  cancelarNFe: (docId: string, justificativa: string) => void
  reprocessarNotas: () => void

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

  // Ações SEFAZ DF-e
  executarConsultaDFe: (uf: string, forcarConsumoIndevido?: boolean) => void

  // Backup e Restauração
  historicoBackups: BackupHistorico[]
  exportarBackupJson: () => void
  importarBackupJson: (arquivoConteudo: string) => boolean
  restaurarBackupHistorico: (versao: string) => void
}

const SigefContext = createContext<SigefContextType | null>(null)

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
      const atualizado: DadosEmpresaStore = {
        ...prev,
        ...novosDados,
      }
      // Sem empresa real cadastrada, nada é gravado (placeholder nunca persiste)
      if (empresaAtiva.id) salvarDadosEmpresa(atualizado)
      return atualizado
    })
  }

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
    const resultado = reprocessarKardexCronologico(produtosAtuais, documentosAtuais, deParaAtuais)
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

  // Importar XMLs em lote (colados ou pastas)
  const importarXmlsEmLote = (xmlStrings: string[]) => {
    let importados = 0
    let duplicados = 0
    let pendentesDePara = 0

    const novosDocs: DocumentoFiscal[] = []
    xmlStrings.forEach((xml) => {
      if (!xml || !xml.trim()) return
      const doc = parseNFeXml(xml, empresaAtiva.cnpj)
      novosDocs.push(doc)
    })

    // Combina com documentos existentes
    const todosDocumentos = [...store.documentos, ...novosDocs]

    const resultado = reprocessarKardexCronologico(store.produtos, todosDocumentos, store.dePara)

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
    const resultado = reprocessarKardexCronologico(novosProdutos, store.documentos, store.dePara)

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
    return calcularItensInventario(store.produtos, store.kardex)
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

  // SEFAZ DF-e
  const executarConsultaDFe = (uf: string, forcarConsumoIndevido?: boolean) => {
    const resultado = consultarDFeSimulado({
      empresa: empresaAtiva,
      uf,
      ultimoNSUAtual: store.ultimoNSU,
      forcarConsumoIndevido,
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
      const resKardex = reprocessarKardexCronologico(store.produtos, todosDocs, store.dePara)

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
        documentos: store.documentos,
        kardex: store.kardex,
        fechamentos: store.fechamentos,
        ocorrencias: store.ocorrencias,
        consultasDFe: store.consultasDFe,
        ultimoNSU: store.ultimoNSU,
        cadastrarProduto,
        editarProduto,
        excluirProduto,
        importarProdutosPlanilha,
        salvarDePara,
        excluirDePara,
        importarXmlsEmLote,
        cancelarNFe,
        reprocessarNotas,
        gerarContagemCompetencia,
        salvarAjusteContagem,
        fecharCompetencia,
        reprocessarOcorrencia,
        resolverOcorrenciaManual,
        executarConsultaDFe,
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
