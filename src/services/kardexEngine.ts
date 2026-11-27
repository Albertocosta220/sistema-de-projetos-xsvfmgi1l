import {
  DeParaVigente,
  DocumentoFiscal,
  ItemContagemInventario,
  MovimentoKardex,
  OcorrenciaAuditoria,
  Produto,
  RegraDesqualificacao,
} from '@/types/sigef'
import { REGUAS_AUDITORIA } from '@/data/regrasAuditoria'
import { chaveRegraDesqualificacao, chavesNaoVinculaEstoque } from './desqualificacaoService'
import { normalizarCodigo } from './vinculoAutomaticoService'

export interface ResultadoProcessamentoLote {
  documentosAtualizados: DocumentoFiscal[]
  movimentosKardex: MovimentoKardex[]
  novasOcorrencias: OcorrenciaAuditoria[]
  deParaVigentes: DeParaVigente[]
}

export function buscarDePara(
  cnpjFornecedor: string,
  cProdFornecedor: string,
  tabelaDePara: DeParaVigente[],
): DeParaVigente | undefined {
  const cnpjLimpo = cnpjFornecedor.replace(/\D/g, '')
  // Exato (mesma capitalização) tem prioridade…
  const exato = tabelaDePara.find(
    (dp) =>
      dp.cnpjFornecedor.replace(/\D/g, '') === cnpjLimpo &&
      dp.cProd.trim().toUpperCase() === cProdFornecedor.trim().toUpperCase(),
  )
  if (exato) return exato
  // …e o fallback normalizado (trim, maiúsculas, zeros à esquerda) cobre os
  // casos em que o vínculo foi gravado com o cProd em outra forma (ex. '0078'
  // vs '78' ou '78 ' no XML) — sem ele, um vínculo criado pelo automático
  // nunca é resolvido no kardex e a nota volta para AGUARDANDO_DE_PARA.
  const alvo = normalizarCodigo(cProdFornecedor)
  return tabelaDePara.find(
    (dp) =>
      dp.cnpjFornecedor.replace(/\D/g, '') === cnpjLimpo && normalizarCodigo(dp.cProd) === alvo,
  )
}

/**
 * Recomputa toda a linha do tempo do Kardex por Custo Médio Ponderado (CMP).
 * Respeita saídas bloqueadas por saldo negativo (Regra A03), estornos de notas
 * canceladas (Regra A05) e itens com regra "Não vincular" (sem pendência de de-para).
 */

export function reprocessarKardexCronologico(
  produtos: Produto[],
  documentos: DocumentoFiscal[],
  deParaList: DeParaVigente[],
  ajustesInventario: Array<{
    dataMovimento: string
    codigoInventario: string
    quantidadeAjuste: number // positivo = entrada, negativo = saída
    motivo: string
  }> = [],
  regrasDesqualificacao: RegraDesqualificacao[] = [],
): {
  documentosAtualizados: DocumentoFiscal[]
  kardex: MovimentoKardex[]
  ocorrencias: OcorrenciaAuditoria[]
} {
  const ocorrencias: OcorrenciaAuditoria[] = []

  // Pares CNPJ emitente + cProd com regra "Não vincular": esses itens não têm
  // de-para a resolver — NÃO geram pendência, aviso nem erro (o "resolver
  // de-para" nunca será executado para eles).
  const paresNaoVinculados = chavesNaoVinculaEstoque(regrasDesqualificacao)

  const docsOrdenados = [...documentos].sort(
    (a, b) => new Date(a.dataEmissao).getTime() - new Date(b.dataEmissao).getTime(),
  )

  // 1. Verificar duplicidades de Chave de Acesso (Regra A01)
  const chavesVistas = new Set<string>()
  const docsComStatus = docsOrdenados.map((doc) => {
    if (doc.status === 'CANCELADO') return doc
    if (chavesVistas.has(doc.chaveAcesso)) {
      ocorrencias.push({
        id: `oco-a01-${doc.id}`,
        regraCodigo: 'A01',
        regraNome: 'Chave de Acesso em Duplicidade',
        severidade: 'ERRO',
        descricao: `A NF-e nº ${doc.numero} (série ${doc.serie}) possui chave ${doc.chaveAcesso} já registrada anteriormente.`,
        baseLegal: REGUAS_AUDITORIA.find((r) => r.codigo === 'A01')?.baseLegal || '',
        documentoRef: doc.numero,
        chaveAcessoRef: doc.chaveAcesso,
        dataIdentificacao: new Date().toISOString(),
        resolvido: false,
        podeReprocessar: true,
      })
      return {
        ...doc,
        status: 'DUPLICIDADE' as const,
        motivoErro: 'Chave de acesso em duplicidade (Regra A01)',
      }
    }
    chavesVistas.add(doc.chaveAcesso)
    return doc
  })

  // 2. Resolver de-para e validar itens
  const docsAposDePara = docsComStatus.map((doc) => {
    if (doc.status === 'CANCELADO' || doc.status === 'DUPLICIDADE') return doc

    let pendenteDePara = false
    const itensResolvidos = (doc.itens || []).map((item) => {
      // Item com regra "Não vincular" (CNPJ emitente + cProd): fica fora do
      // de-para sem virar pendência, aviso (A02) nem erro — a nota segue
      // visível com o badge violeta derivado das regras.
      if (paresNaoVinculados.has(chaveRegraDesqualificacao(doc.cnpjEmitente, item.cProd))) {
        return {
          ...item,
          // Sem vínculo por definição (o de-para NÃO é criado) — mas também sem
          // pendência: não vira AGUARDANDO_DE_PARA, aviso (A02) nem erro.
          pendenteDePara: false,
          codigoInventario: undefined,
          fatorConversaoAplicado: item.fatorConversaoAplicado ?? 1,
          quantidadeConvertida: item.quantidadeConvertida ?? item.qCom,
          custoLiquidoAquisicao: item.custoLiquidoAquisicao ?? Math.max(0, item.vProd),
          custoUnitarioConvertido:
            item.custoUnitarioConvertido ??
            (item.qCom > 0 ? Math.max(0, item.vProd) / item.qCom : 0),
        }
      }

      // Se for saída emitida pela própria empresa, o código já costuma ser o próprio do produto
      let codInv: string | undefined
      let fator = 1.0

      if (doc.tipoOperacao === 'SAIDA') {
        const prodExistente = produtos.find((p) => p.codigoInventario === item.cProd)
        if (prodExistente) {
          codInv = prodExistente.codigoInventario
          fator = prodExistente.fatorConversaoPadrao || 1.0
        } else {
          // Busca de-para mesmo assim
          const dp = buscarDePara(doc.cnpjEmitente, item.cProd, deParaList)
          if (dp) {
            codInv = dp.codigoInventario
            fator = dp.fatorConversao || 1.0
          } else {
            pendenteDePara = true
          }
        }
      } else {
        // ENTRADA: busca de-para com CNPJ do Fornecedor + cProd
        const dp = buscarDePara(doc.cnpjEmitente, item.cProd, deParaList)
        if (dp) {
          codInv = dp.codigoInventario
          fator = dp.fatorConversao > 0 ? dp.fatorConversao : 1.0
        } else {
          pendenteDePara = true
        }
      }

      // Validação Regra A07 - Fator suspeito
      if (fator <= 0 || fator > 1000) {
        ocorrencias.push({
          id: `oco-a07-${doc.id}-${item.nItem}`,
          regraCodigo: 'A07',
          regraNome: 'Fator de Conversão de Unidade Suspeito ou Nulo',
          severidade: 'ERRO',
          descricao: `Item ${item.nItem} (${item.xProd}) possui fator de conversão de ${fator}, fora dos padrões aceitos.`,
          baseLegal: REGUAS_AUDITORIA.find((r) => r.codigo === 'A07')?.baseLegal || '',
          documentoRef: doc.numero,
          chaveAcessoRef: doc.chaveAcesso,
          dataIdentificacao: new Date().toISOString(),
          resolvido: false,
          podeReprocessar: true,
        })
      }

      const qConvertida = item.qCom * fator
      // Custo Líquido de Aquisição (Dedução de ICMS, PIS, COFINS e IBS/CBS na Reforma Tributária - Regra A06)
      const vIcmsRecuperavel = item.vICMS || 0
      const vPisRecuperavel = item.vPIS || 0
      const vCofinsRecuperavel = item.vCOFINS || 0
      const vIbsRecuperavel = item.vIBS || 0
      const vCbsRecuperavel = item.vCBS || 0

      const tributosRecuperaveis =
        vIcmsRecuperavel + vPisRecuperavel + vCofinsRecuperavel + vIbsRecuperavel + vCbsRecuperavel
      const custoLiquidoAquisicao = Math.max(0, item.vProd - tributosRecuperaveis)
      const custoUnitarioConvertido = qConvertida > 0 ? custoLiquidoAquisicao / qConvertida : 0

      return {
        ...item,
        codigoInventario: codInv,
        fatorConversaoAplicado: fator,
        quantidadeConvertida: qConvertida,
        custoLiquidoAquisicao,
        custoUnitarioConvertido,
        pendenteDePara: !codInv,
      }
    })

    if (pendenteDePara) {
      ocorrencias.push({
        id: `oco-a02-${doc.id}`,
        regraCodigo: 'A02',
        regraNome: 'Item sem De-Para Vinculado (cProd Desconhecido)',
        severidade: 'BLOQUEANTE',
        descricao: `A NF-e nº ${doc.numero} do emitente ${doc.nomeEmitente} possui itens sem de-para vinculado.`,
        baseLegal: REGUAS_AUDITORIA.find((r) => r.codigo === 'A02')?.baseLegal || '',
        documentoRef: doc.numero,
        chaveAcessoRef: doc.chaveAcesso,
        dataIdentificacao: new Date().toISOString(),
        resolvido: false,
        podeReprocessar: true,
      })
      return {
        ...doc,
        itens: itensResolvidos,
        status: 'AGUARDANDO_DE_PARA' as const,
        motivoErro: 'Itens pendentes de mapeamento De-Para (cProd)',
      }
    }

    return {
      ...doc,
      itens: itensResolvidos,
      status: 'PROCESSADO' as const,
      motivoErro: undefined,
    }
  })

  // 3. Montar Linha de Movimentos Cronológicos por Produto
  // Cada produto mantém seu estado de saldoQuantidade, custoMedioUnitario, saldoValorTotal
  const saldoPorProduto: Record<
    string,
    {
      quantidade: number
      custoMedio: number
      valorTotal: number
    }
  > = {}

  produtos.forEach((p) => {
    saldoPorProduto[p.codigoInventario] = {
      quantidade: 0,
      custoMedio: 0,
      valorTotal: 0,
    }
  })

  const kardex: MovimentoKardex[] = []

  // Criar eventos combinados (entradas, saídas, ajustes, estornos) ordenados por data
  interface EventoParaKardex {
    data: string
    tipo: 'DOC' | 'AJUSTE'
    doc?: DocumentoFiscal
    ajuste?: {
      dataMovimento: string
      codigoInventario: string
      quantidadeAjuste: number
      motivo: string
    }
  }

  const eventos: EventoParaKardex[] = [
    ...docsAposDePara.map((doc) => ({ data: doc.dataEmissao, tipo: 'DOC' as const, doc })),
    ...ajustesInventario.map((aj) => ({
      data: aj.dataMovimento,
      tipo: 'AJUSTE' as const,
      ajuste: aj,
    })),
  ].sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime())

  eventos.forEach((ev) => {
    if (ev.tipo === 'DOC' && ev.doc) {
      const doc = ev.doc
      const isCancelado = doc.status === 'CANCELADO'

      // Documento desqualificado para inventário ("não gera inventário"),
      // marcado "Não controla estoque" (alias da mesma regra CNPJ + cProd) ou
      // gravado "Não vincular" (regra CNPJ + cProd sem de-para): fica fora do
      // Kardex e, portanto, do Bloco H (Regra A13).
      if (doc.desqualificadaParaInventario || doc.naoControlaEstoque || doc.naoVinculaEstoque)
        return

      // Se documento não está processado ou cancelado, não gera kardex direto (exceto se for cancelado gerando estorno)
      if (doc.status !== 'PROCESSADO' && !isCancelado) return

      ;(doc.itens || []).forEach((item) => {
        const codInv = item.codigoInventario
        if (!codInv) return

        if (!saldoPorProduto[codInv]) {
          saldoPorProduto[codInv] = { quantidade: 0, custoMedio: 0, valorTotal: 0 }
        }

        const saldoAtual = saldoPorProduto[codInv]
        const qConvertida = item.quantidadeConvertida || item.qCom

        if (isCancelado) {
          // Estorno de NF cancelada (Regra A05)
          ocorrencias.push({
            id: `oco-a05-${doc.id}-${item.nItem}`,
            regraCodigo: 'A05',
            regraNome: 'Cancelamento Extemporâneo ou Estorno de NF-e',
            severidade: 'AVISO',
            descricao: `Estorno efetuado para a NF-e cancelada nº ${doc.numero}, item ${item.nItem} (${codInv}).`,
            baseLegal: REGUAS_AUDITORIA.find((r) => r.codigo === 'A05')?.baseLegal || '',
            documentoRef: doc.numero,
            chaveAcessoRef: doc.chaveAcesso,
            codigoInventarioRef: codInv,
            dataIdentificacao: doc.canceladoEm || new Date().toISOString(),
            resolvido: true,
            podeReprocessar: false,
          })

          kardex.push({
            id: `estorno-${doc.id}-${item.nItem}`,
            dataMovimento: doc.canceladoEm || doc.dataEmissao,
            codigoInventario: codInv,
            tipo: 'ESTORNO_CANCELAMENTO',
            documentoRef: `CANC NF ${doc.numero}`,
            chaveNFeRef: doc.chaveAcesso,
            nItemRef: item.nItem,
            historico: `Estorno de ${doc.tipoOperacao} da NF-e cancelada nº ${doc.numero}`,
            quantidadeEntrada: 0,
            custoUnitarioEntrada: 0,
            valorTotalEntrada: 0,
            quantidadeSaida: 0,
            custoUnitarioSaida: 0,
            valorTotalSaida: 0,
            saldoQuantidade: saldoAtual.quantidade,
            custoMedioUnitario: saldoAtual.custoMedio,
            saldoValorTotal: saldoAtual.valorTotal,
            estornado: true,
          })
          return
        }

        if (doc.tipoOperacao === 'ENTRADA') {
          // ENTRADA: Aplica Custo Médio Ponderado (CMP)
          // Novo Saldo Qtd = Saldo Anterior Qtd + Qtd Entrada
          // Novo Saldo Valor = Saldo Anterior Valor + Custo Líquido Aquisição
          // Novo Custo Médio = Novo Saldo Valor / Novo Saldo Qtd
          const valorEntrada = item.custoLiquidoAquisicao || item.vProd
          const custoUnitEntrada = qConvertida > 0 ? valorEntrada / qConvertida : 0

          const novoSaldoQtd = saldoAtual.quantidade + qConvertida
          const novoSaldoValor = saldoAtual.valorTotal + valorEntrada
          const novoCustoMedio = novoSaldoQtd > 0 ? novoSaldoValor / novoSaldoQtd : custoUnitEntrada

          saldoAtual.quantidade = novoSaldoQtd
          saldoAtual.valorTotal = novoSaldoValor
          saldoAtual.custoMedio = novoCustoMedio

          kardex.push({
            id: `kdx-${doc.id}-${item.nItem}`,
            dataMovimento: doc.dataEmissao,
            codigoInventario: codInv,
            tipo: 'ENTRADA_COMPRA',
            documentoRef: `NF ${doc.numero}/${doc.serie}`,
            chaveNFeRef: doc.chaveAcesso,
            nItemRef: item.nItem,
            historico: `Compra - ${doc.nomeEmitente} (Item: ${item.xProd})`,
            quantidadeEntrada: qConvertida,
            custoUnitarioEntrada: custoUnitEntrada,
            valorTotalEntrada: valorEntrada,
            quantidadeSaida: 0,
            custoUnitarioSaida: 0,
            valorTotalSaida: 0,
            saldoQuantidade: novoSaldoQtd,
            custoMedioUnitario: novoCustoMedio,
            saldoValorTotal: novoSaldoValor,
          })
        } else {
          // SAÍDA: Baixa pelo Custo Médio Vigente
          // Bloquear se geraria saldo negativo (Regra A03)
          if (saldoAtual.quantidade - qConvertida < -0.0001) {
            // BLOQUEIO POR SALDO NEGATIVO
            ocorrencias.push({
              id: `oco-a03-${doc.id}-${item.nItem}`,
              regraCodigo: 'A03',
              regraNome: 'Saída Bloqueada por Saldo Negativo de Estoque',
              severidade: 'BLOQUEANTE',
              descricao: `A NF-e nº ${doc.numero} tenta retirar ${qConvertida} de ${codInv}, mas o saldo atual é apenas ${saldoAtual.quantidade}.`,
              baseLegal: REGUAS_AUDITORIA.find((r) => r.codigo === 'A03')?.baseLegal || '',
              documentoRef: doc.numero,
              chaveAcessoRef: doc.chaveAcesso,
              codigoInventarioRef: codInv,
              dataIdentificacao: doc.dataEmissao,
              resolvido: false,
              podeReprocessar: true,
            })

            kardex.push({
              id: `kdx-bloq-${doc.id}-${item.nItem}`,
              dataMovimento: doc.dataEmissao,
              codigoInventario: codInv,
              tipo: 'SAIDA_VENDA',
              documentoRef: `BLOQUEIO NF ${doc.numero}`,
              chaveNFeRef: doc.chaveAcesso,
              nItemRef: item.nItem,
              historico: `[BLOQUEADA] Tentativa de saída superior ao saldo físico disponível`,
              quantidadeEntrada: 0,
              custoUnitarioEntrada: 0,
              valorTotalEntrada: 0,
              quantidadeSaida: qConvertida,
              custoUnitarioSaida: saldoAtual.custoMedio,
              valorTotalSaida: qConvertida * saldoAtual.custoMedio,
              saldoQuantidade: saldoAtual.quantidade,
              custoMedioUnitario: saldoAtual.custoMedio,
              saldoValorTotal: saldoAtual.valorTotal,
              bloqueadoSaldoNegativo: true,
            })
          } else {
            // Saída autorizada: baixa ao CMP
            const custoUnitSaida = saldoAtual.custoMedio
            const valorTotalSaida = qConvertida * custoUnitSaida
            const novoSaldoQtd = Math.max(0, saldoAtual.quantidade - qConvertida)
            const novoSaldoValor = novoSaldoQtd > 0 ? novoSaldoQtd * custoUnitSaida : 0

            saldoAtual.quantidade = novoSaldoQtd
            saldoAtual.valorTotal = novoSaldoValor

            kardex.push({
              id: `kdx-${doc.id}-${item.nItem}`,
              dataMovimento: doc.dataEmissao,
              codigoInventario: codInv,
              tipo: 'SAIDA_VENDA',
              documentoRef: `NF ${doc.numero}/${doc.serie}`,
              chaveNFeRef: doc.chaveAcesso,
              nItemRef: item.nItem,
              historico: `Venda - ${doc.nomeDestinatario}`,
              quantidadeEntrada: 0,
              custoUnitarioEntrada: 0,
              valorTotalEntrada: 0,
              quantidadeSaida: qConvertida,
              custoUnitarioSaida: custoUnitSaida,
              valorTotalSaida: valorTotalSaida,
              saldoQuantidade: novoSaldoQtd,
              custoMedioUnitario: custoUnitSaida,
              saldoValorTotal: novoSaldoValor,
            })
          }
        }
      })
    } else if (ev.tipo === 'AJUSTE' && ev.ajuste) {
      // Ajuste aprovado de inventário
      const aj = ev.ajuste
      const codInv = aj.codigoInventario
      if (!saldoPorProduto[codInv]) {
        saldoPorProduto[codInv] = { quantidade: 0, custoMedio: 0, valorTotal: 0 }
      }
      const saldoAtual = saldoPorProduto[codInv]

      if (aj.quantidadeAjuste > 0) {
        const qEntrada = aj.quantidadeAjuste
        const custoEntrada = saldoAtual.custoMedio
        const vEntrada = qEntrada * custoEntrada
        const novoSaldoQtd = saldoAtual.quantidade + qEntrada
        const novoSaldoValor = saldoAtual.valorTotal + vEntrada

        saldoAtual.quantidade = novoSaldoQtd
        saldoAtual.valorTotal = novoSaldoValor

        kardex.push({
          id: `kdx-ajuste-in-${Date.now()}-${codInv}`,
          dataMovimento: aj.dataMovimento,
          codigoInventario: codInv,
          tipo: 'AJUSTE_INVENTARIO_ENTRADA',
          documentoRef: 'AJUSTE-INV',
          historico: `Ajuste Físico de Inventário (+): ${aj.motivo}`,
          quantidadeEntrada: qEntrada,
          custoUnitarioEntrada: custoEntrada,
          valorTotalEntrada: vEntrada,
          quantidadeSaida: 0,
          custoUnitarioSaida: 0,
          valorTotalSaida: 0,
          saldoQuantidade: novoSaldoQtd,
          custoMedioUnitario: custoEntrada,
          saldoValorTotal: novoSaldoValor,
        })
      } else if (aj.quantidadeAjuste < 0) {
        const qSaida = Math.abs(aj.quantidadeAjuste)
        const custoSaida = saldoAtual.custoMedio
        const vSaida = qSaida * custoSaida
        const novoSaldoQtd = Math.max(0, saldoAtual.quantidade - qSaida)
        const novoSaldoValor = novoSaldoQtd * custoSaida

        saldoAtual.quantidade = novoSaldoQtd
        saldoAtual.valorTotal = novoSaldoValor

        kardex.push({
          id: `kdx-ajuste-out-${Date.now()}-${codInv}`,
          dataMovimento: aj.dataMovimento,
          codigoInventario: codInv,
          tipo: 'AJUSTE_INVENTARIO_SAIDA',
          documentoRef: 'AJUSTE-INV',
          historico: `Ajuste Físico de Inventário (-): ${aj.motivo}`,
          quantidadeEntrada: 0,
          custoUnitarioEntrada: 0,
          valorTotalEntrada: 0,
          quantidadeSaida: qSaida,
          custoUnitarioSaida: custoSaida,
          valorTotalSaida: vSaida,
          saldoQuantidade: novoSaldoQtd,
          custoMedioUnitario: custoSaida,
          saldoValorTotal: novoSaldoValor,
        })
      }
    }
  })

  return {
    documentosAtualizados: docsAposDePara,
    kardex,
    ocorrencias,
  }
}

/**
 * Monta os itens para a tela de Inventário Físico / Fechamento do Bloco H
 */
export function calcularItensInventario(
  produtos: Produto[],
  kardex: MovimentoKardex[],
): ItemContagemInventario[] {
  return produtos.map((p) => {
    // Pega o último movimento do produto no Kardex para saber o saldo escriturado
    const movsDoProduto = kardex.filter((k) => k.codigoInventario === p.codigoInventario)
    const ultimoMov = movsDoProduto.length > 0 ? movsDoProduto[movsDoProduto.length - 1] : undefined

    const qtdSistema = ultimoMov ? ultimoMov.saldoQuantidade : 0
    const custoMedio =
      ultimoMov && ultimoMov.custoMedioUnitario > 0 ? ultimoMov.custoMedioUnitario : 0
    const valorTotal = ultimoMov ? ultimoMov.saldoValorTotal : 0

    return {
      codigoInventario: p.codigoInventario,
      descricao: p.descricao,
      unidade: p.unidade,
      quantidadeSistema: qtdSistema,
      custoMedioSistema: custoMedio,
      valorTotalSistema: valorTotal,
      quantidadeContada: qtdSistema, // default igual ao sistema
      diferencaQuantidade: 0,
      diferencaValor: 0,
      statusAjuste: 'SEM_DIVERGENCIA',
    }
  })
}
