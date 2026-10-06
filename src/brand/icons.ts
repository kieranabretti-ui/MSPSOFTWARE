// The icon system: one library (lucide), one stroke (1.75, set globally in
// index.css), 16px in dense UI and 20px in empty states. Each product concept
// has exactly one icon, so the same idea always looks the same.
import {
  Building2,
  CircleAlert,
  Database,
  FileSignature,
  FileText,
  LayoutDashboard,
  ListChecks,
  Percent,
  PoundSterling,
  ReceiptPoundSterling,
  ScanSearch,
  Settings,
  Ticket,
  TrendingDown,
  type LucideIcon,
} from 'lucide-react'

export const ICONS = {
  revenue: PoundSterling,
  leakage: TrendingDown,
  findings: ScanSearch,
  contracts: FileSignature,
  tickets: Ticket,
  clients: Building2,
  billing: ReceiptPoundSterling,
  profitability: Percent,
  actions: ListChecks,
  alerts: CircleAlert,
  reports: FileText,
  overview: LayoutDashboard,
  data: Database,
  settings: Settings,
} satisfies Record<string, LucideIcon>
