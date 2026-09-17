import BannersAdmin from '../components/settings/BannersAdmin'

export default function GerenciarBanners() {
  return (
    <div>
      <header className="page-header">
        <div>
          <div className="page-eyebrow">Conteúdo</div>
          <div className="page-title">Banners</div>
          <div className="page-sub">Imagens exibidas na Home e na TV Display.</div>
        </div>
      </header>

      <BannersAdmin />
    </div>
  )
}
