import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { color, paper, viz } from './tokens'

const css = readFileSync(new URL('../../brand/brand-tokens.css', import.meta.url), 'utf8')
const block = (selector: string) => {
  const start = css.indexOf(`${selector} {`)
  return css.slice(start, css.indexOf('\n}', start))
}
const read = (scope: string, name: string) => {
  const m = block(scope).match(new RegExp(`--${name}:\\s*([^;]+);`))
  if (!m) throw new Error(`--${name} missing from ${scope}`)
  return m[1].trim().toLowerCase()
}

describe('brand tokens', () => {
  it('match brand-tokens.css on the dark foundation', () => {
    const pairs: [string, string][] = [
      ['brand-primary', color.ink],
      ['brand-secondary', color.bone],
      ['brand-accent', color.accent],
      ['brand-accent-hover', color.accentHover],
      ['brand-accent-deep', color.accentDeep],
      ['brand-background', color.background],
      ['brand-surface', color.surface],
      ['brand-surface-raised', color.surfaceRaised],
      ['brand-border', color.border],
      ['brand-border-muted', color.borderMuted],
      ['brand-border-strong', color.borderStrong],
      ['brand-text', color.text],
      ['brand-text-secondary', color.textSecondary],
      ['brand-muted', color.muted],
      ['brand-faint', color.faint],
      ['brand-success', color.success],
      ['brand-warning', color.warning],
      ['brand-danger', color.danger],
      ['brand-info', color.info],
      ['viz-series', viz.series],
      ['viz-series-strong', viz.seriesStrong],
      ['viz-grid', viz.grid],
      ['viz-axis', viz.axis],
      ['viz-cat-1', viz.categorical[0]],
      ['viz-cat-2', viz.categorical[1]],
      ['viz-cat-3', viz.categorical[2]],
      ['viz-cat-4', viz.categorical[3]],
      ['viz-cat-other', viz.other],
      ['brand-mark', color.bone],
      ['brand-mark-accent', color.accent],
    ]
    for (const [name, value] of pairs) expect(read(':root', name), name).toBe(value)
  })

  it('match brand-tokens.css on paper', () => {
    const pairs: [string, string][] = [
      ['brand-background', paper.background],
      ['brand-surface-sunken', paper.surfaceSunken],
      ['brand-surface-raised', paper.surfaceRaised],
      ['brand-border', paper.border],
      ['brand-border-muted', paper.borderMuted],
      ['brand-text', paper.text],
      ['brand-text-secondary', paper.textSecondary],
      ['brand-muted', paper.muted],
      ['brand-success', paper.success],
      ['brand-warning', paper.warning],
      ['brand-danger', paper.danger],
      ['brand-info', paper.info],
      ['brand-accent', paper.accent],
      ['brand-border-strong', paper.borderStrong],
      ['brand-faint', paper.faint],
      ['brand-mark', paper.mark],
      ['brand-mark-accent', paper.markAccent],
    ]
    for (const [name, value] of pairs) expect(read('[data-surface="paper"]', name), name).toBe(value)
  })
})
