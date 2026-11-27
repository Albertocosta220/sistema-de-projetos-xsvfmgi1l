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

// ===== Espelho da NF-e (dados estruturados extraídos do XML na importação) =====
// Sobrevivem ao descarte do XML bruto por cota (marcador XML_COMPACTADO_QUOTA):
// o espelho da tela Importar lê daqui, sem re-parsear o XML.

export interface EnderecoNFe {
  xLgr?: string
  nro?: string
  xBairro?: string
  xMun?: string
  uf?: string
  cep?: string
}

export interface ParticipanteNFe {
  xNome: string
  cnpjCpf: string
  ie?: string
  endereco?: EnderecoNFe
}

export interface ProtocoloAutorizacao {
  nProt: string
  dhRecbto?: string
  cStat?: string
  xMotivo?: string
  tpAmb?: string
  verAplic?: string
}

export type TipoEventoNFe = 'CANC' | 'CCe' | 'MANIFESTACAO' | 'OUTRO'

export interface EventoNFe {
  tipo: TipoEventoNFe
  /** Código do tipo de evento (110111 cancelamento, 110110 CCe, 2102xx manifestação...). */
  codigoEvento: string
  descricao?: string
  sequencial?: number
  nProt?: string
  dataEvento?: string
  dataRegistro?: string
  cStat?: string
  xMotivo?: string
}

export interface TotaisNFe {
  vBC?: number
  vICMS?: number
  vProd: number
  vFrete?: number
  vSeg?: number
  vDesc?: number
  vII?: number
  vIPI?: number
  vPIS?: number
  vCOFINS?: number
  vOutro?: number
  vNF: number
}

export interface EspelhoNFe {
  naturezaOperacao?: string
  emitente: ParticipanteNFe
  destinatario: ParticipanteNFe
  protocoloAutorizacao?: ProtocoloAutorizacao
  eventos: EventoNFe[]
  totais: TotaisNFe
}

/**
 * Regra de desqualificação para inventário (funcionalidade do usuário): excluir
 * do Kardex/Inventário todas as notas de um CNPJ emitente que contenham o
 * produto (cProd do fornecedor). Persistida por empresa; a marca no documento
 * é derivada destas regras por aplicarRegrasDesqualificacao.
 */
/** Origem da regra: desqualificação p/ inventário, marca "Nota Controla Estoque"
 * (alias) ou "Não vincular" (não gera estoque, sem de-para criado). */
export type OrigemRegraDesqualificacao =
  | 'DESQUALIFICACAO'
  | 'CONTROLE_ESTOQUE'
  | 'NAO_VINCULA_ESTOQUE'

export interface RegraDesqualificacao {
  id: string
  cnpjEmitente: string
  razaoSocialEmitente?: string
  cProd: string
  xProd?: string
  criadoEm: string
  criadoPor: string
  chaveDocOrigem?: string
  /** Qual pedido do usuário criou a regra — define o badge exibido na fila. */
  origem?: OrigemRegraDesqualificacao
}

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
  /** Marca "não gera inventário": fora do Kardex, Bloco H e Bloco C (regra CNPJ + cProd). */
  desqualificadaParaInventario?: boolean
  desqualificadaEm?: string
  desqualificadaPor?: string
  /** Marca derivada "Nota Controla Estoque" = NÃO (alias da desqualificação, mesma regra). */
  naoControlaEstoque?: boolean
  /** Marca derivada "Não vincular": regra CNPJ + cProd gravada SEM criar o
   * de-para — o item não gera estoque, nem inventário (Kardex/Bloco H). */
  naoVinculaEstoque?: boolean
  /** Espelho estruturado do XML (protocolo de autorização, eventos, endereços, totais). */
  espelho?: EspelhoNFe
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
  /** Regras de desqualificação para inventário (CNPJ emitente + cProd do fornecedor). */
  regrasDesqualificacao: RegraDesqualificacao[]
}
