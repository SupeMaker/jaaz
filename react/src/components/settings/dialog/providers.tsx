import AddProviderDialog from '@/components/settings/AddProviderDialog'
import ComfyuiSetting from '@/components/settings/ComfyuiSetting'
import CommonSetting from '@/components/settings/CommonSetting'
import JaazSetting from '@/components/settings/JaazSetting'
import { Button } from '@/components/ui/button'
import useConfigsStore from '@/stores/configs'
import { LLMConfig } from '@/types/types'
import { getConfig, updateConfig } from '@/api/config'
import { useRefreshModels } from '@/contexts/configs'
import { Plus, Save, Loader2, Server } from 'lucide-react'
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
  }, [])

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

  return (
    <div className="flex flex-col w-full h-full relative">
      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-4 pb-24">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Loading providers...</p>
          </div>
        ) : !hasProviders ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
            <div className="size-16 rounded-2xl bg-muted/50 flex items-center justify-center ring-1 ring-border/30">
              <Server className="size-8 text-muted-foreground/50" />
            </div>
            <div>
              <h3 className="text-base font-semibold mb-1">No providers configured</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                Add your first AI provider to start generating images, videos, and text.
              </p>
            </div>
            <Button onClick={() => setIsAddProviderDialogOpen(true)} className="gap-2">
              <Plus className="size-4" />
              {t('settings:provider.addProvider')}
            </Button>
          </div>
        ) : (
          <div className="space-y-3 max-w-3xl mx-auto">
            {providerKeys.map((key) => (
              <div key={key}>
                {key === 'jaaz' ? (
                  <JaazSetting
                    config={providers[key]}
                    onConfigChange={handleConfigChange}
                  />
                ) : key === 'comfyui' ? (
                  <ComfyuiSetting
                    config={providers[key]}
                    onConfigChange={handleConfigChange}
                  />
                ) : (
                  <CommonSetting
                    providerKey={key}
                    config={providers[key]}
                    onConfigChange={handleConfigChange}
                    onDeleteProvider={handleDeleteProvider}
                  />
                )}
              </div>
            ))}
          </div>
        )}

        {errorMessage && (
          <div className="text-red-500 text-center text-sm mt-4">{errorMessage}</div>
        )}
      </div>

      {/* Fixed Bottom Action Bar */}
      {!isLoading && hasProviders && (
        <div className="absolute bottom-0 left-0 right-0 border-t border-border/50 bg-background/80 backdrop-blur-xl px-4 py-3">
          <div className="flex items-center gap-2 max-w-3xl mx-auto">
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1 gap-2"
            >
              {isSaving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              {t('settings:saveSettings')}
            </Button>

            <Button
              variant="outline"
              onClick={() => setIsAddProviderDialogOpen(true)}
              className="gap-2"
            >
              <Plus className="size-4" />
              {t('settings:provider.addProvider')}
            </Button>
          </div>
        </div>
      )}

      <AddProviderDialog
        open={isAddProviderDialogOpen}
        onOpenChange={setIsAddProviderDialogOpen}
        onSave={handleAddProvider}
      />
    </div>
  )
}

export default SettingProviders
