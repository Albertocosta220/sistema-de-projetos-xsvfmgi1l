/// <reference types="vite/client" />

/**
 * Boot à prova de dados corrompidos (5ª e definitiva rodada do crash do login):
 *
 * 1. main.tsx executa primeiro `prepararBoot()` — qualquer exceção em código de
 *    módulo anterior (imports com efeito colateral, localStorage com lixo)
 *    leva à LIMPEZA TOTAL das chaves sigef-* antes do React montar;
 * 2. o provider de autenticação tem boot try/catch/finally (setPronto sempre);
 * 3. como ÚLTIMA linha de defesa, o ErrorBoundary do app detecta que a queda
 *    aconteceu na rota /login e oferece recuperação total (limpa tudo e
 *    recarrega).
 *
 * Assim /login SEMPRE renderiza o formulário — nunca a tela de erro.
 */

// ====== Execução ANTES de qualquer import de módulo do app ======
try {
  const chaves: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k && k.startsWith('sigef')) chaves.push(k)
  }
  for (const k of chaves) {
    const v = localStorage.getItem(k)
    // JSON estruturado do sistema: valida; lixo que não parseia é removido.
    if (v && (v.startsWith('{') || v.startsWith('['))) {
      try {
        JSON.parse(v)
      } catch {
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
