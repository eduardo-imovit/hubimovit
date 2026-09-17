import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const BUCKET = 'banners'

export function useBanners() {
  const [banners, setBanners] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)

  const recarregar = useCallback(async () => {
    setCarregando(true)
    const { data, error } = await supabase
      .from('home_banners')
      .select('*')
      .eq('ativo', true)
      .order('ordem', { ascending: true })
    if (error) setErro(error.message)
    else setBanners(data ?? [])
    setCarregando(false)
  }, [])

  useEffect(() => {
    recarregar()
  }, [recarregar])

  async function enviarImagem(arquivo) {
    const extensao = arquivo.name.split('.').pop()
    const path = `${crypto.randomUUID()}.${extensao}`
    const { error } = await supabase.storage.from(BUCKET).upload(path, arquivo)
    if (error) throw error
    return path
  }

  async function criarBanner(banner) {
    const { error } = await supabase.from('home_banners').insert(banner)
    if (error) throw error
    await recarregar()
  }

  async function atualizarBanner(id, banner) {
    const { error } = await supabase.from('home_banners').update(banner).eq('id', id)
    if (error) throw error
    await recarregar()
  }

  async function removerBanner(id, imagemPath) {
    const { error } = await supabase.from('home_banners').update({ ativo: false }).eq('id', id)
    if (error) throw error
    if (imagemPath) await supabase.storage.from(BUCKET).remove([imagemPath])
    await recarregar()
  }

  return { banners, carregando, erro, enviarImagem, criarBanner, atualizarBanner, removerBanner }
}

export function urlPublicaBanner(path) {
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}
