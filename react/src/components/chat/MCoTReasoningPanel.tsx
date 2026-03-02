import { motion, AnimatePresence } from 'motion/react'
import { Brain, ChevronDown, Lightbulb, Target, Users, Palette, Wand2, CheckCircle2 } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { useTranslation } from 'react-i18next'

export type MCoTStep = {
  id: string
  type: 'analysis' | 'audience' | 'brand' | 'planning' | 'execution'
  title: string
  description: string
  status: 'pending' | 'running' | 'done'
}

interface MCoTReasoningPanelProps {
  steps: MCoTStep[]
  isExpanded?: boolean
  className?: string
}

const stepIcons = {
  analysis: Lightbulb,
  audience: Users,
  brand: Palette,
  planning: Target,
  execution: Wand2,
}

const stepColors = {
  analysis: 'text-amber-500 bg-amber-500/10',
  audience: 'text-blue-500 bg-blue-500/10',
  brand: 'text-violet-500 bg-violet-500/10',
  planning: 'text-emerald-500 bg-emerald-500/10',
  execution: 'text-rose-500 bg-rose-500/10',
}

export default function MCoTReasoningPanel({
  steps,
  isExpanded: defaultExpanded = false,
  className,
}: MCoTReasoningPanelProps) {
  const { t } = useTranslation()
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  const runningStep = steps.find((s) => s.status === 'running')
  const doneCount = steps.filter((s) => s.status === 'done').length
  const totalCount = steps.length
  const allDone = doneCount === totalCount && totalCount > 0

  return (
    <div className={cn('rounded-xl border border-border/50 bg-muted/20 overflow-hidden', className)}>
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-muted/40 transition-colors cursor-pointer"
      >
        <div className={cn(
          'flex items-center justify-center size-7 rounded-lg transition-colors',
          allDone ? 'bg-emerald-500/15 text-emerald-500' : 'bg-primary/10 text-primary'
        )}>
          {allDone ? <CheckCircle2 className="size-4" /> : <Brain className="size-4" />}
        </div>
        <div className="flex-1 text-left min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{t('chat:mcot.title', 'MCoT Reasoning')}</span>
            {runningStep && (
              <span className="text-xs text-muted-foreground truncate">
                · {runningStep.title}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden max-w-[120px]">
              <motion.div
                className="h-full bg-primary rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${(doneCount / Math.max(totalCount, 1)) * 100}%` }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
              />
            </div>
            <span className="text-[10px] text-muted-foreground tabular-nums">
              {doneCount}/{totalCount}
            </span>
          </div>
        </div>
        <ChevronDown className={cn(
          'size-4 text-muted-foreground transition-transform duration-200',
          isExpanded && 'rotate-180'
        )} />
      </button>

      {/* Steps */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="border-t border-border/30 overflow-hidden"
          >
            <div className="p-3 space-y-2">
              {steps.map((step, index) => {
                const Icon = stepIcons[step.type]
                const isLast = index === steps.length - 1
                return (
                  <div key={step.id} className="relative flex gap-2.5">
                    {/* Connector line */}
                    {!isLast && (
                      <div className="absolute left-[14px] top-8 bottom-0 w-px bg-border/40" />
                    )}
                    {/* Icon */}
                    <div className={cn(
                      'relative z-10 flex items-center justify-center size-7 rounded-lg shrink-0 transition-colors',
                      step.status === 'done' ? 'bg-emerald-500/15 text-emerald-500' :
                      step.status === 'running' ? stepColors[step.type] :
                      'bg-muted text-muted-foreground/50'
                    )}>
                      {step.status === 'running' ? (
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                        >
                          <Icon className="size-3.5" />
                        </motion.div>
                      ) : step.status === 'done' ? (
                        <CheckCircle2 className="size-3.5" />
                      ) : (
                        <Icon className="size-3.5" />
                      )}
                    </div>
                    {/* Content */}
                    <div className="flex-1 pb-2 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          'text-xs font-medium',
                          step.status === 'pending' && 'text-muted-foreground/60'
                        )}>
                          {step.title}
                        </span>
                        {step.status === 'running' && (
                          <span className="text-[10px] text-primary font-medium px-1.5 py-0.5 rounded bg-primary/10">
                            Running
                          </span>
                        )}
                      </div>
                      <p className={cn(
                        'text-[11px] mt-0.5 leading-relaxed',
                        step.status === 'pending' ? 'text-muted-foreground/40' : 'text-muted-foreground'
                      )}>
                        {step.description}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
