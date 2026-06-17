import AddProviderDialog from '@/components/settings/AddProviderDialog'
import ComfyuiSetting from '@/components/settings/ComfyuiSetting'
import CommonSetting from '@/components/settings/CommonSetting'
import JaazSetting from '@/components/settings/JaazSetting'
import { Button } from '@/components/ui/button'
import useConfigsStore from '@/stores/configs'
import { LLMConfig } from '@/types/types'
import { getConfig, updateConfig } from '@/api/config'
import { useRefreshModels } from '@/contexts/configs'
import { Plus, Save, Loader2, Server, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

const SettingProviders = () => {
  const { t } = useTranslation()
  const { providers, setProviders } = useConfigsStore()
  const refreshModels = useRefreshModels()
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [isAddProviderDialogOpen, setIsAddProviderDialogOpen] = useState(false)

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const config: { [key: string]: LLMConfig } = await getConfig()
        setProviders(config)
      } catch (error) {
        console.error('Error loading configuration:', error)
        setErrorMessage(t('settings:messages.failedToLoad'))
      } finally {
        setIsLoading(false)
      }
    }

    loadConfig()
  }, [setProviders, t])

  const handleConfigChange = (key: string, newConfig: LLMConfig) => {
    setProviders({
      ...providers,
      [key]: newConfig,
    })
  }

  const handleAddProvider = (providerKey: string, newConfig: LLMConfig) => {
    setProviders({
      ...providers,
      [providerKey]: newConfig,
    })
  }

  const handleDeleteProvider = (providerKey: string) => {
    delete providers[providerKey]
    setProviders({
      ...providers,
    })
  }

  const handleSave = async () => {
    try {
      setIsSaving(true)
      setErrorMessage('')

      const result = await updateConfig(providers)

      if (result.status === 'success') {
        toast.success(result.message)
        refreshModels()
      } else {
        throw new Error(result.message || 'Failed to save configuration')
      }
    } catch (error) {
      console.error('Error saving settings:', error)
      setErrorMessage(t('settings:messages.failedToSave'))
      toast.error(t('settings:messages.failedToSave'))
    } finally {
      setIsSaving(false)
    }
  }

  const providerKeys = Object.keys(providers)
  const hasProviders = providerKeys.length > 0

  const renderProviderCard = (key: string) => {
    if (key === 'jaaz') {
      return <JaazSetting config={providers[key]} onConfigChange={handleConfigChange} />
    }
    if (key === 'comfyui') {
      return <ComfyuiSetting config={providers[key]} onConfigChange={handleConfigChange} />
    }
    return (
      <CommonSetting
        providerKey={key}
        config={providers[key]}
        onConfigChange={handleConfigChange}
        onDeleteProvider={handleDeleteProvider}
      />
    )
  }

  return (
    <div className="flex flex-col w-full h-full bg-muted/20">
      {/* Header */}
      <div className="border-b border-border/40 bg-background/80 backdrop-blur-xl sticky top-0 z-10">
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 max-w-[1600px] mx-auto">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center ring-1 ring-primary/15">
              <Sparkles className="size-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">{t('settings:provider.providers')}</h1>
              <p className="text-xs text-muted-foreground hidden sm:block">
                Manage AI providers, test connectivity, and configure models.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setIsAddProviderDialogOpen(true)}
              className="gap-2 h-9"
              disabled={isLoading}
            >
              <Plus className="size-4" />
              <span className="hidden sm:inline">{t('settings:provider.addProvider')}</span>
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving || isLoading}
              className="gap-2 h-9"
            >
              {isSaving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              <span className="hidden sm:inline">{t('settings:saveSettings')}</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="max-w-[1600px] mx-auto">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Loading providers...</p>
            </div>
          ) : !hasProviders ? (
            <div className="flex flex-col items-center justify-center h-96 gap-5 text-center">
              <div className="size-20 rounded-3xl bg-muted/50 flex items-center justify-center ring-1 ring-border/30">
                <Server className="size-10 text-muted-foreground/50" />
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-1">No providers configured</h3>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                  Add your first AI provider to start generating images, videos, and text.
                </p>
              </div>
              <Button onClick={() => setIsAddProviderDialogOpen(true)} className="gap-2">
                <Plus className="size-4" />
                {t('settings:provider.addProvider')}
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
              {providerKeys.map((key) => (
                <div key={key} className="min-w-0">
                  {renderProviderCard(key)}
                </div>
              ))}
            </div>
          )}

          {errorMessage && (
            <div className="text-red-500 text-center text-sm mt-6">{errorMessage}</div>
          )}
        </div>
      </div>

      <AddProviderDialog
        open={isAddProviderDialogOpen}
        onOpenChange={setIsAddProviderDialogOpen}
        onSave={handleAddProvider}
      />
    </div>
  )
}

export default SettingProviders
