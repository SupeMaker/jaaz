import { cn } from '@/lib/utils'
import { MessageSquare, MousePointerClick, SlidersHorizontal } from 'lucide-react'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'

export type WorkMode = 'talk' | 'tab' | 'tune'

type WorkModeIndicatorProps = {
  activeMode: WorkMode
  onModeChange: (mode: WorkMode) => void
  className?: string
}

const WorkModeIndicator: React.FC<WorkModeIndicatorProps> = ({
  activeMode,
  onModeChange,
  className,
}) => {
  const { t } = useTranslation()

  const modes: { key: WorkMode; icon: React.ElementType; label: string; desc: string }[] = [
    { key: 'talk', icon: MessageSquare, label: 'Talk', desc: t('canvas:workMode.talkDesc') },
    { key: 'tab', icon: MousePointerClick, label: 'Tab', desc: t('canvas:workMode.tabDesc') },
    { key: 'tune', icon: SlidersHorizontal, label: 'Tune', desc: t('canvas:workMode.tuneDesc') },
  ]

  return (
    <div className={cn('flex items-center gap-1 bg-secondary/50 rounded-lg p-1', className)}>
      {modes.map((mode) => {
        const Icon = mode.icon
        const isActive = activeMode === mode.key
        return (
          <button
            key={mode.key}
            onClick={() => onModeChange(mode.key)}
            title={mode.desc}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200',
              isActive
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            <span>{mode.label}</span>
          </button>
        )
      })}
    </div>
  )
}

export default memo(WorkModeIndicator)
