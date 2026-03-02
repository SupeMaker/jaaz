import { motion, AnimatePresence } from 'motion/react'
import { History, RotateCcw, Clock, MoreVertical, Trash2, Download } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export type Snapshot = {
  id: string
  timestamp: string
  label: string
  thumbnail?: string
  prompt?: string
  active?: boolean
}

interface HistorySnapshotsProps {
  snapshots: Snapshot[]
  onRestore?: (id: string) => void
  onDelete?: (id: string) => void
  onDownload?: (id: string) => void
  className?: string
}

function formatTimestamp(ts: string): string {
  try {
    const date = new Date(ts)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMin = Math.floor(diffMs / 60000)
    const diffHr = Math.floor(diffMin / 60)
    const diffDay = Math.floor(diffHr / 24)

    if (diffMin < 1) return 'just now'
    if (diffMin < 60) return `${diffMin}m ago`
    if (diffHr < 24) return `${diffHr}h ago`
    if (diffDay < 7) return `${diffDay}d ago`
    return date.toLocaleDateString()
  } catch {
    return ts
  }
}

export default function HistorySnapshots({
  snapshots,
  onRestore,
  onDelete,
  onDownload,
  className,
}: HistorySnapshotsProps) {
  const { t } = useTranslation()

  return (
    <div className={cn('rounded-xl border border-border/50 bg-background/50 overflow-hidden', className)}>
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border/30 bg-muted/20">
        <History className="size-4 text-primary" />
        <span className="text-sm font-medium">{t('canvas:history.title', 'History Snapshots')}</span>
        <span className="text-xs text-muted-foreground ml-auto">{snapshots.length}</span>
      </div>

      {/* Snapshots List */}
      <div className="max-h-80 overflow-y-auto p-2 space-y-1">
        {snapshots.length === 0 ? (
          <div className="text-center py-6 px-3">
            <Clock className="size-6 mx-auto text-muted-foreground/30 mb-2" />
            <p className="text-xs text-muted-foreground/60">
              {t('canvas:history.empty', 'No snapshots yet. Each generation creates a restorable snapshot.')}
            </p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {snapshots.map((snapshot, index) => (
              <motion.div
                key={snapshot.id}
                layout
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2, delay: index * 0.03 }}
                className={cn(
                  'group relative flex items-center gap-2.5 p-2 rounded-lg transition-all duration-150 cursor-pointer',
                  snapshot.active
                    ? 'bg-primary/8 ring-1 ring-primary/15'
                    : 'hover:bg-muted/40'
                )}
              >
                {/* Thumbnail */}
                <div className="relative size-10 rounded-md overflow-hidden bg-muted shrink-0 ring-1 ring-border/30">
                  {snapshot.thumbnail ? (
                    <img src={snapshot.thumbnail} alt={snapshot.label} className="size-full object-cover" />
                  ) : (
                    <div className="size-full flex items-center justify-center">
                      <Clock className="size-4 text-muted-foreground/40" />
                    </div>
                  )}
                  {snapshot.active && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary" />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium truncate">{snapshot.label}</span>
                    {snapshot.active && (
                      <span className="text-[9px] text-primary font-medium px-1 py-0.5 rounded bg-primary/10 shrink-0">
                        Current
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Clock className="size-2.5 text-muted-foreground/50" />
                    <span className="text-[10px] text-muted-foreground">
                      {formatTimestamp(snapshot.timestamp)}
                    </span>
                  </div>
                  {snapshot.prompt && (
                    <p className="text-[10px] text-muted-foreground/70 truncate mt-0.5 italic">
                      "{snapshot.prompt}"
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-0.5 shrink-0">
                  {!snapshot.active && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        onRestore?.(snapshot.id)
                      }}
                      className="size-7 p-0 text-muted-foreground hover:text-primary hover:bg-primary/10 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <RotateCcw className="size-3" />
                    </Button>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => e.stopPropagation()}
                        className="size-7 p-0 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <MoreVertical className="size-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-36">
                      <DropdownMenuItem
                        onClick={() => onDownload?.(snapshot.id)}
                        className="text-xs cursor-pointer"
                      >
                        <Download className="size-3 mr-2" />
                        Download
                      </DropdownMenuItem>
                      {!snapshot.active && (
                        <DropdownMenuItem
                          onClick={() => onRestore?.(snapshot.id)}
                          className="text-xs cursor-pointer"
                        >
                          <RotateCcw className="size-3 mr-2" />
                          Restore
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        onClick={() => onDelete?.(snapshot.id)}
                        className="text-xs cursor-pointer text-red-600 hover:text-red-700 hover:bg-red-500/10"
                      >
                        <Trash2 className="size-3 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  )
}
