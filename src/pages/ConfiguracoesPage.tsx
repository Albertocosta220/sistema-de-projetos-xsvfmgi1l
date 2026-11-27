import { useEffect, useState } from 'react'
import { PageHead, CardS, Pill, dataHoraBR } from '@/components/shell'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

const CHAVE_STORAGE = 'sigef-configuracoes'

interface ConfigSigef {
  fatorCubagem: number // kg/m³ — fator de cubagem padrão da rodoviária (6000 cm³/kg)
  intervaloSefazMin: number // intervalo da consulta DF-e (minutos)
  alertaEstoqueMinimoAtivo: boolean
  atualizadoEm?: string
}

const PADRAO: ConfigSigef = {
  fatorCubagem: 6000,
  intervaloSefazMin: 60,
  alertaEstoqueMinimoAtivo: true,
}

function carregarConfig(): ConfigSigef {
  try {
    const bruto = localStorage.getItem(CHAVE_STORAGE)
    if (!bruto) return { ...PADRAO }
    const parsed = JSON.parse(bruto) as Partial<ConfigSigef>
    return {
      fatorCubagem:
        typeof parsed.fatorCubagem === 'number' ? parsed.fatorCubagem : PADRAO.fatorCubagem,
      intervaloSefazMin:
        typeof parsed.intervaloSefazMin === 'number'
          ? parsed.intervaloSefazMin
          : PADRAO.intervaloSefazMin,
      alertaEstoqueMinimoAtivo:
        typeof parsed.alertaEstoqueMinimoAtivo === 'boolean'
          ? parsed.alertaEstoqueMinimoAtivo
          : PADRAO.alertaEstoqueMinimoAtivo,
      atualizadoEm: parsed.atualizadoEm,
    }
  } catch {
    return { ...PADRAO }
  }
}

/**
 * Configurações — parâmetros gerais do sistema, persistidos em localStorage
 * (o projeto não tem banco: os dados vivem no navegador).
 */
export default function ConfiguracoesPage() {
  const [config, setConfig] = useState<ConfigSigef>(carregarConfig)
  const [intervaloTexto, setIntervaloTexto] = useState(String(config.intervaloSefazMin))

  // Reage a mudanças feitas em outra aba da mesma sessão
  useEffect(() => {
    const sincronizar = (e: StorageEvent) => {
      if (e.key === CHAVE_STORAGE) setConfig(carregarConfig())
    }
    window.addEventListener('storage', sincronizar)
    return () => window.removeEventListener('storage', sincronizar)
  }, [])

  const salvar = (proximo: ConfigSigef) => {
    const comData = { ...proximo, atualizadoEm: new Date().toISOString() }
    localStorage.setItem(CHAVE_STORAGE, JSON.stringify(comData))
    setConfig(comData)
  }

  const salvarIntervalo = () => {
    const valor = Number(intervaloTexto)
    if (!Number.isFinite(valor) || valor < 5 || valor > 1440) {
      toast.error('Informe um intervalo entre 5 e 1440 minutos.')
      return
    }
    salvar({ ...config, intervaloSefazMin: Math.round(valor) })
    toast.success(`Intervalo da consulta SEFAZ salvo: ${Math.round(valor)} minutos.`)
  }

  const alternarAlerta = (ativo: boolean) => {
    salvar({ ...config, alertaEstoqueMinimoAtivo: ativo })
    toast.success(`Alerta de estoque mínimo ${ativo ? 'ativado' : 'desativado'}.`)
  }

  return (
    <div>
      <PageHead
        eyebrow="Sistema"
        titulo="Configurações"
        subtitulo="Parâmetros gerais do SIGEF-ME. Os valores ficam salvos neste navegador (localStorage)."
      />

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <CardS
          titulo="Fator de cubagem"
          sub="Usado na conversão de volumes para o cálculo de frete e cubagem dos produtos."
        >
          <div className="field-row">
            <div className="field">
              <Label htmlFor="fator-cubagem">Fator de cubagem (cm³/kg)</Label>
              <Input
                id="fator-cubagem"
                className="sig-input"
                value={config.fatorCubagem}
                readOnly
                aria-readonly="true"
                inputMode="numeric"
              />
            </div>
          </div>
          <p className="text-xs text-[var(--sig-muted)] m-0">
            Valor fixo do padrão rodoviário (6000 cm³ = 1 kg fiscal). Somente leitura — alterações
            exigem revisão da equipe fiscal.
          </p>
        </CardS>

        <CardS
          titulo="Consulta SEFAZ (DF-e)"
          sub="Intervalo entre as buscas automáticas de novos documentos no ambiente nacional."
        >
          <div className="field-row">
            <div className="field">
              <Label htmlFor="intervalo-sefaz">Intervalo da consulta (minutos)</Label>
              <Input
                id="intervalo-sefaz"
                className="sig-input"
                type="number"
                inputMode="numeric"
                min={5}
                max={1440}
                value={intervaloTexto}
                autoComplete="off"
                onChange={(e) => setIntervaloTexto(e.target.value)}
                onBlur={() => {
                  const valor = Number(intervaloTexto)
                  if (
                    Number.isFinite(valor) &&
                    valor >= 5 &&
                    valor <= 1440 &&
                    valor !== config.intervaloSefazMin
                  ) {
                    salvarIntervalo()
                  }
                }}
              />
            </div>
            <div className="flex items-end">
              <Button className="bg-blue-700 hover:bg-blue-800" onClick={salvarIntervalo}>
                Salvar intervalo
              </Button>
            </div>
          </div>
          <p className="text-xs text-[var(--sig-muted)] m-0">
            O padrão de 60 minutos evita consumo indevido do distribuidor DF-e (rejeição 656).
          </p>
        </CardS>

        <CardS
          titulo="Alerta de estoque mínimo"
          sub="Avisa no Painel quando a quantidade disponível de um item cair abaixo do mínimo definido no cadastro."
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor="alerta-estoque">Alerta de estoque mínimo</Label>
              <p className="text-xs text-[var(--sig-muted)] m-0 mt-1">
                Quando desativado, o Painel não destaca itens abaixo do mínimo.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Pill tone={config.alertaEstoqueMinimoAtivo ? 't-verde' : 't-muted'}>
                {config.alertaEstoqueMinimoAtivo ? 'Ativo' : 'Inativo'}
              </Pill>
              <Switch
                id="alerta-estoque"
                checked={config.alertaEstoqueMinimoAtivo}
                onCheckedChange={alternarAlerta}
                aria-label="Ativar ou desativar alerta de estoque mínimo"
              />
            </div>
          </div>
        </CardS>

        <CardS titulo="Sobre esta configuração" sub="Onde os dados ficam guardados.">
          <dl className="m-0 text-sm flex flex-col gap-2">
            <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
              <dt className="text-[var(--sig-muted)]">Armazenamento</dt>
              <dd className="m-0">localStorage do navegador — sem servidor externo</dd>
            </div>
            <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
              <dt className="text-[var(--sig-muted)]">Última atualização</dt>
              <dd className="m-0">{config.atualizadoEm ? dataHoraBR(config.atualizadoEm) : '—'}</dd>
            </div>
          </dl>
        </CardS>
      </div>
    </div>
  )
}
