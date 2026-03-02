import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  ImageIcon,
  Video,
  Music,
  FileCode,
  Box,
  Palette,
  ChevronDown,
  Sparkles,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

export type OutputMode = 'image' | 'video' | 'audio' | 'script' | '3d' | 'brand'

const modeIcons: Record<OutputMode, React.ElementType> = {
  image: ImageIcon,
  video: Video,
  audio: Music,
  script: FileCode,
  '3d': Box,
  brand: Palette,
}

const modeColors: Record<OutputMode, string> = {
  image: 'from-violet-500/15 to-violet-500/5 text-violet-500 border-violet-500/20',
  video: 'from-rose-500/15 to-rose-500/5 text-rose-500 border-rose-500/20',
  audio: 'from-amber-500/15 to-amber-500/5 text-amber-500 border-amber-500/20',
  script: 'from-emerald-500/15 to-emerald-500/5 text-emerald-500 border-emerald-500/20',
  '3d': 'from-cyan-500/15 to-cyan-500/5 text-cyan-500 border-cyan-500/20',
  brand: 'from-fuchsia-500/15 to-fuchsia-500/5 text-fuchsia-500 border-fuchsia-500/20',
}

const modeDotColors: Record<OutputMode, string> = {
  image: 'bg-violet-500',
  video: 'bg-rose-500',
  audio: 'bg-amber-500',
  script: 'bg-emerald-500',
  '3d': 'bg-cyan-500',
  brand: 'bg-fuchsia-500',
}

type OutputModeSelectorProps = {
  selected: OutputMode
  onSelect: (mode: OutputMode) => void
  className?: string
}

const OutputModeSelector: React.FC<OutputModeSelectorProps> = ({
  selected,
  onSelect,
  className,
}) => {
  const { t } = useTranslation()

  const modes: OutputMode[] = ['image', 'video', 'audio', 'script', '3d', 'brand']
  const Icon = modeIcons[selected]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            'group inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium transition-all duration-200 cursor-pointer select-none border bg-gradient-to-r',
            modeColors[selected],
            'hover:shadow-sm hover:scale-[1.02] active:scale-[0.98]',
            className
          )}
        >
          <Icon className="size-3.5" />
          <span>{t(`home:multimodal.${selected}`)}</span>
          <ChevronDown className="size-3 opacity-40 group-hover:opacity-70 transition-opacity" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-44 p-1.5 rounded-xl border-border/50 shadow-xl shadow-black/10">
        {modes.map((mode) => {
          const ModeIcon = modeIcons[mode]
          const isActive = selected === mode
          return (
            <DropdownMenuItem
              key={mode}
              onClick={() => onSelect(mode)}
              className={cn(
                'flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-all duration-150 cursor-pointer',
                isActive && 'bg-primary/8 ring-1 ring-primary/15'
              )}
            >
              <div className="flex items-center gap-2.5">
                <div className={cn(
                  'flex items-center justify-center w-6 h-6 rounded-md bg-gradient-to-br',
                  modeColors[mode]
                )}>
                  <ModeIcon className="size-3.5" />
                </div>
                <span className={isActive ? 'font-medium' : ''}>{t(`home:multimodal.${mode}`)}</span>
              </div>
              {isActive && (
                <div className={cn('size-1.5 rounded-full', modeDotColors[mode])} />
              )}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default OutputModeSelector
