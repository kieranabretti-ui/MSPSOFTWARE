import { Fragment, useState } from 'react'
import { ChevronDown, RotateCcw, Trash2 } from 'lucide-react'
import type { Upload } from '../../../engine/types'
import { Badge, Button, Card, CardHeader, cx } from '../../../components/ui'
import { SCHEMAS } from '../../../data/importers'
import { plural, relative } from '../../../lib/format'

const TH = 'px-3 py-2.5 text-left text-label uppercase text-ink-3 font-semibold'

const kindLabel = (u: Upload) => (u.kind === 'contract' ? 'Contract' : SCHEMAS[u.kind].title)

export function UploadHistory({ uploads, onClear, onDelete, id }: { uploads: Upload[]; onClear?: () => void; onDelete?: (u: Upload) => void; id?: string }) {
  const [open, setOpen] = useState<string | null>(null)
  const rows = [...uploads].sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
  return (
    <div id={id} className="scroll-mt-6">
      <Card>
        <CardHeader
          title="Upload history"
          subtitle={rows.length ? <span className="tnum">{plural(rows.length, 'file')} imported into this workspace. Deleting a file removes the records it imported.</span> : undefined}
          right={
            onClear && (
              <Button variant="ghost" size="sm" className="-my-1 -mr-2 shrink-0" onClick={onClear}>
                <RotateCcw className="size-4 shrink-0" aria-hidden /> Clear all data
              </Button>
            )
          }
        />
        {rows.length ? (
          <table className="w-full table-fixed text-small">
            <caption className="sr-only">Uploads, newest first</caption>
            <thead>
              <tr className="border-b border-line-soft">
                <th scope="col" className={cx(TH, 'pl-4 sm:pl-5')}>
                  File
                </th>
                <th scope="col" className={cx(TH, 'hidden w-40 sm:table-cell')}>
                  Source
                </th>
                <th scope="col" className={cx(TH, 'hidden w-32 text-right sm:table-cell')}>
                  Rows
                </th>
                <th scope="col" className={cx(TH, 'w-28 pr-4 sm:w-36 sm:pr-3')}>
                  Status
                </th>
                <th scope="col" className={cx(TH, 'hidden w-40 text-right md:table-cell', !onDelete && 'pr-5')}>
                  Uploaded
                </th>
                {onDelete && (
                  <th scope="col" className={cx(TH, 'w-14 pr-3 sm:pr-4')}>
                    <span className="sr-only">Actions</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {rows.map((u) => {
                const expanded = open === u.id
                const failed = u.status === 'failed'
                return (
                  <Fragment key={u.id}>
                    <tr className="transition-colors duration-150 hover:bg-hover">
                      <td className="py-3 pl-4 pr-3 sm:pl-5">
                        <p className="truncate font-medium text-ink" title={u.file_name}>
                          {u.file_name}
                        </p>
                        <p className="tnum mt-0.5 truncate text-caption text-ink-3 md:hidden">
                          <span className="sm:hidden">{kindLabel(u)} · {plural(u.row_count, u.kind === 'contract' ? 'document' : 'row')} · </span>
                          {relative(u.created_at)}
                        </p>
                      </td>
                      <td className="hidden px-3 py-3 text-ink-2 sm:table-cell">{kindLabel(u)}</td>
                      <td className="tnum hidden px-3 py-3 text-right text-ink-2 sm:table-cell">{plural(u.row_count, u.kind === 'contract' ? 'document' : 'row')}</td>
                      <td className="py-3 pl-3 pr-4 sm:pr-3">
                        {failed ? (
                          <Badge tone="danger">Failed</Badge>
                        ) : u.warnings.length ? (
                          <button
                            type="button"
                            onClick={() => setOpen(expanded ? null : u.id)}
                            aria-expanded={expanded}
                            aria-controls={`upload-warnings-${u.id}`}
                            className="inline-flex items-center gap-1 rounded-xs text-warning transition-opacity hover:opacity-85"
                          >
                            <Badge tone="warning">
                              <span className="tnum">{plural(u.warnings.length, 'warning')}</span>
                              <ChevronDown className={cx('size-3 transition-transform duration-150', expanded && 'rotate-180')} aria-hidden />
                            </Badge>
                          </button>
                        ) : (
                          <Badge>Imported</Badge>
                        )}
                      </td>
                      <td className={cx('hidden whitespace-nowrap py-3 pl-3 text-right text-caption text-ink-3 md:table-cell', onDelete ? 'pr-3' : 'pr-5')}>{relative(u.created_at)}</td>
                      {onDelete && (
                        <td className="py-1.5 pr-2 text-right sm:pr-3">
                          <button
                            type="button"
                            onClick={() => onDelete(u)}
                            className="inline-flex size-9 items-center justify-center rounded-sm text-ink-3 transition-colors duration-150 hover:bg-raised hover:text-ink"
                            aria-label={`Delete ${u.file_name}`}
                            title="Delete this file and its records"
                          >
                            <Trash2 className="size-4" aria-hidden />
                          </button>
                        </td>
                      )}
                    </tr>
                    {expanded && (
                      <tr id={`upload-warnings-${u.id}`} className="bg-sunken">
                        <td colSpan={onDelete ? 6 : 5} className="px-4 py-3 sm:px-5">
                          <ul className="space-y-1 text-small text-ink-2">
                            {u.warnings.map((w) => (
                              <li key={w} className="flex gap-2">
                                <span className="mt-2 size-1 shrink-0 rounded-full bg-warning" aria-hidden />
                                {w}
                              </li>
                            ))}
                          </ul>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        ) : (
          <div className="px-5 py-8">
            <p className="text-body text-ink-2">Nothing uploaded yet.</p>
            <p className="mt-1 text-small text-ink-3">Each file you import appears here with its row count and any warnings.</p>
          </div>
        )}
      </Card>
    </div>
  )
}
