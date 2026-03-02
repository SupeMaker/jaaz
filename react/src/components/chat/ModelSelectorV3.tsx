import React, { useState } from 'react'
import { ChevronDown, Check, Sparkles, ImageIcon, Video, FileText, Zap } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuGroup,
} from '@/components/ui/dropdown-menu'
import { Switch } from '@/components/ui/switch'
import { useTranslation } from 'react-i18next'
import { useConfigs } from '@/contexts/configs'
import { ModelInfo, ToolInfo } from '@/api/model'
import { PROVIDER_NAME_MAPPING } from '@/constants'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

interface ModelSelectorV3Props {
  onModelToggle?: (modelId: string, checked: boolean) => void
  onAutoToggle?: (enabled: boolean) => void
}

const ModelSelectorV3: React.FC<ModelSelectorV3Props> = ({
  onModelToggle,
  onAutoToggle
}) => {
  const {
    textModel,
    setTextModel,
    textModels,
    selectedTools,
    setSelectedTools,
    allTools,
  } = useConfigs()

  const [activeTab, setActiveTab] = useState<'image' | 'video' | 'text'>('image')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const { t } = useTranslation()

  // 初始化时判断auto模式：如果所有工具都被选中，则为auto模式
  const initialAutoMode = allTools.length > 0 && selectedTools.length === allTools.length
  const [autoMode, setAutoMode] = useState(initialAutoMode)

  const hasType = (
    modelType: ModelInfo['type'],
    target: 'text' | 'image' | 'video'
  ) =>
    Array.isArray(modelType) ? modelType.includes(target) : modelType === target

  const groupItemsByProvider = <T extends { provider: string }>(items: T[]) => {
    const grouped: { [provider: string]: T[] } = {}
    items?.forEach((item) => {
      if (!grouped[item.provider]) {
        grouped[item.provider] = []
      }
      grouped[item.provider].push(item)
    })
    return grouped
  }

  const sortProviders = <T,>(grouped: { [provider: string]: T[] }) => {
    const sortedEntries = Object.entries(grouped).sort(([a], [b]) => {
      if (a === 'jaaz') return -1
      if (b === 'jaaz') return 1
      return a.localeCompare(b)
    })
    return Object.fromEntries(sortedEntries)
  }

  const getModelsByType = (type: 'text' | 'image' | 'video') =>
    (textModels || []).filter((model): model is ModelInfo & { type: NonNullable<ModelInfo['type']> } => {
      const modelType = model.type
      if (modelType === undefined) return false
      return hasType(modelType, type)
    })

  const groupedLLMs = sortProviders(groupItemsByProvider(getModelsByType('text')))
  const groupedTools = sortProviders(groupItemsByProvider(allTools))

  const getToolsByType = (type: 'image' | 'video') => {
    const filteredTools = allTools.filter((tool) => tool.type === type)
    return sortProviders(groupItemsByProvider(filteredTools))
  }

  const getCurrentModels = () => {
    if (activeTab === 'text') {
      return groupedLLMs
    }

    const modelsByType = getModelsByType(activeTab)
    const toolGroups = getToolsByType(activeTab)
    // Convert models to ToolInfo-like items, but avoid duplicating entries
    // that already exist in toolGroups (same provider and id).
    const modelLikeItems = modelsByType
      .map((model) => ({
        provider: model.provider,
        id: model.model,
        display_name: model.model,
        type: activeTab,
      }) as ToolInfo)
      .filter((m) => {
        const providerTools = toolGroups[m.provider] || []
        const existingIds = providerTools.map((t) => t.id)
        return !existingIds.includes(m.id)
      })

    const modelItems = groupItemsByProvider(modelLikeItems)

    // Merge tool and model groups so provider groups can contain both tools and multi-type models
    const mergedGroups = { ...toolGroups }
    for (const provider of Object.keys(modelItems)) {
      mergedGroups[provider] = [
        ...(mergedGroups[provider] || []),
        ...modelItems[provider],
      ]
    }
    return sortProviders(mergedGroups)
  }

  const getSelectedModelKey = (item: ModelInfo | ToolInfo) =>
    'model' in item ? `${item.provider}:${item.model}` : `${item.provider}:${item.id}`

  const getSelectedModelName = (item: ModelInfo | ToolInfo) =>
    'model' in item ? item.model : item.display_name || item.id

  const handleModelToggle = (modelKey: string, checked: boolean) => {
    if (activeTab === 'text') {
      const model = textModels?.find((m) => `${m.provider}:${m.model}` === modelKey)
      if (model) {
        setTextModel(model)
        localStorage.setItem('text_model', modelKey)
      }
    } else {
      let newSelected: ToolInfo[] = []
      const tool = allTools.find((m) => `${m.provider}:${m.id}` === modelKey)
      const model = getModelsByType(activeTab).find(
        (m) => `${m.provider}:${m.model}` === modelKey
      )

      if (checked) {
        if (tool) {
          newSelected = [...selectedTools, tool]
        } else if (model) {
          newSelected = [
            ...selectedTools,
            {
              provider: model.provider,
              id: model.model,
              display_name: model.model,
              type: activeTab,
            },
          ]
        }
      } else {
        newSelected = selectedTools.filter(
          (t) => `${t.provider}:${t.id}` !== modelKey
        )
      }

      setSelectedTools(newSelected)
      localStorage.setItem(
        'disabled_tool_ids',
        JSON.stringify(
          allTools.filter((t) => !newSelected.some((selected) => selected.provider === t.provider && selected.id === t.id)).map((t) => t.id)
        )
      )

      const isAuto = newSelected.length === allTools.length
      setAutoMode(isAuto)
    }
    onModelToggle?.(modelKey, checked)
  }

  const handleModelClick = (modelKey: string) => {
    if (activeTab === 'text') {
      const model = textModels?.find((m) => `${m.provider}:${m.model}` === modelKey)
      if (model) {
        setTextModel(model)
        localStorage.setItem('text_model', modelKey)
        onModelToggle?.(modelKey, true)
      }
      return
    }

    if (autoMode) {
      setAutoMode(false)
      const tool = allTools.find((m) => `${m.provider}:${m.id}` === modelKey)
      if (tool) {
        setSelectedTools([tool])
        localStorage.setItem(
          'disabled_tool_ids',
          JSON.stringify(allTools.filter((t) => t.id !== tool.id).map((t) => t.id))
        )
        onModelToggle?.(modelKey, true)
      } else {
        const model = getModelsByType(activeTab).find(
          (m) => `${m.provider}:${m.model}` === modelKey
        )
        if (model) {
          setSelectedTools([
            {
              provider: model.provider,
              id: model.model,
              display_name: model.model,
              type: activeTab,
            },
          ])
          onModelToggle?.(modelKey, true)
        }
      }
      return
    }

    const isSelected = selectedTools.some(
      (t) => `${t.provider}:${t.id}` === modelKey
    )
    handleModelToggle(modelKey, !isSelected)
  }

  const handleAutoToggle = (enabled: boolean) => {
    if (activeTab === 'text') {
      return
    }

    if (enabled) {
      setSelectedTools(allTools)
      localStorage.setItem('disabled_tool_ids', JSON.stringify([]))
    } else {
      const imageTools = allTools.filter((tool) => tool.type === 'image')
      const videoTools = allTools.filter((tool) => tool.type === 'video')

      const firstImageTool = imageTools.length > 0 ? imageTools[0] : null
      const firstVideoTool = videoTools.length > 0 ? videoTools[0] : null

      const selectedToolsList: ToolInfo[] = []
      if (firstImageTool) selectedToolsList.push(firstImageTool)
      if (firstVideoTool) selectedToolsList.push(firstVideoTool)

      if (selectedToolsList.length > 0) {
        setSelectedTools(selectedToolsList)
        localStorage.setItem(
          'disabled_tool_ids',
          JSON.stringify(
            allTools.filter((t) => !selectedToolsList.some((selected) => selected.provider === t.provider && selected.id === t.id)).map((t) => t.id)
          )
        )
      }
    }
    setAutoMode(enabled)
    onAutoToggle?.(enabled)
  }

  // Get selected models count
  const getSelectedModelsCount = () => {
    if (activeTab === 'text') {
      return textModel ? 1 : 0
    }
    return selectedTools.length
  }

  const isModelSelected = (modelKey: string) => {
    if (activeTab === 'text') {
      return textModel?.provider + ':' + textModel?.model === modelKey
    }
    return selectedTools.some((t) => `${t.provider}:${t.id}` === modelKey)
  }

  // Get provider display info
  const getProviderDisplayInfo = (provider: string) => {
    const providerInfo = PROVIDER_NAME_MAPPING[provider]
    return {
      name: providerInfo?.name || provider,
      icon: providerInfo?.icon,
    }
  }

  const tabs = [
    { id: 'image', label: t('chat:modelSelector.tabs.image') },
    { id: 'video', label: t('chat:modelSelector.tabs.video') },
    { id: 'text', label: t('chat:modelSelector.tabs.text') }
  ] as const

  return (
    <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
      <DropdownMenuTrigger asChild>
        <button
          className={`group inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium transition-all duration-200 cursor-pointer select-none
            ${autoMode
              ? 'bg-primary/8 text-primary border border-primary/15 hover:bg-primary/12 hover:border-primary/25'
              : 'bg-primary/12 text-primary border border-primary/25 hover:bg-primary/18 hover:border-primary/35'
            }`}
        >
          {autoMode ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path d="M4 4m0 1a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z" /><path d="M4 14m0 1a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z" /><path d="M14 14m0 1a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z" /><path d="M14 7l6 0" /><path d="M17 4l0 6" /></svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="icon icon-tabler icons-tabler-filled icon-tabler-apps"><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path d="M9 3h-4a2 2 0 0 0 -2 2v4a2 2 0 0 0 2 2h4a2 2 0 0 0 2 -2v-4a2 2 0 0 0 -2 -2z" /><path d="M9 13h-4a2 2 0 0 0 -2 2v4a2 2 0 0 0 2 2h4a2 2 0 0 0 2 -2v-4a2 2 0 0 0 -2 -2z" /><path d="M19 13h-4a2 2 0 0 0 -2 2v4a2 2 0 0 0 2 2h4a2 2 0 0 0 2 -2v-4a2 2 0 0 0 -2 -2z" /><path d="M17 3a1 1 0 0 1 .993 .883l.007 .117v2h2a1 1 0 0 1 .117 1.993l-.117 .007h-2v2a1 1 0 0 1 -1.993 .117l-.007 -.117v-2h-2a1 1 0 0 1 -.117 -1.993l.117 -.007h2v-2a1 1 0 0 1 1 -1z" /></svg>
          )}
          <span>{autoMode ? t('chat:modelSelector.auto') : `${getSelectedModelsCount()} ${activeTab}`}</span>
          <ChevronDown className="size-3 opacity-40 group-hover:opacity-70 transition-opacity" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-96 select-none p-0 overflow-hidden rounded-xl border-border/50 shadow-xl shadow-black/10">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-muted/30">
          <div className="flex items-center gap-2">
            <Sparkles className="size-3.5 text-primary" />
            <span className="text-sm font-semibold">{t('chat:modelSelector.title')}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={cn(
              'text-xs transition-colors',
              autoMode ? 'text-primary font-medium' : 'text-muted-foreground'
            )}>
              {t('chat:modelSelector.auto')}
            </span>
            <Switch
              checked={autoMode}
              onCheckedChange={handleAutoToggle}
              className="scale-90"
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex p-1.5 bg-muted/40 mx-3 my-2 rounded-lg">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 cursor-pointer
                ${activeTab === tab.id
                  ? 'bg-background text-foreground shadow-sm ring-1 ring-border/50'
                  : 'text-muted-foreground hover:text-foreground'
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Models List */}
        <ScrollArea>
          <div className="max-h-80 h-80 px-2.5 pb-3 select-none">
            {Object.entries(getCurrentModels()).map(([provider, providerModels], index, array) => {
              const providerInfo = getProviderDisplayInfo(provider)
              const isLastGroup = index === array.length - 1
              return (
                <DropdownMenuGroup key={provider}>
                  <DropdownMenuLabel className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wider px-2 py-2 flex items-center gap-2">
                    {providerInfo.icon ? (
                      <img
                        src={providerInfo.icon}
                        alt={providerInfo.name}
                        className="w-3.5 h-3.5 rounded-full ring-1 ring-border/30"
                      />
                    ) : (
                      <div className="w-3.5 h-3.5 rounded-full bg-muted ring-1 ring-border/30" />
                    )}
                    {providerInfo.name}
                  </DropdownMenuLabel>
                  {providerModels.map((model: ModelInfo | ToolInfo) => {
                    const modelKey = getSelectedModelKey(model)
                    const modelName = getSelectedModelName(model)
                    const isSelected = isModelSelected(modelKey)
                    const modelType = 'type' in model ? model.type : activeTab

                    return (
                      <div
                        key={modelKey}
                        className={cn(
                          'group flex items-center gap-2.5 px-2.5 py-2 rounded-lg mb-0.5 cursor-pointer transition-all duration-150',
                          isSelected
                            ? 'bg-primary/8 ring-1 ring-primary/15'
                            : 'hover:bg-muted/60'
                        )}
                        onClick={() => handleModelClick(modelKey)}
                      >
                        {/* Type indicator */}
                        <div className={cn(
                          'flex items-center justify-center w-7 h-7 rounded-md shrink-0 transition-colors',
                          isSelected
                            ? 'bg-primary/15 text-primary'
                            : 'bg-muted/70 text-muted-foreground group-hover:bg-muted'
                        )}>
                          {modelType === 'image' && <ImageIcon className="size-3.5" />}
                          {modelType === 'video' && <Video className="size-3.5" />}
                          {modelType === 'text' && <FileText className="size-3.5" />}
                        </div>

                        {/* Name */}
                        <div className="flex-1 min-w-0">
                          <div className={cn(
                            'text-sm truncate',
                            isSelected ? 'font-medium text-primary' : 'font-normal text-foreground'
                          )}>
                            {modelName}
                          </div>
                        </div>

                        {/* Selection indicator */}
                        <div className={cn(
                          'flex items-center justify-center w-4 h-4 rounded-full shrink-0 transition-all',
                          isSelected
                            ? 'bg-primary text-primary-foreground scale-100'
                            : 'border border-border/60 scale-90 opacity-0 group-hover:opacity-100',
                          autoMode && activeTab !== 'text' && 'opacity-40'
                        )}>
                          {isSelected && <Check className="size-3" strokeWidth={3} />}
                        </div>
                      </div>
                    )
                  })}
                  {!isLastGroup && <DropdownMenuSeparator className="my-1.5 opacity-50" />}
                </DropdownMenuGroup>
              )
            })}
          </div>
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default ModelSelectorV3
