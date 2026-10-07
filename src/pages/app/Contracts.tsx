import { Card, EmptyState, PageHeader } from '../../components/ui'

// Placeholder route so the nav and redirects can land here; the full page
// (each client's agreement against delivery) replaces this.
export default function Contracts() {
  return (
    <>
      <PageHeader title="Contracts" />
      <Card>
        <EmptyState title="Contracts" body="Each client's agreement against what you actually deliver." />
      </Card>
    </>
  )
}
