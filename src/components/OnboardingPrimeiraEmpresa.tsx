import { useState } from 'react'
import { Empresa } from '@/types/sigef'
import { useSigef } from '@/context/SigefContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Building2 } from 'lucide-react'
import { novoId } from '@/services/authService'

const UFS = [
  'AC',
  'AL',
  'AP',
  'AM',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MT',
  'MS',
  'MG',
  'PA',
  'PB',
  'PR',
  'PE',
  'PI',
  'RJ',
  'RN',
  'RS',
  'RO',
  'RR',
  'SC',
  'SP',
  'SE',
  'TO',
]

/** Formulário de cadastro da primeira empresa (onboarding, produção sem seeds). */
export function OnboardingPrimeiraEmpresa() {
  const { cadastrarOuEditarEmpresa } = useSigef()

  const [razaoSocial, setRazaoSocial] = useState('')
  const [nomeFantasia, setNomeFantasia] = useState('')
  const [cnpj, setCnpj] = useState('')
  const [inscricaoEstadual, setInscricaoEstadual] = useState('')
  const [uf, setUf] = useState('')

  const apenasDigitos = (v: string) => v.replace(/\D/g, '')

  const formatarCnpj = (v: string) => {
    const d = apenasDigitos(v).slice(0, 14)
    if (d.length <= 2) return d
    if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`
    if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`
    if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
  }

  const erros: Record<string, string> = {}
  if (!razaoSocial.trim()) erros.razaoSocial = 'Informe a razão social.'
  if (apenasDigitos(cnpj).length !== 14) erros.cnpj = 'CNPJ deve ter 14 dígitos.'
  if (!inscricaoEstadual.trim()) erros.inscricaoEstadual = 'Informe a inscrição estadual.'
  if (!uf) erros.uf = 'Selecione a UF.'

  const valido = Object.keys(erros).length === 0

  const salvar = () => {
    if (!valido) return
    const empresa: Empresa = {
      id: novoId(),
      razaoSocial: razaoSocial.trim(),
      nomeFantasia: nomeFantasia.trim() || razaoSocial.trim(),
      cnpj: apenasDigitos(cnpj),
      inscricaoEstadual: inscricaoEstadual.trim(),
      uf,
      situacaoCadastral: 'ATIVA',
      bloquearFechamento: false,
    }
    cadastrarOuEditarEmpresa(empresa)
  }

  return (
    <Card className="border-slate-200 max-w-xl">
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="size-9 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
            <Building2 className="size-5" />
          </div>
          <div>
            <CardTitle className="text-base font-bold">Cadastre a sua empresa</CardTitle>
            <CardDescription className="text-xs">
              Primeiro passo do SIGEF-ME: os dados fiscais (estoque, kardex, SPED) ficam vinculados
              a ela.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="onb-razao">Razão social *</Label>
          <Input
            id="onb-razao"
            value={razaoSocial}
            onChange={(e) => setRazaoSocial(e.target.value)}
            autoComplete="organization"
            placeholder="Razão social completa"
          />
          {erros.razaoSocial && <p className="text-xs text-rose-700">{erros.razaoSocial}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="onb-fantasia">Nome fantasia</Label>
          <Input
            id="onb-fantasia"
            value={nomeFantasia}
            onChange={(e) => setNomeFantasia(e.target.value)}
            autoComplete="organization"
            placeholder="Como a empresa é conhecida"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="onb-cnpj">CNPJ *</Label>
            <Input
              id="onb-cnpj"
              value={cnpj}
              onChange={(e) => setCnpj(formatarCnpj(e.target.value))}
              inputMode="numeric"
              autoComplete="off"
              placeholder="00.000.000/0000-00"
            />
            {erros.cnpj && <p className="text-xs text-rose-700">{erros.cnpj}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="onb-ie">Inscrição estadual *</Label>
            <Input
              id="onb-ie"
              value={inscricaoEstadual}
              onChange={(e) => setInscricaoEstadual(e.target.value)}
              inputMode="numeric"
              autoComplete="off"
              placeholder="Número da IE"
            />
            {erros.inscricaoEstadual && (
              <p className="text-xs text-rose-700">{erros.inscricaoEstadual}</p>
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="onb-uf">UF *</Label>
          <Select value={uf} onValueChange={setUf}>
            <SelectTrigger id="onb-uf" aria-label="Unidade federativa">
              <SelectValue placeholder="Selecione a UF" />
            </SelectTrigger>
            <SelectContent>
              {UFS.map((u) => (
                <SelectItem key={u} value={u}>
                  {u}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {erros.uf && <p className="text-xs text-rose-700">{erros.uf}</p>}
        </div>

        <Button
          className="bg-blue-700 hover:bg-blue-800 w-full"
          disabled={!valido}
          onClick={salvar}
        >
          Cadastrar empresa e começar
        </Button>
        <p className="text-[11px] text-slate-500 m-0">
          Nenhum dado de exemplo é carregado: o sistema começa zerado, com os seus dados reais.
        </p>
      </CardContent>
    </Card>
  )
}
