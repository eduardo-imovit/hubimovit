import Navbar from './Navbar'
import { usePerfil } from '../../hooks/usePerfil'
import { PAPEL_LABEL } from '../../lib/acessos'
import { definirVerComo } from '../../lib/verComo'

/** Faixa fixa enquanto a Gestão está em "Ver como" outro nível ou corretor. */
function FaixaPrevia({ perfil }) {
  const p = perfil.previa
  const quem = p.role === 'corretor' && p.nome ? `${p.nome} (Corretor)` : `o nível ${PAPEL_LABEL[p.role] ?? p.role}`
  return (
    <div className="faixa-previa" role="status">
      <span>
        Você está vendo o Hub como <strong>{quem}</strong>. É uma prévia: os dados são os que a sua conta lê, filtrados para essa visão.
      </span>
      <button type="button" className="btn btn-sm" onClick={() => definirVerComo(null)}>Sair da prévia</button>
    </div>
  )
}

export default function AppShell({ children, navbar, semPadding, semScroll }) {
  const { perfil } = usePerfil()
  return (
    <div className={semScroll ? 'app-shell app-shell--sem-scroll' : 'app-shell'}>
      {navbar ?? <Navbar />}
      {perfil?.previa && <FaixaPrevia perfil={perfil} />}
      <main className={semPadding ? 'app-main app-main--sem-padding' : 'app-main'}>{children}</main>
    </div>
  )
}
