import { Link } from 'react-router-dom'
import { ButtonLink, Logo } from '../components/ui'

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <div className="border-b border-line-soft">
        <div className="mx-auto w-full max-w-6xl px-5 py-4 sm:px-8">
          <Link to="/" className="inline-flex w-fit rounded-sm">
            <Logo />
          </Link>
        </div>
      </div>

      <main className="mx-auto flex w-full max-w-6xl flex-1 items-center px-5 py-14 sm:px-8">
        <div className="w-full max-w-xl">
          <h1 className="text-h1 text-balance text-ink">Nothing at this address</h1>
          <p className="mt-3 max-w-[56ch] text-body text-ink-2">
            That page does not exist, or it has moved. Your workspace, opportunities and reports are untouched.
          </p>
          <div className="mt-7 flex flex-wrap gap-2">
            <ButtonLink to="/app">Open the dashboard</ButtonLink>
            <ButtonLink to="/" variant="secondary">
              Back to Headroom
            </ButtonLink>
          </div>
          <p className="tnum mt-9 border-t border-line-soft pt-5 text-caption text-ink-3">Error 404</p>
        </div>
      </main>
    </div>
  )
}
