// leaflet.heat é um plugin UMD que procura `window.L`; este módulo é importado antes dele.
import L from 'leaflet'

window.L = L

export default L
