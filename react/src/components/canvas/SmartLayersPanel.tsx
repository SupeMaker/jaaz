import { motion, AnimatePresence } from 'motion/react'
import { Layers, Eye, EyeOff, Image, Type, Square, Sparkles, Lock, Unlock } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { useTranslation } from 'react-i18next'

export type SmartLayer = {
  id: string
  name: string
  type: 'subject' | 'background' | 'text' | 'foreground' | 'effect'
  visible: boolean
  locked: boolean
  thumbnail?: string
  opacity: number
}

interface SmartLayersPanelProps {
  layers: SmartLayer[]
  onToggleVisible?: (id: string) => void
  onToggleLock?: (id: string) => void
  onOpacityChange?: (id: string, opacity: number) => void
  className?: string
}

const layerIcons = {
  subject: Sparkles,
  background: Image,
  text: Type,
  foreground: Square,
  effect: Layers,
}

const layerColors = {
  subject: 'text-violet-500 bg-violet-500/10',
  background: 'text-blue-500 bg-blue-500/10',
  text: 'text-amber-500 bg-amber-500/10',
  foreground: 'text-emerald-500 bg-emerald-500/10',
  effect: 'text-rose-500 bg-rose-500/10',
}

export default function SmartLayersPanel({
  layers,
  onToggleVisible,
  onToggleLock,
  onOpacityChange,
  className,
}: SmartLayersPanelProps) {
  const { t } = useTranslation()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selectedLayer = layers.find((l) => l.id === selectedId)

  return (
    <div className={cn('rounded-xl border border-border/50 bg-background/50 overflow-hidden', className)}>
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border/30 bg-muted/20">
        <Layers className="size-4 text-primary" />
        <span className="text-sm font-medium">{t('canvas:smartLayers.title', 'Smart Layers')}</span>
        <span className="text-xs text-muted-foreground ml-auto">{layers.length}</span>
      </div>

      {/* Layers List */}
      <div className="max-h-64 overflow-y-auto p-1.5 space-y-0.5">
        {layers.length === 0 ? (
          <div className="text-center py-6 px-3">
            <Layers className="size-6 mx-auto text-muted-foreground/30 mb-2" />
            <p className="text-xs text-muted-foreground/60">
              {t('canvas:smartLayers.empty', 'No layers detected. Generate an image to auto-extract layers.')}
            </p>
          </div>
        ) : (
          layers.map((layer) => {
            const Icon = layerIcons[layer.type]
            const isSelected = selectedId === layer.id
            return (
              <div
                key={layer.id}
                className={cn(
                  'group rounded-lg transition-all duration-150 cursor-pointer',
                  isSelected ? 'bg-primary/8 ring-1 ring-primary/15' : 'hover:bg-muted/40'
                )}
                onClick={() => setSelectedId(isSelected ? null : layer.id)}
              >
                <div className="flex items-center gap-2 p-2">
                  {/* Thumbnail / Icon */}
                  <div className={cn(
                    'relative size-8 rounded-md flex items-center justify-center shrink-0',
                    layerColors[layer.type]
                  )}>
                    {layer.thumbnail ? (
                      <img src={layer.thumbnail} alt={layer.name} className="size-full rounded-md object-cover" />
                    ) : (
                      <Icon className="size-4" />
                    )}
                    {!layer.visible && (
                      <div className="absolute inset-0 rounded-md bg-background/60 backdrop-blur-[1px] flex items-center justify-center">
                        <EyeOff className="size-3" />
                      </div>
                    )}
                  </div>

                  {/* Name */}
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate">{layer.name}</div>
                    <div className="text-[10px] text-muted-foreground capitalize">{layer.type}</div>
                  </div>

                  {/* Opacity */}
                  <span className="text-[10px] text-muted-foreground tabular-nums">
                    {Math.round(layer.opacity * 100)}%
                  </span>

                  {/* Actions */}
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onToggleVisible?.(layer.id)
                      }}
                      className="size-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 cursor-pointer"
                    >
                      {layer.visible ? <Eye className="size-3" /> : <EyeOff className="size-3" />}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onToggleLock?.(layer.id)
                      }}
                      className="size-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 cursor-pointer"
                    >
                      {layer.locked ? <Lock className="size-3" /> : <Unlock className="size-3" />}
                    </button>
                  </div>
                </div>

                {/* Opacity slider (when selected) */}
                <AnimatePresence>
                  {isSelected && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="overflow-hidden px-2 pb-2"
                    >
                      <div className="flex items-center gap-2 pt-1">
                        <span className="text-[10px] text-muted-foreground">Opacity</span>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={Math.round(layer.opacity * 100)}
                          onChange={(e) => onOpacityChange?.(layer.id, Number(e.target.value) / 100)}
                          onClick={(e) => e.stopPropagation()}
                          className="flex-1 h-1 bg-muted rounded-full appearance-none cursor-pointer
                                    [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3
                                    [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary
                                    [&::-webkit-slider-thumb]:cursor-pointer"
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })
        )}
      </div>

      {/* Footer hint */}
      {selectedLayer && (
        <div className="px-3 py-2 border-t border-border/30 bg-muted/20">
          <p className="text-[10px] text-muted-foreground/70 italic">
            {t('canvas:smartLayers.hint', 'Click layer to edit. Toggle visibility to isolate.')}
          </p>
        </div>
      )}
    </div>
  )
}
