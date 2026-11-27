// Tipos e modelos centrais do SIGEF-ME v1.0
// Controle Fiscal de Estoque Multiempresa para Atacadistas na Reforma Tributária

export type SituacaoCadastral = 'ATIVA' | 'INAPTA' | 'SUSPENSA' | 'BAIXADA'

export interface Empresa {
  id: string
  razaoSocial: string
  nomeFantasia: string
  cnpj: string
  inscricaoEstadual: string
  uf: string
  situacaoCadastral: SituacaoCadastral
  bloquearFechamento: boolean
  motivoBloqueio?: string
}

export interface Produto {
  codigoInventario: string // Código interno no inventário (ex: MET-ALU-001)
  descricao: string
  ncm: string
  cstIcms: string // ex: 000, 020, 040
  cstPisCofins: string // ex: 01, 50
  unidade: string // KG, UN, MT, TON
  fatorConversaoPadrao: number // Multiplica a unidade de compra para chegar na unidade de inventário
  aliquotaIcms: number // percentual, ex: 18
  aliquotaPis: number // percentual, ex: 1.65
  aliquotaCofins: number // percentual, ex: 7.60
  aliquotaIbs: number // percentual Reforma Tributária, ex: 1.0 (teste/transição)
  aliquotaCbs: number // percentual Reforma Tributária, ex: 0.9 (teste/transição)
  /** Marcado pelo importador de planilha quando algum campo veio "SEM CORRESPONDÊNCIA" ou incompleto. */
  revisar?: boolean
  /** Observação gerada na importação da planilha (coluna divergente/pendência de revisão). */
  observacaoImportacao?: string
}

export interface DeParaVigente {
  id: string
  cnpjFornecedor: string
  razaoSocialFornecedor?: string
  cProd: string // Código no fornecedor
  xProd: string // Descrição no fornecedor
  uCom: string // Unidade de compra
  fatorConversao: number // Fator específico desta relação
  codigoInventario: string // Código interno vinculado
  atualizadoEm: string
}

export interface RegraCfop {
  id: string
  cfop: string // 4 dígitos
  naturezaMovimento: string
  descricao: string
  tipoOperacao: 'ENTRADA' | 'SAIDA'
  gerarBlocoK: boolean
  ativa: boolean
  atualizadoEm: string
}

export type StatusDocumento =
  | 'PENDENTE'
  | 'PROCESSADO'
  | 'AGUARDANDO_DE_PARA'
  | 'ERRO'
  | 'DUPLICIDADE'
  | 'CANCELADO'

export type TipoOperacaoNFe = 'ENTRADA' | 'SAIDA'

export interface ItemNFe {
  nItem: number
  cProd: string
  cEAN?: string
  xProd: string
  ncm: string
  cfop: string
  uCom: string
  qCom: number
  vUnCom: number
  vProd: number
  vDesc?: number
  vFrete?: number
  // Tributos destacados
  vICMS?: number
  vPIS?: number
  vCOFINS?: number
  vIBS?: number // Reforma Tributária
  vCBS?: number // Reforma Tributária
  // Resolução de de-para
  codigoInventario?: string
  fatorConversaoAplicado?: number
  quantidadeConvertida?: number
  custoLiquidoAquisicao?: number // Valor total menos tributos recuperáveis
  custoUnitarioConvertido?: number
  pendenteDePara?: boolean
}

export interface DocumentoFiscal {
  id: string
  chaveAcesso: string
  numero: string
  serie: string
  dataEmissao: string // YYYY-MM-DDTHH:mm:ss
  dataEntradaSaida: string
  tipoOperacao: TipoOperacaoNFe
  cnpjEmitente: string
  nomeEmitente: string
  cnpjDestinatario: string
  nomeDestinatario: string
  valorTotal: number
  status: StatusDocumento
  motivoErro?: string
  xmlOriginal: string
  itens: ItemNFe[]
  importadoEm: string
  canceladoEm?: string
  justificativaCancelamento?: string
  /** NSU atribuído pelo distribuidor DF-e simulado (quando baixado via consulta). */
  nsu?: number
}

export type TipoMovimentoKardex =
  | 'ENTRADA_COMPRA'
  | 'SAIDA_VENDA'
  | 'AJUSTE_INVENTARIO_ENTRADA'
  | 'AJUSTE_INVENTARIO_SAIDA'
  | 'ESTORNO_CANCELAMENTO'

export interface MovimentoKardex {
  id: string
  dataMovimento: string
  codigoInventario: string
  tipo: TipoMovimentoKardex
  documentoRef: string // Número/Série NF ou Chave ou 'INV-COMPETENCIA'
  chaveNFeRef?: string
  nItemRef?: number
  historico: string
  // Quantidades e Valores
  quantidadeEntrada: number
  custoUnitarioEntrada: number
  valorTotalEntrada: number
  quantidadeSaida: number
  custoUnitarioSaida: number
  valorTotalSaida: number
  // Saldo Resultante após o movimento (Custo Médio Ponderado)
  saldoQuantidade: number
  custoMedioUnitario: number
  saldoValorTotal: number
  // Indicadores
  estornado?: boolean
  bloqueadoSaldoNegativo?: boolean
}

export interface ItemContagemInventario {
  codigoInventario: string
  descricao: string
  unidade: string
  quantidadeSistema: number
  custoMedioSistema: number
  valorTotalSistema: number
  quantidadeContada: number
  diferencaQuantidade: number // contada - sistema
  diferencaValor: number
  statusAjuste: 'PENDENTE' | 'APROVADO' | 'REJEITADO' | 'SEM_DIVERGENCIA'
  justificativa?: string
}

export interface CompetenciaFechamento {
  id: string
  competencia: string // YYYY-MM
  dataFechamento: string
  responsavel: string
  status: 'ABERTA' | 'FECHADA' | 'BLOQUEADA'
  itensInventario: ItemContagemInventario[]
  valorTotalEstoque: number
  bloqueioMotivos?: string[]
}

export type SeveridadeRegra = 'INFO' | 'AVISO' | 'ERRO' | 'BLOQUEANTE'

export interface OcorrenciaAuditoria {
  id: string
  regraCodigo: string // A01 .. A12
  regraNome: string
  severidade: SeveridadeRegra
  descricao: string
  baseLegal: string
  documentoRef?: string
  chaveAcessoRef?: string
  codigoInventarioRef?: string
  competenciaRef?: string
  dataIdentificacao: string
  resolvido: boolean
  podeReprocessar: boolean
  /** Usuário logado que resolveu/reprocessou a ocorrência (quando aplicável). */
  resolvidoPor?: string
  resolvidoEm?: string
}

export interface ConsultaDFeSefaz {
  id: string
  uf: string
  dataConsulta: string
  nsuConsultado: number
  novoUltNSU: number
  maxNSU: number
  codigoStatus: number // 137 (Nenhum doc), 138 (Doc localizado), 656 (Consumo indevido)
  xMotivo: string
  documentosRetornados: number
}

export interface BackupHistorico {
  versao: string
  dataBackup: string
  descricao: string
  tamanhoKb: number
  dadosJson: string
}

export interface DadosEmpresaStore {
  empresa: Empresa
  produtos: Produto[]
  dePara: DeParaVigente[]
  documentos: DocumentoFiscal[]
  kardex: MovimentoKardex[]
  fechamentos: CompetenciaFechamento[]
  ocorrencias: OcorrenciaAuditoria[]
  consultasDFe: ConsultaDFeSefaz[]
  ultimoNSU: number
  /** Competência ativa (YYYY-MM) definida pela última importação — persistida por empresa. */
  competenciaAtiva?: string
}
