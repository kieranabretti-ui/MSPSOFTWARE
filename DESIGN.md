---
name: Headroom
description: Find the work your MSP is doing for free.
colors:
  ink-canvas: "#0a0b0d"
  graphite-sunken: "#0d0e10"
  graphite-surface: "#111316"
  graphite-hover: "#15181b"
  graphite-raised: "#181b1f"
  hairline: "#262a30"
  hairline-soft: "#1b1e22"
  hairline-strong: "#363b43"
  bone: "#edeef0"
  bone-secondary: "#a9afb8"
  bone-muted: "#7f8690"
  bone-faint: "#5b616a"
  recovery-lime: "#c4f25b"
  recovery-lime-hover: "#d4f87f"
  recovery-lime-deep: "#4d6b00"
  signal-success: "#4cd18f"
  signal-warning: "#f2b84b"
  signal-danger: "#f2735f"
  signal-info: "#74a9f6"
  viz-series: "#3d434c"
  viz-series-strong: "#6a717b"
  viz-grid: "#1c1f24"
typography:
  display:
    fontFamily: "Host Grotesk Variable, Host Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2.75rem, 1.15rem + 5.4vw, 5rem)"
    fontWeight: 600
    lineHeight: 0.98
    letterSpacing: "-0.04em"
  data-xl:
    fontFamily: "Host Grotesk Variable, Host Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(3rem, 7vw, 4.5rem)"
    fontWeight: 600
    lineHeight: 0.95
    letterSpacing: "-0.045em"
    fontFeature: "\"tnum\" 1"
  data-lg:
    fontFamily: "Host Grotesk Variable, Host Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-0.03em"
    fontFeature: "\"tnum\" 1"
  data-md:
    fontFamily: "Host Grotesk Variable, Host Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.015em"
    fontFeature: "\"tnum\" 1"
  headline:
    fontFamily: "Host Grotesk Variable, Host Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Host Grotesk Variable, Host Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.015em"
  title-sm:
    fontFamily: "Host Grotesk Variable, Host Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "-0.005em"
  lead:
    fontFamily: "Host Grotesk Variable, Host Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 400
    lineHeight: 1.55
  body:
    fontFamily: "Host Grotesk Variable, Host Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.55
  small:
    fontFamily: "Host Grotesk Variable, Host Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.5
  caption:
    fontFamily: "Host Grotesk Variable, Host Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.4
  column-label:
    fontFamily: "Host Grotesk Variable, Host Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "0.09em"
rounded:
  xs: "4px"
  sm: "6px"
  md: "8px"
  lg: "12px"
  xl: "16px"
spacing:
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "5": "20px"
  "6": "24px"
  "7": "28px"
  "10": "40px"
components:
  button-primary:
    backgroundColor: "{colors.bone}"
    textColor: "{colors.ink-canvas}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "36px"
  button-primary-hover:
    backgroundColor: "#ffffff"
  button-accent:
    backgroundColor: "{colors.recovery-lime}"
    textColor: "{colors.ink-canvas}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "36px"
  button-accent-hover:
    backgroundColor: "{colors.recovery-lime-hover}"
  button-secondary:
    backgroundColor: "{colors.graphite-raised}"
    textColor: "{colors.bone}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "36px"
  button-secondary-hover:
    backgroundColor: "{colors.graphite-hover}"
  button-ghost:
    textColor: "{colors.bone-secondary}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "36px"
  button-ghost-hover:
    backgroundColor: "{colors.graphite-raised}"
    textColor: "{colors.bone}"
  input:
    backgroundColor: "{colors.graphite-sunken}"
    textColor: "{colors.bone}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "36px"
  card:
    backgroundColor: "{colors.graphite-surface}"
    rounded: "{rounded.lg}"
  modal:
    backgroundColor: "{colors.graphite-surface}"
    rounded: "{rounded.xl}"
  badge:
    backgroundColor: "{colors.graphite-raised}"
    textColor: "{colors.bone-secondary}"
    rounded: "{rounded.xs}"
    padding: "0 6px"
    height: "20px"
  nav-item:
    textColor: "{colors.bone-secondary}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "6px 10px"
  nav-item-active:
    backgroundColor: "{colors.graphite-raised}"
    textColor: "{colors.bone}"
---

# Design System: Headroom

Brand truth (positioning, voice, logo, icons, paper/PDF values, accessibility floor) lives in [brand/brand-guidelines.md](brand/brand-guidelines.md). Token source of truth is [brand/brand-tokens.css](brand/brand-tokens.css), mapped to utilities in [src/styles/theme.css](src/styles/theme.css) and mirrored for charts and PDF in [src/brand/tokens.ts](src/brand/tokens.ts) (a test keeps them in sync). This file records the visual system as the build ships it; where it and the guidelines disagree, see "Recorded divergence" at the end.

## Overview

**Creative North Star: "The Ledger of Found Money"**

Headroom is a dark financial ledger. An ink canvas, graphite surfaces stepped in very small lightness increments, hairline borders and bone type carry everything; the figures are the brightest thing on screen. One electric lime is reserved for money found or recoverable and the single action on a screen that leads to money. Problems are stated calmly in neutrals, with danger confined to small marks, so the product reads as confident about fixes rather than alarmed about issues.

Density is that of a serious operations tool: 14px body, 13px table cells, tabular figures everywhere a number can change, rows separated by hairlines rather than zebra fills or pills. The marketing site is the same world at a larger scale: display type up to 80px, the real components showing real demo figures, sections laid out as statements of account rather than feature cards.

The system refuses the grey admin panel with a coloured pill on every row, and the centred headline over a gradient followed by three feature cards.

**Key Characteristics:**
- Ink canvas, graphite steps and hairlines; depth without shadows on anything that sits on the page.
- One family (Host Grotesk), semibold for headings and figures, tabular numerals throughout.
- Lime means money. Everything else is neutral.
- The GapBar (billed in neutral, unbilled gap in lime) is the signature form, repeated from hero to client row.
- Severity and health are quiet marks plus words, never pills.

## Colors

A near-monochrome dark scale with one energetic accent and four restrained signal hues.

### Primary
- **Recovery Lime** (`recovery-lime`): the unbilled gap in a GapBar and its figure, recurring or recovered money figures ("£356 a month", resolved value), the one money action per screen, positive trends on money found, LeakBar fills in client rows, the matched phrase in evidence (soft fill plus lime underline), the active nav icon, the page spinner, and system accents (focus ring, caret, selection, checkbox). Hover lifts to **Lime Hover** (`recovery-lime-hover`). Text on lime is ink.
- **Deep Lime** (`recovery-lime-deep`): the accent on paper, where lime is unreadable. Print and PDF only.

### Neutral
- **Ink Canvas** (`ink-canvas`): the page, the sidebar, and the text on bone and lime buttons.
- **Graphite Sunken** (`graphite-sunken`): inputs and the demo/local-mode banner.
- **Graphite Surface** (`graphite-surface`): cards, tables, modals.
- **Graphite Hover** (`graphite-hover`) and **Graphite Raised** (`graphite-raised`): row hover, secondary buttons, active nav item, neutral badges, tooltips.
- **Hairline** (`hairline`), **Soft Hairline** (`hairline-soft`), **Strong Hairline** (`hairline-strong`): card borders; internal dividers and section rules; input borders and empty bar tracks.
- **Bone** (`bone`), **Bone Secondary** (`bone-secondary`), **Bone Muted** (`bone-muted`), **Bone Faint** (`bone-faint`): primary text and figures; secondary text and row labels; captions, subtitles, column labels; icons and disabled only, never body text.

### Signal
- **Danger Coral** (`signal-danger`): the Critical severity bars, the At-risk health dot, form errors, destructive confirmation (soft fill plus hairline, never a solid red block).
- **Success Green**, **Warning Amber**, **Info Blue** (`signal-success`, `signal-warning`, `signal-info`): tone badges, callouts and action-status dots only. Each has a 12% soft fill and a 30% line variant in the token file. Always paired with a word or icon.

### Data
- **Series** and **Series Strong** (`viz-series`, `viz-series-strong`): bars carry data in neutral; the latest month or the share bar fill is a step brighter. **Grid** (`viz-grid`) is recessive. Categorical colours (max four, then "Other") are in the token file and used only where categories must be told apart.

### Named Rules
**The Lime Means Money Rule.** Lime appears only on money found or recoverable, the one money action per screen, and the system accents listed above. A lime heading, lime body text, a lime card border or lime on a download button is a bug. The full allowed inventory is §8.4 of the brand guidelines.

**The One Lime Button Rule.** At most one accent button per viewport. The landing top bar's "Find My Lost Revenue" is bone primary so the hero's lime button stays the only one.

**The Calm Problems Rule.** Danger is a mark, not a field: three small bars, a 6px dot, a caption-size error. No row, card or banner is filled with a signal colour at full strength.

## Typography

**Display Font:** Host Grotesk Variable (with ui-sans-serif, system-ui)
**Body Font:** Host Grotesk Variable (same family)

**Character:** One grotesk doing every job; hierarchy comes from size, weight 600 against 400/500, and tight negative tracking on large sizes. Figures are tabular so columns of money align.

### Hierarchy
- **Display** (600, fluid 44 to 80px, 0.98): the landing hero question; section titles step down to a fluid 30 to 48px at 1.06 and -0.032em.
- **Data XL** (600, fluid 48 to 72px, 0.95, tabular): the one headline figure per screen (£4,281).
- **Data LG / Data MD** (600, 28px / 18px, tabular): KPI figures and inline figures.
- **Headline** (600, 28px, 1.15): page titles via PageHeader.
- **Title** (600, 20px, 1.3): section headings inside a page. **Title SM** (600, 15px, 1.4): card and modal titles, empty-state titles.
- **Lead** (400, 18px, 1.55): marketing body, capped at 56 to 68ch.
- **Body** (400, 14px, 1.55): app body. **Small** (13px, 1.5): table cells, labels, secondary text. **Caption** (12px, 1.4): helper text, meta lines, disclaimers.
- **Column Label** (600, 11px, +0.09em, uppercase, bone-muted): table and ledger column headers only.

### Named Rules
**The Tabular Figures Rule.** Every number that can change is set with tabular numerals. Money is semibold and bone, or lime when it is money found.

**The Column Label Rule.** The 11px uppercase label exists to head a column of a table or ledger. It is never placed above a heading as a kicker or eyebrow.

## Layout

The app is a fixed 240px left rail on the canvas (hairline right edge) with content in a centred column capped at 1200px, padded 16px on phones and 32px from 640px, 28 to 40px top. Below 1024px the rail becomes a sticky 56px top bar with a blurred translucent canvas and a slide-in drawer. Page structure is fixed by PageHeader (title, subtitle, actions on the right, 28px below), then panels in a single column or a two-up grid that collapses to one column.

The Overview reads in one fixed order: the money hero, then critical findings beside client risk, then actions, then supporting data. Nothing is inserted above the money.

Spacing runs on a 4px base. Card internals are 20px horizontal, 12 to 16px vertical per row; card headers 20px by 16px; gaps between related controls 8px, between panels 16 to 24px. Rows are divided by hairlines, not gaps.

The landing page uses a 1240px wrap (16/24/32px gutters), sections divided by a soft hairline with 80 to 112px vertical padding, and a 12-column intro grid where the heading spans seven columns and the lead sits at columns 9 to 12.

## Elevation & Depth

Depth is tonal: canvas, sunken, surface, hover, raised, each a small lightness step, with a hairline at the edge. Cards, tables and panels carry no shadow. Shadows exist only for layers that float above the page, and each pairs with a faint inset top highlight so it reads on dark.

### Shadow Vocabulary
- **Float** (`0 1px 0 rgb(255 255 255 / 0.04) inset, 0 12px 32px -12px rgb(0 0 0 / 0.75)`): chart tooltips.
- **Overlay** (`0 1px 0 rgb(255 255 255 / 0.05) inset, 0 32px 80px -24px rgb(0 0 0 / 0.85), 0 0 0 1px rgb(255 255 255 / 0.04)`): modals, the mobile nav drawer, toasts, the busy panel.
- The overlay scrim is ink at 72% with a 3px backdrop blur.

### Named Rules
**The Hairline, Not Shadow Rule.** Anything that sits on the page separates by a surface step and a hairline. A shadow on a card is a bug; only things that float get one.

## Shapes

Controls are crisp and containers are soft: badges 4px, icon buttons and small controls 6px, buttons, inputs and nav items 8px, cards and tables 12px, modals and the hero panel 16px. On a phone the modal becomes a bottom sheet with only its top corners rounded. Bars in charts and meters are fully rounded or 3 to 4px at their ends. Every container edge is a 1px hairline; ledger totals on the landing page sit under a double rule.

## Components

### Buttons
Quiet, solid and decisive.
- **Shape:** gently rounded (8px); heights 32 / 36 / 44px for sm / md / lg, 500 weight.
- **Primary:** bone fill, ink text, hover to white. The default action.
- **Accent:** lime fill, ink text, hover to lime hover. One per screen, only for money (Review findings, Find My Lost Revenue, Upload your data, Create action, Run analysis).
- **Secondary:** raised graphite with a hairline; hover strengthens the hairline. **Ghost:** bone-secondary text until hovered. **Danger:** soft coral fill, coral text, coral hairline.
- **States:** 150ms colour transition; disabled at 45% opacity; loading adds a spinner and keeps the label. Focus is the global 2px lime outline at 2px offset.

### Chips / Badges
- **Style:** 20px tall, 11px medium text, 4px radius, inset 1px ring; neutral, accent, success, warning, danger and info tones on 10 to 12% soft fills. Used for states such as "Demo data", "Planned", "Confirmed", never one per table row as decoration.

### Cards / Containers
- **Corner Style:** 12px.
- **Background:** graphite surface on the ink canvas.
- **Shadow Strategy:** none (see Elevation & Depth).
- **Border:** 1px hairline; internal dividers in the soft hairline.
- **Internal Padding:** 20px horizontal; card header 20px by 16px with an h3 title and muted subtitle.

### Inputs / Fields
- **Style:** 36px tall, 8px radius, sunken fill, strong hairline, 12px horizontal padding, lime caret.
- **Focus:** border turns lime plus a 3px soft-lime ring.
- **Error / Disabled:** error replaces the hint in coral at caption size; disabled at 50% opacity. Labels are 13px medium bone-secondary, 6px above the control.

### Navigation
- **App rail:** 14px medium items, 8px radius, 6px by 10px padding, bone-secondary at rest. Active item takes the raised fill, bone text and a lime icon. Counts sit in a small hairline-filled tag. The workspace block sits at the foot above a soft hairline.
- **Landing top bar:** logo, section links, Sign in, and a bone primary CTA.

### Severity and Health
- **SeverityBadge:** a caption-size word beside three tiny ascending bars. Critical fills three bars in coral with bone text; High two bars in bone-secondary; Medium one bar in muted; Low none. No pill, no fill.
- **HealthDot:** a 6px mark plus the word. At risk is a coral dot; Watch a hollow muted ring; Healthy keeps an empty slot so labels align.
- **Confidence:** a 48px, 4px-tall neutral meter (brighter at 85% and above) plus the percentage.

### Empty States
Left-aligned in the ledger voice: a 15px title, one line of muted explanation (max 60ch), at most two actions. No icon tile.

### GapBar (signature)
What was billed and the gap that was not. A 14px bar: billed in the neutral series colour, a 3px gap, then the unbilled share in lime (minimum 1.5% so a small gap still reads), with a 1px bone-secondary tick crossing the junction. Beneath it, "Billed" and "Unbilled" captions with the unbilled figure in semibold lime and its percentage. Used in the Overview hero, client pages, the landing audit panel and the PDF.

### LeakBar
The signature at row scale: a 4px lime fill on a 1px strong-hairline track, ranked against the largest value in the list, beside the figure that carries the meaning.

### Charts
Monthly bars in the neutral series colour, the latest month one step brighter, 4px top corners, one axis, a recessive horizontal grid, lime only on the hovered bar. Share bars are a single neutral hue on a 6px soft track, sorted, each labelled with its figure. Every chart has a text alternative.

## Do's and Don'ts

### Do:
- **Do** keep lime to money found or recoverable, the one money action per screen, and the system accents (focus, caret, selection, spinner, active nav icon).
- **Do** set every changeable number in tabular figures, semibold, and give the screen's headline figure Data XL.
- **Do** separate surfaces with a lightness step and a 1px hairline; reserve shadows for tooltips, modals, drawers and toasts.
- **Do** show severity as a word plus bars and health as a word plus a small mark.
- **Do** reuse the GapBar or LeakBar wherever billed is compared with unbilled.
- **Do** build landing imagery from the real components and real demo figures, labelled as demo data.
- **Do** use the 11px uppercase label only as a table or ledger column header.

### Don't:
- **Don't** use lime for headings, body text, card borders, download buttons, or as a mood; don't put two lime buttons in one viewport.
- **Don't** put a coloured pill on every row, or fill a row, card or banner with a signal colour.
- **Don't** put a shadow on a card or table.
- **Don't** lay out a page as a centred headline over a gradient followed by three feature cards, or as a grid of same-size icon cards.
- **Don't** place an uppercase kicker or eyebrow above a heading.
- **Don't** use bone faint for body text.
- **Don't** introduce a second typeface or a gradient.

---

**Recorded divergence.** `--radius-2xl`, `--shadow-sm` and `--shadow-glow` are declared but unused and are not recorded as system tokens. Component transitions use 150ms rather than the 120ms / 200ms motion tokens (guidelines §21).
