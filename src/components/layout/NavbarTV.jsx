import logoImovitLares from '../../assets/logo-imovit-lares-champagne.png'
import WeatherCardTV from './WeatherCardTV'
import DateTimeCardTV from './DateTimeCardTV'
import SpotifyCardTV from './SpotifyCardTV'

export default function NavbarTV() {
  return (
    <nav className="navbar-tv">
      <div className="navbar-tv-side">
        <SpotifyCardTV />
      </div>

      <div className="navbar-tv-center">
        <img src={logoImovitLares} alt="Imovit — Lares com a sua alma." className="navbar-tv-logo" />
      </div>

      <div className="navbar-tv-side navbar-tv-side--end navbar-tv-cards">
        <DateTimeCardTV />
        <WeatherCardTV />
      </div>
    </nav>
  )
}
