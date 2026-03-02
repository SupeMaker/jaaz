import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus, Trash2, FileText, ImageIcon, Video, Music, Check } from 'lucide-react'
import { Dialog, DialogContent, DialogTrigger } from '../ui/dialog'
import { cn } from '@/lib/utils'

export type ModelType = 'text' | 'image' | 'video' | 'audio'
export type ModelItem = {
  name: string
  types: ModelType[]
}

const MODEL_TYPE_OPTIONS: { value: ModelType; label: string; icon: React.ElementType }[] = [
  { value: 'text', label: 'Text', icon: FileText },
  { value: 'image', label: 'Image', icon: ImageIcon },
  { value: 'video', label: 'Video', icon: Video },
  { value: 'audio', label: 'Audio', icon: Music },
]

const typeColors: Record<ModelType, string> = {
  text: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  image: 'bg-violet-500/10 text-violet-500 border-violet-500/20',
  video: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
  audio: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
}

interface ModelsListProps {
  models: Record<string, { type?: ModelType | ModelType[] }>
  onChange: (
    models: Record<string, { type?: ModelType | ModelType[] }>
  ) => void
  label?: string
}

export default function AddModelsList({
  models,
  onChange,
  label = 'Models',
}: ModelsListProps) {
  const [modelItems, setModelItems] = useState<ModelItem[]>([])
  const [newModelName, setNewModelName] = useState('')
  const [newModelTypes, setNewModelTypes] = useState<ModelType[]>(['text'])
  const [openAddModelDialog, setOpenAddModelDialog] = useState(false)

  useEffect(() => {
    const modelItems = Object.entries(models).map(([name, config]) => {
      const types = Array.isArray(config.type)
        ? (config.type as ModelType[])
        : ([config.type || 'text'] as ModelType[])
      return {
        name,
        types,
      }
    })
    setModelItems(modelItems)
  }, [models])

  const notifyChange = useCallback(
    (items: ModelItem[]) => {
      const validModels = items.filter((model) => model.name.trim())
      const modelsConfig: Record<
        string,
        { type?: ModelType | ModelType[] }
      > = {}

      validModels.forEach((model) => {
        if (model.types.length <= 1) {
          modelsConfig[model.name] = { type: model.types[0] || 'text' }
        } else {
          modelsConfig[model.name] = { type: model.types }
        }
      })

      onChange(modelsConfig)
    },
    [onChange]
  )

  const toggleType = (types: ModelType[], type: ModelType) => {
    if (types.includes(type)) {
      return types.filter((item) => item !== type)
    }
    return [...types, type]
  }

  const handleAddModel = () => {
    if (!newModelName.trim()) {
      return
    }

    const newItems = [
      ...modelItems,
      {
        name: newModelName.trim(),
        types: newModelTypes.length ? newModelTypes : (['text'] as ModelType[]),
      },
    ]
    setModelItems(newItems)
    notifyChange(newItems)
    setNewModelName('')
    setNewModelTypes(['text'])
    setOpenAddModelDialog(false)
  }

  const handleRemoveModel = (index: number) => {
    const newItems = modelItems.filter((_, i) => i !== index)
    setModelItems(newItems)
    notifyChange(newItems)
  }

  const handleUpdateModel = (index: number, item: ModelItem) => {
    const newItems = modelItems.map((model, i) => (i === index ? item : model))
    setModelItems(newItems)
    notifyChange(newItems)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</Label>
        <Dialog open={openAddModelDialog} onOpenChange={setOpenAddModelDialog}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 hover:bg-primary/8 hover:text-primary">
              <Plus className="size-3.5" />
              Add Model
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <div className="space-y-5 py-2">
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Model Name</Label>
                <Input
                  type="text"
                  placeholder="openai/gpt-4o"
                  value={newModelName}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleAddModel()
                    }
                  }}
                  onChange={(e) => setNewModelName(e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Model Types</Label>
                <div className="flex flex-wrap gap-2">
                  {MODEL_TYPE_OPTIONS.map((option) => {
                    const Icon = option.icon
                    const isActive = newModelTypes.includes(option.value)
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() =>
                          setNewModelTypes((types) => toggleType(types, option.value))
                        }
                        className={cn(
                          'inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium border transition-all duration-150 cursor-pointer',
                          isActive
                            ? typeColors[option.value]
                            : 'border-border/50 text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                        )}
                      >
                        <Icon className="size-3.5" />
                        {option.label}
                        {isActive && <Check className="size-3" strokeWidth={3} />}
                      </button>
                    )
                  })}
                </div>
              </div>
              <Button type="button" onClick={handleAddModel} className="w-full" disabled={!newModelName.trim()}>
                Add Model
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {modelItems.length === 0 ? (
        <div className="text-xs text-muted-foreground/60 italic py-2 px-3 rounded-lg bg-muted/30 border border-dashed border-border/40">
          No models configured yet. Add one to enable manual model management.
        </div>
      ) : (
        <div className="space-y-1.5">
          {modelItems.map((model, index) => (
            <div
              key={`${model.name}-${index}`}
              className="group relative rounded-lg border border-border/50 bg-background/50 p-3 hover:border-border/80 transition-all duration-150"
            >
              <button
                type="button"
                onClick={() => handleRemoveModel(index)}
                className="absolute right-2 top-2 size-6 rounded-md flex items-center justify-center text-muted-foreground/50 hover:text-red-500 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all duration-150 cursor-pointer"
              >
                <Trash2 className="size-3.5" />
              </button>

              <div className="grid gap-2.5 lg:grid-cols-[1.5fr,1.5fr] pr-8">
                <div className="space-y-1">
                  <Label className="text-[10px] font-medium text-muted-foreground/70 uppercase tracking-wider">Name</Label>
                  <Input
                    value={model.name}
                    onChange={(e) =>
                      handleUpdateModel(index, {
                        ...model,
                        name: e.target.value,
                      })
                    }
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-medium text-muted-foreground/70 uppercase tracking-wider">Types</Label>
                  <div className="flex flex-wrap gap-1">
                    {MODEL_TYPE_OPTIONS.map((option) => {
                      const Icon = option.icon
                      const isActive = model.types.includes(option.value)
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() =>
                            handleUpdateModel(index, {
                              ...model,
                              types: toggleType(model.types, option.value),
                            })
                          }
                          className={cn(
                            'inline-flex items-center gap-1 h-6 px-2 rounded-md text-[11px] font-medium border transition-all duration-150 cursor-pointer',
                            isActive
                              ? typeColors[option.value]
                              : 'border-border/40 text-muted-foreground/60 hover:bg-muted/40 hover:text-foreground'
                          )}
                        >
                          <Icon className="size-3" />
                          {option.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
