import React, { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  Award,
  BadgeCheck,
  CalendarClock,
  FileKey,
  Globe,
  KeyRound,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Upload,
  RefreshCw,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAuth } from '@/context/AuthContext'
import { useSigef } from '@/context/SigefContext'
import {
  CertificadoA1,
  carregarCertificado,
  formatarCnpj,
  formatarCpf,
  formatarDataHora,
  instalarCertificadoA1,
  removerCertificado,
} from '@/services/certificadoService'
import { montarOcorrenciaCertificado } from '@/services/ocorrenciasCertificado'
import { toast } from 'sonner'

export default function CertificadoPage() {
  const { usuarioAtual } = useAuth()
  const { adicionarOcorrenciaAuditoria } = useSigef()

  const [cert, setCert] = useState<CertificadoA1 | null>(() => carregarCertificado())
  const [senha, setSenha] = useState('')
  const [nomeArquivo, setNomeArquivo] = useState('')
  const [pfxBase64, setPfxBase64] = useState('')
  const [instalando, setInstalando] = useState(false)
  const [confirmarRemocao, setConfirmarRemocao] = useState(false)
  const inputArquivoRef = useRef<HTMLInputElement>(null)

  const autor = usuarioAtual?.nome ?? usuarioAtual?.login ?? '—'

  const aoSelecionarArquivo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!/\.(pfx|p12)$/i.test(file.name)) {
      toast.error('Selecione um arquivo de certificado A1 (.pfx ou .p12).')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result !== 'string') {
        toast.error('Não foi possível ler o arquivo do certificado.')
        return
      }
      const base64 = result.split(',')[1] || ''
      setPfxBase64(base64)
      setNomeArquivo(file.name)
      toast.info(`Arquivo "${file.name}" carregado. Informe a senha e clique em Instalar.`)
    }
    reader.onerror = () => toast.error('Falha ao ler o arquivo do certificado.')
    reader.readAsDataURL(file)
  }

  const instalar = (e: React.FormEvent) => {
    e.preventDefault()
    if (!pfxBase64) {
      toast.error('Selecione o arquivo .pfx do certificado A1.')
      return
    }
    if (!senha) {
      toast.error('Informe a senha do certificado.')
      return
    }
    setInstalando(true)
    // Parse real do PKCS#12 no navegador (node-forge); valida a senha de verdade.
    setTimeout(() => {
      try {
        const { cert: novoCert } = instalarCertificadoA1(pfxBase64, senha, nomeArquivo)
        setCert(novoCert)
        setSenha('')
        setPfxBase64('')
        setNomeArquivo('')
        if (inputArquivoRef.current) inputArquivoRef.current.value = ''
        adicionarOcorrenciaAuditoria(
          montarOcorrenciaCertificado({ acao: 'INSTALOU', cert: novoCert, autor }),
        )
        toast.success(
          `Certificado A1 instalado: ${novoCert.subjectCN}${
            novoCert.vencido ? ' (ATENÇÃO: certificado VENCIDO)' : ''
          }`,
        )
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Falha ao instalar o certificado.')
      } finally {
        setInstalando(false)
      }
    }, 300)
  }

  const remover = () => {
    if (cert) {
      adicionarOcorrenciaAuditoria(montarOcorrenciaCertificado({ acao: 'REMOVEU', cert, autor }))
    }
    removerCertificado()
    setCert(null)
    setConfirmarRemocao(false)
    toast.info('Certificado digital A1 removido do sistema.')
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Certificado Digital A1
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Instalação do arquivo .pfx no navegador. O certificado fica disponível para todas as
            operações que exigem assinatura/autenticação (consultas SEFAZ DF-e, envios e pesquisas).
          </p>
        </div>
      </div>

      {!cert ? (
        /* ---- Estado vazio: nenhum certificado instalado ---- */
        <Card className="border-dashed border-2 border-slate-300">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <FileKey className="size-5 text-slate-400" />
              Nenhum certificado instalado
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              Instale seu certificado digital A1 (arquivo .pfx emitido por AC credenciada
              ICP-Brasil) para habilitar as consultas e transmissões que exigem autenticação.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={instalar} className="space-y-4 max-w-xl">
              <div>
                <Label htmlFor="pfxFile" className="text-xs font-semibold">
                  Arquivo do certificado (.pfx / .p12) *
                </Label>
                <Input
                  ref={inputArquivoRef}
                  id="pfxFile"
                  type="file"
                  accept=".pfx,.p12"
                  onChange={aoSelecionarArquivo}
                  className="text-xs mt-1 cursor-pointer"
                  required
                />
              </div>
              <div>
                <Label htmlFor="pfxSenha" className="text-xs font-semibold">
                  Senha do certificado *
                </Label>
                <Input
                  id="pfxSenha"
                  type="password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder="Senha do .pfx"
                  autoComplete="off"
                  className="text-xs mt-1"
                  required
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  A senha é usada apenas para abrir o arquivo .pfx neste navegador (node-forge) e
                  gravada junto aos dados locais para o sistema poder utilizá-lo.
                </p>
              </div>
              <Button
                type="submit"
                disabled={instalando}
                className="bg-blue-700 hover:bg-blue-800 text-xs font-semibold flex items-center gap-1.5"
              >
                <Upload className="size-3.5" />
                <span>{instalando ? 'Validando certificado…' : 'Instalar certificado'}</span>
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : (
        /* ---- Estado instalado ---- */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card
            className={`lg:col-span-2 border-2 ${
              cert.vencido ? 'border-rose-300' : 'border-emerald-300'
            }`}
          >
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    {cert.vencido ? (
                      <ShieldAlert className="size-5 text-rose-600" />
                    ) : (
                      <ShieldCheck className="size-5 text-emerald-600" />
                    )}
                    Certificado instalado
                  </CardTitle>
                  <CardDescription className="text-xs mt-1 font-mono">
                    {cert.subjectCompleto}
                  </CardDescription>
                </div>
                <Badge
                  variant={cert.vencido ? 'destructive' : 'outline'}
                  className={
                    cert.vencido
                      ? 'text-[10px]'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]'
                  }
                >
                  {cert.vencido ? 'VENCIDO' : 'VÁLIDO'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <Linha rotulo="Titular (CN)" valor={cert.subjectCN} />
              {cert.cnpj && <Linha rotulo="CNPJ" valor={formatarCnpj(cert.cnpj)} />}
              {cert.cpf && <Linha rotulo="CPF" valor={formatarCpf(cert.cpf)} />}
              <Linha rotulo="Emitido por" valor={cert.emitidoPor || '—'} />
              <Linha rotulo="Válido de" valor={formatarDataHora(cert.validoDe)} />
              <Linha rotulo="Válido até" valor={formatarDataHora(cert.validoAte)} />
              <Linha rotulo="Instalado em" valor={formatarDataHora(cert.instaladoEm)} />
              <Linha rotulo="Arquivo" valor={cert.nomeArquivo} />

              {cert.vencido && (
                <div className="p-2 bg-rose-50 border border-rose-200 rounded text-rose-800 text-[11px] flex items-start gap-1.5 mt-2">
                  <AlertTriangle className="size-3.5 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <strong>Certificado vencido:</strong> renove na Autoridade Certificadora e
                    reinstale o novo arquivo .pfx.
                  </div>
                </div>
              )}

              <div className="pt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setConfirmarRemocao(true)}
                  className="text-xs text-rose-700 border-rose-300 hover:bg-rose-50 flex items-center gap-1.5"
                >
                  <Trash2 className="size-3.5" />
                  <span>Remover certificado</span>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => inputArquivoRef.current?.click()}
                  className="text-xs flex items-center gap-1.5"
                >
                  <RefreshCw className="size-3.5" />
                  <span>Reinstalar / substituir</span>
                </Button>
              </div>
              {/* Input escondido usado pelo botão Reinstalar (formulário do estado vazio não renderiza) */}
              <input
                ref={inputArquivoRef}
                id="pfxFileReplace"
                type="file"
                accept=".pfx,.p12"
                onChange={aoSelecionarArquivo}
                className="hidden"
                aria-label="Selecionar novo arquivo de certificado .pfx"
              />
              {pfxBase64 && (
                <form
                  onSubmit={instalar}
                  className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-2"
                >
                  <Label htmlFor="pfxSenhaReplace" className="text-xs font-semibold">
                    Senha do novo arquivo "{nomeArquivo}"
                  </Label>
                  <Input
                    id="pfxSenhaReplace"
                    type="password"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    placeholder="Senha do .pfx"
                    autoComplete="off"
                    className="text-xs"
                    required
                  />
                  <Button
                    type="submit"
                    disabled={instalando}
                    size="sm"
                    className="bg-blue-700 hover:bg-blue-800 text-xs"
                  >
                    {instalando ? 'Validando…' : 'Concluir instalação'}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>

          {/* Status de uso no sistema */}
          <Card className="border-slate-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <BadgeCheck className="size-4 text-blue-700" />
                Uso no sistema
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs text-slate-600">
              <UsoItem
                icone={<Globe className="size-4 text-slate-400" />}
                titulo="Consulta SEFAZ DF-e"
                descricao={
                  cert.vencido
                    ? 'Bloqueada: certificado vencido.'
                    : 'Liberada com este certificado (Empresas & Consulta DF-e).'
                }
                ok={!cert.vencido}
              />
              <UsoItem
                icone={<FileKey className="size-4 text-slate-400" />}
                titulo="Assinatura de documentos"
                descricao="Certificado disponível para rotinas que exigem o A1."
                ok={!cert.vencido}
              />
              <Link
                to="/empresas"
                className="inline-flex items-center gap-1 text-blue-700 hover:underline text-xs font-semibold pt-1"
              >
                Ir para Consulta DF-e →
              </Link>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Card informativo (sempre visível) */}
      <Card className="border-slate-200 bg-slate-50/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Award className="size-4 text-blue-700" />
            Como funciona
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-slate-600 space-y-1.5">
          <p className="flex items-start gap-1.5">
            <KeyRound className="size-3.5 shrink-0 mt-0.5 text-slate-400" />
            O arquivo .pfx é validado de verdade (PKCS#12 / node-forge) com a senha informada —
            senha errada é recusada na hora.
          </p>
          <p className="flex items-start gap-1.5">
            <CalendarClock className="size-3.5 shrink-0 mt-0.5 text-slate-400" />
            CN, CNPJ (quando presente no certificado), emissor e validade são extraídos e exibidos.
          </p>
          <p className="flex items-start gap-1.5">
            <ShieldCheck className="size-3.5 shrink-0 mt-0.5 text-slate-400" />
            O certificado fica gravado localmente (localStorage) e fica disponível para todo o
            sistema — inclusive como requisito da Consulta DF-e.
          </p>
        </CardContent>
      </Card>

      {/* Confirmação de remoção */}
      <Dialog open={confirmarRemocao} onOpenChange={setConfirmarRemocao}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Remover certificado digital?</DialogTitle>
            <DialogDescription className="text-xs">
              O certificado "{cert?.subjectCN}" será removido deste navegador. As consultas SEFAZ
              DF-e voltarão a ficar bloqueadas até que um novo certificado seja instalado.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmarRemocao(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={remover} className="text-xs">
              Remover certificado
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-1.5">
      <span className="text-slate-500 font-semibold shrink-0">{rotulo}</span>
      <span className="font-mono text-slate-800 text-right break-all">{valor}</span>
    </div>
  )
}

function UsoItem({
  icone,
  titulo,
  descricao,
  ok,
}: {
  icone: React.ReactNode
  titulo: string
  descricao: string
  ok: boolean
}) {
  return (
    <div className="flex items-start gap-2">
      {icone}
      <div>
        <div className="font-semibold text-slate-800">{titulo}</div>
        <div className={ok ? 'text-emerald-700' : 'text-rose-700'}>{descricao}</div>
      </div>
    </div>
  )
}
