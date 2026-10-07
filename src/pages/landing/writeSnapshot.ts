// Regenerates demoSnapshot.ts from the demo dataset and the real engine.
// Usage: npx tsx src/pages/landing/writeSnapshot.ts
// The builder is loaded through Vite's module runner, so shared modules that
// read import.meta.env (lib/format, via lib/calculation) see the same values
// they do in the app and in the tests.
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { runnerImport } from 'vite'

type Builder = typeof import('./buildSnapshot')

const builder = fileURLToPath(new URL('./buildSnapshot.ts', import.meta.url))
const { module } = await runnerImport<Builder>(builder, { configFile: false, logLevel: 'error' })
const target = new URL('./demoSnapshot.ts', import.meta.url)
writeFileSync(target, module.renderSnapshotModule(module.buildLandingSnapshot()))
console.log(`wrote ${target.pathname}`)
