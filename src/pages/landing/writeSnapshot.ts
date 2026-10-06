// Regenerates demoSnapshot.ts from the demo dataset and the real engine.
// Usage: npx tsx src/pages/landing/writeSnapshot.ts
import { writeFileSync } from 'node:fs'
import { buildLandingSnapshot, renderSnapshotModule } from './buildSnapshot'

const target = new URL('./demoSnapshot.ts', import.meta.url)
writeFileSync(target, renderSnapshotModule(buildLandingSnapshot()))
console.log(`wrote ${target.pathname}`)
