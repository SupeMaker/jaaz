import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'motion/react'
import { Loader2, Sticker, X, GripHorizontal, Move } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { icMockup } from '@/api/directEdit'
import { eventBus, TCanvasImageAddedEvent } from '@/lib/event'
import { useTranslation } from 'react-i18next'
import { useCanvas } from '@/contexts/canvas'
import { nanoid } from 'nanoid'
import { cn } from '@/lib/utils'
import {
  findImageElementByFileId,
  findImageElementById,
  getCanvasAreaRect,
  sceneRectToClientBounds,
  type ClientRect,
} from './utils/sceneCoords'
import {
  collectCanvasImages,
  type CanvasImageInfo,
} from './utils/canvasImages'
import {
  estimateCurvature,
  getCurvedStickerStyle,
  isPointInsideRect,
} from './utils/mockupPreview'

type DesignWithBounds = CanvasImageInfo & { bounds: ClientRect | null }
type DragSource = 'canvas' | 'panel' | null

interface CanvasMockupEditorProps {
  open: boolean
  onClose: () => void
  targetFileId: string
  sessionId: string
  canvasId: string
  popbarPos?: { x: number; y: number }
}

const StickerPreview: React.FC<{
  design: CanvasImageInfo
  width: number
  height: number
  normalizedX: number
  normalizedY: number
  className?: string
}> = ({ design, width, height, normalizedX, normalizedY, className }) => {
  const curved = getCurvedStickerStyle(normalizedX, normalizedY)
  return (
    <img
      src={design.base64 || design.url}
      alt='design'
      className={cn('object-contain pointer-events-none drop-shadow-md', className)}
      draggable={false}
      style={{
        width,
        height,
        transform: curved.transform,
        transformOrigin: curved.transformOrigin,
        opacity: curved.opacity,
        filter: curved.filter,
      }}
    />
  )
}

/**
 * 画布内 Mockup 编辑器。
 * - 样机图高亮，其他图片可直接在画布上拖拽到样机
 * - 拖拽时实时预览曲面弧度贴合（柱面/透视）
 * - 松手后 AI 自动贴合纹理与光影
 */
const CanvasMockupEditor: React.FC<CanvasMockupEditorProps> = ({
  open,
  onClose,
  targetFileId,
  sessionId,
  canvasId,
  popbarPos,
}) => {
  const { t } = useTranslation()
  const { excalidrawAPI } = useCanvas()

  const [targetBounds, setTargetBounds] = useState<ClientRect | null>(null)
  const [canvasArea, setCanvasArea] = useState<ClientRect | null>(null)
  const [designOptions, setDesignOptions] = useState<DesignWithBounds[]>([])
  const [activeDesign, setActiveDesign] = useState<CanvasImageInfo | null>(null)
  const [dropPos, setDropPos] = useState({ x: 0.5, y: 0.5 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragSource, setDragSource] = useState<DragSource>(null)
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null)
  const [isOverTarget, setIsOverTarget] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)

  const overlayRef = useRef<HTMLDivElement>(null)
  const wrapperRectRef = useRef<DOMRect | null>(null)
  const applyingRef = useRef(false)
  const [dialogOffset, setDialogOffset] = useState<{ x: number; y: number } | null>(null)
  const [isDraggingDialog, setIsDraggingDialog] = useState(false)
  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 })

  useEffect(() => {
    if (open) {
      setActiveDesign(null)
      setDropPos({ x: 0.5, y: 0.5 })
      setIsDragging(false)
      setDragSource(null)
      setCursorPos(null)
      setIsOverTarget(false)
      setIsProcessing(false)
      setDialogOffset(null)
    }
  }, [open])

  useEffect(() => {
    if (!open || !excalidrawAPI || !targetFileId) return

    const update = () => {
      const wrapperEl = document.getElementById('canvas-popbar-wrapper')
      wrapperRectRef.current = wrapperEl?.getBoundingClientRect() ?? null

      const elements = excalidrawAPI.getSceneElements()
      const appState = excalidrawAPI.getAppState()
      const files = excalidrawAPI.getFiles()

      const targetEl = findImageElementByFileId(elements, files, targetFileId)
      setTargetBounds(targetEl ? sceneRectToClientBounds(targetEl, appState) : null)
      setCanvasArea(getCanvasAreaRect())

      const imageElements = elements.filter(
        (el) => el.type === 'image' && !el.isDeleted
      ) as Parameters<typeof collectCanvasImages>[0]

      const allImages = collectCanvasImages(imageElements, files)
      const designs: DesignWithBounds[] = allImages
        .filter((img) => img.fileId !== targetFileId)
        .map((img) => {
          const el = findImageElementById(elements, img.elementId)
          return {
            ...img,
            bounds: el ? sceneRectToClientBounds(el, appState) : null,
          }
        })

      setDesignOptions(designs)
    }

    update()
    const interval = setInterval(update, 50)
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      clearInterval(interval)
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [open, excalidrawAPI, targetFileId, isDragging])

  const getRelativePos = useCallback(
    (clientX: number, clientY: number) => {
      if (!targetBounds || !overlayRef.current) return { x: 0.5, y: 0.5 }
      const rect = overlayRef.current.getBoundingClientRect()
      return {
        x: Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)),
        y: Math.max(0, Math.min(1, (clientY - rect.top) / rect.height)),
      }
    },
    [targetBounds]
  )

  const applyMockup = useCallback(
    async (design: CanvasImageInfo, position: { x: number; y: number }) => {
      if (applyingRef.current) return
      applyingRef.current = true

      const taskId = nanoid()
      setIsProcessing(true)
      eventBus.emit('Canvas::TaskStarted', {
        id: taskId,
        type: 'mockup',
        status: 'running',
        message: t('canvas:mockup.icLoraProcessing', 'IC-LoRA mockup fitting...'),
      })

      try {
        const curvature = estimateCurvature(position.x)
        const result = await icMockup({
          sessionId,
          canvasId,
          targetFileId,
          designFileId: design.fileId,
          x: position.x,
          y: position.y,
          scale: 0.25,
          curvature,
        })

        if (result.status === 'success') {
          eventBus.emit('Canvas::TaskDone', {
            id: taskId,
            type: 'mockup',
            status: 'success',
            message: t('canvas:mockup.completed', 'Mockup completed'),
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
        applyingRef.current = false
        setIsProcessing(false)
        setCursorPos(null)
        setIsDragging(false)
        setDragSource(null)
      }
    },
    [sessionId, canvasId, targetFileId, onClose, t]
  )

  const startDrag = useCallback(
    (design: CanvasImageInfo, source: DragSource, e: React.MouseEvent) => {
      if (isProcessing) return
      e.preventDefault()
      e.stopPropagation()
      setActiveDesign(design)
      setDragSource(source)
      setIsDragging(true)
      setCursorPos({ x: e.clientX, y: e.clientY })

      if (targetBounds && isPointInsideRect(e.clientX, e.clientY, targetBounds)) {
        setDropPos(getRelativePos(e.clientX, e.clientY))
        setIsOverTarget(true)
      } else {
        setIsOverTarget(false)
      }
    },
    [isProcessing, targetBounds, getRelativePos]
  )

  useEffect(() => {
    if (!isDragging || !activeDesign) return

    const onMove = (e: MouseEvent) => {
      setCursorPos({ x: e.clientX, y: e.clientY })
      const over = targetBounds
        ? isPointInsideRect(e.clientX, e.clientY, targetBounds)
        : false
      setIsOverTarget(over)
      if (over) {
        setDropPos(getRelativePos(e.clientX, e.clientY))
      }
    }

    const onUp = (e: MouseEvent) => {
      const over = targetBounds
        ? isPointInsideRect(e.clientX, e.clientY, targetBounds)
        : false

      setIsDragging(false)
      setDragSource(null)
      setCursorPos(null)
      setIsOverTarget(false)

      if (over && activeDesign && !applyingRef.current) {
        const pos = getRelativePos(e.clientX, e.clientY)
        void applyMockup(activeDesign, pos)
      }
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [isDragging, activeDesign, getRelativePos, applyMockup, targetBounds])

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

  const previewSizeOnTarget = useMemo(() => {
    if (!activeDesign || !targetBounds) return null
    const minSide = Math.min(targetBounds.width, targetBounds.height)
    const size = minSide * 0.25
    const ratio = size / Math.max(activeDesign.width, activeDesign.height)
    return {
      width: activeDesign.width * ratio,
      height: activeDesign.height * ratio,
    }
  }, [activeDesign, targetBounds])

  const ghostPreviewSize = useMemo(() => {
    if (!activeDesign) return null
    const base = dragSource === 'canvas' ? 96 : 80
    const ratio = base / Math.max(activeDesign.width, activeDesign.height)
    return {
      width: activeDesign.width * ratio,
      height: activeDesign.height * ratio,
    }
  }, [activeDesign, dragSource])

  const wrapperEl =
    typeof document !== 'undefined'
      ? document.getElementById('canvas-popbar-wrapper')
      : null

  if (!open || !wrapperEl) return null

  const wrapperRect = wrapperRectRef.current
  const dialogLeft =
    popbarPos && wrapperRect
      ? wrapperRect.left + popbarPos.x + (dialogOffset?.x ?? 0)
      : targetBounds
        ? targetBounds.left + targetBounds.width / 2 + (dialogOffset?.x ?? 0)
        : 100
  const dialogTop =
    popbarPos && wrapperRect
      ? wrapperRect.top + popbarPos.y + 50 + (dialogOffset?.y ?? 0)
      : targetBounds
        ? targetBounds.top + targetBounds.height + 12 + (dialogOffset?.y ?? 0)
        : 100

  const showTargetPreview =
    isDragging && isOverTarget && activeDesign && previewSizeOnTarget
  const showFloatingGhost =
    isDragging && activeDesign && ghostPreviewSize && cursorPos && !isOverTarget

  return createPortal(
    <>
      {/* 阻断 Excalidraw 原生交互，贴图通过画布覆盖层拖拽 */}
      {canvasArea && (
        <div
          className='fixed z-[9996]'
          style={{
            left: canvasArea.left,
            top: canvasArea.top,
            width: canvasArea.width,
            height: canvasArea.height,
            pointerEvents: 'auto',
          }}
        />
      )}

      {/* 画布上的贴图元素：可直接拖拽到样机 */}
      {designOptions.map((design) => {
        if (!design.bounds || (isDragging && activeDesign?.elementId === design.elementId)) {
          return null
        }
        const isActive = activeDesign?.elementId === design.elementId
        return (
          <div
            key={design.elementId}
            className={cn(
              'fixed z-[9997] cursor-grab active:cursor-grabbing rounded-sm transition-shadow',
              isActive && 'ring-2 ring-primary ring-offset-1 ring-offset-background/80',
              isDragging && !isActive && 'opacity-60'
            )}
            style={{
              left: design.bounds.left,
              top: design.bounds.top,
              width: design.bounds.width,
              height: design.bounds.height,
              pointerEvents: isProcessing ? 'none' : 'auto',
            }}
            onMouseDown={(e) => startDrag(design, 'canvas', e)}
          >
            <img
              src={design.base64 || design.url}
              alt={design.fileId}
              className='w-full h-full object-contain pointer-events-none'
              draggable={false}
            />
            <div className='absolute -top-5 left-1/2 -translate-x-1/2 flex items-center gap-0.5 text-[9px] font-medium text-primary-foreground bg-primary px-1.5 py-0.5 rounded whitespace-nowrap shadow-sm'>
              <Move className='size-2.5' />
              {t('canvas:mockup.dragToMockup', 'Drag to mockup')}
            </div>
          </div>
        )
      })}

      {/* 样机目标区域 */}
      {targetBounds && (
        <div
          ref={overlayRef}
          className={cn(
            'fixed z-[9999] border-2 border-dashed rounded-sm transition-colors',
            isOverTarget && isDragging
              ? 'border-primary bg-primary/10'
              : 'border-primary/80'
          )}
          style={{
            left: targetBounds.left,
            top: targetBounds.top,
            width: targetBounds.width,
            height: targetBounds.height,
            pointerEvents: 'none',
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.12)',
          }}
        >
          <div className='absolute -top-6 left-0 text-[10px] font-semibold text-primary bg-background/90 px-2 py-0.5 rounded whitespace-nowrap'>
            {t('canvas:mockup.targetLabel', 'Mockup target')}
          </div>

          {showTargetPreview && (
            <div
              className='absolute pointer-events-none flex items-center justify-center'
              style={{
                left: `${dropPos.x * 100}%`,
                top: `${dropPos.y * 100}%`,
                width: previewSizeOnTarget!.width,
                height: previewSizeOnTarget!.height,
                transform: 'translate(-50%, -50%)',
              }}
            >
              <StickerPreview
                design={activeDesign!}
                width={previewSizeOnTarget!.width}
                height={previewSizeOnTarget!.height}
                normalizedX={dropPos.x}
                normalizedY={dropPos.y}
              />
            </div>
          )}

          {isProcessing && (
            <div className='absolute inset-0 flex items-center justify-center bg-background/40 backdrop-blur-[1px]'>
              <Loader2 className='size-8 animate-spin text-primary' />
            </div>
          )}
        </div>
      )}

      {/* 拖拽中、尚未进入样机区域时的浮动贴图预览 */}
      {showFloatingGhost && (
        <div
          className='fixed z-[10001] pointer-events-none flex items-center justify-center'
          style={{
            left: cursorPos!.x,
            top: cursorPos!.y,
            width: ghostPreviewSize!.width,
            height: ghostPreviewSize!.height,
            transform: 'translate(-50%, -50%)',
            opacity: 0.9,
          }}
        >
          <img
            src={activeDesign!.base64 || activeDesign!.url}
            alt='dragging'
            className='w-full h-full object-contain drop-shadow-lg'
            draggable={false}
          />
        </div>
      )}

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
          >
            <div className='flex items-center justify-between'>
              <div
                className='flex items-center gap-1.5 text-xs font-semibold text-foreground cursor-grab active:cursor-grabbing flex-1 min-w-0'
                onMouseDown={handleDialogDragStart}
              >
                <GripHorizontal className='size-3.5 text-muted-foreground shrink-0' />
                <Sticker className='size-3.5 text-primary shrink-0' />
                <span className='truncate'>
                  {t('canvas:mockup.title', 'Mockup')}
                </span>
              </div>
              <button
                onClick={onClose}
                className='size-6 flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted/60 hover:text-foreground cursor-pointer'
                disabled={isProcessing}
              >
                <X className='size-3' />
              </button>
            </div>

            <p className='text-[10px] text-muted-foreground leading-relaxed'>
              {t(
                'canvas:mockup.canvasDragHint',
                'Drag stickers directly on the canvas onto the mockup. Uses In-Context LoRA for natural surface fitting.'
              )}
            </p>

            {Math.abs(estimateCurvature(dropPos.x)) > 0.12 && isOverTarget && isDragging && (
              <p className='text-[10px] text-primary/90'>
                {t('canvas:mockup.curvePreview', 'Curved surface preview active')}
              </p>
            )}

            {/* 备用：面板内拖拽 */}
            {designOptions.length > 0 && (
              <div className='space-y-1.5'>
                <p className='text-[10px] font-medium text-muted-foreground'>
                  {t('canvas:mockup.pickDesign', 'Or drag from here')}
                </p>
                <div className='flex gap-2 overflow-x-auto pb-1'>
                  {designOptions.map((design) => (
                    <button
                      key={`panel-${design.elementId}`}
                      type='button'
                      className={cn(
                        'relative shrink-0 w-12 h-12 rounded-lg overflow-hidden border-2 transition-colors cursor-grab active:cursor-grabbing',
                        activeDesign?.elementId === design.elementId
                          ? 'border-primary ring-2 ring-primary/30'
                          : 'border-border/60 hover:border-primary/50'
                      )}
                      onMouseDown={(e) => startDrag(design, 'panel', e)}
                      disabled={isProcessing}
                    >
                      <img
                        src={design.base64 || design.url}
                        alt={design.fileId}
                        className='w-full h-full object-cover pointer-events-none'
                        draggable={false}
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {designOptions.length === 0 && (
              <p className='text-[10px] text-muted-foreground'>
                {t(
                  'canvas:mockup.noDesignImages',
                  'Add another image (e.g. logo with background removed) to the canvas.'
                )}
              </p>
            )}

            <div className='flex justify-end'>
              <Button
                variant='outline'
                size='sm'
                className='h-7 text-xs px-2.5'
                onClick={onClose}
                disabled={isProcessing}
              >
                {t('common:cancel', 'Cancel')}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>,
    wrapperEl
  )
}

export default CanvasMockupEditor
