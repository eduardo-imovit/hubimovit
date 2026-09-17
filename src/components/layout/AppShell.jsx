import Navbar from './Navbar'

export default function AppShell({ children, navbar }) {
  return (
    <div className="app-shell">
      {navbar ?? <Navbar />}
      <main className="app-main">{children}</main>
    </div>
  )
}
