import { CertificadoA1, formatarCnpj } from './certificadoService'
import { OcorrenciaAuditoria } from '@/types/sigef'
import { REGUAS_AUDITORIA } from '@/data/regrasAuditoria'

/**
 * Ocorrências de auditoria (régua A13) para operações administrativas:
 * instalação/remoção de certificado digital e edição de cadastro de empresa.
 * As ocorrências são gravadas na store da empresa ativa (SigefContext)
 * por meio de `adicionarOcorrenciaAuditoria`.
 */

export function montarOcorrenciaCertificado(params: {
  acao: 'INSTALOU' | 'REMOVEU'
  cert: Pick<CertificadoA1, 'subjectCN' | 'cnpj' | 'nomeArquivo' | 'validoAte'>
  autor: string
}): OcorrenciaAuditoria {
  const { acao, cert, autor } = params
  const verbo = acao === 'INSTALOU' ? 'instalado' : 'removido'
  return {
    id: `oco-a13-cert-${Date.now()}`,
    regraCodigo: 'A13',
    regraNome: REGUAS_AUDITORIA.find((r) => r.codigo === 'A13')?.nome || '',
    severidade: 'INFO',
    descricao: `Certificado digital A1 ${verbo} por ${autor}: ${cert.subjectCN || cert.nomeArquivo}${
      cert.cnpj ? ` (CNPJ ${formatarCnpj(cert.cnpj)})` : ''
    }, validade até ${formatarValidadeCurta(cert.validoAte)}.`,
    baseLegal: REGUAS_AUDITORIA.find((r) => r.codigo === 'A13')?.baseLegal || '',
    dataIdentificacao: new Date().toISOString(),
    resolvido: false,
    podeReprocessar: false,
  }
}

export function montarOcorrenciaEdicaoEmpresa(params: {
  empresa: { razaoSocial: string; cnpj: string }
  autor: string
  camposAlterados: string[]
}): OcorrenciaAuditoria {
  const { empresa, autor, camposAlterados } = params
  return {
    id: `oco-a13-emp-${Date.now()}`,
    regraCodigo: 'A13',
    regraNome: REGUAS_AUDITORIA.find((r) => r.codigo === 'A13')?.nome || '',
    severidade: 'INFO',
    descricao: `Cadastro da empresa ${empresa.razaoSocial} (CNPJ ${formatarCnpj(
      empresa.cnpj,
    )}) editado por ${autor}. Campos alterados: ${camposAlterados.join(', ')}.`,
    baseLegal: REGUAS_AUDITORIA.find((r) => r.codigo === 'A13')?.baseLegal || '',
    dataIdentificacao: new Date().toISOString(),
    resolvido: false,
    podeReprocessar: false,
  }
}

function formatarValidadeCurta(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
