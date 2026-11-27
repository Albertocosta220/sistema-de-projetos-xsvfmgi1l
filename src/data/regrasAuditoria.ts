// Definição das Réguas de Auditoria Fiscal SIGEF-ME (A01 a A13)
// Especificação completa com bases legais vigentes e Reforma Tributária

export interface DefinicaoRegra {
  codigo: string
  nome: string
  descricao: string
  baseLegal: string
  severidadePadrao: 'INFO' | 'AVISO' | 'ERRO' | 'BLOQUEANTE'
}

export const REGUAS_AUDITORIA: DefinicaoRegra[] = [
  {
    codigo: 'A01',
    nome: 'Chave de Acesso em Duplicidade',
    descricao:
      'Identificação de XML com chave de acesso idêntica já escriturada ou protocolada no período.',
    baseLegal: 'Ajuste SINIEF 07/05, Cláusula terceira; RICMS/SP Art. 127',
    severidadePadrao: 'ERRO',
  },
  {
    codigo: 'A02',
    nome: 'Item sem De-Para Vinculado (cProd Desconhecido)',
    descricao:
      'Mercadoria recebida de fornecedor cujo código não possui mapeamento com o catálogo de inventário.',
    baseLegal: 'Guia Prático EFD-ICMS/IPI v3.1.6, Reg. 0205 e 0220; Convênio SINIEF s/nº de 1970',
    severidadePadrao: 'BLOQUEANTE',
  },
  {
    codigo: 'A03',
    nome: 'Saída Bloqueada por Saldo Negativo de Estoque',
    descricao:
      'Tentativa de movimentação de saída que deixaria o saldo físico inferior a zero na linha do tempo.',
    baseLegal: 'RIR/2018 Art. 304; Parecer Normativo CST nº 26/1976; Convênio S/N 1970',
    severidadePadrao: 'BLOQUEANTE',
  },
  {
    codigo: 'A04',
    nome: 'Divergência de Contagem no Inventário Físico',
    descricao:
      'Diferença apurada entre o estoque escriturado e a contagem física registrada na competência.',
    baseLegal: 'RIR/2018 Art. 306; Guia Prático EFD Reg. H010 / K200',
    severidadePadrao: 'AVISO',
  },
  {
    codigo: 'A05',
    nome: 'Cancelamento Extemporâneo ou Estorno de NF-e',
    descricao:
      'NF-e cancelada após processamento original, exigindo estorno e recálculo do Kardex cronológico.',
    baseLegal: 'Ajuste SINIEF 07/05, Cláusula décima segunda; Protocolo ICMS 10/07',
    severidadePadrao: 'AVISO',
  },
  {
    codigo: 'A06',
    nome: 'Dedução Indevida de Tributos no Custo de Aquisição',
    descricao:
      'Verificação da correta exclusão do ICMS e PIS/COFINS (e créditos de IBS/CBS na Reforma) do custo.',
    baseLegal: 'Lei 10.637/02 Art. 3º; Lei 10.833/03 Art. 3º; EC 132/2023 (Reforma Tributária)',
    severidadePadrao: 'ERRO',
  },
  {
    codigo: 'A07',
    nome: 'Fator de Conversão de Unidade Suspeito ou Nulo',
    descricao:
      'Fator de conversão igual a 0 ou variação superior a 1000x entre uCom da NF-e e unidade de estoque.',
    baseLegal: 'Guia Prático EFD-ICMS/IPI Registro 0220 (Fatores de Conversão)',
    severidadePadrao: 'ERRO',
  },
  {
    codigo: 'A08',
    nome: 'Fechamento de Competência com Pendências em Aberto',
    descricao:
      'Tentativa de encerrar o inventário mensal com documentos com status PENDENTE ou AGUARDANDO_DE_PARA.',
    baseLegal: 'Guia Prático EFD Bloco H / Instrução Normativa RFB nº 1.700/2017',
    severidadePadrao: 'BLOQUEANTE',
  },
  {
    codigo: 'A09',
    nome: 'Inaptidão Cadastral da Empresa (Operações Bloqueadas)',
    descricao:
      'Empresa em situação cadastral irregular (INAPTA/SUSPENSA/BAIXADA) com tentativa de fechamento.',
    baseLegal: 'IN RFB nº 2.119/2022 Art. 40; Lei 9.430/1996 Art. 81',
    severidadePadrao: 'BLOQUEANTE',
  },
  {
    codigo: 'A10',
    nome: 'Quebra de Sequência Cronológica de Movimentações',
    descricao:
      'Registro de movimento fiscal com data retroativa a competência já fechada ou após movimentos subsequentes.',
    baseLegal: 'NBC TG 16 (R2) - Estoques; RIR/2018 Art. 304',
    severidadePadrao: 'AVISO',
  },
  {
    codigo: 'A11',
    nome: 'Consumo Indevido no Web Service SEFAZ DF-e (Rejeição 656)',
    descricao:
      'Repetição de consulta DF-e sem incremento de NSU ou intervalo mínimo legal de requisições.',
    baseLegal: 'Manual de Orientação do Contribuinte (MOC) DF-e v1.01; NT 2014.002',
    severidadePadrao: 'AVISO',
  },
  {
    codigo: 'A12',
    nome: 'Divergência entre Totais dos Blocos H e K do SPED',
    descricao:
      'Totalização física no Bloco H diverge das quantidades escrituradas no Bloco K (K200) na data de corte.',
    baseLegal: 'Ato COTEPE/ICMS nº 44/2018; Guia Prático EFD-ICMS/IPI Registro K200 e H010',
    severidadePadrao: 'ERRO',
  },
  {
    codigo: 'A13',
    nome: 'Importação de planilha — itens para revisão',
    descricao:
      'Item do cadastro importado por planilha que veio com campo "SEM CORRESPONDÊNCIA" ou dados fiscais incompletos, exigindo revisão manual do enquadramento.',
    baseLegal:
      'Lei 11.196/2005 arts. 47/48; TIPI (Decreto 11.158/2022); Guia Prático EFD Reg. 0200',
    severidadePadrao: 'AVISO',
  },
]
