import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Sparkles, Layers, History, Image as ImageIcon, X } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import SmartLayersPanel, { SmartLayer } from './SmartLayersPanel'
import HistorySnapshots, { Snapshot } from './HistorySnapshots'
import CampaignSuite, { CampaignAsset, CampaignPlatform } from './CampaignSuite'
import {
  listSnapshots,
  saveSnapshot,
  deleteSnapshot as deleteSnapshotApi,
  detectSmartLayers,
  listCampaignPlatforms,
  generateCampaign,
  CampaignPlatformInfo,
} from '@/api/canvasFeatures'
import { eventBus } from '@/lib/event'
import { useCanvas } from '@/contexts/canvas'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

type ActiveTab = 'layers' | 'history' | 'campaign' | null

interface CanvasFeaturesPanelProps {
  canvasId: string
  sessionId: string
  className?: string
}

/**
 * Floating toggleable panel that hosts the three "advanced" Canvas
 * features: SmartLayers, HistorySnapshots, and CampaignSuite.
 *
 * The panel can be expanded or collapsed via the toolbar button on the
 * right edge of the canvas. When expanded it overlays a vertical column
 * on the right side of the canvas area, with a tabbed switch.
 */
const CanvasFeaturesPanel: React.FC<CanvasFeaturesPanelProps> = ({
  canvasId,
  sessionId,
  className,
}) => {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<ActiveTab>('history')

  // Smart layers
  const [layers, setLayers] = useState<SmartLayer[]>([])
  const [isDetectingLayers, setIsDetectingLayers] = useState(false)

  // Snapshots
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])

  // Campaign
  const [campaignAssets, setCampaignAssets] = useState<CampaignAsset[]>([])
  const [isGeneratingCampaign, setIsGeneratingCampaign] = useState(false)
  const [platforms, setPlatforms] = useState<CampaignPlatformInfo[]>([])

  const { excalidrawAPI } = useCanvas()

  // Load platforms once
  useEffect(() => {
    let mounted = true
    listCampaignPlatforms()
      .then((p) => {
        if (!mounted) return
        setPlatforms(p)
        setCampaignAssets(
          p.map((info) => ({
            platform: info.platform as CampaignPlatform,
            title: info.platform,
            aspectRatio: info.aspect_ratio,
            dimensions: info.dimensions,
            status: 'pending' as const,
          }))
        )
      })
      .catch(() => {
        /* platforms will simply remain empty */
      })
    return () => {
      mounted = false
    }
  }, [])

  // Load snapshots
  const refreshSnapshots = useCallback(async () => {
    try {
      const data = await listSnapshots(canvasId)
      setSnapshots(data)
    } catch (e) {
      console.error('Failed to load snapshots:', e)
    }
  }, [canvasId])

  useEffect(() => {
    if (activeTab === 'history') {
      refreshSnapshots()
    }
  }, [activeTab, refreshSnapshots])

  // Auto-save a snapshot whenever a new image is added to the canvas
  useEffect(() => {
    const onImageGenerated = (data: { fileId?: string; prompt?: string }) => {
      if (!data?.fileId) return
      saveSnapshot({
        canvasId,
        label: `Snapshot ${new Date().toLocaleTimeString()}`,
        thumbnail: `/api/file/${data.fileId}`,
        prompt: data.prompt || '',
      })
        .then((snap) => {
          setSnapshots((prev) => [snap, ...prev])
        })
        .catch((e) => console.warn('Snapshot save failed', e))
    }
    eventBus.on('Canvas::ImageGenerated', onImageGenerated)
    return () => {
      eventBus.off('Canvas::ImageGenerated', onImageGenerated)
    }
  }, [canvasId])

  // Find the most recent image file id from the Excalidraw scene
  const findLatestImageFileId = useCallback((): string | null => {
    if (!excalidrawAPI) return null
    try {
      const elements = excalidrawAPI.getSceneElements()
      const imageElements = elements
        .filter((el: { type: string }) => el.type === 'image')
        .sort(
          (a: { updated: number }, b: { updated: number }) => b.updated - a.updated
        )
      for (const el of imageElements) {
        const fileId = (el as { fileId?: string }).fileId
        if (fileId) return fileId
      }
    } catch (e) {
      console.warn('Failed to read scene elements:', e)
    }
    return null
  }, [excalidrawAPI])

  // Trigger layer detection for the latest image
  const handleDetectLayers = useCallback(async () => {
    const fileId = findLatestImageFileId()
    if (!fileId) {
      toast.error('No image on canvas. Generate an image first.')
      return
    }
    setIsDetectingLayers(true)
    try {
      const detected = await detectSmartLayers(canvasId, fileId)
      setLayers(detected)
      toast.success(`${detected.length} layers detected`)
    } catch (e) {
      toast.error('Failed to detect layers')
    } finally {
      setIsDetectingLayers(false)
    }
  }, [canvasId, findLatestImageFileId])

  // Snapshot actions
  const handleSaveSnapshot = useCallback(async () => {
    const fileId = findLatestImageFileId()
    try {
      const snap = await saveSnapshot({
        canvasId,
        label: `Snapshot ${new Date().toLocaleTimeString()}`,
        thumbnail: fileId ? `/api/file/${fileId}` : '',
        prompt: '',
      })
      setSnapshots((prev) => [snap, ...prev])
      toast.success('Snapshot saved')
    } catch (e) {
      toast.error('Failed to save snapshot')
    }
  }, [canvasId, findLatestImageFileId])

  const handleDeleteSnapshot = useCallback(
    async (id: string) => {
      try {
        await deleteSnapshotApi(canvasId, id)
        setSnapshots((prev) => prev.filter((s) => s.id !== id))
        toast.success('Snapshot deleted')
      } catch (e) {
        toast.error('Failed to delete snapshot')
      }
    },
    [canvasId]
  )

  const handleRestoreSnapshot = useCallback(
    (id: string) => {
      const snap = snapshots.find((s) => s.id === id)
      if (!snap?.thumbnail) {
        toast.error('Nothing to restore')
        return
      }
      // Emit a generic event - the Excalidraw wrapper can decide what to do.
      eventBus.emit('Canvas::RestoreSnapshot', { id, thumbnail: snap.thumbnail })
      toast.info('Snapshot restore requested')
    },
    [snapshots]
  )

  // Campaign actions
  const handleGenerateCampaign = useCallback(
    async (platform: CampaignPlatform) => {
      const fileId = findLatestImageFileId()
      if (!fileId) {
        toast.error('No image on canvas. Generate an image first.')
        return
      }
      setCampaignAssets((prev) =>
        prev.map((a) =>
          a.platform === platform ? { ...a, status: 'generating' } : a
        )
      )
      try {
        const results = await generateCampaign({
          sessionId,
          canvasId,
          sourceImage: fileId,
          platforms: [platform],
        })
        const r = results[0]
        if (r?.status === 'done') {
          setCampaignAssets((prev) =>
            prev.map((a) =>
              a.platform === platform
                ? { ...a, status: 'done', thumbnail: r.result }
                : a
            )
          )
          toast.success(`${platform} ready`)
        } else {
          setCampaignAssets((prev) =>
            prev.map((a) =>
              a.platform === platform ? { ...a, status: 'pending' } : a
            )
          )
          toast.error(`${platform} failed`)
        }
      } catch (e) {
        setCampaignAssets((prev) =>
          prev.map((a) =>
            a.platform === platform ? { ...a, status: 'pending' } : a
          )
        )
        toast.error(`${platform} failed`)
      }
    },
    [canvasId, sessionId, findLatestImageFileId]
  )

  const handleGenerateAllCampaign = useCallback(async () => {
    const fileId = findLatestImageFileId()
    if (!fileId) {
      toast.error('No image on canvas. Generate an image first.')
      return
    }
    setIsGeneratingCampaign(true)
    setCampaignAssets((prev) =>
      prev.map((a) => ({ ...a, status: 'generating' }))
    )
    try {
      const results = await generateCampaign({
        sessionId,
        canvasId,
        sourceImage: fileId,
        platforms: platforms.map((p) => p.platform),
      })
      setCampaignAssets((prev) => {
        const byPlatform = new Map(results.map((r) => [r.platform, r]))
        return prev.map((a) => {
          const r = byPlatform.get(a.platform)
          if (!r) return a
          if (r.status === 'done') {
            return { ...a, status: 'done', thumbnail: r.result }
          }
          return { ...a, status: 'pending' as const }
        })
      })
      toast.success('Campaign generation complete')
    } catch (e) {
      toast.error('Campaign generation failed')
    } finally {
      setIsGeneratingCampaign(false)
    }
  }, [canvasId, sessionId, findLatestImageFileId, platforms])

  const tabs: Array<{ key: ActiveTab; icon: typeof Sparkles; label: string }> = [
    { key: 'history', icon: History, label: t('canvas:history.title', 'History') },
    { key: 'layers', icon: Layers, label: t('canvas:smartLayers.title', 'Layers') },
    {
      key: 'campaign',
      icon: Sparkles,
      label: t('canvas:campaignSuite.title', 'Campaign'),
    },
  ]

  return (
    <>
      {/* Floating toggle button - shown when panel is closed */}
      <AnimatePresence>
        {!activeTab && (
          <motion.button
            key="open-features"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            onClick={() => setActiveTab('history')}
            className="absolute right-3 top-1/2 -translate-y-1/2 z-30
                       flex items-center justify-center size-9 rounded-full
                       bg-background/90 backdrop-blur border border-border/60
                       shadow-md hover:bg-primary/10 hover:border-primary/30
                       text-muted-foreground hover:text-primary
                       transition-all cursor-pointer"
            title="Canvas features"
          >
            <Sparkles className="size-4" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Expanded panel */}
      <AnimatePresence>
        {activeTab && (
          <motion.div
            key="features-panel"
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 40 }}
            transition={{ type: 'spring', stiffness: 280, damping: 28 }}
            className={cn(
              'absolute right-3 top-1/2 -translate-y-1/2 z-30 w-80 max-w-[90vw]',
              'flex flex-col rounded-xl border border-border/60 bg-background/95 backdrop-blur shadow-xl',
              className
            )}
          >
            {/* Header with tab switcher */}
            <div className="flex items-center gap-1 p-2 border-b border-border/40">
              {tabs.map((tab) => {
                const Icon = tab.icon
                const isActive = activeTab === tab.key
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-1.5 h-8 px-2 rounded-md text-xs font-medium transition-colors cursor-pointer',
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                    )}
                  >
                    <Icon className="size-3.5" />
                    <span className="truncate">{tab.label}</span>
                  </button>
                )
              })}
              <button
                onClick={() => setActiveTab(null)}
                className="size-7 flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted/60 hover:text-foreground cursor-pointer"
                title="Close panel"
              >
                <X className="size-3.5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-3 max-h-[60vh] overflow-y-auto">
              {activeTab === 'history' && (
                <div className="space-y-2">
                  <button
                    onClick={handleSaveSnapshot}
                    className="w-full h-8 rounded-md bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors"
                  >
                    + Save Current Snapshot
                  </button>
                  <HistorySnapshots
                    snapshots={snapshots}
                    onRestore={handleRestoreSnapshot}
                    onDelete={handleDeleteSnapshot}
                  />
                </div>
              )}

              {activeTab === 'layers' && (
                <div className="space-y-2">
                  <button
                    onClick={handleDetectLayers}
                    disabled={isDetectingLayers}
                    className="w-full h-8 rounded-md bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isDetectingLayers
                      ? 'Detecting...'
                      : 'Detect Layers for Latest Image'}
                  </button>
                  <SmartLayersPanel
                    layers={layers}
                    onToggleVisible={(id) =>
                      setLayers((prev) =>
                        prev.map((l) =>
                          l.id === id ? { ...l, visible: !l.visible } : l
                        )
                      )
                    }
                    onToggleLock={(id) =>
                      setLayers((prev) =>
                        prev.map((l) =>
                          l.id === id ? { ...l, locked: !l.locked } : l
                        )
                      )
                    }
                    onOpacityChange={(id, opacity) =>
                      setLayers((prev) =>
                        prev.map((l) =>
                          l.id === id ? { ...l, opacity } : l
                        )
                      )
                    }
                  />
                </div>
              )}

              {activeTab === 'campaign' && (
                <CampaignSuite
                  assets={campaignAssets}
                  onGenerate={handleGenerateCampaign}
                  onGenerateAll={handleGenerateAllCampaign}
                />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

export default CanvasFeaturesPanel
