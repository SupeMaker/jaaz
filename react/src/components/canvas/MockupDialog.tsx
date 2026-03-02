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
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { mockup } from '@/api/directEdit'
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
}

const DEFAULTS = {
  x: 0.5,
  y: 0.5,
  scale: 0.25,
  rotate: 0,
  opacity: 1,
  shadow: true,
  cornerRadius: 0,
}

/**
 * Mockup / 贴纸粘贴对话框（Lovart Mockup 风格）。
 *
 * 用户选择一张设计图，在目标图上实时预览位置、缩放、旋转、透明度、投影和圆角，
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
  const [isProcessing, setIsProcessing] = useState(false)

  const targetRef = useRef<HTMLImageElement>(null)
  const [targetSize, setTargetSize] = useState({ width: 0, height: 0 })

  // 重置状态
  useEffect(() => {
    if (open) {
      setX(DEFAULTS.x)
      setY(DEFAULTS.y)
      setScale(DEFAULTS.scale)
      setRotate(DEFAULTS.rotate)
      setOpacity(DEFAULTS.opacity)
      setShadow(DEFAULTS.shadow)
      setCornerRadius(DEFAULTS.cornerRadius)
      setIsProcessing(false)

      // 从画布中提取所有可作为 design 的图像
      const options: CanvasImageOption[] = []
      if (excalidrawAPI) {
        const elements = excalidrawAPI.getSceneElements()
        const files = excalidrawAPI.getFiles()
        elements.forEach((el) => {
          if (el.type === 'image' && el.fileId && el.fileId !== targetFileId) {
            const file = files[el.fileId]
            if (file && !file.dataURL.startsWith('data:')) {
              options.push({
                fileId: file.dataURL.split('/').pop() || el.fileId,
                url: file.dataURL,
                width: el.width,
                height: el.height,
              })
            }
          }
        })
      }
      setDesignOptions(options)
      setDesignFileId(options[0]?.fileId || '')
    }
  }, [open, excalidrawAPI, targetFileId])

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

  // 计算设计图在预览中的像素尺寸（保持宽高比）
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
    onClose,
    t,
  ])

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
              <div className='flex-1 bg-muted/30 p-4 flex items-center justify-center overflow-auto'>
                <div className='relative inline-block select-none'>
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
                      className='absolute pointer-events-none'
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
                    >
                      <img
                        src={selectedDesign.url}
                        alt='design preview'
                        className='w-full h-full object-contain'
                        draggable={false}
                        style={{
                          borderRadius: 'inherit',
                        }}
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
                  <select
                    value={designFileId}
                    onChange={(e) => setDesignFileId(e.target.value)}
                    className='w-full h-9 px-2 text-sm rounded-md border border-border/60 bg-background focus:outline-none focus:ring-1 focus:ring-primary/30'
                    disabled={isProcessing}
                  >
                    <option value=''>
                      {t('canvas:mockup.selectDesign', 'Select a design image')}
                    </option>
                    {designOptions.map((opt) => (
                      <option key={opt.fileId} value={opt.fileId}>
                        {opt.fileId}
                      </option>
                    ))}
                  </select>
                  {designOptions.length === 0 && (
                    <p className='text-xs text-muted-foreground'>
                      {t(
                        'canvas:mockup.noDesignImages',
                        'No other images on the canvas. Add a logo or sticker first.'
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
                  disabled={isProcessing}
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
                  disabled={isProcessing}
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
                  disabled={isProcessing}
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
                  disabled={isProcessing}
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
                  disabled={isProcessing}
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
                  disabled={isProcessing}
                  format={(v) => `${Math.round(v * 100)}%`}
                />

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
                    disabled={isProcessing}
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
                  disabled={isProcessing}
                >
                  {t('common:cancel', 'Cancel')}
                </Button>
                <Button
                  size='sm'
                  onClick={handleSubmit}
                  disabled={isProcessing || !designFileId}
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
