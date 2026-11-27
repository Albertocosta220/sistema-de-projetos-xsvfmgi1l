import { Navigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '@/context/AuthContext'
import { TELAS } from '@/types/usuario'
import { ShieldAlert } from 'lucide-react'

/**
 * Barreira de acesso: exige sessão (login) e, para rotas mapeadas em TELAS,
 * a permissão correspondente do perfil do usuário logado. Sem permissão,
 * mostra um bloqueio amigável — nunca crasha.
 */
export default function RequireAuth({ children }: { children: ReactNode }) {
  const { pronto, usuarioAtual, temPermissao } = useAuth()
  const location = useLocation()

  if (!pronto) return null

  if (!usuarioAtual) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  const tela = TELAS.find((t) => t.rota === location.pathname)
  if (tela && !temPermissao(tela.key)) {
    return (
      <div className="card-s text-center py-14">
        <ShieldAlert aria-hidden="true" className="size-12 mx-auto text-[var(--ambar)] mb-3" />
        <h2 className="text-lg font-bold text-[var(--petroleo)]">Acesso negado</h2>
        <p className="sub">
          Seu perfil não tem permissão para acessar esta tela. Solicite acesso ao administrador do
          sistema.
        </p>
      </div>
    )
  }

  return <>{children}</>
}
