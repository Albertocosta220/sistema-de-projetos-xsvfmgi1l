// Diálogos do vínculo automático de fornecedor (tela Fornecedores):
// resumo do resultado e lista de pendências "cadastrar produto".
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Pill, dataHoraBR } from '@/components/shell'

export interface ResumoVinculoAutomatico {
  cnpj: string
  razaoSocial: string
  criados: number
  pendentes: number
  reenfileiradas: number
  quando: string
}

export interface PendenciaFornecedor {
  cnpj: string
  razaoSocial: string
  itens: Array<{ cProd: string; xProd: string; uCom: string }>
}

export function DialogoResumoVinculo({
  resumo,
  onFechar,
  onVerPendencias,
}: {
  resumo: ResumoVinculoAutomatico | null
  onFechar: () => void
  onVerPendencias: () => void
}) {
  return (
    <Dialog open={!!resumo} onOpenChange={(aberto) => !aberto && onFechar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Vínculo automático concluído</DialogTitle>
          <DialogDescription>
            Fornecedor {resumo?.cnpj} processado em {dataHoraBR(resumo?.quando)}.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2 py-1 text-sm">
          <div className="flex items-center gap-2">
            <span className="font-medium">Fornecedor cadastrado:</span>
            <span>{resumo?.razaoSocial || '—'}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-medium">Vínculos criados:</span>
            <Pill tone="t-verde">{resumo?.criados ?? 0}</Pill>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-medium">Itens pendentes de cadastro de produto:</span>
            {(resumo?.pendentes ?? 0) > 0 ? (
              <Pill tone="t-ambar">{resumo?.pendentes}</Pill>
            ) : (
              <Pill tone="t-verde">nenhum</Pill>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="font-medium">Notas reenfileiradas (AGUARDANDO_DE_PARA):</span>
            <Pill tone="t-petroleo">{resumo?.reenfileiradas ?? 0}</Pill>
          </div>
        </div>
        <DialogFooter>
          {(resumo?.pendentes ?? 0) > 0 && (
            <Button variant="outline" onClick={onVerPendencias}>
              Ver pendências
            </Button>
          )}
          <Button onClick={onFechar}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function DialogoPendenciasProduto({
  pendencias,
  onFechar,
}: {
  pendencias: PendenciaFornecedor | null
  onFechar: () => void
}) {
  return (
    <Dialog open={!!pendencias} onOpenChange={(aberto) => !aberto && onFechar()}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Itens sem produto no catálogo</DialogTitle>
          <DialogDescription>
            {pendencias?.razaoSocial} ({pendencias?.cnpj}) — nenhum produto foi inventado. Cadastre
            cada código no catálogo de inventário e acione o vínculo automático novamente.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-lg border border-[var(--sig-border)] divide-y">
          {(pendencias?.itens ?? []).map((it) => (
            <div
              key={it.cProd}
              className="px-3 py-2 text-sm flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <div className="font-mono text-xs text-[var(--sig-muted)]">{it.cProd}</div>
                <div className="truncate">{it.xProd || '(sem descrição)'}</div>
              </div>
              <Pill tone="t-ambar">cadastrar produto</Pill>
            </div>
          ))}
          {(pendencias?.itens.length ?? 0) === 0 && (
            <div className="px-3 py-2 text-sm text-[var(--sig-muted)]">
              Nenhuma pendência — todos os itens têm produto no catálogo.
            </div>
          )}
        </div>
        <DialogFooter>
          <Button onClick={onFechar}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
