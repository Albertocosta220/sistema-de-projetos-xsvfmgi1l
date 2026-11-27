import {
  BackupHistorico,
  DadosEmpresaStore,
  DeParaVigente,
  DocumentoFiscal,
  Empresa,
} from '@/types/sigef'
import {
  EMPRESA_ALENA,
  EMPRESA_ALL_METALS,
  EMPRESA_VB_METAIS,
  PRODUTOS_VB_METAIS,
  TODAS_EMPRESAS,
  XMLS_SEED_VB_METAIS,
} from '@/data/seedData'
import { parseNFeXml } from './nfeXmlParser'
import { reprocessarKardexCronologico } from './kardexEngine'

const KEY_EMPRESA_ATIVA = 'sigef_empresa_ativa_id'
const KEY_EMPRESAS_CADASTRO = 'sigef_empresas_lista'
const KEY_PREFIX_STORE = 'sigef_store_empresa_'
const KEY_BACKUP_HISTORICO = 'sigef_backup_historico'

/**
 * Cria o estado inicial rico da VB Metais com XMLs processados, de-para inicial e Kardex calculado
 */
export function criarSeedVbMetais(): DadosEmpresaStore {
  const empresa = EMPRESA_VB_METAIS
  const produtos = [...PRODUTOS_VB_METAIS]

  // Mapeamentos iniciais de De-Para (2 campos: CNPJ Fornecedor + cProd -> codigoInventario)
  const dePara: DeParaVigente[] = [
    {
      id: 'dp-1',
      cnpjFornecedor: '11.222.333/0001-88',
      razaoSocialFornecedor: 'ALUMAS INDUSTRIAL DE METAIS S/A',
      cProd: 'FORN-ALU-6063',
      xProd: 'PERFIL ALUMINIO 6063 T6 BARRA CHATA',
      uCom: 'KG',
      fatorConversao: 1.0,
      codigoInventario: 'MET-ALU-001',
      atualizadoEm: '2025-01-05T10:00:00Z',
    },
    {
      id: 'dp-2',
      cnpjFornecedor: '11.222.333/0001-88',
      razaoSocialFornecedor: 'ALUMAS INDUSTRIAL DE METAIS S/A',
      cProd: 'FORN-LAT-7030',
      xProd: 'CHAPA LATAO MEIO DURO 70/30 1MM',
      uCom: 'KG',
      fatorConversao: 1.0,
      codigoInventario: 'MET-LAT-004',
      atualizadoEm: '2025-01-05T10:00:00Z',
    },
    {
      id: 'dp-3',
      cnpjFornecedor: '22.333.444/0001-99',
      razaoSocialFornecedor: 'COPPER BRASIL REFINARIA DE METAIS LTDA',
      cProd: 'COP-VERG-8MM',
      xProd: 'VERGALHAO COBRE ELETROLITICO 8.00MM',
      uCom: 'KG',
      fatorConversao: 1.0,
      codigoInventario: 'MET-COB-002',
      atualizadoEm: '2025-01-05T10:00:00Z',
    },
    {
      id: 'dp-4',
      cnpjFornecedor: '22.333.444/0001-99',
      razaoSocialFornecedor: 'COPPER BRASIL REFINARIA DE METAIS LTDA',
      cProd: 'COP-TUB-304',
      xProd: 'TUBO ACO INOX 304 1 POL BRUTO (BARRA 6M)',
      uCom: 'BARRA',
      fatorConversao: 6.0, // Cada barra comercial equivale a 6 metros no inventário
      codigoInventario: 'MET-INOX-003',
      atualizadoEm: '2025-01-05T10:00:00Z',
    },
    {
      id: 'dp-5',
      cnpjFornecedor: '11.222.333/0001-88',
      razaoSocialFornecedor: 'ALUMAS INDUSTRIAL DE METAIS S/A',
      cProd: 'FORN-ZINC-SHG',
      xProd: 'LINGOTE ZINCO ESPECIAL ALTA PUREZA',
      uCom: 'TON',
      fatorConversao: 1000.0, // 1 Tonelada = 1000 KG
      codigoInventario: 'MET-ZIN-005',
      atualizadoEm: '2025-01-05T10:00:00Z',
    },
    // Note: o item 'INOX-NOVO-COD-99' do terceiro fornecedor (INOX-TEC) NÃO está no de-para de propósito
    // para que a nota 30005 entre com status AGUARDANDO_DE_PARA e demonstre o requisito 2 do plano!
  ]

  // Carrega e faz o parse dos XMLs embutidos da VB Metais
  const docsOriginais: DocumentoFiscal[] = XMLS_SEED_VB_METAIS.map((xml) =>
    parseNFeXml(xml, empresa.cnpj),
  )

  // Processa Kardex e réguas
  const resultado = reprocessarKardexCronologico(produtos, docsOriginais, dePara)

  // Competência anterior já fechada (Dezembro/2024) para ter histórico de fechamento
  const fechamentoDezembro = {
    id: 'fech-2024-12',
    competencia: '2024-12',
    dataFechamento: '2025-01-02T18:00:00Z',
    responsavel: 'Auditor Fiscal - Carlos Eduardo',
    status: 'FECHADA' as const,
    valorTotalEstoque: 48500.0,
    itensInventario: [
      {
        codigoInventario: 'MET-ALU-001',
        descricao: 'BARRA CHATA DE ALUMINIO EXTRUDADO 6063 T6 (KG)',
        unidade: 'KG',
        quantidadeSistema: 200,
        custoMedioSistema: 24.5,
        valorTotalSistema: 4900.0,
        quantidadeContada: 200,
        diferencaQuantidade: 0,
        diferencaValor: 0,
        statusAjuste: 'SEM_DIVERGENCIA' as const,
      },
      {
        codigoInventario: 'MET-COB-002',
        descricao: 'VERGALHAO DE COBRE ELETROLITICO 8MM (KG)',
        unidade: 'KG',
        quantidadeSistema: 500,
        custoMedioSistema: 52.0,
        valorTotalSistema: 26000.0,
        quantidadeContada: 500,
        diferencaQuantidade: 0,
        diferencaValor: 0,
        statusAjuste: 'SEM_DIVERGENCIA' as const,
      },
      {
        codigoInventario: 'MET-INOX-003',
        descricao: 'TUBO INOX 304 REDONDO 1 POL PAREDE 1.5MM (METRO)',
        unidade: 'MT',
        quantidadeSistema: 300,
        custoMedioSistema: 32.0,
        valorTotalSistema: 9600.0,
        quantidadeContada: 300,
        diferencaQuantidade: 0,
        diferencaValor: 0,
        statusAjuste: 'SEM_DIVERGENCIA' as const,
      },
      {
        codigoInventario: 'MET-LAT-004',
        descricao: 'CHAPA DE LATAO 70/30 MEIO DURO 1.0MM (KG)',
        unidade: 'KG',
        quantidadeSistema: 100,
        custoMedioSistema: 45.0,
        valorTotalSistema: 4500.0,
        quantidadeContada: 100,
        diferencaQuantidade: 0,
        diferencaValor: 0,
        statusAjuste: 'SEM_DIVERGENCIA' as const,
      },
      {
        codigoInventario: 'MET-ZIN-005',
        descricao: 'LINGOTE DE ZINCO SHG 99.995% (KG)',
        unidade: 'KG',
        quantidadeSistema: 150,
        custoMedioSistema: 23.33,
        valorTotalSistema: 3500.0,
        quantidadeContada: 150,
        diferencaQuantidade: 0,
        diferencaValor: 0,
        statusAjuste: 'SEM_DIVERGENCIA' as const,
      },
    ],
  }

  return {
    empresa,
    produtos,
    dePara,
    documentos: resultado.documentosAtualizados,
    kardex: resultado.kardex,
    fechamentos: [fechamentoDezembro],
    ocorrencias: resultado.ocorrencias,
    consultasDFe: [
      {
        id: 'dfe-init-1',
        uf: 'SP',
        dataConsulta: '2025-01-20T10:00:00Z',
        nsuConsultado: 0,
        novoUltNSU: 3,
        maxNSU: 6,
        codigoStatus: 138,
        xMotivo: 'Documento localizado para o destinatário (NSU 3)',
        documentosRetornados: 3,
      },
    ],
    ultimoNSU: 3,
  }
}

export function criarSeedEmpresaVazia(empresa: Empresa): DadosEmpresaStore {
  return {
    empresa,
    produtos: [],
    dePara: [],
    documentos: [],
    kardex: [],
    fechamentos: [],
    ocorrencias: empresa.bloquearFechamento
      ? [
          {
            id: `oco-a09-${empresa.id}`,
            regraCodigo: 'A09',
            regraNome: 'Inaptidão Cadastral da Empresa (Operações Bloqueadas)',
            severidade: 'BLOQUEANTE',
            descricao: empresa.motivoBloqueio || 'Empresa em situação cadastral irregular.',
            baseLegal: 'IN RFB nº 2.119/2022 Art. 40; Lei 9.430/1996 Art. 81',
            dataIdentificacao: new Date().toISOString(),
            resolvido: false,
            podeReprocessar: false,
          },
        ]
      : [],
    consultasDFe: [],
    ultimoNSU: 0,
  }
}

// ==========================================
// MÉTODOS DE PERSISTÊNCIA EM LOCALSTORAGE
// ==========================================

export function carregarEmpresasCadastradas(): Empresa[] {
  try {
    const raw = localStorage.getItem(KEY_EMPRESAS_CADASTRO)
    if (raw) {
      return JSON.parse(raw)
    }
  } catch (e) {
    console.error('Erro ao ler empresas do localStorage:', e)
  }
  // Se não existir, inicializa com as 3 empresas aceitas no plano
  salvarEmpresasCadastradas(TODAS_EMPRESAS)
  return TODAS_EMPRESAS
}

export function salvarEmpresasCadastradas(empresas: Empresa[]): void {
  try {
    localStorage.setItem(KEY_EMPRESAS_CADASTRO, JSON.stringify(empresas))
  } catch (e) {
    console.error('Erro ao salvar empresas no localStorage:', e)
  }
}

export function carregarIdEmpresaAtiva(): string {
  try {
    const id = localStorage.getItem(KEY_EMPRESA_ATIVA)
    if (id) return id
  } catch (e) {
    console.error('Erro ao ler id da empresa ativa:', e)
  }
  return EMPRESA_VB_METAIS.id
}

export function salvarIdEmpresaAtiva(empresaId: string): void {
  try {
    localStorage.setItem(KEY_EMPRESA_ATIVA, empresaId)
  } catch (e) {
    console.error('Erro ao salvar id da empresa ativa:', e)
  }
}

export function carregarDadosEmpresa(empresa: Empresa): DadosEmpresaStore {
  const chave = `${KEY_PREFIX_STORE}${empresa.id}`
  try {
    const raw = localStorage.getItem(chave)
    if (raw) {
      return JSON.parse(raw)
    }
  } catch (e) {
    console.error(`Erro ao carregar dados da empresa ${empresa.id}:`, e)
  }

  // Se for VB Metais, gera o seed inicial rico completo
  if (empresa.id === 'vb-metais') {
    const seed = criarSeedVbMetais()
    salvarDadosEmpresa(seed)
    return seed
  }

  // Caso seja ALENA ou ALL METALS, gera estrutura inicial
  const vazia = criarSeedEmpresaVazia(empresa)
  salvarDadosEmpresa(vazia)
  return vazia
}

export function salvarDadosEmpresa(dados: DadosEmpresaStore): void {
  const chave = `${KEY_PREFIX_STORE}${dados.empresa.id}`
  try {
    localStorage.setItem(chave, JSON.stringify(dados))
  } catch (e) {
    console.error(`Erro ao salvar dados da empresa ${dados.empresa.id}:`, e)
  }
}

export function carregarHistoricoBackups(): BackupHistorico[] {
  try {
    const raw = localStorage.getItem(KEY_BACKUP_HISTORICO)
    if (raw) {
      return JSON.parse(raw)
    }
  } catch (e) {
    console.error('Erro ao carregar histórico de backups:', e)
  }
  return []
}

export function registrarBackup(descricao: string, dadosCompletos: unknown): BackupHistorico {
  const historico = carregarHistoricoBackups()
  const jsonStr = JSON.stringify(dadosCompletos, null, 2)
  const tamanhoKb = Math.round((jsonStr.length / 1024) * 10) / 10

  const novoBackup: BackupHistorico = {
    versao: `v${historico.length + 1}.${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`,
    dataBackup: new Date().toISOString(),
    descricao,
    tamanhoKb,
    dadosJson: jsonStr,
  }

  // Mantém no histórico as últimas 10 versões
  const atualizado = [novoBackup, ...historico].slice(0, 10)
  try {
    localStorage.setItem(KEY_BACKUP_HISTORICO, JSON.stringify(atualizado))
  } catch (e) {
    console.error('Erro ao registrar histórico de backup:', e)
  }

  return novoBackup
}
