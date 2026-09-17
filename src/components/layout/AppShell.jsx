import Sidebar from './Sidebar'

export default function AppShell({ children, navbar }) {
  return (
    <div className="app-shell">
      {navbar ?? <Sidebar />}
      <main className="app-main">{children}</main>
    </div>
  )
}
