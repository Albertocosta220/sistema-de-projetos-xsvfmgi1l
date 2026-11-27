import forge from 'node-forge'

/**
 * Certificado Digital A1 (.pfx/.p12) — 100% no navegador.
 * O arquivo é parseado com node-forge (PKCS#12) usando a senha informada.
 * Guarda em localStorage:
 *   - 'sigef-certificado-a1'  → metadados + pfx em base64 (para reinstalar sem re-upload)
 *   - 'sigef-certificado-a1-senha' → senha do .pfx (necessária para assinaturas
 *     futuras; o usuário é avisado do risco na tela)
 * A senha NUNCA fica em código ou constante.
 */

const KEY_CERT = 'sigef-certificado-a1'
const KEY_SENHA = 'sigef-certificado-a1-senha'

export interface CertificadoA1 {
  subjectCN: string
  subjectCompleto: string
  cnpj: string
  cpf: string
  emitidoPor: string
  validoDe: string // ISO
  validoAte: string // ISO
  vencido: boolean
  instaladoEm: string // ISO
  nomeArquivo: string
  pfxBase64: string
}

export interface ResultadoInstalacao {
  cert: CertificadoA1
  senha: string
}

function ler(): CertificadoA1 | null {
  try {
    const raw = localStorage.getItem(KEY_CERT)
    if (!raw) return null
    return JSON.parse(raw) as CertificadoA1
  } catch {
    return null
  }
}

function gravar(cert: CertificadoA1) {
  localStorage.setItem(KEY_CERT, JSON.stringify(cert))
}

/** Extrai CNPJ (OID 2.5.29.17 otherName /_subjectKeyIdentifier não cobre) — busca padrão CNPJ no subject. */
function extrairCnpjDoSubject(subject: string): string {
  // Formatos comuns: "..., CNPJ=12345678000199, ..." ou VIDs (OIDs) já resolvidos
  const m = subject.match(/CNPJ[=:\s]*([\d./-]{11,18})/i)
  if (m) return m[1].replace(/\D/g, '')
  return ''
}

function extrairCpfDoSubject(subject: string): string {
  const m = subject.match(/CPF[=:\s]*([\d./-]{9,14})/i)
  if (m) return m[1].replace(/\D/g, '')
  return ''
}

/** Valida e converte o .pfx em metadados; lança Error com mensagem amigável. */
export function parsePfx(base64: string, senha: string, nomeArquivo: string): CertificadoA1 {
  let der: forge.util.ByteStringBuffer
  try {
    const bin = forge.util.decode64(base64)
    der = forge.util.createBuffer(bin, 'binary')
  } catch {
    throw new Error('Arquivo .pfx ilegível (não é base64/binário válido).')
  }

  let p12: forge.pkcs12.Pkcs12Pfx
  try {
    p12 = forge.pkcs12.pkcs12FromAsn1(der, senha)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (/password|decrypt|mac/i.test(msg)) {
      throw new Error(
        'Senha incorreta ou arquivo .pfx corrompido. Verifique a senha e tente novamente.',
      )
    }
    throw new Error('Não foi possível abrir o certificado: ' + msg)
  }

  // Procura o par chave+certificado (certificado de assinatura)
  const bagsCert = p12.getBags({ bagType: forge.pki.oids.certBag })
  const certBag = bagsCert[forge.pki.oids.certBag]?.[0]
  if (!certBag || !certBag.cert) {
    throw new Error('O arquivo .pfx não contém um certificado X.509 válido.')
  }
  const certX509 = certBag.cert
  const subjectAttrs = certX509.subject.attributes
  const subjectCompleto = certX509.subject.getField('CN')
    ? certX509.subject.getField('CN').value
    : subjectAttrs.map((a) => `${a.name}=${a.value}`).join(', ')

  const field = (name: string) => certX509.subject.getField(name)?.value || ''
  const cn = field('CN') || subjectCompleto
  const subjectStr = subjectAttrs.map((a) => `${a.shortName}=${a.value}`).join(', ')

  const validoDe = certX509.validity.notBefore.toISOString()
  const validoAte = certX509.validity.notAfter.toISOString()
  const vencido = certX509.validity.notAfter.getTime() < Date.now()

  const cnpj = extrairCnpjDoSubject(subjectStr) || extrairCnpjDoSubject(cn)
  const cpf = extrairCpfDoSubject(subjectStr) || extrairCpfDoSubject(cn)
  const emitidoPor = certX509.issuer.getField('CN')?.value || ''

  return {
    subjectCN: cn,
    subjectCompleto,
    cnpj,
    cpf,
    emitidoPor,
    validoDe,
    validoAte,
    vencido,
    instaladoEm: new Date().toISOString(),
    nomeArquivo,
    pfxBase64: base64,
  }
}

/** Instala (parseia + persiste). Lança Error com mensagem amigável em caso de falha. */
export function instalarCertificadoA1(
  base64: string,
  senha: string,
  nomeArquivo: string,
): ResultadoInstalacao {
  const cert = parsePfx(base64, senha, nomeArquivo)
  gravar(cert)
  // Persiste a senha para o sistema conseguir usar o certificado onde precisar
  // (assinaturas/autenticação mTLS). Aviso de risco exibido na tela.
  localStorage.setItem(KEY_SENHA, senha)
  return { cert, senha }
}

/** Reinstala silenciosamente o PFX guardado (ex.: ao iniciar o sistema). */
export function reinstalarDoStorage(): CertificadoA1 | null {
  const cert = ler()
  if (!cert) return null
  const senha = localStorage.getItem(KEY_SENHA)
  if (!senha) return cert // metadados existem; sem senha não valida de novo
  try {
    parsePfx(cert.pfxBase64, senha, cert.nomeArquivo)
    return cert
  } catch {
    return cert
  }
}

export function carregarCertificado(): CertificadoA1 | null {
  return ler()
}

export function removerCertificado() {
  localStorage.removeItem(KEY_CERT)
  localStorage.removeItem(KEY_SENHA)
}

export function obterSenhaCertificado(): string | null {
  return localStorage.getItem(KEY_SENHA)
}

/** Certificado ativo = instalado e não vencido. */
export function certificadoAtivo(): CertificadoA1 | null {
  const cert = ler()
  if (!cert) return null
  return cert.vencido ? null : cert
}

export function formatarCnpj(digitos: string): string {
  const d = (digitos || '').replace(/\D/g, '')
  if (d.length !== 14) return digitos
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
}

export function formatarCpf(digitos: string): string {
  const d = (digitos || '').replace(/\D/g, '')
  if (d.length !== 11) return digitos
  return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')
}

export function formatarDataHora(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
