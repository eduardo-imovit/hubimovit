import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useSession } from '../hooks/useSession'
import { usePerfil } from '../hooks/usePerfil'
import { useAvisos } from '../hooks/useAvisos'
import { useBibliotecaLinks } from '../hooks/useBibliotecaLinks'
import { usePendenciasHome } from '../hooks/usePendenciasHome'
import { formatarDataLonga, saudacao } from '../lib/dateUtils'
import { isoLocal } from '../lib/paineis'
import { ATALHOS, NIVEIS_PREVIA, paginasDoNivel } from '../lib/homeNiveis'
import { AgendaSemana, Atalhos, AvisosResumo, BuscaHome, HojeNoEscritorio, LinksUteis, Pendencias } from '../components/home/BlocosHome'

/**
 * Home: a porta de entrada de todo mundo (docs/01-prd.md §5.4). Responde "o que
 * eu faço agora?": busca, atalhos e pendências do nível de acesso, o plantão e
 * os compromissos de hoje, avisos e links. Nada aqui é só para ler.
 */
export default function Home() {
  const { session } = useSession()
  const { perfil, carregando: carregandoPerfil } = usePerfil()
  const [previa, setPrevia] = useState(null)
  const { avisos } = useAvisos()
  const { links } = useBibliotecaLinks()

  const papelReal = perfil?.role
  const papel = papelReal === 'gestao' && previa ? previa : papelReal
  const { itens: pendencias, erro: erroPendencias } = usePendenciasHome(papel, perfil)

  // Conta de acesso da TV: nunca fica na Home, vai direto pra tela de exibição.
  if (papelReal === 'tvaccess') return <Navigate to="/tv-display" replace />

  // Sessão autenticada sem linha em `perfis` = cliente externo da esteira de
  // locação (locatário/proprietário, logado via magic link) -- nunca deve
  // cair na Home interna, mesmo que a rota "/" não exija nenhum papel.
  if (session && !carregandoPerfil && !perfil) return <Navigate to="/portal" replace />

  const nome = perfil?.nome?.split(' ')[0] || session?.user?.email?.split('@')[0] || ''
  const primeiroNome = nome.charAt(0).toUpperCase() + nome.slice(1)
  const hoje = isoLocal()

  return (
    <div className="home">
      <header className="home-cabeca">
        <div>
          <div className="page-title">{saudacao()}, <em>{primeiroNome}.</em></div>
          <div className="page-sub">{formatarDataLonga()}</div>
        </div>
        {papelReal === 'gestao' && (
          <label className="home-previa">
            <span>Ver a Home como</span>
            <select value={papel} onChange={(e) => setPrevia(e.target.value === 'gestao' ? null : e.target.value)}>
              {NIVEIS_PREVIA.map((n) => (
                <option key={n.valor} value={n.valor}>{n.label}</option>
              ))}
            </select>
          </label>
        )}
      </header>

      {previa && (
        <div className="home-aviso-previa" role="status">
          Prévia: é assim que a Home aparece para o nível <strong>{NIVEIS_PREVIA.find((n) => n.valor === previa)?.label}</strong>. Os números seguem o que a sua conta pode ver.
        </div>
      )}

      <BuscaHome paginas={paginasDoNivel(papel)} links={links} />

      <Atalhos itens={ATALHOS[papel] ?? ATALHOS.user} />

      <div className="home-duas">
        <section className="home-bloco" aria-labelledby="home-para-voce">
          <h2 id="home-para-voce" className="home-bloco-titulo">Para você hoje</h2>
          <Pendencias itens={pendencias} erro={erroPendencias} />
        </section>
        <section className="home-bloco" aria-labelledby="home-escritorio">
          <h2 id="home-escritorio" className="home-bloco-titulo">Plantão</h2>
          <HojeNoEscritorio hoje={hoje} />
        </section>
      </div>

      <section className="home-bloco home-bloco--largo" aria-labelledby="home-agenda">
        <h2 id="home-agenda" className="home-bloco-titulo">Agenda da semana</h2>
        <AgendaSemana hoje={hoje} />
      </section>

      <div className="home-duas">
        <section className="home-bloco" aria-labelledby="home-avisos">
          <h2 id="home-avisos" className="home-bloco-titulo">Avisos</h2>
          <AvisosResumo avisos={avisos} />
        </section>
        <section className="home-bloco" id="links" aria-labelledby="home-links">
          <h2 id="home-links" className="home-bloco-titulo">Links úteis e manuais</h2>
          <LinksUteis links={links} />
        </section>
      </div>

    </div>
  )
}
