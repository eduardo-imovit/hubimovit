import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { usePerfil } from './usePerfil'

/**
 * Quem o usuário é no CRM, quando o nível é Corretor (ou a Gestão está em
 * "Ver como" um corretor): nome e código, pelo e-mail do login
 * (perfis.email = colaboradores_raw.email_oficial). Para os outros níveis,
 * `corretor` fica null e as páginas mostram tudo o que a conta pode ver.
 */
export function useMeuCorretor() {
  const { perfil, carregando: carregandoPerfil } = usePerfil()
  const ehCorretor = perfil?.role === 'corretor'
  const email = ehCorretor ? perfil.email : null
  const [estado, setEstado] = useState({ email: null, corretor: null })

  useEffect(() => {
    if (!email) return undefined
    let ativo = true
    supabase
      .from('colaboradores_raw')
      .select('id_corretor_crm, nome_completo')
      .ilike('email_oficial', email)
      .limit(1)
      .then(({ data }) => {
        if (!ativo) return
        const c = data?.[0]
        setEstado({ email, corretor: c ? { nome: c.nome_completo, codigo: c.id_corretor_crm } : null })
      })
    return () => { ativo = false }
  }, [email])

  return {
    ehCorretor,
    corretor: ehCorretor && estado.email === email ? estado.corretor : null,
    carregando: carregandoPerfil || (ehCorretor && estado.email !== email),
  }
}
