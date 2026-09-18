import logoImovitLares from '../../assets/logo-imovit-lares-champagne.png'
import SpotifyCardTV from './SpotifyCardTV'

export default function NavbarTV() {
  return (
    <nav className="navbar-tv">
      <div className="navbar-tv-side">
        <span
          className="navbar-tv-logo"
          role="img"
          aria-label="Imovit — Lares com a sua alma."
          style={{ WebkitMaskImage: `url(${logoImovitLares})`, maskImage: `url(${logoImovitLares})` }}
        />
      </div>

      <div className="navbar-tv-center" />

      <div className="navbar-tv-side navbar-tv-side--end">
        <SpotifyCardTV />
      </div>
    </nav>
  )
}
