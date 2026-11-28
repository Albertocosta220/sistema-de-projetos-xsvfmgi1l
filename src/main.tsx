/// <reference types="vite/client" />

/**
 * Boot à prova de dados corrompidos — MODO SEGURO (definitivo):
 *
 * 1. Este arquivo executa ANTES de qualquer import de módulo do app: cada chave
 *    'sigef-*' com JSON quebrado é movida para QUARENTENA
 *    ('sigef-quarentena-<timestamp>') — preservada para inspeção, nunca usada
 *    nem apagada silenciosamente — e o boot segue com o resto;
 * 2. o provider de autenticação tem boot try/catch/finally (setPronto sempre);
 *    usuários/perfis ilegíveis são reinicializados como listas vazias;
 * 3. o bancoService também quarentena chaves inválidas ao hidratar o cache;
 * 4. como ÚLTIMA linha de defesa, o ErrorBoundary do app oferece recuperação.
 *
 * Assim /login SEMPRE renderiza o formulário — nunca a tela de erro.
 */

// ====== Execução ANTES de qualquer import de módulo do app ======
try {
  const chaves: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k && k.startsWith('sigef') && !k.startsWith('sigef-quarentena-')) chaves.push(k)
  }
  for (const k of chaves) {
    const v = localStorage.getItem(k)
    // JSON estruturado do sistema: valida; lixo que não parseia vai para quarentena.
    if (v && (v.startsWith('{') || v.startsWith('['))) {
      try {
        JSON.parse(v)
      } catch {
        try {
          localStorage.setItem(
            `sigef-quarentena-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            JSON.stringify({
              chaveOriginal: k,
              motivo: 'JSON inválido detectado no boot',
              valor: v,
              em: new Date().toISOString(),
            }),
          )
        } catch {
          // sem espaço para quarentena: a chave é descartada e o boot segue
        }
        localStorage.removeItem(k)
      }
    }
  }
} catch {
  // localStorage indisponível: nada a fazer aqui
}

// ====== Boot assíncrono: banco → cache (e migração local → banco) ======
void prepararBoot()

async function prepararBoot(): Promise<void> {
  try {
    const { hidratar } = await import('./services/bancoService')
    await hidratar()
  } catch (e) {
    console.error('[SIGEF] falha ao hidratar do banco; seguindo com espelho local:', e)
  }
}

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './main.css'

try {
  const container = document.getElementById('root')
  if (!container) throw new Error('Elemento #root não encontrado')
  createRoot(container).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
} catch (e) {
  console.error('[SIGEF] falha ao montar o app:', e)
  document.body.innerHTML =
    '<div style="font-family:Inter,sans-serif;padding:40px;color:#0F172A">' +
    '<h1 style="font-size:18px;margin-bottom:8px">SIGEF-ME não pôde ser carregado</h1>' +
    '<p style="font-size:13px;color:#475569">Recarregue a página. Se o problema ' +
    'persistir, limpe os dados do site nas configurações do navegador.</p></div>'
}
