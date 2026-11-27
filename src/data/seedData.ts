import { DadosEmpresaStore, Empresa, Produto } from '@/types/sigef'

export const EMPRESA_VB_METAIS: Empresa = {
  id: 'vb-metais',
  razaoSocial: 'VB METAIS E LIGAS INDUSTRIAIS LTDA',
  nomeFantasia: 'VB Metais',
  cnpj: '12.345.678/0001-90',
  inscricaoEstadual: '123.456.789.110',
  uf: 'SP',
  situacaoCadastral: 'ATIVA',
  bloquearFechamento: false,
}

export const EMPRESA_ALENA: Empresa = {
  id: 'alena',
  razaoSocial: 'ALENA COMÉRCIO ATACADISTA DE METAIS S.A.',
  nomeFantasia: 'ALENA',
  cnpj: '98.765.432/0001-10',
  inscricaoEstadual: '987.654.321.001',
  uf: 'MG',
  situacaoCadastral: 'ATIVA',
  bloquearFechamento: false,
}

export const EMPRESA_ALL_METALS: Empresa = {
  id: 'all-metals',
  razaoSocial: 'ALL METALS DISTRIBUIDORA DE COBRE E LIGAS LTDA',
  nomeFantasia: 'ALL METALS',
  cnpj: '45.678.901/0001-22',
  inscricaoEstadual: '456.789.012.333',
  uf: 'RJ',
  situacaoCadastral: 'INAPTA',
  bloquearFechamento: true,
  motivoBloqueio:
    'Empresa com situação cadastral INAPTA na RFB (Art. 40 da IN RFB nº 2.119/2022). Fechamento de competência e escrituração fiscal bloqueados.',
}

export const TODAS_EMPRESAS: Empresa[] = [EMPRESA_VB_METAIS, EMPRESA_ALENA, EMPRESA_ALL_METALS]

export const PRODUTOS_VB_METAIS: Produto[] = [
  {
    codigoInventario: 'MET-ALU-001',
    descricao: 'BARRA CHATA DE ALUMINIO EXTRUDADO 6063 T6 (KG)',
    ncm: '76042919',
    cstIcms: '000',
    cstPisCofins: '01',
    unidade: 'KG',
    fatorConversaoPadrao: 1.0,
    aliquotaIcms: 18.0,
    aliquotaPis: 1.65,
    aliquotaCofins: 7.6,
    aliquotaIbs: 1.0,
    aliquotaCbs: 0.9,
  },
  {
    codigoInventario: 'MET-COB-002',
    descricao: 'VERGALHAO DE COBRE ELETROLITICO 8MM (KG)',
    ncm: '74081100',
    cstIcms: '000',
    cstPisCofins: '01',
    unidade: 'KG',
    fatorConversaoPadrao: 1.0,
    aliquotaIcms: 18.0,
    aliquotaPis: 1.65,
    aliquotaCofins: 7.6,
    aliquotaIbs: 1.0,
    aliquotaCbs: 0.9,
  },
  {
    codigoInventario: 'MET-INOX-003',
    descricao: 'TUBO INOX 304 REDONDO 1 POL PAREDE 1.5MM (METRO)',
    ncm: '73064000',
    cstIcms: '020',
    cstPisCofins: '01',
    unidade: 'MT',
    fatorConversaoPadrao: 6.0, // Barra comercial vem em 6m
    aliquotaIcms: 12.0,
    aliquotaPis: 1.65,
    aliquotaCofins: 7.6,
    aliquotaIbs: 1.0,
    aliquotaCbs: 0.9,
  },
  {
    codigoInventario: 'MET-LAT-004',
    descricao: 'CHAPA DE LATAO 70/30 MEIO DURO 1.0MM (KG)',
    ncm: '74092100',
    cstIcms: '000',
    cstPisCofins: '01',
    unidade: 'KG',
    fatorConversaoPadrao: 1.0,
    aliquotaIcms: 18.0,
    aliquotaPis: 1.65,
    aliquotaCofins: 7.6,
    aliquotaIbs: 1.0,
    aliquotaCbs: 0.9,
  },
  {
    codigoInventario: 'MET-ZIN-005',
    descricao: 'LINGOTE DE ZINCO SHG 99.995% (KG)',
    ncm: '79011100',
    cstIcms: '000',
    cstPisCofins: '01',
    unidade: 'KG',
    fatorConversaoPadrao: 1000.0, // Comprado em tonelada métrica
    aliquotaIcms: 18.0,
    aliquotaPis: 1.65,
    aliquotaCofins: 7.6,
    aliquotaIbs: 1.0,
    aliquotaCbs: 0.9,
  },
]

// XMLs embutidos realistas de exemplo
export function gerarXmlNFeExemplo(params: {
  chaveAcesso: string
  numero: string
  serie: string
  dhEmi: string
  cnpjEmit: string
  xNomeEmit: string
  cnpjDest: string
  xNomeDest: string
  itens: Array<{
    nItem: number
    cProd: string
    xProd: string
    ncm: string
    cfop: string
    uCom: string
    qCom: number
    vUnCom: number
    vProd: number
    vICMS: number
    vPIS: number
    vCOFINS: number
  }>
}): string {
  const vTotProd = params.itens.reduce((acc, it) => acc + it.vProd, 0)
  const vTotIcms = params.itens.reduce((acc, it) => acc + it.vICMS, 0)
  const vTotPis = params.itens.reduce((acc, it) => acc + it.vPIS, 0)
  const vTotCofins = params.itens.reduce((acc, it) => acc + it.vCOFINS, 0)

  const itensXml = params.itens
    .map(
      (it) => `
    <det nItem="${it.nItem}">
      <prod>
        <cProd>${it.cProd}</cProd>
        <xProd>${it.xProd}</xProd>
        <NCM>${it.ncm}</NCM>
        <CFOP>${it.cfop}</CFOP>
        <uCom>${it.uCom}</uCom>
        <qCom>${it.qCom.toFixed(4)}</qCom>
        <vUnCom>${it.vUnCom.toFixed(4)}</vUnCom>
        <vProd>${it.vProd.toFixed(2)}</vProd>
      </prod>
      <imposto>
        <ICMS>
          <ICMS00>
            <orig>0</orig>
            <CST>00</CST>
            <vBC>${it.vProd.toFixed(2)}</vBC>
            <pICMS>18.00</pICMS>
            <vICMS>${it.vICMS.toFixed(2)}</vICMS>
          </ICMS00>
        </ICMS>
        <PIS>
          <PISAliq>
            <CST>01</CST>
            <vBC>${it.vProd.toFixed(2)}</vBC>
            <pPIS>1.65</pPIS>
            <vPIS>${it.vPIS.toFixed(2)}</vPIS>
          </PISAliq>
        </PIS>
        <COFINS>
          <COFINSAliq>
            <CST>01</CST>
            <vBC>${it.vProd.toFixed(2)}</vBC>
            <pCOFINS>7.60</pCOFINS>
            <vCOFINS>${it.vCOFINS.toFixed(2)}</vCOFINS>
          </COFINSAliq>
        </COFINS>
        <IBS>
          <pIBS>1.00</pIBS>
          <vIBS>${(it.vProd * 0.01).toFixed(2)}</vIBS>
        </IBS>
        <CBS>
          <pCBS>0.90</pCBS>
          <vCBS>${(it.vProd * 0.009).toFixed(2)}</vCBS>
        </CBS>
      </imposto>
    </det>`,
    )
    .join('')

  return `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
  <NFe>
    <infNFe Id="NFe${params.chaveAcesso}" versao="4.00">
      <ide>
        <cUF>35</cUF>
        <cNF>00088992</cNF>
        <natOp>COMPRA PARA COMERCIALIZACAO</natOp>
        <mod>55</mod>
        <serie>${params.serie}</serie>
        <nNF>${params.numero}</nNF>
        <dhEmi>${params.dhEmi}</dhEmi>
        <tpNF>1</tpNF>
        <idDest>1</idDest>
        <cMunFG>3550308</cMunFG>
        <tpImp>1</tpImp>
        <tpEmis>1</tpEmis>
      </ide>
      <emit>
        <CNPJ>${params.cnpjEmit.replace(/\D/g, '')}</CNPJ>
        <xNome>${params.xNomeEmit}</xNome>
        <enderEmit>
          <xLgr>AV INDUSTRIAL</xLgr>
          <nro>1500</nro>
          <xBairro>DISTRITO INDUSTRIAL</xBairro>
          <cMun>3550308</cMun>
          <xMun>SAO PAULO</xMun>
          <UF>SP</UF>
          <CEP>04500000</CEP>
        </enderEmit>
        <IE>112233445566</IE>
        <CRT>3</CRT>
      </emit>
      <dest>
        <CNPJ>${params.cnpjDest.replace(/\D/g, '')}</CNPJ>
        <xNome>${params.xNomeDest}</xNome>
        <enderDest>
          <xLgr>RUA DAS FUNDICOES</xLgr>
          <nro>250</nro>
          <xBairro>BRAS</xBairro>
          <cMun>3550308</cMun>
          <xMun>SAO PAULO</xMun>
          <UF>SP</UF>
        </enderDest>
        <indIEDest>1</indIEDest>
        <IE>123456789110</IE>
      </dest>
      ${itensXml}
      <total>
        <ICMSTot>
          <vBC>${vTotProd.toFixed(2)}</vBC>
          <vICMS>${vTotIcms.toFixed(2)}</vICMS>
          <vProd>${vTotProd.toFixed(2)}</vProd>
          <vNF>${vTotProd.toFixed(2)}</vNF>
          <vPIS>${vTotPis.toFixed(2)}</vPIS>
          <vCOFINS>${vTotCofins.toFixed(2)}</vCOFINS>
        </ICMSTot>
      </total>
    </infNFe>
  </NFe>
  <protNFe versao="4.00">
    <infProt>
      <tpAmb>1</tpAmb>
      <verAplic>SP_NFE_PL_009</verAplic>
      <chNFe>${params.chaveAcesso}</chNFe>
      <dhRecbto>${params.dhEmi}</dhRecbto>
      <nProt>135240019283746</nProt>
      <digVal>zFw9X1q78=</digVal>
      <cStat>100</cStat>
      <xMotivo>Autorizado o uso da NF-e</xMotivo>
    </infProt>
  </protNFe>
</nfeProc>`
}

// 7 XMLs base para VB Metais
export const XMLS_SEED_VB_METAIS = [
  // 1. Entrada Fornecedor A: ALUMAS S/A
  gerarXmlNFeExemplo({
    chaveAcesso: '35240111222333000188550010000100011234567890',
    numero: '10001',
    serie: '1',
    dhEmi: '2025-01-08T09:15:00-03:00',
    cnpjEmit: '11.222.333/0001-88',
    xNomeEmit: 'ALUMAS INDUSTRIAL DE METAIS S/A',
    cnpjDest: EMPRESA_VB_METAIS.cnpj,
    xNomeDest: EMPRESA_VB_METAIS.razaoSocial,
    itens: [
      {
        nItem: 1,
        cProd: 'FORN-ALU-6063',
        xProd: 'PERFIL ALUMINIO 6063 T6 BARRA CHATA',
        ncm: '76042919',
        cfop: '5102',
        uCom: 'KG',
        qCom: 500,
        vUnCom: 28.5,
        vProd: 14250.0,
        vICMS: 2565.0,
        vPIS: 235.12,
        vCOFINS: 1083.0,
      },
      {
        nItem: 2,
        cProd: 'FORN-LAT-7030',
        xProd: 'CHAPA LATAO MEIO DURO 70/30 1MM',
        ncm: '74092100',
        cfop: '5102',
        uCom: 'KG',
        qCom: 300,
        vUnCom: 54.0,
        vProd: 16200.0,
        vICMS: 2916.0,
        vPIS: 267.3,
        vCOFINS: 1231.2,
      },
    ],
  }),

  // 2. Entrada Fornecedor B: COPPER BRASIL
  gerarXmlNFeExemplo({
    chaveAcesso: '35240122333444000199550010000200021345678901',
    numero: '20002',
    serie: '1',
    dhEmi: '2025-01-12T14:30:00-03:00',
    cnpjEmit: '22.333.444/0001-99',
    xNomeEmit: 'COPPER BRASIL REFINARIA DE METAIS LTDA',
    cnpjDest: EMPRESA_VB_METAIS.cnpj,
    xNomeDest: EMPRESA_VB_METAIS.razaoSocial,
    itens: [
      {
        nItem: 1,
        cProd: 'COP-VERG-8MM',
        xProd: 'VERGALHAO COBRE ELETROLITICO 8.00MM',
        ncm: '74081100',
        cfop: '5102',
        uCom: 'KG',
        qCom: 800,
        vUnCom: 62.0,
        vProd: 49600.0,
        vICMS: 8928.0,
        vPIS: 818.4,
        vCOFINS: 3769.6,
      },
      {
        nItem: 2,
        cProd: 'COP-TUB-304',
        xProd: 'TUBO ACO INOX 304 1 POL BRUTO (BARRA 6M)',
        ncm: '73064000',
        cfop: '5102',
        uCom: 'BARRA',
        qCom: 50, // 50 barras x 6m = 300m
        vUnCom: 210.0,
        vProd: 10500.0,
        vICMS: 1260.0,
        vPIS: 173.25,
        vCOFINS: 798.0,
      },
    ],
  }),

  // 3. Entrada Fornecedor A: ALUMAS (Segunda remessa com novo lote de alumínio e zinco)
  gerarXmlNFeExemplo({
    chaveAcesso: '35240111222333000188550010000100031456789012',
    numero: '10003',
    serie: '1',
    dhEmi: '2025-01-18T11:00:00-03:00',
    cnpjEmit: '11.222.333/0001-88',
    xNomeEmit: 'ALUMAS INDUSTRIAL DE METAIS S/A',
    cnpjDest: EMPRESA_VB_METAIS.cnpj,
    xNomeDest: EMPRESA_VB_METAIS.razaoSocial,
    itens: [
      {
        nItem: 1,
        cProd: 'FORN-ALU-6063',
        xProd: 'PERFIL ALUMINIO 6063 T6 BARRA CHATA',
        ncm: '76042919',
        cfop: '5102',
        uCom: 'KG',
        qCom: 400,
        vUnCom: 29.5, // leve aumento de custo para testar CMP
        vProd: 11800.0,
        vICMS: 2124.0,
        vPIS: 194.7,
        vCOFINS: 896.8,
      },
      {
        nItem: 2,
        cProd: 'FORN-ZINC-SHG',
        xProd: 'LINGOTE ZINCO ESPECIAL ALTA PUREZA',
        ncm: '79011100',
        cfop: '5102',
        uCom: 'TON',
        qCom: 1.5, // 1.5 ton = 1500 kg
        vUnCom: 21000.0,
        vProd: 31500.0,
        vICMS: 5670.0,
        vPIS: 519.75,
        vCOFINS: 2394.0,
      },
    ],
  }),

  // 4. Saída/Venda de VB Metais para Cliente Atacadista
  gerarXmlNFeExemplo({
    chaveAcesso: '35240112345678000190550010000550011567890123',
    numero: '55001',
    serie: '1',
    dhEmi: '2025-01-22T16:20:00-03:00',
    cnpjEmit: EMPRESA_VB_METAIS.cnpj,
    xNomeEmit: EMPRESA_VB_METAIS.razaoSocial,
    cnpjDest: '33.444.555/0001-66',
    xNomeDest: 'METALURGICA PAULISTA ELETRO LTDA',
    itens: [
      {
        nItem: 1,
        cProd: 'MET-ALU-001',
        xProd: 'BARRA CHATA DE ALUMINIO EXTRUDADO 6063 T6 (KG)',
        ncm: '76042919',
        cfop: '5102',
        uCom: 'KG',
        qCom: 350,
        vUnCom: 38.0,
        vProd: 13300.0,
        vICMS: 2394.0,
        vPIS: 219.45,
        vCOFINS: 1010.8,
      },
      {
        nItem: 2,
        cProd: 'MET-COB-002',
        xProd: 'VERGALHAO DE COBRE ELETROLITICO 8MM (KG)',
        ncm: '74081100',
        cfop: '5102',
        uCom: 'KG',
        qCom: 250,
        vUnCom: 79.0,
        vProd: 19750.0,
        vICMS: 3555.0,
        vPIS: 325.88,
        vCOFINS: 1501.0,
      },
    ],
  }),

  // 5. NF-e com item sem De-Para cadastrado (Fica AGUARDANDO_DE_PARA para demonstrar tela de resolução)
  gerarXmlNFeExemplo({
    chaveAcesso: '35240199888777000144550010000300051678901234',
    numero: '30005',
    serie: '1',
    dhEmi: '2025-01-25T10:40:00-03:00',
    cnpjEmit: '99.888.777/0001-44',
    xNomeEmit: 'INOX-TEC INDUSTRIA DE TUBOS S.A.',
    cnpjDest: EMPRESA_VB_METAIS.cnpj,
    xNomeDest: EMPRESA_VB_METAIS.razaoSocial,
    itens: [
      {
        nItem: 1,
        cProd: 'INOX-NOVO-COD-99', // Item sem de-para inicial
        xProd: 'TUBO INOX 304 DIAMETRO 25.4MM PAREDE 1.5MM',
        ncm: '73064000',
        cfop: '5102',
        uCom: 'MT',
        qCom: 120,
        vUnCom: 38.0,
        vProd: 4560.0,
        vICMS: 547.2,
        vPIS: 75.24,
        vCOFINS: 346.56,
      },
    ],
  }),

  // 6. NF-e com Chave em Duplicidade (Regra A01 - idêntica à NF 10001 para disparar DUPLICIDADE na importação ou auditoria)
  // Deixaremos como exemplo carregado na lista de XMLs para importação de teste pelo usuário.

  // 7. Segunda Saída regular em 2025-01-28
  gerarXmlNFeExemplo({
    chaveAcesso: '35240112345678000190550010000550021789012345',
    numero: '55002',
    serie: '1',
    dhEmi: '2025-01-28T15:00:00-03:00',
    cnpjEmit: EMPRESA_VB_METAIS.cnpj,
    xNomeEmit: EMPRESA_VB_METAIS.razaoSocial,
    cnpjDest: '55.666.777/0001-88',
    xNomeDest: 'CONSTRUTORA ESTRUTURAS METÁLICAS S.A.',
    itens: [
      {
        nItem: 1,
        cProd: 'MET-INOX-003',
        xProd: 'TUBO INOX 304 REDONDO 1 POL PAREDE 1.5MM (METRO)',
        ncm: '73064000',
        cfop: '5102',
        uCom: 'MT',
        qCom: 100,
        vUnCom: 48.0,
        vProd: 4800.0,
        vICMS: 576.0,
        vPIS: 79.2,
        vCOFINS: 364.8,
      },
      {
        nItem: 2,
        cProd: 'MET-ZIN-005',
        xProd: 'LINGOTE DE ZINCO SHG 99.995% (KG)',
        ncm: '79011100',
        cfop: '5102',
        uCom: 'KG',
        qCom: 400,
        vUnCom: 28.0,
        vProd: 11200.0,
        vICMS: 2016.0,
        vPIS: 184.8,
        vCOFINS: 851.2,
      },
    ],
  }),
]

// XML de teste para duplicidade (mesma chave da nota 10001)
export const XML_EXEMPLO_DUPLICIDADE = XMLS_SEED_VB_METAIS[0]

// XML com saída excessiva para testar bloqueio de saldo negativo (A03)
export const XML_EXEMPLO_SALDO_NEGATIVO = gerarXmlNFeExemplo({
  chaveAcesso: '35240112345678000190550010000559991999999999',
  numero: '55999',
  serie: '1',
  dhEmi: '2025-01-29T18:00:00-03:00',
  cnpjEmit: EMPRESA_VB_METAIS.cnpj,
  xNomeEmit: EMPRESA_VB_METAIS.razaoSocial,
  cnpjDest: '33.444.555/0001-66',
  xNomeDest: 'METALURGICA PAULISTA ELETRO LTDA',
  itens: [
    {
      nItem: 1,
      cProd: 'MET-ALU-001',
      xProd: 'BARRA CHATA DE ALUMINIO EXTRUDADO 6063 T6 (KG)',
      ncm: '76042919',
      cfop: '5102',
      uCom: 'KG',
      qCom: 99999, // Quantidade gigantesca que estoura qualquer saldo
      vUnCom: 35.0,
      vProd: 3499965.0,
      vICMS: 629993.7,
      vPIS: 57749.42,
      vCOFINS: 265997.34,
    },
  ],
})
