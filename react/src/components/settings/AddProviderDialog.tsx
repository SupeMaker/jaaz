import CommonDialogContent from '@/components/common/DialogContent'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { LLMConfig } from '@/types/types'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import AddModelsList from './AddModelsList'
import { toast } from 'sonner'
import { Palette, Film, Search, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AddProviderDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (providerKey: string, config: LLMConfig) => void
}

// Predefined provider options with their API URLs
const PROVIDER_OPTIONS = [
  {
    value: 'anthropic',
    label: 'Claude',
    data: {
      apiUrl: 'https://api.anthropic.com/v1/',
      models: {
        'claude-3-7-sonnet-latest': { type: 'text' },
      },
    },
  },
  {
    value: 'OpenRouter',
    label: 'OpenRouter',
    data: {
      apiUrl: 'https://openrouter.ai/api/v1/',
      models: {
        'openai/gpt-4o': { type: 'text' },
        'deepseek/deepseek-chat-v3-0324': { type: 'text' },
        'deepseek/deepseek-chat-v3-0324:free': { type: 'text' },
      },
    },
  },
  {
    value: 'wavespeed',
    label: 'Wavespeed',
    mediaOnly: true,
    data: {
      apiUrl: 'https://api.wavespeed.ai/api/v3/',
      models: {},
      api_key: '',
    },
  },
  {
    value: 'replicate',
    label: 'Replicate',
    mediaOnly: true,
    data: {
      apiUrl: 'https://api.replicate.com/v1/',
      models: {},
      api_key: '',
      max_tokens: 8192,
    },
  },
  {
    value: '深度求索',
    label: '深度求索 (DeepSeek)',
    data: {
      apiUrl: 'https://api.deepseek.com/v1/',
      models: {
        'deepseek-chat': { type: 'text' },
      },
    },
  },
  {
    value: 'volces',
    label: '火山引擎 (Volces)',
    data: {
      apiUrl: 'https://ark.cn-beijing.volces.com/api/v3/',
      models: {
        'doubao-seed-1-6-250615': { type: 'text' },
        'doubao-seed-1-6-thinking-250615': { type: 'text' },
        'doubao-seed-1-6-flash-250615': { type: 'text' },
        'doubao-seedream-3-0-t2i-250415': { type: 'image' },
        'doubao-seedance-1-0-pro-250528': { type: 'video' },
        'doubao-seedance-1-0-lite-i2v-250428': { type: 'video' },
        'doubao-seedance-1-0-lite-t2v-250428': { type: 'video' },
      },
    },
  },
  {
    value: 'GoogleVertex',
    label: 'GoogleVertex',
    data: {
      apiUrl: '',
      models: {
        'gemini-2.5-flash': { type: 'text' },
        'gemini-2.5-pro': { type: 'text' },
        'gemini-2.5-flash-lite-preview-06-17': { type: 'text' },
        'gemini-2.0-flash': { type: 'text' },
        'gemini-2.0-flash-lite': { type: 'text' },
        // not supported yet!
        // 'gemini-2.0-flash-preview-image-generation': { type: 'image' },
        // 'imagen-4.0-generate-preview-06-06': { type: 'image' },
        // 'imagen-4.0-fast-generate-preview-06-06': { type: 'image' },
        // 'imagen-4.0-ultra-generate-preview-06-06': { type: 'image' },
        // 'imagen-3.0-generate-002': { type: 'image' },
        // 'imagen-3.0-fast-generate-001': { type: 'image' },
        // 'veo-3.0-generate-preview': { type: 'video' },
        // 'veo-2.0-generate-001': { type: 'video' },
      },
    },
  },
  {
    value: '硅基流动',
    label: '硅基流动 (SiliconFlow)',
    data: { apiUrl: 'https://api.siliconflow.cn/v1/' },
  },
  {
    value: '智谱 AI',
    label: '智谱 AI (GLM)',
    data: { apiUrl: 'https://open.bigmodel.cn/api/paas/v4/' },
  },
  {
    value: '月之暗面',
    label: '月之暗面 (Kimi)',
    data: { apiUrl: 'https://api.moonshot.cn/v1/' },
  },
]

export default function AddProviderDialog({
  open,
  onOpenChange,
  onSave,
}: AddProviderDialogProps) {
  const { t } = useTranslation()
  const [providerName, setProviderName] = useState('')
  const [apiUrl, setApiUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [models, setModels] = useState<
    Record<string, { type?: 'text' | 'image' | 'video' }>
  >({})
  const [searchQuery, setSearchQuery] = useState('')

  const selectedProvider = PROVIDER_OPTIONS.find((p) => p.value === providerName)
  const isMediaOnlyProvider = selectedProvider?.mediaOnly ?? false

  // Filter providers by search query
  const filteredProviders = useMemo(() => {
    if (!searchQuery.trim()) return PROVIDER_OPTIONS
    const q = searchQuery.toLowerCase()
    return PROVIDER_OPTIONS.filter(
      (p) =>
        p.label.toLowerCase().includes(q) ||
        p.value.toLowerCase().includes(q)
    )
  }, [searchQuery])

  // Handle data change when provider is selected
  const handleProviderDataChange = (data: any) => {
    if (data && typeof data === 'object' && 'apiUrl' in data) {
      setApiUrl((data as { apiUrl: string }).apiUrl)
      setModels(data.models ?? {})
    }
  }

  const handleSelectProvider = (option: (typeof PROVIDER_OPTIONS)[number]) => {
    setProviderName(option.value)
    handleProviderDataChange(option.data)
  }

  const handleSave = () => {
    if (!providerName.trim() || !apiUrl.trim()) {
      return
    }
    if (
      !PROVIDER_OPTIONS.find((p) => p.value === providerName)?.mediaOnly &&
      Object.keys(models).length === 0
    ) {
      toast.error(t('settings:provider.noModelsSelected'))
      return
    }

    const config: LLMConfig = {
      models,
      url: apiUrl,
      api_key: apiKey,
      max_tokens: 8192,
      is_custom: true,
    }

    // Use provider name as key (convert to lowercase and replace spaces with underscores)
    const providerKey = providerName.toLowerCase().replace(/\s+/g, '_')

    onSave(providerKey, config)

    // Reset form
    setProviderName('')
    setApiUrl('')
    setApiKey('')
    setModels({})
    setSearchQuery('')
    onOpenChange(false)
  }

  const handleCancel = () => {
    // Reset form
    setProviderName('')
    setApiUrl('')
    setApiKey('')
    setModels({})
    setSearchQuery('')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <CommonDialogContent open={open}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {t('settings:provider.addProvider')}
            {isMediaOnlyProvider && (
              <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-md bg-violet-500/10 text-violet-500 border border-violet-500/15">
                <Palette className="size-3" />
                <Film className="size-3" />
                Media Only
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto">
          {/* Provider Selection - Grid of small cards */}
          <div className="space-y-2">
            <Label>{t('settings:provider.providerName')}</Label>

            {/* Search input */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                placeholder={t('settings:provider.providerNamePlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 pl-8 text-sm"
              />
            </div>

            {/* Provider cards grid - left to right, top to bottom */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
              {filteredProviders.map((option) => {
                const isSelected = providerName === option.value
                const isMedia = option.mediaOnly
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleSelectProvider(option)}
                    className={cn(
                      'group relative flex items-center gap-2 px-2.5 py-2 rounded-lg border text-left text-xs font-medium transition-all duration-150 cursor-pointer',
                      'hover:bg-accent/50 hover:border-primary/30 active:scale-[0.98]',
                      isSelected
                        ? 'border-primary bg-primary/8 ring-1 ring-primary/20 text-primary'
                        : 'border-border/60 bg-background/40 text-foreground'
                    )}
                    title={option.label}
                  >
                    <span className="flex-1 truncate">{option.label}</span>
                    {isMedia && (
                      <Palette className="size-3 shrink-0 text-violet-500" />
                    )}
                    {isSelected && (
                      <Check className="size-3 shrink-0 text-primary" />
                    )}
                  </button>
                )
              })}
            </div>

            {filteredProviders.length === 0 && (
              <div className="text-center text-xs text-muted-foreground py-4">
                No providers found
              </div>
            )}
          </div>

          {/* Show full configuration only after a provider is selected */}
          {providerName && (
            <div className="space-y-4 pt-2 border-t border-border/40">
              {/* API URL */}
              <div className="space-y-2">
                <Label htmlFor="api-url">{t('settings:provider.apiUrl')}</Label>
                <Input
                  id="api-url"
                  placeholder={t('settings:provider.apiUrlPlaceholder')}
                  value={apiUrl}
                  onChange={(e) => setApiUrl(e.target.value)}
                />
              </div>

              {/* API Key */}
              <div className="space-y-2">
                <Label htmlFor="api-key">{t('settings:provider.apiKey')}</Label>
                <Input
                  id="api-key"
                  type="password"
                  placeholder={t('settings:provider.apiKeyPlaceholder')}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
              </div>

              {/* Models */}
              {!isMediaOnlyProvider && (
                <AddModelsList
                  models={models}
                  onChange={setModels}
                  label={t('settings:models.title')}
                />
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            {t('settings:provider.cancel')}
          </Button>
          <Button
            onClick={handleSave}
            disabled={!providerName.trim() || !apiUrl.trim()}
          >
            {t('settings:provider.save')}
          </Button>
        </DialogFooter>
      </CommonDialogContent>
    </Dialog>
  )
}
