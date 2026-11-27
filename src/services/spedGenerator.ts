import { CompetenciaFechamento, Empresa, MovimentoKardex, Produto } from '@/types/sigef'

/**
 * Gerador do arquivo oficial SPED Fiscal (EFD-ICMS/IPI)
 * Leiaute oficial com Blocos:
 * - Bloco 0: Abertura, identificação da empresa (0000, 0001, 0005, 0100, 0150, 0190, 0200, 0990)
 * - Bloco H: Inventário Físico (H001, H005, H010, H990)
 * - Bloco K: Controle da Produção e do Estoque (K001, K010, K200, K990)
 * - Bloco 9: Encerramento e totalizadores (9001, 9900, 9990, 9999)
 */

function formatarDataSped(dataIsoOuDate: string | Date): string {
  const d = typeof dataIsoOuDate === 'string' ? new Date(dataIsoOuDate) : dataIsoOuDate
  const dia = String(d.getDate()).padStart(2, '0')
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const ano = d.getFullYear()
  return `${dia}${mes}${ano}`
}

function formatarNumeroSped(valor: number, decimais: number = 2): string {
  return valor.toFixed(decimais).replace('.', ',')
}

export function gerarSpedTxt(params: {
  empresa: Empresa
  competencia: string // YYYY-MM
  produtos: Produto[]
  kardex: MovimentoKardex[]
  fechamento?: CompetenciaFechamento
}): string {
  const { empresa, competencia, produtos, kardex, fechamento } = params

  const [anoStr, mesStr] = competencia.split('-')
  const ano = parseInt(anoStr, 10)
  const mes = parseInt(mesStr, 10)

  const dtIni = new Date(ano, mes - 1, 1)
  const dtFin = new Date(ano, mes, 0) // Último dia do mês

  const dtIniStr = formatarDataSped(dtIni)
  const dtFinStr = formatarDataSped(dtFin)

  const linhas: string[] = []
  const contagemRegistros: Record<string, number> = {}

  function adicionarLinha(campos: (string | number)[]) {
    const reg = String(campos[0])
    contagemRegistros[reg] = (contagemRegistros[reg] || 0) + 1
    linhas.push(`|${campos.join('|')}|`)
  }

  // ==========================================
  // BLOCO 0 - ABERTURA E IDENTIFICAÇÃO
  // ==========================================
  adicionarLinha([
    '0000',
    '018', // Versão do leiaute Guia Prático
    '0', // Finalidade do arquivo: 0 - Remessa do arquivo original
    dtIniStr,
    dtFinStr,
    empresa.razaoSocial.toUpperCase(),
    empresa.cnpj.replace(/\D/g, ''),
    empresa.uf.toUpperCase(),
    empresa.inscricaoEstadual.replace(/\D/g, ''),
    '3550308', // Código IBGE do Município
    '', // IM
    '', // SUFRAMA
    'A', // Perfil de apresentação
    '1', // Indicador de tipo de atividade: 1 - Outros (Comércio/Atacado)
  ])

  adicionarLinha(['0001', '0']) // Abertura Bloco 0 com movimento

  adicionarLinha([
    '0005',
    empresa.nomeFantasia.toUpperCase(),
    '04500000', // CEP
    'AV INDUSTRIAL',
    '1500',
    '',
    'DISTRITO INDUSTRIAL',
    '1130004000',
    'fiscal@' + empresa.id + '.com.br',
  ])

  adicionarLinha([
    '0100',
    'CONTADOR RESPONSAVEL CRC/SP 123456',
    '12345678909',
    'CRC-SP 123456/O-0',
    '00000000000191',
    '04500000',
    'RUA DOS CONTADORES',
    '100',
    '',
    'CENTRO',
    '1133334444',
    '',
    'contabilidade@sigef.com.br',
    '3550308',
  ])

  // Cadastro de Unidades de Medida (0190)
  const unidades = Array.from(new Set(produtos.map((p) => p.unidade.toUpperCase())))
  unidades.forEach((un) => {
    adicionarLinha(['0190', un, `UNIDADE DE MEDIDA ${un}`])
  })

  // Cadastro de Produtos e Serviços (0200)
  produtos.forEach((p) => {
    adicionarLinha([
      '0200',
      p.codigoInventario,
      p.descricao.toUpperCase(),
      '', // Código de barra
      '', // Código anterior
      p.unidade.toUpperCase(),
      '00', // Tipo do item: 00 - Mercadoria para Revenda
      p.ncm.replace(/\D/g, ''),
      '', // Ex IPI
      '00', // Gênero
      '', // Código serviço
      formatarNumeroSped(p.aliquotaIcms),
      '', // CEST
    ])
  })

  // Fechamento Bloco 0 (0990)
  adicionarLinha(['0990', (contagemRegistros['0000'] || 1) + 1]) // Será recalculado no final

  // ==========================================
  // BLOCO H - INVENTÁRIO FÍSICO
  // ==========================================
  adicionarLinha(['H001', '0']) // Abertura Bloco H com movimento

  // Obter saldo final de cada produto até a data final da competência
  const itensParaH = produtos.map((p) => {
    // Se temos fechamento formal aprovado, usamos seus itens
    const itemFechamento = fechamento?.itensInventario.find(
      (it) => it.codigoInventario === p.codigoInventario,
    )

    if (itemFechamento) {
      return {
        cod: p.codigoInventario,
        unidade: p.unidade,
        qtd: itemFechamento.quantidadeContada,
        unit: itemFechamento.custoMedioSistema,
        tot: itemFechamento.quantidadeContada * itemFechamento.custoMedioSistema,
      }
    }

    // Caso contrário, pega último saldo do Kardex
    const movsDoProduto = kardex.filter((k) => k.codigoInventario === p.codigoInventario)
    const ultimo = movsDoProduto.length > 0 ? movsDoProduto[movsDoProduto.length - 1] : undefined
    const qtd = ultimo ? ultimo.saldoQuantidade : 0
    const unit = ultimo && ultimo.custoMedioUnitario > 0 ? ultimo.custoMedioUnitario : 0
    const tot = ultimo ? ultimo.saldoValorTotal : 0

    return {
      cod: p.codigoInventario,
      unidade: p.unidade,
      qtd,
      unit,
      tot,
    }
  })

  const valorTotalInventarioH = itensParaH.reduce((acc, it) => acc + it.tot, 0)

  adicionarLinha([
    'H005',
    dtFinStr,
    formatarNumeroSped(valorTotalInventarioH),
    '01', // Motivo do inventário: 01 - No final no período
  ])

  itensParaH.forEach((it) => {
    adicionarLinha([
      'H010',
      it.cod,
      it.unidade.toUpperCase(),
      formatarNumeroSped(it.qtd, 3),
      formatarNumeroSped(it.unit, 6),
      formatarNumeroSped(it.tot, 2),
      '0', // Indicador de propriedade: 0 - Do declarante e em seu poder
      '', // Participante
      '', // Conta contábil
      formatarNumeroSped(it.tot, 2), // Valor item para IR
    ])
  })

  adicionarLinha(['H990', '1']) // Fechamento H

  // ==========================================
  // BLOCO K - CONTROLE DA PRODUÇÃO E ESTOQUE
  // ==========================================
  adicionarLinha(['K001', '0']) // Abertura Bloco K com movimento

  adicionarLinha([
    'K010',
    '0', // Leiaute completo do Bloco K
  ])

  // Registro K200 - Estoque Escriturado na data de encerramento do período
  itensParaH.forEach((it) => {
    adicionarLinha([
      'K200',
      dtFinStr,
      it.cod,
      formatarNumeroSped(it.qtd, 3),
      '0', // Tipo de estoque: 0 - Estoque de propriedade do declarante em seu poder
      '', // Participante
    ])
  })

  adicionarLinha(['K990', '1']) // Fechamento K

  // ==========================================
  // BLOCO 9 - CONTROLE E ENCERRAMENTO
  // ==========================================
  adicionarLinha(['9001', '0'])

  // Recalcular contagem exata e montar 9900
  // Lista de todos os registros gerados até aqui
  const registrosExistentes = Object.keys(contagemRegistros)
  registrosExistentes.forEach((reg) => {
    adicionarLinha(['9900', reg, contagemRegistros[reg]])
  })

  adicionarLinha(['9900', '9001', 1])
  adicionarLinha(['9900', '9900', registrosExistentes.length + 4])
  adicionarLinha(['9900', '9990', 1])
  adicionarLinha(['9900', '9999', 1])

  adicionarLinha(['9990', contagemRegistros['9900'] + 3])
  adicionarLinha(['9999', linhas.length + 2])

  return linhas.join('\r\n')
}
