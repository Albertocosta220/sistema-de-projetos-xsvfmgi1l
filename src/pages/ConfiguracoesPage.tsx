import { useEffect, useState } from 'react'
import { PageHead, CardS } from '@/components/shell'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import {
  carregarConfiguracoes,
  ConfigSigef,
  CHAVE_CONFIGURACOES,
} from '@/services/configuracoesService'

export default function ConfiguracoesPage() {
  const [config, setConfig] = useState<ConfigSigef>(carregarConfiguracoes)
  const [intervaloTexto, setIntervaloTexto] = useState(String(config.intervaloSefazMin))

  // Reage a mudanças feitas em outra aba da mesma sessão
  useEffect(() => {
    const sincronizar = (e: StorageEvent) => {
      if (e.key === CHAVE_CONFIGURACOES) setConfig(carregarConfiguracoes())
    }
    window.addEventListener('storage', sincronizar)
    return () => window.removeEventListener('storage', sincronizar)
  }, [])

  const salvar = (proximo: ConfigSigef) => {
    const comData = { ...proximo, atualizadoEm: new Date().toISOString() }
    localStorage.setItem(CHAVE_CONFIGURACOES, JSON.stringify(comData))
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
                type="number"
                inputMode="decimal"
                value={String(config.fatorCubagem)}
                onChange={(e) =>
                  setConfig({ ...config, fatorCubagem: Number(e.target.value) || 0 })
                }
                onBlur={() => {
                  if (config.fatorCubagem <= 0) {
                    toast.error('Fator de cubagem deve ser maior que zero.')
                    return
                  }
                  salvar(config)
                  toast.success('Fator de cubagem salvo.')
                }}
              />
            </div>
          </div>
        </CardS>

        <CardS
          titulo="Intervalo da consulta SEFAZ (DF-e)"
          sub="Tempo mínimo, em minutos, entre consultas ao Web Service NFeDistribuicaoDFe (retorna 656 antes disso)."
        >
          <div className="field-row">
            <div className="field">
              <Label htmlFor="intervalo-sefaz">Intervalo (minutos, 5 a 1440)</Label>
              <Input
                id="intervalo-sefaz"
                type="number"
                inputMode="numeric"
                value={intervaloTexto}
                onChange={(e) => setIntervaloTexto(e.target.value)}
              />
            </div>
            <Button size="sm" onClick={salvarIntervalo}>
              Salvar intervalo
            </Button>
          </div>
        </CardS>

        <CardS
          titulo="Alerta de estoque mínimo"
          sub="Exibe aviso no Painel quando um produto fica abaixo do estoque mínimo cadastrado."
        >
          <div className="field-row">
            <div className="field">
              <Label htmlFor="alerta-estoque">Alerta ativo</Label>
              <Switch
                id="alerta-estoque"
                checked={config.alertaEstoqueMinimoAtivo}
                onCheckedChange={alternarAlerta}
              />
            </div>
          </div>
        </CardS>
      </div>
    </div>
  )
}
