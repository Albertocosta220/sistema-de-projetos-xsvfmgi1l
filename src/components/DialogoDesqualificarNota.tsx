// Confirmação da desqualificação para inventário ("não gera inventário") e da
// marcação "Nota Controla Estoque" (mesma regra CNPJ + cProd, rótulo diferente).
// Explica o alcance da regra (emitente + produto em TODAS as notas) antes do
// usuário confirmar, seguindo o padrão visual teal do sistema.
import { Boxes, PackageX, ShieldOff } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DocumentoFiscal } from '@/types/sigef'
import { itensDocumento } from '@/services/desqualificacaoService'

export function DialogoDesqualificarNota({
  doc,
  onConfirm,
  onCancel,
  modo = 'inventario',
}: {
  doc: DocumentoFiscal | null
  onConfirm: () => void
  onCancel: () => void
  /** 'inventario': desqualificar p/ Bloco H; 'estoque': "Nota Controla Estoque" = NÃO. */
  modo?: 'inventario' | 'estoque'
}) {
  if (!doc) return null
  const itens = itensDocumento(doc)
  const modoEstoque = modo === 'estoque'

  return (
    <Dialog open={!!doc} onOpenChange={(aberto) => !aberto && onCancel()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-teal-800">
            {modoEstoque ? (
              <PackageX className="size-5" aria-hidden="true" />
            ) : (
              <ShieldOff className="size-5" aria-hidden="true" />
            )}
            {modoEstoque
              ? 'Marcar nota como "Não controla estoque"'
              : 'Desqualificar nota para o Inventário'}
          </DialogTitle>
          <DialogDescription className="text-xs">
            NF-e nº {doc.numero} (série {doc.serie}) — {doc.nomeEmitente} ({doc.cnpjEmitente}). A
            nota continua na fila e na escrituração, mas os produtos ficam{' '}
            <strong className="text-teal-800">
              {modoEstoque ? 'fora do Kardex e do Bloco H' : 'fora do Inventário Bloco H'}
            </strong>
            .
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="rounded-xl border border-teal-200 bg-teal-50/50 p-3 text-xs text-slate-700">
            Ao confirmar,{' '}
            <strong>
              este fornecedor (mesmo CNPJ emitente) e todas as notas dele com os mesmos produtos
            </strong>{' '}
            ficam marcadas como{' '}
            <strong className="text-teal-800">
              {modoEstoque ? '"não controla estoque"' : '"não gera inventário"'}
            </strong>{' '}
            — agora e em importações futuras. A marcação é salva nesta empresa e sobrevive a
            logout/F5.
          </div>

          <div>
            <div className="text-[11px] font-bold uppercase tracking-wide text-teal-800/80 mb-1.5 flex items-center gap-1.5">
              <Boxes className="size-3.5" aria-hidden="true" />
              Regras que serão criadas ({itens.length})
            </div>
            {itens.length === 0 ? (
              <p className="text-xs text-slate-500">
                Esta nota não possui itens com código de produto identificável.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                {itens.map((it) => (
                  <Badge
                    key={it.cProd}
                    variant="outline"
                    className="border-teal-300 text-teal-800 bg-white text-[10px] max-w-[260px]"
                  >
                    <span className="font-mono truncate">{it.cProd}</span>
                    <span className="truncate text-slate-500">— {it.xProd}</span>
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel}>
            Desistir
          </Button>
          <Button onClick={onConfirm} className="bg-teal-700 hover:bg-teal-800 text-white">
            {modoEstoque ? 'Marcar "Não controla estoque"' : 'Desqualificar para Inventário'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
