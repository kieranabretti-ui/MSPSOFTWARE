// Generates the demo MSP ("Northlight IT") as raw rows in the same shape a
// user would upload, so loading the demo exercises the real import pipeline.
//
// Most tickets are ordinary, covered work. A small, deliberate set of records
// carries the leakage the engine should find. The totals are tuned so the
// default settings produce £4,281 identified, £356/month recurring.

export type RawRow = Record<string, string>

export interface DemoRaw {
  clients: RawRow[]
  tickets: RawRow[]
  time_entries: RawRow[]
  assets: RawRow[]
  billing: RawRow[]
  contracts: { client: string; title: string; text: string }[]
}

function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const MONTHS = ['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09']
const TECHS = ['James Smith', 'Priya Patel', 'Tom Walker', 'Sophie Clarke', 'Daniel Hughes']

interface ClientSpec {
  name: string
  prefix: string
  pkg: string
  mrr: number
  users: number // contracted
  devices: number // contracted
  included?: number
  software: number
  hours: number[] // per month, Apr..Sep (hours; fractional ok, converted to whole minutes)
  extraUsers?: { preWindow: number; dated: string[] }
  extraDevices?: { preWindow: number; dated: string[] }
  devicePrice?: number
  license?: { name: string; price: number; billedShort?: { added: string } }
  leaver?: boolean
  clauses: string[]
  start: string
  end: string
}

const LIC_BP = { name: 'Microsoft 365 Business Premium', price: 18 }

const CLIENTS: ClientSpec[] = [
  { name: 'ABC Ltd', prefix: 'ABC', pkg: 'Business Pro', mrr: 1850, users: 35, devices: 42, software: 420, hours: [22, 24, 26, 27, 28, 28.6], extraUsers: { preWindow: 2, dated: ['2026-07-06', '2026-07-20'] }, license: LIC_BP, clauses: [], start: '2024-02-01', end: '2027-01-31' },
  { name: 'Bramley Homes', prefix: 'BRM', pkg: 'Business Essentials', mrr: 1150, users: 18, devices: 22, software: 160, hours: [11, 12, 13, 12, 12, 13], license: LIC_BP, clauses: ['devices', 'hardware'], start: '2025-05-01', end: '2027-04-30' },
  { name: 'Castle Accountancy', prefix: 'CAS', pkg: 'Business Pro', mrr: 1500, users: 24, devices: 26, software: 150, hours: [24, 25, 26.4, 27, 28, 28], license: LIC_BP, clauses: ['thirdparty'], start: '2023-09-01', end: '2027-08-31' },
  { name: 'Harbour Physio', prefix: 'HBP', pkg: 'Support Block 10', mrr: 790, users: 12, devices: 14, included: 10, software: 110, hours: [9, 8.5, 10, 9.5, 13, 775 / 60], license: LIC_BP, clauses: ['included'], start: '2025-01-01', end: '2026-12-31' },
  { name: 'Elmfield Dental', prefix: 'ELM', pkg: 'Business Essentials', mrr: 1400, users: 20, devices: 28, software: 180, hours: [13, 14, 15, 14, 14, 15], license: LIC_BP, clauses: [], start: '2024-06-01', end: '2027-05-31' },
  { name: 'Smith & Co', prefix: 'SMC', pkg: 'Business Essentials', mrr: 950, users: 21, devices: 23, software: 150, hours: [7, 8, 8, 9, 8, 8], license: { name: 'Microsoft 365 Business Standard', price: 11 }, clauses: ['onboarding'], start: '2022-11-01', end: '2026-10-31' },
  { name: 'Dorset Legal', prefix: 'DSL', pkg: 'Business Pro', mrr: 2400, users: 45, devices: 52, software: 380, hours: [17, 18, 19, 20, 19, 19], extraDevices: { preWindow: 4, dated: [] }, devicePrice: 7, license: LIC_BP, clauses: ['projects'], start: '2024-03-01', end: '2027-02-28' },
  { name: 'Kingsbridge Architects', prefix: 'KGA', pkg: 'Business Pro', mrr: 1650, users: 16, devices: 20, software: 210, hours: [14, 15, 16, 15, 15, 16], license: LIC_BP, clauses: ['thirdparty'], start: '2025-02-01', end: '2027-01-31' },
  { name: 'Meridian Logistics', prefix: 'MDL', pkg: 'Business Pro', mrr: 2100, users: 30, devices: 38, software: 300, hours: [17, 18, 18, 19, 18, 18], extraDevices: { preWindow: 5, dated: [] }, license: LIC_BP, clauses: [], start: '2023-04-01', end: '2027-03-31' },
  { name: 'Northgate Veterinary', prefix: 'NGV', pkg: 'Business Essentials', mrr: 1250, users: 22, devices: 26, software: 200, hours: [10, 11, 11, 12, 11, 11], license: { name: 'Microsoft 365 Business Standard', price: 15, billedShort: { added: '2026-07-14' } }, leaver: true, clauses: [], start: '2024-10-01', end: '2027-09-30' },
  { name: 'Pennine Engineering', prefix: 'PEN', pkg: 'Business Pro', mrr: 1700, users: 28, devices: 34, software: 250, hours: [15, 16, 16, 17, 16, 16], extraDevices: { preWindow: 0, dated: ['2026-05-11', '2026-07-02'] }, license: LIC_BP, clauses: ['onsite'], start: '2024-01-01', end: '2026-12-31' },
  { name: 'Riverside Care Group', prefix: 'RCG', pkg: 'Business Pro', mrr: 2600, users: 40, devices: 48, software: 420, hours: [21, 22, 22, 23, 22, 22], extraUsers: { preWindow: 2, dated: ['2026-07-15'] }, license: LIC_BP, clauses: [], start: '2023-07-01', end: '2027-06-30' },
  { name: 'Sterling Wealth Partners', prefix: 'SWP', pkg: 'Premium', mrr: 2950, users: 14, devices: 18, software: 260, hours: [13, 14, 14, 15, 14, 14], license: LIC_BP, clauses: ['onboarding', 'projectsIncluded'], start: '2022-05-01', end: '2027-04-30' },
  { name: 'Thames Valley Recruitment', prefix: 'TVR', pkg: 'Business Essentials', mrr: 980, users: 19, devices: 21, software: 170, hours: [9, 10, 10, 11, 10, 10], extraUsers: { preWindow: 0, dated: ['2026-07-01'] }, license: LIC_BP, clauses: [], start: '2025-03-01', end: '2027-02-28' },
  { name: 'Willow & Hart Interiors', prefix: 'WHI', pkg: 'Business Essentials', mrr: 600, users: 8, devices: 9, software: 60, hours: [9, 10, 11, 11, 687 / 60, 11], license: LIC_BP, clauses: ['devices'], start: '2025-08-01', end: '2027-07-31' },
]

interface ProblemTicket {
  client: string
  month: string
  day?: number
  time?: string
  subject: string
  description: string
  minutes: number
  tech?: string
  ticketBillable?: boolean // true + non-billable time = billing mismatch
  id?: string
}

// Intentional leakage. Values at £60/h: one minute = £1 (after-hours ×1.5).
const PROBLEMS: ProblemTicket[] = [
  // Out of scope (12)
  { client: 'Bramley Homes', month: '2026-09', day: 15, time: '10:20', subject: "Set up employee's personal MacBook", description: "Sales negotiator asked us to configure her personal MacBook with Outlook, Teams and the shared drive so she can work from it. Installed Company Portal, configured mail and OneDrive, mapped drives.", minutes: 80, tech: 'James Smith', id: '18492' },
  { client: 'Bramley Homes', month: '2026-08', subject: "Replace cracked screen on director's laptop", description: 'Director dropped laptop. Sourced replacement panel, fitted cracked screen replacement and tested display.', minutes: 95 },
  { client: 'Bramley Homes', month: '2026-06', subject: "Connect MD's personal iPad to company email", description: 'MD wants work email on his personal iPad. Set up Outlook app and MFA.', minutes: 45 },
  { client: 'Kingsbridge Architects', month: '2026-07', subject: 'AutoCAD licence server not starting after vendor update', description: 'Network licence manager failing after vendor update. Spent time with Autodesk support, reinstalled FlexLM service.', minutes: 110 },
  { client: 'Kingsbridge Architects', month: '2026-09', subject: 'Revit crashing when opening central model', description: 'Revit 2025 crashing on two workstations when opening the central model. Cleared local cache, repaired install, liaised with vendor.', minutes: 150 },
  { client: 'Pennine Engineering', month: '2026-05', subject: 'Engineer to attend site: server room UPS alarm', description: 'UPS alarming in server room. Engineer attended site, replaced battery module and tested failover.', minutes: 125 },
  { client: 'Pennine Engineering', month: '2026-08', subject: 'Site visit to patch desks in workshop office', description: 'Site visit to patch six desks in the workshop office and test ports.', minutes: 120 },
  { client: 'Meridian Logistics', month: '2026-09', day: 9, time: '21:40', subject: 'Out of hours: warehouse scanner system down', description: 'Night shift could not scan. Remote session to restart handheld scanner service and print server.', minutes: 100 },
  { client: 'Meridian Logistics', month: '2026-07', day: 18, time: '10:05', subject: 'Saturday callout for email outage at depot', description: 'Depot reported no email on Saturday morning. Resolved connector issue.', minutes: 60 },
  { client: 'Dorset Legal', month: '2026-06', subject: 'Migrate case files to SharePoint', description: 'Migrate the archived case files share to the new SharePoint document library and set permissions.', minutes: 140 },
  { client: 'Castle Accountancy', month: '2026-08', subject: "Sage 50 accounts won't open after update", description: 'Sage 50 data path broken after update. Repaired install and re-pointed company data.', minutes: 75 },
  { client: 'Willow & Hart Interiors', month: '2026-09', subject: "Fix owner's son's laptop with virus", description: "Owner asked us to look at her son's laptop. Removed adware and reset browser.", minutes: 60 },
  // Unbilled (17)
  { client: 'Elmfield Dental', month: '2026-04', subject: 'New starter: dental nurse accounts and email', description: 'Created Microsoft 365 account, added to groups, set up practice software login.', minutes: 60 },
  { client: 'Elmfield Dental', month: '2026-06', subject: 'Build new laptop for reception', description: 'Built and enrolled laptop, installed apps and printers.', minutes: 50 },
  { client: 'Elmfield Dental', month: '2026-07', subject: 'Dentally integration with X-ray software not syncing', description: 'Imaging bridge not passing patient records. Reinstalled bridge.', minutes: 45 },
  { client: 'Elmfield Dental', month: '2026-08', subject: 'Install additional surgery workstation', description: 'Quoted and approved. Installed workstation in surgery 4.', minutes: 70, ticketBillable: true },
  { client: 'Elmfield Dental', month: '2026-09', subject: 'Onboarding two associates', description: 'Onboarding two associate dentists: accounts, MFA, laptop handover.', minutes: 50 },
  { client: 'Thames Valley Recruitment', month: '2026-05', subject: 'New joiner: consultant laptop and accounts', description: 'Laptop handover and account creation for consultant.', minutes: 45 },
  { client: 'Thames Valley Recruitment', month: '2026-07', subject: 'New starter setup x2', description: 'Accounts, licences and CRM access for two consultants.', minutes: 40 },
  { client: 'Thames Valley Recruitment', month: '2026-09', subject: 'Reconfigure meeting room AV', description: 'Client approved chargeable work to rewire meeting room screen.', minutes: 30, ticketBillable: true },
  { client: 'Riverside Care Group', month: '2026-06', subject: 'Implementation of rota software', description: 'Deployed rota client to all care home PCs and configured SSO.', minutes: 75 },
  { client: 'Riverside Care Group', month: '2026-08', subject: 'Additional Wi-Fi access point installation', description: 'Chargeable install agreed with operations manager.', minutes: 40, ticketBillable: true },
  { client: 'Sterling Wealth Partners', month: '2026-05', subject: 'Move Bloomberg terminal to partner desk', description: 'Agreed as chargeable. Moved terminal and re-cabled.', minutes: 55, ticketBillable: true },
  { client: 'Smith & Co', month: '2026-07', subject: 'Printer lease swap', description: 'Chargeable per quote. Swapped leased MFD and set up scan to email.', minutes: 25, ticketBillable: true },
  { client: 'Northgate Veterinary', month: '2026-07', subject: 'Configure new PC for consulting room 3', description: 'Configured PC, practice system client and label printer.', minutes: 60 },
  { client: 'Harbour Physio', month: '2026-06', subject: 'New user onboarding for physiotherapist', description: 'Created account and set up booking system access.', minutes: 35 },
  { client: 'ABC Ltd', month: '2026-08', subject: 'Office move: patch network in new suite', description: 'Office move to second floor. Patched network and moved printers.', minutes: 80 },
  { client: 'Meridian Logistics', month: '2026-04', subject: 'Label printer replacement', description: 'Chargeable replacement approved by ops director. Installed and configured.', minutes: 35, ticketBillable: true },
  { client: 'Willow & Hart Interiors', month: '2026-05', subject: 'Set up new MacBook for designer', description: 'Enrolled in Intune, installed Adobe apps.', minutes: 45 },
]

const NORMAL: [string, string][] = [
  ['Outlook keeps asking for password', 'Cleared cached credentials and re-created profile.'],
  ['Password reset', 'User locked out after password expiry. Reset and confirmed sign-in.'],
  ['Printer showing offline', 'Restarted print spooler and re-added queue.'],
  ['Unable to access shared drive', 'Permissions corrected on folder.'],
  ['Teams calls dropping audio', 'Updated audio drivers and Teams client.'],
  ['VPN not connecting', 'Reissued VPN profile.'],
  ['MFA prompt not received', 'Re-registered authenticator app.'],
  ['Slow performance on laptop', 'Removed startup items, ran updates, checked disk health.'],
  ['OneDrive sync errors', 'Reset OneDrive client and resolved conflicting files.'],
  ['Mailbox nearly full', 'Enabled archive and applied retention policy.'],
  ['Phishing email reported', 'Investigated message, purged from mailboxes, blocked sender.'],
  ['Windows update failed', 'Cleared update cache and reinstalled cumulative update.'],
  ['Excel crashing when opening file', 'Disabled faulty add-in and repaired Office.'],
  ['Locked out of account', 'Unlocked account and checked sign-in logs.'],
  ['Wi-Fi dropping in meeting room', 'Adjusted access point channel.'],
  ['Shared calendar permissions', 'Granted editor access to team calendar.'],
  ['Scanner to email not working', 'Updated SMTP relay settings on scanner.'],
  ['Browser certificate warning', 'Updated root certificates via policy.'],
  ['Distribution list change request', 'Updated membership of distribution list.'],
  ['Docking station not detecting monitors', 'Updated dock firmware and display drivers.'],
  ['Backup job warning', 'Investigated failed job, re-ran successfully.'],
  ['Antivirus alert investigated', 'Alert reviewed, file quarantined, scan clean.'],
  ['Disk space low on file server', 'Cleared temp files and extended volume.'],
  ['Adobe Acrobat licence prompt', 'Reassigned licence in admin console.'],
  ['Leaver: disable account', 'Disabled account, converted mailbox, removed licences.'],
  ['Cannot print to large format plotter', 'Reinstalled driver.'],
  ['Email not syncing on mobile', 'Re-added account in Outlook mobile.'],
  ['SharePoint access request', 'Added user to site members.'],
  ['Laptop battery warning', 'Ran diagnostics, battery within tolerance, advised user.'],
  ['Spam getting through filter', 'Tuned anti-spam policy.'],
]

const BILLED_NORMAL: [string, string][] = [
  ['Quoted work: firewall firmware upgrade window', 'Approved chargeable change.'],
  ['Chargeable: additional monitor install', 'Approved by office manager.'],
]

const FIRST = ['Olivia', 'Jack', 'Amelia', 'Harry', 'Isla', 'George', 'Ava', 'Noah', 'Mia', 'Leo', 'Emily', 'Oscar', 'Grace', 'Arthur', 'Sophia', 'Charlie', 'Ella', 'Freddie', 'Lily', 'Alfie', 'Ruby', 'Theo', 'Chloe', 'Henry', 'Evie', 'Archie', 'Poppy', 'Thomas', 'Florence', 'Joshua', 'Hannah', 'William', 'Lucy', 'James', 'Zara', 'Samuel', 'Megan', 'Daniel', 'Rosie', 'Ethan']
const LAST = ['Taylor', 'Brown', 'Wilson', 'Evans', 'Thomas', 'Roberts', 'Johnson', 'Walker', 'Wright', 'Robinson', 'Thompson', 'White', 'Hughes', 'Edwards', 'Green', 'Hall', 'Wood', 'Harris', 'Lewis', 'Martin', 'Jackson', 'Clarke', 'Clark', 'Turner', 'Hill', 'Scott', 'Cooper', 'Morris', 'Ward', 'Moore', 'King', 'Watson', 'Baker', 'Harrison', 'Morgan', 'Patel', 'Young', 'Allen', 'Mitchell', 'James']

const pad = (n: number) => String(n).padStart(2, '0')

function weekdays(month: string): number[] {
  const [y, m] = month.split('-').map(Number)
  const days: number[] = []
  const last = new Date(y, m, 0).getDate()
  for (let d = 1; d <= last; d++) {
    const wd = new Date(y, m - 1, d).getDay()
    if (wd !== 0 && wd !== 6) days.push(d)
  }
  return days
}

function contractText(c: ClientSpec): string {
  const p: string[] = [
    `MANAGED SERVICES AGREEMENT`,
    `Between Northlight IT Ltd ("the Provider") and ${c.name} ("the Client"). Package: ${c.pkg}. Term: ${c.start} to ${c.end}.`,
    `1. Services`,
    `1.1 The Provider will deliver remote and telephone support for the Client's users and devices listed in Schedule A, together with proactive monitoring, patching and backup management.`,
    `1.2 The monthly charge is based on ${c.users} supported users and ${c.devices} supported devices. Additional users or devices will be added to the monthly charge at the rates in Schedule B.`,
    `2. Service hours`,
    `2.1 Support is available between 08:30 and 17:30, Monday to Friday, excluding UK bank holidays. Work requested outside these hours is chargeable at 1.5 times the standard hourly rate.`,
  ]
  const ex: string[] = []
  if (c.clauses.includes('devices')) ex.push('Support applies to company-owned devices only. Personal devices are excluded from this agreement.')
  if (c.clauses.includes('hardware')) ex.push('Hardware repair and replacement parts are excluded and will be charged at the standard hourly rate plus parts.')
  if (c.clauses.includes('thirdparty')) ex.push(`Third-party line-of-business applications${c.prefix === 'KGA' ? ' (including AutoCAD and Revit)' : c.prefix === 'CAS' ? ' (including Sage 50)' : ''} are excluded and are supported on a best endeavours basis at the standard hourly rate.`)
  if (c.clauses.includes('onsite')) ex.push('Onsite visits are chargeable at the standard hourly rate, with a minimum charge of one hour.')
  if (c.clauses.includes('projects')) ex.push('Project work, including migrations, installations and upgrades, is excluded and will be quoted separately.')
  if (c.clauses.includes('included')) ex.push('The Service includes up to 10 hours of remote support per month. Additional time is chargeable at the standard hourly rate.')
  if (c.clauses.includes('onboarding')) ex.push('Onboarding of new users and setup of new devices is included in the monthly charge.')
  if (c.clauses.includes('projectsIncluded')) ex.push('Minor projects of up to one day are included in the monthly charge.')
  if (ex.length) {
    p.push('3. Scope and exclusions')
    ex.forEach((e, i) => p.push(`3.${i + 1} ${e}`))
  }
  p.push(`${ex.length ? 4 : 3}. Charges`, `The standard hourly rate is £60 per hour, charged in 15 minute increments.`)
  return p.join('\n\n')
}

export function generateDemo(): DemoRaw {
  const rnd = mulberry32(20260930)
  const pick = <T,>(xs: T[]) => xs[Math.floor(rnd() * xs.length)]
  const out: DemoRaw = { clients: [], tickets: [], time_entries: [], assets: [], billing: [], contracts: [] }

  interface T {
    client: string
    date: string
    tech: string
    subject: string
    description: string
    minutes: number
    billable: boolean
    entriesBillable: boolean
    status: string
    id?: string
    problem?: boolean
  }
  const tickets: T[] = []

  for (const c of CLIENTS) {
    // ----- client row
    out.clients.push({
      client: c.name,
      monthly_recurring_revenue: String(c.mrr),
      contracted_users: String(c.users),
      contracted_devices: String(c.devices),
      package: c.pkg,
      contract_start: c.start,
      contract_end: c.end,
      included_hours: c.included ? String(c.included) : '',
      monthly_software_cost: String(c.software),
    })
    out.contracts.push({ client: c.name, title: `Managed Services Agreement – ${c.pkg}`, text: contractText(c) })

    // ----- users
    const usedNames = new Set<string>()
    const personName = () => {
      for (;;) {
        const n = `${pick(FIRST)} ${pick(LAST)}`
        if (!usedNames.has(n)) {
          usedNames.add(n)
          return n
        }
      }
    }
    const preDate = () => `${2022 + Math.floor(rnd() * 4)}-${pad(1 + Math.floor(rnd() * 12))}-${pad(1 + Math.floor(rnd() * 27))}`
    const users: { name: string; first_seen: string; status: string }[] = []
    const baseUsers = c.users + (c.extraUsers?.preWindow ?? 0)
    for (let i = 0; i < baseUsers; i++) {
      let d = preDate()
      if (d > '2026-03-31') d = '2025-11-03'
      users.push({ name: personName(), first_seen: d, status: 'active' })
    }
    for (const d of c.extraUsers?.dated ?? []) users.push({ name: personName(), first_seen: d, status: 'active' })
    if (c.leaver) {
      // A leaver in June, replaced by a new starter in July: headcount unchanged.
      users[3].status = 'inactive'
      users.push({ name: personName(), first_seen: c.license!.billedShort!.added, status: 'active' })
    }
    const lic = c.license!
    for (const u of users) out.assets.push({ client: c.name, type: 'user', name: u.name, ownership: '', license: lic.name, status: u.status, first_seen: u.first_seen })

    // ----- devices
    const devCount = c.devices + (c.extraDevices?.preWindow ?? 0)
    const devDates = [...Array.from({ length: devCount }, () => preDate()).map((d) => (d > '2026-03-31' ? '2025-10-14' : d)), ...(c.extraDevices?.dated ?? [])]
    devDates.forEach((d, i) => {
      const kind = i < 2 ? 'SRV' : rnd() < 0.7 ? 'LT' : 'DT'
      out.assets.push({ client: c.name, type: 'device', name: `${c.prefix}-${kind}-${String(i + 1).padStart(3, '0')}`, ownership: 'company', license: '', status: 'active', first_seen: d })
    })

    // ----- billing (lines sum to MRR)
    const activeLicensed = users.filter((u) => u.status === 'active').length
    const licBilled = lic.billedShort ? activeLicensed - 1 : activeLicensed
    const devicePrice = c.devicePrice ?? 8
    const lines: [string, number, number][] = [
      ['Managed User Support (per user)', c.users, 18],
      ['Managed Device Monitoring (per device)', c.devices, devicePrice],
      [lic.name, licBilled, lic.price],
      ['Backup & Disaster Recovery', 1, Math.round(c.mrr * 0.08)],
    ]
    const subtotal = lines.reduce((a, [, q, p]) => a + q * p, 0)
    lines.push([`${c.pkg} service fee`, 1, Math.round((c.mrr - subtotal) * 100) / 100])
    for (const [service, q, price] of lines) {
      out.billing.push({ client: c.name, service, quantity: String(q), unit_price: price.toFixed(2), monthly_value: (q * price).toFixed(2) })
    }

    // ----- tickets per month
    MONTHS.forEach((month, mi) => {
      const target = Math.round(c.hours[mi] * 60)
      const problems = PROBLEMS.filter((p) => p.client === c.name && p.month === month)
      const days = weekdays(month)
      let used = 0
      for (const p of problems) {
        const day = p.day ?? pick(days)
        const time = p.time ?? `${pad(9 + Math.floor(rnd() * 6))}:${pad(Math.floor(rnd() * 4) * 15)}`
        tickets.push({ client: c.name, date: `${month}-${pad(day)}T${time}:00`, tech: p.tech ?? pick(TECHS), subject: p.subject, description: p.description, minutes: p.minutes, billable: !!p.ticketBillable, entriesBillable: false, status: 'Closed', id: p.id, problem: true })
        used += p.minutes
      }
      let remaining = target - used
      if (remaining < 0) throw new Error(`Demo data: ${c.name} ${month} over target`)
      const sizes = [15, 20, 30, 30, 45, 45, 60, 60, 75, 90, 90, 120, 150, 180]
      while (remaining > 0) {
        let m = remaining <= 200 ? remaining : pick(sizes)
        if (remaining - m > 0 && remaining - m < 15) m = remaining
        remaining -= m
        const billed = rnd() < 0.03
        const [subject, description] = billed ? pick(BILLED_NORMAL) : pick(NORMAL)
        const day = pick(days)
        const hh = 9 + Math.floor(rnd() * 5)
        const status = month === '2026-09' && day > 24 && rnd() < 0.4 ? pick(['Open', 'In progress', 'Waiting on client']) : 'Closed'
        tickets.push({ client: c.name, date: `${month}-${pad(day)}T${pad(hh)}:${pad(Math.floor(rnd() * 60))}:00`, tech: pick(TECHS), subject, description, minutes: m, billable: billed, entriesBillable: billed, status })
      }
    })
  }

  // ----- number tickets in date order, emit tickets + time entries
  tickets.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  let seq = 17240
  for (const t of tickets) {
    let id = t.id
    if (!id) {
      if (seq === 18492) seq++
      id = String(seq++)
    }
    out.tickets.push({
      ticket_id: id,
      client: t.client,
      date: t.date.replace('T', ' ').slice(0, 16),
      technician: t.tech,
      subject: t.subject,
      description: t.description,
      status: t.status,
      time_spent_minutes: String(t.minutes),
      billable: t.billable ? 'Yes' : 'No',
    })
    // Long jobs are logged in two sittings, sometimes by a second technician.
    const split = t.minutes >= 90 && !t.problem && Number(id) % 2 === 0
    const parts = split ? [Math.round(t.minutes / 2 / 5) * 5, t.minutes - Math.round(t.minutes / 2 / 5) * 5] : [t.minutes]
    parts.forEach((mins, i) => {
      const [d, time] = t.date.split('T')
      const [hh, mm] = time.split(':').map(Number)
      const start = i === 0 ? `${pad(hh)}:${pad(mm)}` : `${pad(Math.min(16, hh + 2))}:${pad(mm)}`
      out.time_entries.push({
        date: `${d} ${start}`,
        client: t.client,
        technician: i === 0 ? t.tech : TECHS[(TECHS.indexOf(t.tech) + 1) % TECHS.length],
        ticket_id: id!,
        minutes: String(mins),
        billable: t.entriesBillable ? 'Yes' : 'No',
      })
    })
  }
  return out
}
