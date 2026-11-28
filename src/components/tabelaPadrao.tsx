import type { ReactNode, TdHTMLAttributes, ThHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

/**
 * Padrão visual único de tabelas (v0.0.43):
 * - cabeçalho compacto em maiúsculas, células com padding reduzido,
 * - números sempre à direita em fonte mono com whitespace-nowrap,
 * - textos longos truncados com tooltip (title),
 * - linha de totais no rodapé (TrTotais/TdTotal) com negativo em vermelho.
 */

export function Th({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      scope="col"
      className={cn(
        'py-1.5 pr-3 text-left text-[11px] font-semibold uppercase tracking-wide text-[var(--sig-muted)] whitespace-nowrap',
        className,
      )}
      {...props}
    />
  )
}

export function Td({
  className,
  title,
  children,
  ...props
}: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td title={title} className={cn('py-1.5 pr-3 text-xs align-middle', className)} {...props}>
      {children}
    </td>
  )
}

/** Célula numérica: à direita, mono e sem quebra de linha. */
export function TdNum({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn('py-1.5 pr-3 text-right font-mono text-xs whitespace-nowrap', className)}
      {...props}
    />
  )
}

/** Texto longo truncado com tooltip — nunca quebra a linha da tabela. */
export function TdTrunc({
  texto,
  className,
  max = 'max-w-[220px]',
  mono = false,
}: {
  texto: string | null | undefined
  className?: string
  max?: string
  mono?: boolean
}) {
  return (
    <td className={cn('py-1.5 pr-3 text-xs align-middle', className)}>
      <div className={cn('truncate', max, mono && 'font-mono')} title={texto || ''}>
        {texto || '—'}
      </div>
    </td>
  )
}

/** Linha de totais do rodapé da tabela. */
export function TrTotais({
  children,
  titulo = 'Totais',
  colSpan = 1,
}: {
  children: ReactNode
  titulo?: string
  colSpan?: number
}) {
  return (
    <tfoot>
      <tr className="border-t-2 border-[var(--sig-line,#e2e8f0)] bg-[var(--sig-bg-sub,#f8fafc)] font-bold">
        <td className="py-1.5 pr-3 text-xs whitespace-nowrap" colSpan={colSpan}>
          {titulo}
        </td>
        {children}
      </tr>
    </tfoot>
  )
}

/** Célula de total numérica: negativo recebe sinal natural do formatter + vermelho. */
export function TdTotal({
  valor,
  fmt,
  className,
}: {
  valor: number
  fmt: (n: number) => string
  className?: string
}) {
  return (
    <td
      className={cn(
        'py-1.5 pr-3 text-right font-mono text-xs whitespace-nowrap font-bold',
        valor < 0 && 'text-rose-700',
        className,
      )}
    >
      {fmt(valor)}
    </td>
  )
}

/** Span numérico com negativo em vermelho (para uso dentro de células livres). */
export function Valor({
  v,
  fmt,
  className,
}: {
  v: number
  fmt: (n: number) => string
  className?: string
}) {
  return <span className={cn('font-mono', v < 0 && 'text-rose-700', className)}>{fmt(v)}</span>
}

/** Wrapper padrão de tabela com scroll horizontal só quando necessário. */
export function TabelaWrap({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('overflow-x-auto', className)}>{children}</div>
}
