import { ButtonLink, Logo } from '../components/ui'

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <Logo />
      <h1 className="text-xl font-semibold">Page not found</h1>
      <p className="text-sm text-zinc-500">The page you were looking for doesn't exist.</p>
      <ButtonLink to="/app" variant="secondary">Go to dashboard</ButtonLink>
    </div>
  )
}
