import { useRef, useState } from 'react'
import { useSigef } from '@/context/SigefContext'
import { PageHead, CardS, Pill, dataHoraBR } from '@/components/shell'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'

/**
 * Backup — exportação/importação JSON + histórico automático (últimas 10 versões).
 * Tela própria no estilo do anexo (a lógica já existia no contexto).
 */
export default function BackupPage() {
  const {
    empresaAtiva,
    historicoBackups,
    exportarBackupJson,
    importarBackupJson,
    restaurarBackupHistorico,
  } = useSigef()

  const inputRef = useRef<HTMLInputElement>(null)
  const [previa, setPrevia] = useState<{ nome: string; conteudo: string } | null>(null)
  const [confirmarRestauracao, setConfirmarRestauracao] = useState(false)

  const escolherArquivo = async (file?: File) => {
    if (!file) return
    try {
      const conteudo = await file.text()
      const parsed = JSON.parse(conteudo)
      if (!parsed.store || !parsed.store.empresa) {
        toast.error('Arquivo sem a estrutura de backup do SIGEF-ME.')
        return
      }
      setPrevia({ nome: file.name, conteudo })
    } catch {
      toast.error('Não foi possível ler o arquivo JSON.')
    }
  }

  const aplicarPrevia = () => {
    if (!previa) return
    const ok = importarBackupJson(previa.conteudo)
    if (ok) setPrevia(null)
  }

  return (
    <div>
      <PageHead
        eyebrow="Segurança dos dados"
        titulo="Backup"
        subtitulo={`Exportação, importação e histórico das últimas versões dos dados de ${empresaAtiva.nomeFantasia}.`}
      />

      <CardS
        titulo="Exportar e importar"
        sub="O backup é um arquivo JSON com toda a base local da empresa ativa."
      >
        <div className="flex flex-wrap gap-2">
          <Button className="bg-blue-700 hover:bg-blue-800" onClick={exportarBackupJson}>
            Exportar backup JSON
          </Button>
          <Button variant="outline" onClick={() => inputRef.current?.click()}>
            Importar backup
          </Button>
          <Button
            variant="outline"
            className="text-rose-700 border-rose-200 hover:bg-rose-50"
            onClick={() => setConfirmarRestauracao(true)}
          >
            Restaurar backup anterior
          </Button>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="application/json"
          className="hidden"
          aria-label="Selecionar arquivo de backup"
          onChange={(e) => {
            escolherArquivo(e.target.files?.[0])
            e.target.value = ''
          }}
        />
        <p className="text-xs text-[var(--sig-muted)] m-0">
          A importação mostra uma prévia e só aplica após a sua confirmação.
        </p>
      </CardS>

      <CardS
        titulo={`Histórico de versões (${historicoBackups.length})`}
        sub="As 10 versões mais recentes ficam guardadas automaticamente no navegador."
      >
        {historicoBackups.length === 0 ? (
          <p className="text-sm text-[var(--sig-muted)] m-0">
            Nenhum backup registrado ainda. Exporte o primeiro agora.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table>
              <caption className="sr-only">Histórico de backups registrados</caption>
              <thead>
                <tr>
                  <th scope="col">Versão</th>
                  <th scope="col">Data / hora</th>
                  <th scope="col">Descrição</th>
                  <th scope="col" className="num">
                    Tamanho
                  </th>
                  <th scope="col">Ação</th>
                </tr>
              </thead>
              <tbody>
                {historicoBackups.map((b) => (
                  <tr key={b.versao}>
                    <td>
                      <Pill tone="t-petroleo">{b.versao}</Pill>
                    </td>
                    <td className="whitespace-nowrap">{dataHoraBR(b.dataBackup)}</td>
                    <td>{b.descricao}</td>
                    <td className="num">{b.tamanhoKb} KB</td>
                    <td>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => restaurarBackupHistorico(b.versao)}
                      >
                        Restaurar
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardS>

      <Dialog open={!!previa} onOpenChange={(v) => !v && setPrevia(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Prévia do backup</DialogTitle>
            <DialogDescription>
              {previa?.nome} — confirme antes de substituir os dados atuais.
            </DialogDescription>
          </DialogHeader>
          <pre className="codeblock max-h-64">{previa?.conteudo.slice(0, 2000)}</pre>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPrevia(null)}>
              Cancelar
            </Button>
            <Button className="bg-blue-700 hover:bg-blue-800" onClick={aplicarPrevia}>
              Aplicar backup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmarRestauracao} onOpenChange={setConfirmarRestauracao}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restaurar última versão do histórico?</DialogTitle>
            <DialogDescription>
              Os dados atuais serão substituídos pela versão mais recente guardada no histórico (
              {historicoBackups.length > 0
                ? dataHoraBR(historicoBackups[0].dataBackup)
                : 'nenhuma versão registrada'}
              ). Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmarRestauracao(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={historicoBackups.length === 0}
              onClick={() => {
                if (historicoBackups.length > 0) {
                  restaurarBackupHistorico(historicoBackups[0].versao)
                }
                setConfirmarRestauracao(false)
              }}
            >
              Restaurar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
