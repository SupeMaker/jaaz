import { eventBus, TCanvasTaskEvent } from '@/lib/event'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'motion/react'
import { Loader2, CheckCircle2, XCircle, Wand2, Sticker, Pencil } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TaskItem extends TCanvasTaskEvent {
  createdAt: number
}

const TASK_TTL_MS = 4000

const typeIcons: Record<string, React.ReactNode> = {
  edit: <Pencil className='size-3' />,
  inpaint: <Wand2 className='size-3' />,
  mockup: <Sticker className='size-3' />,
}

const CanvasTaskStatus: React.FC = () => {
  const { t } = useTranslation()
  const [tasks, setTasks] = useState<TaskItem[]>([])
  const timersRef = useRef<Record<string, number>>({})

  useEffect(() => {
    const handleTask = (event: TCanvasTaskEvent) => {
      setTasks((prev) => {
        const next = prev.filter((t) => t.id !== event.id)
        if (event.status !== 'success' || event.status !== 'error') {
          // keep running tasks, replace if exists
        }
        const item: TaskItem = { ...event, createdAt: Date.now() }
        return [...next, item]
      })

      // Auto-dismiss success/error after TTL
      if (event.status === 'success' || event.status === 'error') {
        window.clearTimeout(timersRef.current[event.id])
        timersRef.current[event.id] = window.setTimeout(() => {
          setTasks((prev) => prev.filter((t) => t.id !== event.id))
        }, TASK_TTL_MS)
      }
    }

    eventBus.on('Canvas::TaskStarted', handleTask)
    eventBus.on('Canvas::TaskUpdated', handleTask)
    eventBus.on('Canvas::TaskDone', handleTask)

    const timers = timersRef.current
    return () => {
      eventBus.off('Canvas::TaskStarted', handleTask)
      eventBus.off('Canvas::TaskUpdated', handleTask)
      eventBus.off('Canvas::TaskDone', handleTask)
      Object.values(timers).forEach((id) => window.clearTimeout(id))
    }
  }, [t])

  if (tasks.length === 0) return null

  return (
    <div className='absolute top-3 left-3 z-30 flex flex-col gap-2 pointer-events-none'>
      <AnimatePresence initial={false}>
        {tasks.map((task) => (
          <motion.div
            key={task.id}
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            className={cn(
              'pointer-events-auto flex items-center gap-2.5 pl-2.5 pr-3 py-2 rounded-lg text-xs font-medium shadow-lg border backdrop-blur-md min-w-[180px] max-w-[260px]',
              task.status === 'running' &&
              'bg-background/90 border-primary/20 text-foreground',
              task.status === 'success' &&
              'bg-green-50/95 dark:bg-green-950/40 border-green-200/60 dark:border-green-900/50 text-green-700 dark:text-green-300',
              task.status === 'error' &&
              'bg-red-50/95 dark:bg-red-950/40 border-red-200/60 dark:border-red-900/50 text-red-700 dark:text-red-300'
            )}
          >
            <span className='shrink-0 text-muted-foreground'>
              {typeIcons[task.type] || <Wand2 className='size-3' />}
            </span>
            <span className='flex-1 truncate'>{task.message}</span>
            {task.status === 'running' && (
              <Loader2 className='size-3.5 animate-spin shrink-0 text-primary' />
            )}
            {task.status === 'success' && (
              <CheckCircle2 className='size-3.5 shrink-0 text-green-600 dark:text-green-400' />
            )}
            {task.status === 'error' && (
              <XCircle className='size-3.5 shrink-0 text-red-600 dark:text-red-400' />
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

export default CanvasTaskStatus
