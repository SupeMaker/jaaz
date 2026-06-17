import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  X,
  Sticker,
  Loader2,
  MousePointer2,
  Move,
  RotateCcw,
  Sun,
  Square,
  CloudFog,
  Wand2,
  Upload,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { mockup, composeImages } from '@/api/directEdit'
import { uploadImage } from '@/api/upload'
import { eventBus, TCanvasImageAddedEvent } from '@/lib/event'
import { useTranslation } from 'react-i18next'
import { nanoid } from 'nanoid'
import { useCanvas } from '@/contexts/canvas'
import { cn } from '@/lib/utils'

interface MockupDialogProps {
  open: boolean
  onClose: () => void
  targetFileId: string
  targetImageUrl: string
  sessionId: string
  canvasId: string
}

interface CanvasImageOption {
  fileId: string
  url: string
  width: number
  height: number
  label: string
}

const DEFAULTS = {
  x: 0.5,
  y: 0.5,
  scale: 0.25,
  rotate: 0,
  opacity: 1,
  shadow: true,
  cornerRadius: 0,
  blendMode: 'auto',
}

const BLEND_MODES = [
  'auto',
  'overlay',
  'multiply',
  'screen',
  'soft_light',
  'hard_light',
  'normal',
] as const

/**
 * Mockup / 贴纸粘贴对话框（Lovart Mockup 风格）。
 *
 * 用户选择或上传设计图，在目标图上拖拽定位并实时预览，
 * 然后调用后端 /api/mockup 合成并保存到画布。
 */
const MockupDialog: React.FC<MockupDialogProps> = ({
  open,
  onClose,
  targetFileId,
  targetImageUrl,
  sessionId,
  canvasId,
}) => {
  const { t } = useTranslation()
  const { excalidrawAPI } = useCanvas()

  const [designOptions, setDesignOptions] = useState<CanvasImageOption[]>([])
  const [designFileId, setDesignFileId] = useState<string>('')
  const [x, setX] = useState(DEFAULTS.x)
  const [y, setY] = useState(DEFAULTS.y)
  const [scale, setScale] = useState(DEFAULTS.scale)
  const [rotate, setRotate] = useState(DEFAULTS.rotate)
  const [opacity, setOpacity] = useState(DEFAULTS.opacity)
  const [shadow, setShadow] = useState(DEFAULTS.shadow)
  const [cornerRadius, setCornerRadius] = useState(DEFAULTS.cornerRadius)
  const [blendMode, setBlendMode] = useState(DEFAULTS.blendMode)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [dragMode, setDragMode] = useState<'none' | 'move' | 'scale'>('none')
  const [dragStart, setDragStart] = useState({
    clientX: 0,
    clientY: 0,
    x: 0,
    y: 0,
    scale: 0,
  })

  const targetRef = useRef<HTMLImageElement>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [targetSize, setTargetSize] = useState({ width: 0, height: 0 })

  const collectDesignOptions = useCallback(() => {
    const options: CanvasImageOption[] = []
    if (!excalidrawAPI) return options

    const elements = excalidrawAPI.getSceneElements()
    const files = excalidrawAPI.getFiles()
    elements.forEach((el) => {
      if (el.type !== 'image' || !el.fileId) return

      const file = files[el.fileId]
      if (!file) return

      const isBase64 = file.dataURL.startsWith('data:')
      const resolvedId = isBase64
        ? file.id
        : file.dataURL.split('/').pop() || el.fileId

      if (resolvedId === targetFileId || el.fileId === targetFileId) return

      options.push({
        fileId: resolvedId,
        url: isBase64 ? file.dataURL : file.dataURL,
        width: el.width,
        height: el.height,
        label: resolvedId,
      })
    })

    return options
  }, [excalidrawAPI, targetFileId])

  // 重置状态
  useEffect(() => {
    if (!open) return

    setX(DEFAULTS.x)
    setY(DEFAULTS.y)
    setScale(DEFAULTS.scale)
    setRotate(DEFAULTS.rotate)
    setOpacity(DEFAULTS.opacity)
    setShadow(DEFAULTS.shadow)
    setCornerRadius(DEFAULTS.cornerRadius)
    setBlendMode(DEFAULTS.blendMode)
    setIsProcessing(false)
    setIsUploading(false)
    setDragMode('none')

    const options = collectDesignOptions()
    setDesignOptions(options)
    setDesignFileId(options[0]?.fileId || '')
  }, [open, collectDesignOptions])

  const selectedDesign = useMemo(
    () => designOptions.find((d) => d.fileId === designFileId),
    [designOptions, designFileId]
  )

  const handleTargetLoad = useCallback(() => {
    const img = targetRef.current
    if (img) {
      setTargetSize({ width: img.clientWidth, height: img.clientHeight })
    }
  }, [])

  useEffect(() => {
    if (!open) return
    handleTargetLoad()
  }, [open, handleTargetLoad, targetImageUrl])

  const previewDesignSize = useMemo(() => {
    if (!selectedDesign || targetSize.width === 0) return null
    const minTarget = Math.min(targetSize.width, targetSize.height)
    const targetSizePx = minTarget * scale
    const ratio = targetSizePx / Math.max(selectedDesign.width, selectedDesign.height)
    return {
      width: selectedDesign.width * ratio,
      height: selectedDesign.height * ratio,
    }
  }, [selectedDesign, targetSize, scale])

  const handleDesignMouseDown = useCallback(
    (e: React.MouseEvent, mode: 'move' | 'scale') => {
      if (isProcessing || !selectedDesign) return
      e.preventDefault()
      e.stopPropagation()
      setDragMode(mode)
      setDragStart({
        clientX: e.clientX,
        clientY: e.clientY,
        x,
        y,
        scale,
      })
    },
    [isProcessing, selectedDesign, x, y, scale]
  )

  const handlePreviewMouseMove = useCallback(
    (e: MouseEvent) => {
      if (dragMode === 'none' || !previewRef.current || targetSize.width === 0) return

      const rect = previewRef.current.getBoundingClientRect()
      const dx = (e.clientX - dragStart.clientX) / rect.width
      const dy = (e.clientY - dragStart.clientY) / rect.height

      if (dragMode === 'move') {
        setX(Math.max(0, Math.min(1, dragStart.x + dx)))
        setY(Math.max(0, Math.min(1, dragStart.y + dy)))
      } else if (dragMode === 'scale') {
        const delta = (e.clientX - dragStart.clientX + e.clientY - dragStart.clientY) / 400
        setScale(Math.max(0.02, Math.min(1, dragStart.scale + delta)))
      }
    },
    [dragMode, dragStart, targetSize.width]
  )

  const handlePreviewMouseUp = useCallback(() => {
    setDragMode('none')
  }, [])

  useEffect(() => {
    if (dragMode === 'none') return
    window.addEventListener('mousemove', handlePreviewMouseMove)
    window.addEventListener('mouseup', handlePreviewMouseUp)
    return () => {
      window.removeEventListener('mousemove', handlePreviewMouseMove)
      window.removeEventListener('mouseup', handlePreviewMouseUp)
    }
  }, [dragMode, handlePreviewMouseMove, handlePreviewMouseUp])

  const handlePreviewWheel = useCallback(
    (e: React.WheelEvent) => {
      if (!selectedDesign || isProcessing) return
      e.preventDefault()
      const delta = e.deltaY > 0 ? -0.02 : 0.02
      setScale((prev) => Math.max(0.02, Math.min(1, prev + delta)))
    },
    [selectedDesign, isProcessing]
  )

  const handleUploadDesign = useCallback(
    async (file: File) => {
      setIsUploading(true)
      try {
        const result = await uploadImage(file)
        const newOption: CanvasImageOption = {
          fileId: result.file_id,
          url: result.url || `/api/file/${result.file_id}`,
          width: result.width,
          height: result.height,
          label: file.name,
        }
        setDesignOptions((prev) => {
          const filtered = prev.filter((opt) => opt.fileId !== newOption.fileId)
          return [newOption, ...filtered]
        })
        setDesignFileId(newOption.fileId)
      } catch (e) {
        eventBus.emit('Canvas::TaskDone', {
          id: nanoid(),
          type: 'mockup',
          status: 'error',
          message: t('canvas:mockup.uploadFailed', { error: String(e) }),
        })
      } finally {
        setIsUploading(false)
      }
    },
    [t]
  )

  const handleSubmit = useCallback(async () => {
    if (!designFileId) {
      eventBus.emit('Canvas::TaskDone', {
        id: nanoid(),
        type: 'mockup',
        status: 'error',
        message: t('canvas:mockup.noDesign', 'Please select a design image'),
      })
      return
    }

    const taskId = nanoid()
    setIsProcessing(true)
    eventBus.emit('Canvas::TaskStarted', {
      id: taskId,
      type: 'mockup',
      status: 'running',
      message: t('canvas:mockup.processing', 'Processing mockup...'),
    })

    try {
      const result = await mockup({
        sessionId,
        canvasId,
        targetFileId,
        designFileId,
        x,
        y,
        scale,
        rotate,
        opacity,
        shadow,
        cornerRadius,
        blendMode,
      })

      if (result.status === 'success') {
        eventBus.emit('Canvas::TaskDone', {
          id: taskId,
          type: 'mockup',
          status: 'success',
          message: t('canvas:mockup.completed', 'Mockup completed'),
        })
        const addEvent: TCanvasImageAddedEvent = {
          canvas_id: canvasId,
          session_id: sessionId,
          element: result.result.element,
          file: result.result.file,
          image_url: result.result.image_url,
        }
        eventBus.emit('Canvas::ImageAdded', addEvent)
        onClose()
      } else {
        eventBus.emit('Canvas::TaskDone', {
          id: taskId,
          type: 'mockup',
          status: 'error',
          message: t('canvas:mockup.failed', 'Mockup failed'),
        })
      }
    } catch (e) {
      eventBus.emit('Canvas::TaskDone', {
        id: taskId,
        type: 'mockup',
        status: 'error',
        message: t('canvas:mockup.failedWithError', { error: String(e) }),
      })
    } finally {
      setIsProcessing(false)
    }
  }, [
    designFileId,
    sessionId,
    canvasId,
    targetFileId,
    x,
    y,
    scale,
    rotate,
    opacity,
    shadow,
    cornerRadius,
    blendMode,
    onClose,
    t,
  ])

  const handleAutoFit = useCallback(async () => {
    if (!designFileId) {
      eventBus.emit('Canvas::TaskDone', {
        id: nanoid(),
        type: 'mockup',
        status: 'error',
        message: t('canvas:mockup.noDesign', 'Please select a design image'),
      })
      return
    }

    const taskId = nanoid()
    setIsProcessing(true)
    eventBus.emit('Canvas::TaskStarted', {
      id: taskId,
      type: 'mockup',
      status: 'running',
      message: t('canvas:mockup.autoFitting', 'AI auto-fitting...'),
    })

    try {
      const autoFitPrompt = t(
        'canvas:mockup.autoFitPrompt',
        'Place image 2 (the design/logo) onto the main object in image 1 (the mockup). Automatically determine the best position, scale, rotation, and perspective to naturally fit the object\'s surface. Match the lighting, shadows, and texture of the mockup. The result should look like the design was naturally printed or placed on the object.'
      )

      const result = await composeImages({
        sessionId,
        canvasId,
        prompt: autoFitPrompt,
        inputImages: [targetFileId, designFileId],
      })

      if (result.status === 'success') {
        eventBus.emit('Canvas::TaskDone', {
          id: taskId,
          type: 'mockup',
          status: 'success',
          message: t('canvas:mockup.autoFitCompleted', 'Auto-fit completed'),
        })
        const addEvent: TCanvasImageAddedEvent = {
          canvas_id: canvasId,
          session_id: sessionId,
          element: result.result.element,
          file: result.result.file,
          image_url: result.result.image_url,
        }
        eventBus.emit('Canvas::ImageAdded', addEvent)
        onClose()
      } else {
        eventBus.emit('Canvas::TaskDone', {
          id: taskId,
          type: 'mockup',
          status: 'error',
          message: t('canvas:mockup.failed', 'Auto-fit failed'),
        })
      }
    } catch (e) {
      eventBus.emit('Canvas::TaskDone', {
        id: taskId,
        type: 'mockup',
        status: 'error',
        message: t('canvas:mockup.failedWithError', { error: String(e) }),
      })
    } finally {
      setIsProcessing(false)
    }
  }, [designFileId, sessionId, canvasId, targetFileId, onClose, t])

  const isBusy = isProcessing || isUploading

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm'
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className='bg-popover border border-border/60 rounded-xl shadow-2xl w-[960px] max-w-[95vw] max-h-[95vh] overflow-hidden flex flex-col'
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className='flex items-center justify-between px-4 py-3 border-b border-border/40'>
              <div className='flex items-center gap-2'>
                <Sticker className='size-4 text-primary' />
                <h3 className='text-sm font-semibold'>
                  {t('canvas:mockup.title', 'Mockup / Sticker')}
                </h3>
              </div>
              <button
                onClick={onClose}
                className='size-7 flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted/60 hover:text-foreground cursor-pointer'
              >
                <X className='size-4' />
              </button>
            </div>

            {/* Body */}
            <div className='flex-1 overflow-hidden flex flex-col md:flex-row'>
              {/* Preview */}
              <div className='flex-1 bg-muted/30 p-4 flex flex-col items-center justify-center overflow-auto'>
                <p className='text-[11px] text-muted-foreground mb-2 self-start'>
                  {t(
                    'canvas:mockup.dragHint',
                    'Drag the design to position it. Scroll to resize. Drag the corner handle to scale.'
                  )}
                </p>
                <div
                  ref={previewRef}
                  className='relative inline-block select-none'
                  onWheel={handlePreviewWheel}
                >
                  <img
                    ref={targetRef}
                    src={targetImageUrl}
                    alt='target'
                    onLoad={handleTargetLoad}
                    className='max-w-full max-h-[520px] block rounded-md shadow-sm'
                    draggable={false}
                  />
                  {selectedDesign && previewDesignSize && targetSize.width > 0 && (
                    <div
                      className={cn(
                        'absolute cursor-move border-2 border-primary/70',
                        dragMode === 'move' && 'border-primary shadow-lg'
                      )}
                      style={{
                        left: x * targetSize.width,
                        top: y * targetSize.height,
                        width: previewDesignSize.width,
                        height: previewDesignSize.height,
                        transform: `translate(-50%, -50%) rotate(${rotate}deg)`,
                        opacity,
                        borderRadius: `${Math.min(previewDesignSize.width, previewDesignSize.height) *
                          cornerRadius}px`,
                        boxShadow: shadow
                          ? '4px 6px 14px rgba(0,0,0,0.35)'
                          : 'none',
                        overflow: 'hidden',
                      }}
                      onMouseDown={(e) => handleDesignMouseDown(e, 'move')}
                    >
                      <img
                        src={selectedDesign.url}
                        alt='design preview'
                        className='w-full h-full object-contain pointer-events-none'
                        draggable={false}
                        style={{ borderRadius: 'inherit' }}
                      />
                      <div
                        className='absolute -bottom-1 -right-1 size-3.5 rounded-full bg-primary border-2 border-background cursor-nwse-resize'
                        onMouseDown={(e) => handleDesignMouseDown(e, 'scale')}
                        title={t('canvas:mockup.resizeHandle', 'Drag to resize')}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Controls */}
              <div className='w-full md:w-80 border-l border-border/40 p-4 space-y-4 overflow-y-auto'>
                {/* Design selector */}
                <div className='space-y-1.5'>
                  <label className='text-xs font-medium text-muted-foreground flex items-center gap-1.5'>
                    <Sticker className='size-3' />
                    {t('canvas:mockup.designImage', 'Design Image')}
                  </label>
                  <div className='flex gap-2'>
                    <select
                      value={designFileId}
                      onChange={(e) => setDesignFileId(e.target.value)}
                      className='flex-1 h-9 px-2 text-sm rounded-md border border-border/60 bg-background focus:outline-none focus:ring-1 focus:ring-primary/30'
                      disabled={isBusy}
                    >
                      <option value=''>
                        {t('canvas:mockup.selectDesign', 'Select a design image')}
                      </option>
                      {designOptions.map((opt) => (
                        <option key={opt.fileId} value={opt.fileId}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <Button
                      variant='outline'
                      size='sm'
                      className='h-9 px-2.5 shrink-0'
                      disabled={isBusy}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {isUploading ? (
                        <Loader2 className='size-3.5 animate-spin' />
                      ) : (
                        <Upload className='size-3.5' />
                      )}
                    </Button>
                    <input
                      ref={fileInputRef}
                      type='file'
                      accept='image/*'
                      className='hidden'
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) void handleUploadDesign(file)
                        e.target.value = ''
                      }}
                    />
                  </div>
                  {designOptions.length === 0 && (
                    <p className='text-xs text-muted-foreground'>
                      {t(
                        'canvas:mockup.noDesignImages',
                        'No other images on the canvas. Upload a logo or sticker.'
                      )}
                    </p>
                  )}
                </div>

                <ControlRow
                  icon={<MousePointer2 className='size-3' />}
                  label={t('canvas:mockup.positionX', 'Position X')}
                  value={x}
                  min={0}
                  max={1}
                  step={0.01}
                  onChange={setX}
                  disabled={isBusy}
                  format={(v) => `${Math.round(v * 100)}%`}
                />
                <ControlRow
                  icon={<Move className='size-3 rotate-90' />}
                  label={t('canvas:mockup.positionY', 'Position Y')}
                  value={y}
                  min={0}
                  max={1}
                  step={0.01}
                  onChange={setY}
                  disabled={isBusy}
                  format={(v) => `${Math.round(v * 100)}%`}
                />
                <ControlRow
                  icon={<Sticker className='size-3' />}
                  label={t('canvas:mockup.scale', 'Scale')}
                  value={scale}
                  min={0.02}
                  max={1.0}
                  step={0.01}
                  onChange={setScale}
                  disabled={isBusy}
                  format={(v) => `${Math.round(v * 100)}%`}
                />
                <ControlRow
                  icon={<RotateCcw className='size-3' />}
                  label={t('canvas:mockup.rotate', 'Rotate')}
                  value={rotate}
                  min={-180}
                  max={180}
                  step={1}
                  onChange={setRotate}
                  disabled={isBusy}
                  format={(v) => `${Math.round(v)}°`}
                />
                <ControlRow
                  icon={<Sun className='size-3' />}
                  label={t('canvas:mockup.opacity', 'Opacity')}
                  value={opacity}
                  min={0}
                  max={1}
                  step={0.01}
                  onChange={setOpacity}
                  disabled={isBusy}
                  format={(v) => `${Math.round(v * 100)}%`}
                />
                <ControlRow
                  icon={<Square className='size-3' />}
                  label={t('canvas:mockup.cornerRadius', 'Corner Radius')}
                  value={cornerRadius}
                  min={0}
                  max={0.5}
                  step={0.01}
                  onChange={setCornerRadius}
                  disabled={isBusy}
                  format={(v) => `${Math.round(v * 100)}%`}
                />

                <div className='space-y-1.5'>
                  <label className='text-xs font-medium text-muted-foreground'>
                    {t('canvas:mockup.blendMode', 'Blend Mode')}
                  </label>
                  <select
                    value={blendMode}
                    onChange={(e) => setBlendMode(e.target.value)}
                    className='w-full h-9 px-2 text-sm rounded-md border border-border/60 bg-background focus:outline-none focus:ring-1 focus:ring-primary/30'
                    disabled={isBusy}
                  >
                    {BLEND_MODES.map((mode) => (
                      <option key={mode} value={mode}>
                        {mode.replace('_', ' ')}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Shadow toggle */}
                <div className='flex items-center justify-between'>
                  <label className='text-xs font-medium text-muted-foreground flex items-center gap-1.5'>
                    <CloudFog className='size-3' />
                    {t('canvas:mockup.shadow', 'Shadow')}
                  </label>
                  <button
                    onClick={() => setShadow((s) => !s)}
                    className={cn(
                      'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
                      shadow ? 'bg-primary' : 'bg-muted'
                    )}
                    disabled={isBusy}
                  >
                    <span
                      className={cn(
                        'inline-block size-3.5 transform rounded-full bg-background transition-transform',
                        shadow ? 'translate-x-5' : 'translate-x-1'
                      )}
                    />
                  </button>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className='flex items-center justify-between px-4 py-3 border-t border-border/40'>
              <span className='text-xs text-muted-foreground'>
                {t('canvas:mockup.hint', 'Adjust placement and apply')}
              </span>
              <div className='flex gap-2'>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={onClose}
                  disabled={isBusy}
                >
                  {t('common:cancel', 'Cancel')}
                </Button>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={handleAutoFit}
                  disabled={isBusy || !designFileId}
                  className='border-primary/30 text-primary hover:bg-primary/10'
                >
                  {isProcessing ? (
                    <Loader2 className='size-3.5 animate-spin mr-1' />
                  ) : (
                    <Wand2 className='size-3.5 mr-1' />
                  )}
                  {t('canvas:mockup.autoFit', 'AI Auto-fit')}
                </Button>
                <Button
                  size='sm'
                  onClick={handleSubmit}
                  disabled={isBusy || !designFileId}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className='size-3.5 animate-spin mr-1' />
                      {t('canvas:mockup.processing', 'Processing...')}
                    </>
                  ) : (
                    <>
                      <Sticker className='size-3.5 mr-1' />
                      {t('canvas:mockup.apply', 'Apply Mockup')}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

interface ControlRowProps {
  icon: React.ReactNode
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
  disabled?: boolean
  format: (value: number) => string
}

const ControlRow: React.FC<ControlRowProps> = ({
  icon,
  label,
  value,
  min,
  max,
  step,
  onChange,
  disabled,
  format,
}) => {
  return (
    <div className='space-y-1.5'>
      <div className='flex items-center justify-between text-xs'>
        <label className='font-medium text-muted-foreground flex items-center gap-1.5'>
          {icon}
          {label}
        </label>
        <span className='text-foreground tabular-nums'>{format(value)}</span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={([v]) => onChange(v)}
        disabled={disabled}
      />
    </div>
  )
}

export default MockupDialog
