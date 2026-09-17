import Navbar from './Navbar'

export default function AppShell({ children, navbar, semPadding }) {
  return (
    <div className="app-shell">
      {navbar ?? <Navbar />}
      <main className={semPadding ? 'app-main app-main--sem-padding' : 'app-main'}>{children}</main>
    </div>
  )
}
