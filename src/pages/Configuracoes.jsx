import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import AvisosAdmin from '../components/settings/AvisosAdmin'
import BibliotecaLinksAdmin from '../components/settings/BibliotecaLinksAdmin'
import BannersAdmin from '../components/settings/BannersAdmin'
import PlantaoAdmin from '../components/settings/PlantaoAdmin'
import FotografoAdmin from '../components/settings/FotografoAdmin'
import DatasComemorativasAdmin from '../components/settings/DatasComemorativasAdmin'
import UsuariosAdmin from '../components/settings/UsuariosAdmin'
import { usePerfil } from '../hooks/usePerfil'
import { pode } from '../lib/acessos'

const ABAS = [
  { id: 'avisos', label: 'Avisos & Links' },
  { id: 'banners', label: 'Banners da Home' },
  { id: 'plantao', label: 'Plantão' },
  { id: 'fotografo', label: 'Agenda do Fotógrafo' },
  { id: 'datas', label: 'Datas Comemorativas' },
  { id: 'usuarios', label: 'Usuários & Acessos', somenteGestao: true },
]

export default function Configuracoes() {
  const { perfil } = usePerfil()
  const abasVisiveis = ABAS.filter((a) => !a.somenteGestao || pode(perfil, 'usuarios'))
  // ?aba=plantao abre direto na aba (links das pendências da Home)
  const [params] = useSearchParams()
  const abaUrl = params.get('aba')
  const [aba, setAba] = useState(abasVisiveis.some((a) => a.id === abaUrl) ? abaUrl : 'avisos')

  return (
    <div>
      <header className="page-header">
        <div>
          <div className="page-eyebrow">Administração</div>
          <div className="page-title">Configurações</div>
          <div className="page-sub">Gerencie o conteúdo da Home, escalas e acessos do Hub.</div>
        </div>
      </header>

      <div className="tabs" style={{ marginBottom: 'var(--space-6)' }}>
        {abasVisiveis.map((a) => (
          <button
            key={a.id}
            type="button"
            className={`tab${aba === a.id ? ' is-active' : ''}`}
            onClick={() => setAba(a.id)}
          >
            {a.label}
          </button>
        ))}
      </div>

      {aba === 'avisos' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 'var(--space-6)', alignItems: 'start' }}>
          <section>
            <div className="page-eyebrow">Avisos & Novidades</div>
            <AvisosAdmin />
          </section>
          <section>
            <div className="page-eyebrow">Links Úteis & Manuais</div>
            <BibliotecaLinksAdmin />
          </section>
        </div>
      )}
      {aba === 'banners' && <BannersAdmin />}
      {aba === 'plantao' && <PlantaoAdmin />}
      {aba === 'fotografo' && <FotografoAdmin />}
      {aba === 'datas' && <DatasComemorativasAdmin />}
      {aba === 'usuarios' && <UsuariosAdmin />}
    </div>
  )
}
