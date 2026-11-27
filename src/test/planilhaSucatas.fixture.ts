// Planilha de EVIDÊNCIA — Lista_NCM_VB_Metais_Base_Fiscal.xlsx (aba "Sucatas Cadastro")
// Formato real observado no anexo do usuário; 15 itens válidos + item 16 marcado
// "SEM CORRESPONDÊNCIA — REVISAR". Usada APENAS como fixture do teste do importador:
// nada dela é fixado no código do app (o app lê o XLSX do usuário em runtime).
import * as XLSX from 'xlsx'

const CABECALHO = [
  'COD_ITEM',
  'DESCR_ITEM',
  'UNID_INV',
  'COD_NCM',
  'CST_ICMS',
  'CST_PIS_COFINS_ENTRADA',
  'NAT_REC_PIS_COFINS',
]

// prettier-ignore
const LINHAS: (string | number)[][] = [
  ['VB0023', 'SUCATA DE COBRE BERILLI', 'KG', '74040010', '000', '50', '101'],
  ['AL0001', 'SUCATA DE ALUMINIO LIMPO', 'KG', '76020000', '000', '50', '101'],
  ['VB0001', 'SUCATA DE BRONZE', 'KG', '74198090', '000', '50', '101'],
  ['VB0002', 'SUCATA DE LATAO MISTO', 'KG', '74198090', '000', '50', '101'],
  ['VB0005', 'SUCATA DE INOX 304', 'KG', '72042100', '000', '50', '101'],
  ['VB0007', 'SUCATA DE FERRO GUSA', 'KG', '72011000', '000', '50', '101'],
  ['VB0010', 'SUCATA DE ZINCO', 'KG', '79020000', '000', '50', '101'],
  ['VB0012', 'SUCATA DE CHUMBO', 'KG', '78020000', '000', '50', '101'],
  ['VB0015', 'SUCATA DE ESTANHO', 'KG', '80020000', '000', '50', '101'],
  ['VB0017', 'SUCATA DE NIQUEL', 'KG', '75030000', '000', '50', '101'],
  ['VB0019', 'SUCATA DE TITANIO', 'KG', '81083000', '000', '50', '101'],
  ['VB0021', 'SUCATA DE MAGNESIO', 'KG', '81042000', '000', '50', '101'],
  ['AL0002', 'SUCATA DE ALUMINIO FUNDIDO', 'KG', '76020000', '000', '50', '101'],
  ['VB0024', 'SUCATA DE COBRE COM ISOLAMENTO', 'KG', '74040010', '000', '50', '101'],
  ['VB0030', 'SUCATA DE METAL MISTO', 'KG', '72044900', '000', '50', '101'],
  // Item 16: veio SEM CORRESPONDÊNCIA — deve entrar com revisar=true
  ['VB0033', 'SUCATA DE ANTIMONIO', 'KG', 'SEM CORRESPONDÊNCIA — REVISAR', '', '', ''],
]

export async function criarPlanilhaTesteSucatas(): Promise<File> {
  const ws = XLSX.utils.aoa_to_sheet([CABECALHO, ...LINHAS])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Sucatas Cadastro')
  const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
  return new File([buffer], 'Lista_NCM_VB_Metais_Base_Fiscal.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}
