import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'motion/react'
import { Loader2, Wand2, X, Check, GripHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { inpaint, type BBox } from '@/api/directEdit'
import { eventBus, TCanvasImageAddedEvent } from '@/lib/event'
import { useTranslation } from 'react-i18next'
import { useCanvas } from '@/contexts/canvas'
import { nanoid } from 'nanoid'
import { toast } from 'sonner'
import {
  findImageElementByFileId,
  getCanvasAreaRect,
  sceneRectToClientBounds,
  type ClientRect,
} from './utils/sceneCoords'

interface CanvasInpaintEditorProps {
  open: boolean
  onClose: () => void
  imageFileId: string
  imageUrl?: string
  sessionId: string
  canvasId: string
  defaultMode?: 'editElement' | 'editText'
  title?: string
  placeholder?: string
  popbarPos?: { x: number; y: number }
}

interface SelectionRect {
  startX: number
  startY: number
  endX: number
  endY: number
}

const MIN_SELECTION_SIZE = 8

/**
 * 画布局部重绘编辑器。
 *
 * 特点：
 * - 选区直接在被编辑的原图上绘制（透明覆盖层）。
 * - 第一次点击为选区左上角，右下角跟随鼠标。
 * - 输入框小弹窗位于 popbar 按钮下方。
 */
const CanvasInpaintEditor: React.FC<CanvasInpaintEditorProps> = ({
  open,
  onClose,
  imageFileId,
  imageUrl,
  sessionId,
  canvasId,
  defaultMode = 'editElement',
  title,
  placeholder,
  popbarPos,
}) => {
  const { t } = useTranslation()
  const { excalidrawAPI } = useCanvas()

  const [prompt, setPrompt] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [selection, setSelection] = useState<SelectionRect | null>(null)
  const [dragAction, setDragAction] = useState<'none' | 'create' | 'move'>('none')
  const [moveOffset, setMoveOffset] = useState({ x: 0, y: 0 })
  const [imageBounds, setImageBounds] = useState<ClientRect | null>(null)
  const [canvasArea, setCanvasArea] = useState<ClientRect | null>(null)
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 })
  const [imageNotFound, setImageNotFound] = useState(false)

  // Dialog drag state
  const [dialogOffset, setDialogOffset] = useState<{ x: number; y: number } | null>(null)
  const [isDraggingDialog, setIsDraggingDialog] = useState(false)
  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 })

  const overlayRef = useRef<HTMLDivElement>(null)
  const wrapperRectRef = useRef<DOMRect | null>(null)

  // 重置状态
  useEffect(() => {
    if (open) {
      setPrompt('')
      setSelection(null)
      setIsProcessing(false)
      setDragAction('none')
      setImageBounds(null)
      setCanvasArea(null)
      setImageNotFound(false)
      setDialogOffset(null)
    }
  }, [open])

  // 计算选中图片在视口中的位置和尺寸
  useEffect(() => {
    if (!open || !excalidrawAPI || !imageFileId) return

    const updateBounds = () => {
      const wrapperEl = document.getElementById('canvas-popbar-wrapper')
      wrapperRectRef.current = wrapperEl?.getBoundingClientRect() ?? null

      const elements = excalidrawAPI.getSceneElements()
      const appState = excalidrawAPI.getAppState()
      const files = excalidrawAPI.getFiles()

      const imageEl = findImageElementByFileId(elements, files, imageFileId)
      if (!imageEl) {
        setImageBounds(null)
        setImageNotFound(true)
        setCanvasArea(getCanvasAreaRect())
        return
      }

      setImageNotFound(false)
      setImageBounds(sceneRectToClientBounds(imageEl, appState))
      setCanvasArea(getCanvasAreaRect())
    }

    updateBounds()
    const interval = setInterval(updateBounds, 50)
    window.addEventListener('resize', updateBounds)
    window.addEventListener('scroll', updateBounds, true)
    return () => {
      clearInterval(interval)
      window.removeEventListener('resize', updateBounds)
      window.removeEventListener('scroll', updateBounds, true)
    }
  }, [open, excalidrawAPI, imageFileId])

  // 加载原图以获取自然尺寸
  useEffect(() => {
    if (!open || !imageFileId) return
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = imageUrl || `/api/file/${imageFileId}`
    img.onload = () => {
      setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight })
    }
  }, [open, imageFileId, imageUrl])

  // 规范化选区
  const normalizedSelection = useMemo(() => {
    if (!selection || !imageBounds) return null
    const minX = Math.min(selection.startX, selection.endX)
    const maxX = Math.max(selection.startX, selection.endX)
    const minY = Math.min(selection.startY, selection.endY)
    const maxY = Math.max(selection.startY, selection.endY)
    return {
      x: Math.max(0, Math.min(minX, imageBounds.width)),
      y: Math.max(0, Math.min(minY, imageBounds.height)),
      width: Math.min(maxX - minX, imageBounds.width - minX),
      height: Math.min(maxY - minY, imageBounds.height - minY),
    }
  }, [selection, imageBounds])

  const isPointInsideSelection = useCallback(
    (x: number, y: number) => {
      const ns = normalizedSelection
      if (!ns) return false
      return (
        x >= ns.x && x <= ns.x + ns.width && y >= ns.y && y <= ns.y + ns.height
      )
    },
    [normalizedSelection]
  )

  const getRelativePos = useCallback(
    (e: React.MouseEvent | MouseEvent) => {
      if (!imageBounds || !overlayRef.current) return { x: 0, y: 0 }
      const rect = overlayRef.current.getBoundingClientRect()
      return {
        x: Math.max(0, Math.min(e.clientX - rect.left, imageBounds.width)),
        y: Math.max(0, Math.min(e.clientY - rect.top, imageBounds.height)),
      }
    },
    [imageBounds]
  )

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (isProcessing || !imageBounds) return
      e.preventDefault()
      e.stopPropagation()
      const { x, y } = getRelativePos(e)

      if (normalizedSelection && isPointInsideSelection(x, y)) {
        setDragAction('move')
        setMoveOffset({
          x: x - normalizedSelection.x,
          y: y - normalizedSelection.y,
        })
        return
      }

      setSelection({ startX: x, startY: y, endX: x, endY: y })
      setDragAction('create')
    },
    [isProcessing, imageBounds, normalizedSelection, isPointInsideSelection, getRelativePos]
  )

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!imageBounds || dragAction === 'none') return
      const { x, y } = getRelativePos(e)

      if (dragAction === 'create') {
        setSelection((prev) => (prev ? { ...prev, endX: x, endY: y } : null))
      } else if (dragAction === 'move' && normalizedSelection) {
        let newX = x - moveOffset.x
        let newY = y - moveOffset.y
        newX = Math.max(
          0,
          Math.min(newX, imageBounds.width - normalizedSelection.width)
        )
        newY = Math.max(
          0,
          Math.min(newY, imageBounds.height - normalizedSelection.height)
        )
        setSelection({
          startX: newX,
          startY: newY,
          endX: newX + normalizedSelection.width,
          endY: newY + normalizedSelection.height,
        })
      }
    },
    [dragAction, moveOffset, normalizedSelection, imageBounds, getRelativePos]
  )

  const handleMouseUp = useCallback(() => {
    setDragAction('none')
  }, [])

  // Dialog drag handlers
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

  useEffect(() => {
    if (dragAction === 'none') return
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [dragAction, handleMouseMove, handleMouseUp])

  const getNormalizedBBox = useCallback((): BBox | null => {
    if (!normalizedSelection || !imageBounds) return null
    const { x, y, width, height } = normalizedSelection
    if (width < MIN_SELECTION_SIZE || height < MIN_SELECTION_SIZE) return null
    return {
      x: x / imageBounds.width,
      y: y / imageBounds.height,
      width: width / imageBounds.width,
      height: height / imageBounds.height,
    }
  }, [normalizedSelection, imageBounds])

  const generateMaskBase64 = useCallback((): string | null => {
    const bbox = getNormalizedBBox()
    if (!bbox || naturalSize.width === 0) return null
    const canvas = document.createElement('canvas')
    canvas.width = naturalSize.width
    canvas.height = naturalSize.height
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.fillStyle = 'black'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = 'white'
    ctx.fillRect(
      bbox.x * canvas.width,
      bbox.y * canvas.height,
      bbox.width * canvas.width,
      bbox.height * canvas.height
    )
    return canvas.toDataURL('image/png')
  }, [getNormalizedBBox, naturalSize])

  const handleSubmit = useCallback(async () => {
    if (!prompt.trim()) return
    if (!imageFileId) return

    const bbox = getNormalizedBBox()
    const maskBase64 = generateMaskBase64()
    const taskId = nanoid()

    setIsProcessing(true)
    eventBus.emit('Canvas::TaskStarted', {
      id: taskId,
      type: 'inpaint',
      status: 'running',
      message: t('canvas:inpaint.processing', 'Inpainting...'),
    })

    try {
      const result = await inpaint({
        sessionId,
        canvasId,
        imageFileId,
        prompt: prompt.trim(),
        bbox: bbox || undefined,
        maskBase64: maskBase64 || undefined,
      })

      if (result.status === 'success') {
        eventBus.emit('Canvas::TaskDone', {
          id: taskId,
          type: 'inpaint',
          status: 'success',
          message: t('canvas:inpaint.completed', 'Inpaint completed'),
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
          type: 'inpaint',
          status: 'error',
          message: t('canvas:inpaint.failed', 'Inpaint failed'),
        })
      }
    } catch (e) {
      eventBus.emit('Canvas::TaskDone', {
        id: taskId,
        type: 'inpaint',
        status: 'error',
        message: t('canvas:inpaint.failedWithError', { error: String(e) }),
      })
    } finally {
      setIsProcessing(false)
    }
  }, [
    prompt,
    sessionId,
    canvasId,
    imageFileId,
    getNormalizedBBox,
    generateMaskBase64,
    onClose,
    t,
  ])

  const hasValidSelection = useMemo(() => {
    if (!normalizedSelection) return false
    return (
      normalizedSelection.width >= MIN_SELECTION_SIZE &&
      normalizedSelection.height >= MIN_SELECTION_SIZE
    )
  }, [normalizedSelection])

  useEffect(() => {
    if (open && imageNotFound) {
      toast.error(
        t('canvas:inpaint.imageNotFound', 'Could not locate the selected image on canvas')
      )
    }
  }, [open, imageNotFound, t])

  const wrapperEl = typeof document !== 'undefined'
    ? document.getElementById('canvas-popbar-wrapper')
    : null

  if (!open || !wrapperEl) return null

  const wrapperRect = wrapperRectRef.current
  const dialogLeft = popbarPos && wrapperRect
    ? wrapperRect.left + popbarPos.x + (dialogOffset?.x ?? 0)
    : imageBounds
      ? imageBounds.left + imageBounds.width / 2 + (dialogOffset?.x ?? 0)
      : 100
  const dialogTop = popbarPos && wrapperRect
    ? wrapperRect.top + popbarPos.y + 50 + (dialogOffset?.y ?? 0)
    : imageBounds
      ? imageBounds.top + imageBounds.height + 12 + (dialogOffset?.y ?? 0)
      : 100

  return createPortal(
    <>
      {/* 仅覆盖画布区域，不阻断聊天面板等区域 */}
      {canvasArea && (
        <div
          className='fixed z-[9998]'
          style={{
            left: canvasArea.left,
            top: canvasArea.top,
            width: canvasArea.width,
            height: canvasArea.height,
            pointerEvents: 'auto',
          }}
          onMouseDown={(e) => {
            e.stopPropagation()
          }}
        />
      )}

      {/* 透明覆盖层：在原图上绘制选区 */}
      {imageBounds && (
        <div
          ref={overlayRef}
          className='fixed z-[9999] cursor-crosshair'
          style={{
            left: imageBounds.left,
            top: imageBounds.top,
            width: imageBounds.width,
            height: imageBounds.height,
            pointerEvents: 'auto',
          }}
          onMouseDown={handleMouseDown}
        >
          {normalizedSelection && (
            <div
              className='absolute border-2 border-primary bg-primary/20 pointer-events-none rounded-sm'
              style={{
                left: normalizedSelection.x,
                top: normalizedSelection.y,
                width: normalizedSelection.width,
                height: normalizedSelection.height,
              }}
            >
              <div className='absolute -top-5 left-0 text-[10px] font-medium text-primary bg-background/80 px-1.5 py-0.5 rounded whitespace-nowrap'>
                {Math.round(normalizedSelection.width)}×
                {Math.round(normalizedSelection.height)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 小弹窗：输入框与操作，定位在 popbar 按钮下方 */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className='fixed z-[10000] flex flex-col gap-2 w-80 rounded-xl border border-border/60 bg-popover/95 backdrop-blur-md shadow-xl p-3'
            style={{
              left: dialogLeft,
              top: dialogTop,
              transform: 'translate(-50%, 0)',
              pointerEvents: 'auto',
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <div className='flex items-center justify-between'>
              <div
                className='flex items-center gap-1.5 text-xs font-semibold text-foreground cursor-grab active:cursor-grabbing flex-1 min-w-0'
                onMouseDown={handleDialogDragStart}
                title={t('canvas:inpaint.dragToMove', 'Drag to move')}
              >
                <GripHorizontal className='size-3.5 text-muted-foreground shrink-0' />
                <Wand2 className='size-3.5 text-primary shrink-0' />
                <span className='truncate'>
                  {title ||
                    (defaultMode === 'editText'
                      ? t('canvas:popbar.editText')
                      : t('canvas:popbar.editElement'))}
                </span>
              </div>
              <button
                onClick={onClose}
                className='size-6 flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted/60 hover:text-foreground cursor-pointer'
              >
                <X className='size-3' />
              </button>
            </div>

            <div className='flex items-center gap-2 text-[10px] text-muted-foreground'>
              {imageNotFound ? (
                <span className='text-destructive'>
                  {t(
                    'canvas:inpaint.imageNotFound',
                    'Could not locate the selected image on canvas'
                  )}
                </span>
              ) : hasValidSelection ? (
                <>
                  <Check className='size-3 text-green-500' />
                  <span>
                    {t('canvas:inpaint.regionSelected', 'Region selected')}
                  </span>
                </>
              ) : (
                <span>
                  {t(
                    'canvas:inpaint.dragToSelect',
                    'Drag on the image to select a region'
                  )}
                </span>
              )}
            </div>

            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={
                placeholder ||
                t(
                  'canvas:inpaint.placeholder',
                  'Describe the edit...'
                )
              }
              className='w-full h-16 px-2.5 py-1.5 text-xs rounded-md border border-border/60 bg-background resize-none focus:outline-none focus:ring-1 focus:ring-primary/30'
              disabled={isProcessing}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  handleSubmit()
                }
              }}
            />

            <div className='flex items-center justify-end gap-2'>
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
                    <Wand2 className='size-3 mr-1' />
                    {t('canvas:inpaint.apply', 'Apply')}
                  </>
                )}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>,
    wrapperEl
  )
}

export default CanvasInpaintEditor
