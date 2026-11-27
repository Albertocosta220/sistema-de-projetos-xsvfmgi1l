// Seletor de competência compartilhado: o valor é a competência ATIVA da
// empresa (fonte única no SigefContext). Trocar o período em qualquer aba
// troca para todas as outras — "a competência ativa é o que estamos
// trabalhando na tela principal".
//
// Tons padronizados do shell (t-* do badge-pill) em vez de classes avulsas,
// e o select usa a largura fixa para não estourar em telas estreitas.
import { useSigef } from '@/context/SigefContext'
import { useCompetencias } from '@/hooks/use-competencias'
import { Pill } from '@/components/shell'

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

export function formatarCompetencia(competencia: string): string {
  const [ano, mes] = (competencia || '').split('-')
  const idx = Number(mes) - 1
  if (!ano || !mes || idx < 0 || idx > 11) return competencia || '—'
  return `${MESES[idx]}/${ano}`
}

export function SeletorCompetencia({ className = '' }: { className?: string }) {
  const { competenciaAtiva, definirCompetenciaAtiva } = useSigef()
  const competencias = useCompetencias()

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <Pill tone="t-accent">Competência ativa: {formatarCompetencia(competenciaAtiva)}</Pill>
      <label className="field !gap-1 !mb-0">
        <span className="sr-only">Período de apuração (competência ativa)</span>
        <select
          className="sig-input !w-auto text-xs font-bold"
          value={competenciaAtiva}
          onChange={(e) => definirCompetenciaAtiva(e.target.value)}
        >
          {competencias.length === 0 ? (
            <option value={competenciaAtiva}>{competenciaAtiva}</option>
          ) : null}
          {competencias.map((c) => (
            <option key={c} value={c}>
              {c} {c === competenciaAtiva ? '· ativa' : ''}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}
