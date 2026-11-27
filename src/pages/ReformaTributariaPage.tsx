import { useState } from 'react'
import { PageHead, CardS, TabBar } from '@/components/shell'

const CRONOLOGIA = [
  {
    ano: '2023',
    marco: 'EC 132/2023 promulgada',
    detalhe:
      'Reforma tributária sobre o consumo sancionada. Cria IBS, CBS e IS, com transição de 2026 a 2033.',
  },
  {
    ano: '2024',
    marco: 'Regulamentação (LC 214/2025) e comitê gestor',
    detalhe:
      'Lei complementar do IBS/CBS e definição das alíquotas de referência, reduções e cesta básica.',
  },
  {
    ano: '2026',
    marco: 'Fase-teste: CBS 0,9% e IBS 0,1%',
    detalhe:
      'Escrituração obrigatória em caráter informativo; compensação integral do que for recolhido.',
  },
  {
    ano: '2027',
    marco: 'Extinção de PIS/Cofins; início do IS',
    detalhe:
      'CBS passa a integralidade; IBS continua informativo; Imposto Seletivo começa a valer para itens específicos.',
  },
  {
    ano: '2029–2032',
    marco: 'Transição ICMS/ISS → IBS',
    detalhe:
      'Redução gradual das alíquotas de ICMS/ISS (90% → 0% em 10 pontos por ano) com subida espelhada do IBS.',
  },
  {
    ano: '2033',
    marco: 'Modelo definitivo',
    detalhe:
      'ICMS, ISS, PIS e Cofins extintos. Resta IBS + CBS + IS, com crédito financeiro em toda a cadeia.',
  },
]

const ABAS = [
  {
    id: 'cronologia',
    label: 'Cronologia',
    conteudo: (
      <ol className="prose-step">
        {CRONOLOGIA.map((c) => (
          <li key={c.ano}>
            <strong>{c.ano}</strong> — {c.marco}: {c.detalhe}
          </li>
        ))}
      </ol>
    ),
  },
  {
    id: 'impactos',
    label: 'Impactos no SIGEF-ME',
    conteudo: (
      <div className="grid gap-3 text-[13.5px] text-[#29465c]">
        <p>
          <strong>Blocos EFD:</strong> durante a fase-teste o SPED continua com Blocos 0, C, H e K.
          Os novos registros informativos (IBS/CBS) serão adicionados como Blocos dedicados quando a
          EFD publicar o leiaute definitivo.
        </p>
        <p>
          <strong>Custos e créditos:</strong> o Kardex segue custo líquido de aquisição; quando a
          CBS/IBS forem não-cumulativas plenas, a composição de custo deverá excluir o tributo
          creditado — o campo de custo já é separado do valor bruto.
        </p>
        <p>
          <strong>Produtos:</strong> mantenha a classificação fiscal (NCM/CEST) atualizada — as
          reduções e o Imposto Seletivo partem de segmentos e cestas, não de alíquota única.
        </p>
        <p>
          <strong>Multiempresa:</strong> cada empresa mantém CRT e regime próprios; a transição pode
          se dar em datas distintas conforme o regime (Simples x Regime Regular).
        </p>
      </div>
    ),
  },
  {
    id: 'checklist',
    label: 'Checklist 2026',
    conteudo: (
      <ol className="prose-step">
        <li>Inventariar a base de produtos com NCM, CEST e origem consistentes.</li>
        <li>Conferir o cadastro de empresas (CNPJ, IE, CRT) — ele alimenta a fase-teste.</li>
        <li>Manter o de-para de produtos em dia: o Bloco K sai do cadastro, não do XML.</li>
        <li>Acompanhar as réguas de Auditoria — divergência de CFOP impacta o crédito.</li>
        <li>Salvar backup antes de cada competência de fase-teste.</li>
        <li>Documentar decisões de precificação com o impacto estimado da CBS/IBS.</li>
      </ol>
    ),
  },
]

export default function ReformaTributariaPage() {
  const [aba, setAba] = useState(CRONOLOGIA ? 'cronologia' : 'cronologia')

  return (
    <div>
      <PageHead
        eyebrow="Página técnica"
        titulo="Reforma Tributária"
        subtitulo="Cronologia, impactos no sistema e checklist da fase-teste (EC 132/2023, LC 214/2025)."
      />

      <CardS>
        <TabBar
          ariaLabel="Seções da Reforma Tributária"
          tabs={ABAS.map((a) => ({ id: a.id, label: a.label }))}
          ativa={aba}
          onTrocar={setAba}
        />
        <div className="mt-4" role="tabpanel" aria-label={aba}>
          {ABAS.find((a) => a.id === aba)?.conteudo}
        </div>
      </CardS>
    </div>
  )
}
