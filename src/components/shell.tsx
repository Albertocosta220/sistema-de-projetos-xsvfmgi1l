import React from 'react'

/** Cabeçalho de página no estilo do anexo: eyebrow pill + h1 + subtítulo. */
export function PageHead({
  eyebrow,
  titulo,
  subtitulo,
  acoes,
}: {
  eyebrow: string
  titulo: string
  subtitulo?: string
  acoes?: React.ReactNode
}) {
  return (
    <div className="page-head flex flex-col sm:flex-row sm:items-end justify-between gap-3">
      <div>
        <span className="eyebrow-pill">{eyebrow}</span>
        <h1>{titulo}</h1>
        {subtitulo ? <p>{subtitulo}</p> : null}
      </div>
      {acoes ? <div className="flex flex-wrap items-center gap-2">{acoes}</div> : null}
    </div>
  )
}

/** Card simples shell. */
export function CardS({
  titulo,
  sub,
  acoes,
  children,
  className = '',
}: {
  titulo?: string
  sub?: string
  acoes?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={`card-s ${className}`}>
      {titulo ? (
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2>{titulo}</h2>
            {sub ? <p className="sub mb-0">{sub}</p> : null}
          </div>
          {acoes ? <div className="flex flex-wrap items-center gap-2">{acoes}</div> : null}
        </header>
      ) : null}
      {children}
    </section>
  )
}

/** KPI no estilo do anexo, com faixa de tom no topo. */
export function KpiB({
  label,
  value,
  hint,
  tone = 'accent',
}: {
  label: string
  value: React.ReactNode
  hint?: string
  tone?: 'accent' | 'verde' | 'ambar' | 'vermelho'
}) {
  return (
    <div className={`kpi-b tone-${tone} flex flex-col items-start gap-1`}>
      <span className="kpi-label">{label}</span>
      <span className="kpi-value block">{value}</span>
      {hint ? <span className="kpi-hint block">{hint}</span> : null}
    </div>
  )
}

/** Badge em pílula com os tons do sistema. */
export type TonePill = 't-accent' | 't-verde' | 't-ambar' | 't-vermelho' | 't-petroleo' | 't-muted'

export function Pill({
  children,
  tone = 't-muted',
}: {
  children: React.ReactNode
  tone?: TonePill
}) {
  return <span className={`badge-pill ${tone}`}>{children}</span>
}

/** Bloco de código (SPED / XML) no estilo do anexo. */
export function CodeBlock({
  children,
  ariaLabel,
}: {
  children: React.ReactNode
  ariaLabel?: string
}) {
  return (
    <pre className="codeblock max-h-[520px]" aria-label={ariaLabel}>
      {children}
    </pre>
  )
}

/** Barra de abas acessível (role=tab) no estilo do anexo. */
export function TabBar({
  tabs,
  ativa,
  onTrocar,
  ariaLabel,
}: {
  tabs: { id: string; label: string }[]
  ativa: string
  onTrocar: (id: string) => void
  ariaLabel: string
}) {
  return (
    <div className="tab-bar" role="tablist" aria-label={ariaLabel}>
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          type="button"
          aria-selected={ativa === t.id}
          onClick={() => onTrocar(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

const fmtBRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
export const brl = (v: number) => fmtBRL.format(v ?? 0)
export const num = (v: number, dec = 3) =>
  new Intl.NumberFormat('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(
    v ?? 0,
  )
export const dataBR = (iso?: string) => {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
export const dataHoraBR = (iso?: string) => {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
}
