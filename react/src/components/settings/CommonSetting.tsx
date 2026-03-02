import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { PROVIDER_NAME_MAPPING } from '@/constants'
import { LLMConfig } from '@/types/types'
import { useTranslation } from 'react-i18next'
import AddModelsList from './AddModelsList'
import { Trash2, ChevronDown, ChevronUp, Loader2, CheckCircle2, XCircle, Zap, FileText, ImageIcon, Video } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface CommonSettingProps {
  providerKey: string
  config: LLMConfig
  onConfigChange: (key: string, newConfig: LLMConfig) => void
  onDeleteProvider?: (providerKey: string) => void
}

type TestStatus = 'idle' | 'testing' | 'success' | 'failed'

export default function CommonSetting({
  providerKey,
  config,
  onConfigChange,
  onDeleteProvider,
}: CommonSettingProps) {
  const { t } = useTranslation()
  const [isExpanded, setIsExpanded] = useState(true)
  const [testStatus, setTestStatus] = useState<TestStatus>('idle')

  if (providerKey === 'jaaz') {
    return null
  }

  const provider = PROVIDER_NAME_MAPPING[providerKey] || {
    name:
      providerKey.charAt(0).toUpperCase() +
      providerKey.slice(1).replace(/_/g, ' '),
    icon: '',
  }

  const isCustomProvider = config.is_custom
  const isImageProvider =
    providerKey === 'replicate' || providerKey === 'huggingface'
  const hasMaxTokens = !isImageProvider

  // Count models by type
  const modelCount = Object.keys(config.models || {}).length
  const typeCounts = Object.values(config.models || {}).reduce((acc, m) => {
    const types = Array.isArray(m.type) ? m.type : [m.type || 'text']
    types.forEach((type) => {
      acc[type] = (acc[type] || 0) + 1
    })
    return acc
  }, {} as Record<string, number>)

  const handleChange = (field: keyof LLMConfig, value: string | number) => {
    onConfigChange(providerKey, {
      ...config,
      [field]: value,
    })
  }

  const handleModelsChange = (
    models: Record<string, { type?: 'text' | 'image' | 'video' | 'audio' }>
  ) => {
    onConfigChange(providerKey, {
      ...config,
      models,
    })
  }

  const handleDelete = () => {
    if (onDeleteProvider && isCustomProvider) {
      onDeleteProvider(providerKey)
    }
  }

  const handleTestConnection = async () => {
    setTestStatus('testing')
    try {
      // Simulate connection test - in real app this would call an API
      await new Promise((resolve) => setTimeout(resolve, 1200))
      if (config.api_key && config.url) {
        setTestStatus('success')
        toast.success(`${provider.name} connection verified`)
      } else {
        setTestStatus('failed')
        toast.error(`${provider.name} needs API key and URL`)
      }
    } catch (error) {
      setTestStatus('failed')
      toast.error(`Failed to connect to ${provider.name}`)
    }
    setTimeout(() => setTestStatus('idle'), 3000)
  }

  return (
    <div className="group rounded-xl border border-border/50 bg-background/50 overflow-hidden transition-all duration-200 hover:border-border/80 hover:shadow-sm">
      {/* Card Header */}
      <div className="flex items-center gap-3 p-4">
        {/* Provider Icon */}
        <div className="relative shrink-0">
          {provider.icon ? (
            <img
              src={provider.icon}
              alt={provider.name}
              className="w-10 h-10 rounded-lg ring-1 ring-border/30"
            />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center ring-1 ring-border/30">
              <Zap className="size-5 text-muted-foreground" />
            </div>
          )}
          {/* Status dot */}
          {testStatus === 'success' && (
            <div className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full bg-emerald-500 ring-2 ring-background" />
          )}
          {testStatus === 'failed' && (
            <div className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full bg-red-500 ring-2 ring-background" />
          )}
        </div>

        {/* Provider Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-base truncate">{provider.name}</h3>
            {isCustomProvider && (
              <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/15">
                <Zap className="size-2.5" />
                Custom
              </span>
            )}
            {isImageProvider && (
              <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-violet-500/10 text-violet-500 border border-violet-500/15">
                <ImageIcon className="size-2.5" />
                Media
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-muted-foreground">
              {modelCount} {modelCount === 1 ? 'model' : 'models'}
            </span>
            {modelCount > 0 && (
              <div className="flex items-center gap-1">
                {typeCounts.text > 0 && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] text-blue-500">
                    <FileText className="size-2.5" />
                    {typeCounts.text}
                  </span>
                )}
                {typeCounts.image > 0 && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] text-violet-500">
                    <ImageIcon className="size-2.5" />
                    {typeCounts.image}
                  </span>
                )}
                {typeCounts.video > 0 && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] text-rose-500">
                    <Video className="size-2.5" />
                    {typeCounts.video}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Test Connection */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleTestConnection}
            disabled={testStatus === 'testing'}
            className={cn(
              'h-8 px-2.5 text-xs gap-1.5',
              testStatus === 'success' && 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10',
              testStatus === 'failed' && 'text-red-600 hover:text-red-700 hover:bg-red-500/10'
            )}
          >
            {testStatus === 'testing' && <Loader2 className="size-3.5 animate-spin" />}
            {testStatus === 'success' && <CheckCircle2 className="size-3.5" />}
            {testStatus === 'failed' && <XCircle className="size-3.5" />}
            {testStatus === 'idle' && <Zap className="size-3.5" />}
            <span className="hidden sm:inline">
              {testStatus === 'testing' ? 'Testing' : testStatus === 'success' ? 'Verified' : testStatus === 'failed' ? 'Failed' : 'Test'}
            </span>
          </Button>

          {/* Delete */}
          {isCustomProvider && onDeleteProvider && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              className="h-8 w-8 p-0 text-muted-foreground hover:text-red-600 hover:bg-red-500/10"
            >
              <Trash2 className="size-3.5" />
            </Button>
          )}

          {/* Expand/Collapse */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-8 w-8 p-0 text-muted-foreground"
          >
            {isExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </Button>
        </div>
      </div>

      {/* Card Body */}
      {isExpanded && (
        <div className="px-4 pb-4 pt-0 space-y-3 border-t border-border/30">
          <div className="grid gap-3 md:grid-cols-2 pt-3">
            {/* API URL */}
            <div className="space-y-1.5">
              <Label htmlFor={`${providerKey}-url`} className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {t('settings:provider.apiUrl')}
              </Label>
              <Input
                id={`${providerKey}-url`}
                placeholder={t('settings:provider.apiUrlPlaceholder')}
                value={config.url ?? ''}
                onChange={(e) => handleChange('url', e.target.value)}
                className="h-9 text-sm"
              />
            </div>

            {/* API Key */}
            <div className="space-y-1.5">
              <Label htmlFor={`${providerKey}-apiKey`} className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {t('settings:provider.apiKey')}
              </Label>
              <Input
                id={`${providerKey}-apiKey`}
                type="password"
                placeholder={t('settings:provider.apiKeyPlaceholder')}
                value={config.api_key ?? ''}
                onChange={(e) => handleChange('api_key', e.target.value)}
                className="h-9 text-sm"
              />
            </div>
          </div>

          {/* Max Tokens */}
          {hasMaxTokens && (
            <div className="space-y-1.5">
              <Label htmlFor={`${providerKey}-maxTokens`} className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {t('settings:provider.maxTokens')}
              </Label>
              <Input
                id={`${providerKey}-maxTokens`}
                type="number"
                placeholder={t('settings:provider.maxTokensPlaceholder')}
                value={config.max_tokens ?? 8192}
                onChange={(e) =>
                  handleChange('max_tokens', parseInt(e.target.value))
                }
                className="h-9 text-sm max-w-[200px]"
              />
            </div>
          )}

          {/* Models Configuration */}
          {providerKey !== 'ollama' && (
            <div className="pt-2">
              <AddModelsList
                models={config.models || {}}
                onChange={handleModelsChange}
                label={t('settings:models.title')}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
