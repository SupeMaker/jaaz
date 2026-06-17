import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'motion/react'
import { Loader2, Layers, X, GripHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { composeImages } from '@/api/directEdit'
import { eventBus, TCanvasImageAddedEvent, TCanvasAddImagesToChatEvent } from '@/lib/event'
import { useTranslation } from 'react-i18next'
import { nanoid } from 'nanoid'

interface CanvasComposeDialogProps {
  open: boolean
  onClose: () => void
  selectedImages: TCanvasAddImagesToChatEvent
  sessionId: string
  canvasId: string
  popbarPos?: { x: number; y: number }
}

const PROMPT_PRESETS = [
  {
    key: 'mergeIntoFirst',
    zh: '将第2张图合并到第1张中',
    en: 'Merge image 2 into image 1',
  },
  {
    key: 'placeInScene',
    zh: '将这些元素放入第1张图的场景中',
    en: 'Place these elements into the scene of image 1',
  },
  {
    key: 'kitchenScene',
    zh: '将这些元素放在厨房场景中',
    en: 'Place these elements in the kitchen scene',
  },
] as const

/**
 * 图像合成对话框。
 * 选中两张及以上图像时，按选中顺序编号，输入提示词进行 AI 合成。
 */
const CanvasComposeDialog: React.FC<CanvasComposeDialogProps> = ({
  open,
  onClose,
  selectedImages,
  sessionId,
  canvasId,
  popbarPos,
}) => {
  const { t, i18n } = useTranslation()
  const [prompt, setPrompt] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)

  const wrapperRectRef = useRef<DOMRect | null>(null)
  const [dialogOffset, setDialogOffset] = useState<{ x: number; y: number } | null>(null)
  const [isDraggingDialog, setIsDraggingDialog] = useState(false)
  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 })

  const orderedImages = useMemo(
    () =>
      [...selectedImages].sort(
        (a, b) => (a.order ?? 0) - (b.order ?? 0)
      ),
    [selectedImages]
  )

  useEffect(() => {
    if (open) {
      setPrompt('')
      setIsProcessing(false)
      setDialogOffset(null)
    }
  }, [open])

  const handleDialogDragStart = useCallback((e: React.MouseEvent) => {
    if (isProcessing) return
    e.preventDefault()
    e.stopPropagation()
    setIsDraggingDialog(true)
    setDragStartPos({ x: e.clientX, y: e.clientY })
  }, [isProcessing])

  const handleDialogDragMove = useCallback((e: MouseEvent) => {
    if (!isDraggingDialog) return
    const dx = e.clientX - dragStartPos.x
    const dy = e.clientY - dragStartPos.y
    setDialogOffset((prev) => ({
      x: (prev?.x ?? 0) + dx,
      y: (prev?.y ?? 0) + dy,
    }))
    setDragStartPos({ x: e.clientX, y: e.clientY })
  }, [isDraggingDialog, dragStartPos])

  const handleDialogDragEnd = useCallback(() => {
    setIsDraggingDialog(false)
  }, [])

  useEffect(() => {
    if (!isDraggingDialog) return
    window.addEventListener('mousemove', handleDialogDragMove)
    window.addEventListener('mouseup', handleDialogDragEnd)
    return () => {
      window.removeEventListener('mousemove', handleDialogDragMove)
      window.removeEventListener('mouseup', handleDialogDragEnd)
    }
  }, [isDraggingDialog, handleDialogDragMove, handleDialogDragEnd])

  const handleSubmit = useCallback(async () => {
    if (!prompt.trim() || orderedImages.length < 2) return

    const taskId = nanoid()
    setIsProcessing(true)
    eventBus.emit('Canvas::TaskStarted', {
      id: taskId,
      type: 'compose',
      status: 'running',
      message: t('canvas:compose.processing', 'Composing images...'),
    })

    try {
      const result = await composeImages({
        sessionId,
        canvasId,
        prompt: prompt.trim(),
        inputImages: orderedImages.map((img) => img.fileId),
      })

      if (result.status === 'success') {
        eventBus.emit('Canvas::TaskDone', {
          id: taskId,
          type: 'compose',
          status: 'success',
          message: t('canvas:compose.completed', 'Composition completed'),
        })
        eventBus.emit('Canvas::ImageAdded', {
          canvas_id: canvasId,
          session_id: sessionId,
          element: result.result.element,
          file: result.result.file,
          image_url: result.result.image_url,
        })
        onClose()
      } else {
        eventBus.emit('Canvas::TaskDone', {
          id: taskId,
          type: 'compose',
          status: 'error',
          message: t('canvas:compose.failed', 'Composition failed'),
        })
      }
    } catch (e) {
      eventBus.emit('Canvas::TaskDone', {
        id: taskId,
        type: 'compose',
        status: 'error',
        message: t('canvas:compose.failedWithError', { error: String(e) }),
      })
    } finally {
      setIsProcessing(false)
    }
  }, [prompt, orderedImages, sessionId, canvasId, onClose, t])

  const wrapperEl =
    typeof document !== 'undefined'
      ? document.getElementById('canvas-popbar-wrapper')
      : null

  if (!open || !wrapperEl) return null

  wrapperRectRef.current = wrapperEl.getBoundingClientRect()
  const wrapperRect = wrapperRectRef.current

  const dialogLeft = popbarPos
    ? wrapperRect.left + popbarPos.x + (dialogOffset?.x ?? 0)
    : 100
  const dialogTop = popbarPos
    ? wrapperRect.top + popbarPos.y + 50 + (dialogOffset?.y ?? 0)
    : 100

  const isZh = i18n.language.startsWith('zh')

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className='fixed z-[10000] flex flex-col gap-2 w-[26rem] max-w-[95vw] rounded-xl border border-border/60 bg-popover/95 backdrop-blur-md shadow-xl p-3'
          style={{
            left: dialogLeft,
            top: dialogTop,
            transform: 'translate(-50%, 0)',
            pointerEvents: 'auto',
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className='flex items-center justify-between'>
            <div
              className='flex items-center gap-1.5 text-xs font-semibold text-foreground cursor-grab active:cursor-grabbing flex-1 min-w-0'
              onMouseDown={handleDialogDragStart}
              title={t('canvas:compose.dragToMove', 'Drag to move')}
            >
              <GripHorizontal className='size-3.5 text-muted-foreground shrink-0' />
              <Layers className='size-3.5 text-primary shrink-0' />
              <span className='truncate'>
                {t('canvas:compose.title', 'Image Composition')}
              </span>
            </div>
            <button
              onClick={onClose}
              className='size-6 flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted/60 hover:text-foreground cursor-pointer'
            >
              <X className='size-3' />
            </button>
          </div>

          <div className='flex gap-2 overflow-x-auto pb-1'>
            {orderedImages.map((img) => (
              <div
                key={`${img.fileId}-${img.order}`}
                className='relative shrink-0 w-16 h-16 rounded-lg overflow-hidden border border-border/60 bg-muted/30'
              >
                <img
                  src={img.base64 || `/api/file/${img.fileId}`}
                  className='w-full h-full object-cover'
                  alt={`Image ${img.order}`}
                />
                <div className='absolute top-0.5 left-0.5 size-5 flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold'>
                  {img.order}
                </div>
              </div>
            ))}
          </div>

          <div className='text-[10px] text-muted-foreground leading-relaxed'>
            {t(
              'canvas:compose.hint',
              '{{count}} images selected in order. Reference them by number, e.g. "merge image 2 into image 1" or "place these elements in the kitchen".',
              { count: orderedImages.length }
            )}
          </div>

          <div className='flex flex-wrap gap-1.5'>
            {PROMPT_PRESETS.map((preset) => (
              <button
                key={preset.key}
                type='button'
                className='text-[10px] px-2 py-1 rounded-md border border-border/60 bg-muted/40 hover:bg-primary/10 hover:border-primary/40 transition-colors'
                onClick={() => setPrompt(isZh ? preset.zh : preset.en)}
                disabled={isProcessing}
              >
                {isZh ? preset.zh : preset.en}
              </button>
            ))}
          </div>

          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={t(
              'canvas:compose.placeholder',
              'e.g., Merge image 2 into image 1, place the knife/rice cooker/bowl into the kitchen photo...'
            )}
            className='w-full h-20 px-2.5 py-1.5 text-xs rounded-md border border-border/60 bg-background resize-none focus:outline-none focus:ring-1 focus:ring-primary/30'
            disabled={isProcessing}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                handleSubmit()
              }
            }}
          />

          <div className='flex items-center justify-between gap-2'>
            <span className='text-[10px] text-muted-foreground'>
              {t('canvas:compose.shortcut', 'Ctrl+Enter to submit')}
            </span>
            <div className='flex gap-2'>
              <Button
                variant='outline'
                size='sm'
                className='h-7 text-xs px-2.5'
                onClick={onClose}
                disabled={isProcessing}
              >
                {t('common:cancel', 'Cancel')}
              </Button>
              <Button
                size='sm'
                className='h-7 text-xs px-2.5'
                onClick={handleSubmit}
                disabled={isProcessing || !prompt.trim()}
              >
                {isProcessing ? (
                  <Loader2 className='size-3 animate-spin' />
                ) : (
                  <>
                    <Layers className='size-3 mr-1' />
                    {t('canvas:compose.apply', 'Compose')}
                  </>
                )}
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    wrapperEl
  )
}

export default CanvasComposeDialog
