/**
 * Configurações gerais do SIGEF-ME — parâmetros do sistema persistidos em
 * localStorage (o projeto não tem banco: os dados vivem no navegador).
 * Extraído de ConfiguracoesPage para que serviços (ex.: simulador DF-e) e
 * telas leiam a MESMA configuração da MESMA chave sem duplicar parsers.
 */

export const CHAVE_CONFIGURACOES = 'sigef-configuracoes'
export const INTERVALO_SEFAZ_MIN_PADRAO = 60

export interface ConfigSigef {
  fatorCubagem: number // kg/m³ — fator de cubagem padrão da rodoviária (6000 cm³/kg)
  intervaloSefazMin: number // intervalo da consulta DF-e (minutos)
  alertaEstoqueMinimoAtivo: boolean
  atualizadoEm?: string
}

export const CONFIG_PADRAO: ConfigSigef = {
  fatorCubagem: 6000,
  intervaloSefazMin: INTERVALO_SEFAZ_MIN_PADRAO,
  alertaEstoqueMinimoAtivo: true,
}

export function carregarConfiguracoes(): ConfigSigef {
  try {
    const bruto = localStorage.getItem(CHAVE_CONFIGURACOES)
    if (!bruto) return { ...CONFIG_PADRAO }
    const parsed = JSON.parse(bruto) as Partial<ConfigSigef>
    return {
      fatorCubagem:
        typeof parsed.fatorCubagem === 'number' ? parsed.fatorCubagem : CONFIG_PADRAO.fatorCubagem,
      intervaloSefazMin:
        typeof parsed.intervaloSefazMin === 'number'
          ? parsed.intervaloSefazMin
          : CONFIG_PADRAO.intervaloSefazMin,
      alertaEstoqueMinimoAtivo:
        typeof parsed.alertaEstoqueMinimoAtivo === 'boolean'
          ? parsed.alertaEstoqueMinimoAtivo
          : CONFIG_PADRAO.alertaEstoqueMinimoAtivo,
      atualizadoEm: parsed.atualizadoEm,
    }
  } catch {
    return { ...CONFIG_PADRAO }
  }
}
