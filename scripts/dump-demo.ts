import { analyse } from '../src/engine/analyse'
import { buildDemoDataset } from '../src/demo/dataset'
const ds = buildDemoDataset('ws')
const { summary, findings } = analyse(ds)
console.log(summary.data_counts, summary.period_label, summary.trend.map((t) => t.value))
for (const f of findings) console.log(f.category, f.severity, f.confidence, f.estimated_value, f.monthly_value, ds.clients.find((c) => c.id === f.client_id)!.name, '|', f.title)
for (const c of summary.client_metrics) console.log(c.name, c.mrr, c.avg_monthly_hours, Math.round(c.margin * 100) + '%', c.leakage, c.health, c.users, c.devices)
