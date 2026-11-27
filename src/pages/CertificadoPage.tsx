import { useState } from 'react'
import { PageHead, CardS, Pill } from '@/components/shell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'

const KEY_CERT = 'sigef_certificado_a1'

interface CertA1 {
  nomeArquivo: string
  validade: string
  registradoEm: string
}

function carregar(): CertA1 | null {
  try {
    const raw = localStorage.getItem(KEY_CERT)
    return raw ? (JSON.parse(raw) as CertA1) : null
  } catch {
    return null
  }
}

/**
 * Certificado Digital — cadastro simulado A1: apenas o nome do arquivo,
 * como no anexo (a chamada real exige backend com ICP-Brasil).
 */
export default function CertificadoPage() {
  const [cert, setCert] = useState<CertA1 | null>(carregar)
  const [nome, setNome] = useState(cert?.nomeArquivo ?? '')

  const salvar = () => {
    const nomeArquivo = nome.trim()
    if (!nomeArquivo) {
      toast.error('Informe o nome do arquivo .pfx (A1).')
      return
    }
    const novo: CertA1 = {
      nomeArquivo,
      validade: cert?.validade ?? '',
      registradoEm: new Date().toISOString(),
    }
    localStorage.setItem(KEY_CERT, JSON.stringify(novo))
    setCert(novo)
    toast.success(`Certificado A1 "${nomeArquivo}" registrado (simulado).`)
  }

  const remover = () => {
    localStorage.removeItem(KEY_CERT)
    setCert(null)
    setNome('')
    toast.info('Certificado removido.')
  }

  return (
    <div>
      <PageHead
        eyebrow="Certificação ICP-Brasil"
        titulo="Certificado Digital"
        subtitulo="Cadastro simulado do certificado A1. A assinatura real exige servidor com acesso ao arquivo."
      />

      <CardS
        titulo="Certificado A1"
        sub="Nesta versão é registrado somente o nome do arquivo .pfx — nenhum conteúdo é enviado."
      >
        {cert ? (
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <Pill tone="t-verde">Registrado</Pill>
            <span className="text-sm font-mono">{cert.nomeArquivo}</span>
            {cert.validade ? (
              <span className="text-xs text-[var(--sig-muted)]">validade: {cert.validade}</span>
            ) : null}
          </div>
        ) : (
          <Pill tone="t-ambar">Nenhum certificado registrado</Pill>
        )}

        <form
          className="field-row mt-3"
          onSubmit={(e) => {
            e.preventDefault()
            salvar()
          }}
        >
          <div className="field flex-1" style={{ minWidth: 280 }}>
            <label htmlFor="cert-nome">Nome do arquivo (.pfx)</label>
            <Input
              id="cert-nome"
              className="sig-input"
              autoComplete="off"
              placeholder="ex: certificado_acme_2026.pfx"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
            />
            <small>Somente o nome do arquivo, sem conteúdo.</small>
          </div>
          <div className="flex gap-2 pb-0.5">
            <Button type="submit" className="bg-blue-700 hover:bg-blue-800">
              {cert ? 'Atualizar' : 'Registrar'}
            </Button>
            {cert ? (
              <Button type="button" variant="outline" onClick={remover}>
                Remover
              </Button>
            ) : null}
          </div>
        </form>
      </CardS>

      <CardS titulo="Como funciona a consulta real" sub="Fluxo NFeDistribuicaoDFe com certificado">
        <ol className="prose-step">
          <li>O backend carrega o .pfx A1 e a senha do cofre de segredos.</li>
          <li>A requisição é assinada XML-DSig e enviada ao web service da SEFAZ da UF.</li>
          <li>O retorno (137/138/656) controla o ultNSU guardado por empresa.</li>
          <li>Neste app a chamada é simulada localmente, com os mesmos códigos de retorno.</li>
        </ol>
      </CardS>
    </div>
  )
}
