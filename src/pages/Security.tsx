import { Link } from 'react-router-dom'
import { ButtonLink, Logo } from '../components/ui'

// Placeholder route for the security page; its content replaces this. Only
// sentences the code can back go here, so it starts with the heading alone.
export default function Security() {
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <div className="border-b border-line-soft">
        <div className="mx-auto w-full max-w-6xl px-5 py-4 sm:px-8">
          <Link to="/" className="inline-flex w-fit rounded-sm">
            <Logo />
          </Link>
        </div>
      </div>

      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-14 sm:px-8">
        <h1 className="text-h1 text-balance text-ink">How Headroom handles your data</h1>
        <div className="mt-7">
          <ButtonLink to="/" variant="secondary">
            Back to Headroom
          </ButtonLink>
        </div>
      </main>
    </div>
  )
}
