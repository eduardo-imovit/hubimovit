import Navbar from './Navbar'

export default function AppShell({ children, navbar, semPadding, semScroll }) {
  return (
    <div className={semScroll ? 'app-shell app-shell--sem-scroll' : 'app-shell'}>
      {navbar ?? <Navbar />}
      <main className={semPadding ? 'app-main app-main--sem-padding' : 'app-main'}>{children}</main>
    </div>
  )
}
