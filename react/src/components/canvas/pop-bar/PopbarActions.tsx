import { Button } from '@/components/ui/button'
import { TCanvasAddImagesToChatEvent } from '@/lib/event'
import { eventBus } from '@/lib/event'
import { memo, useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useCanvas } from '@/contexts/canvas'
import {
  Maximize2,
  Eraser,
  Pencil,
  Type,
  Expand,
  Paintbrush,
  Download,
  Sticker,
  Layers,
} from 'lucide-react'
import { toast } from 'sonner'
import CanvasInpaintEditor from '../CanvasInpaintEditor'
import CanvasComposeDialog from '../CanvasComposeDialog'
import CanvasMockupEditor from '../CanvasMockupEditor'

type PopbarActionsProps = {
  selectedImages: TCanvasAddImagesToChatEvent
  popbarPos?: { x: number; y: number }
}

const PopbarActions = ({ selectedImages, popbarPos }: PopbarActionsProps) => {
  const { t } = useTranslation()
  const { canvasId } = useCanvas()
  const hasImages = selectedImages.length > 0

  // Inpaint editor state
  const [inpaintOpen, setInpaintOpen] = useState(false)
  const [inpaintMode, setInpaintMode] = useState<'editElement' | 'editText'>(
    'editElement'
  )

  // Mockup editor state
  const [mockupOpen, setMockupOpen] = useState(false)

  // Compose dialog state
  const [composeOpen, setComposeOpen] = useState(false)

  // 从 URL search params 获取 sessionId
  const sessionId = useMemo(() => {
    if (typeof window === 'undefined') return ''
    const params = new URLSearchParams(window.location.search)
    return params.get('sessionId') || ''
  }, [])

  // 获取选中图像的信息（取第一张）
  const selectedImage = selectedImages[0]
  const imageUrl = selectedImage
    ? selectedImage.base64 || `/api/file/${selectedImage.fileId}`
    : ''
  const imageFileId = selectedImage?.fileId || ''

  const handleUpscale = () => {
    if (!hasImages) return
    eventBus.emit('Canvas::Upscale', selectedImages)
    toast.info(t('canvas:popbar.upscale'))
  }

  const handleRemoveBg = () => {
    if (!hasImages) return
    eventBus.emit('Canvas::RemoveBg', selectedImages)
    toast.info(t('canvas:popbar.removeBg'))
  }

  const handleEditElement = () => {
    if (!hasImages) {
      toast.error('Please select an image first')
      return
    }
    setInpaintMode('editElement')
    setInpaintOpen(true)
  }

  const handleEditText = () => {
    if (!hasImages) {
      toast.error('Please select an image first')
      return
    }
    setInpaintMode('editText')
    setInpaintOpen(true)
  }

  const handleExpand = () => {
    if (!hasImages) return
    eventBus.emit('Canvas::Expand', selectedImages)
    toast.info(t('canvas:popbar.expand'))
  }

  const handleRedraw = () => {
    if (!hasImages) {
      toast.error('Please select an image first')
      return
    }
    eventBus.emit('Canvas::Redraw', selectedImages)
    toast.info(t('canvas:popbar.redraw'))
  }

  const handleDownload = () => {
    if (!hasImages) return
    eventBus.emit('Canvas::Download', selectedImages)
    toast.info(t('canvas:popbar.download'))
  }

  const handleMockup = () => {
    if (!hasImages) {
      toast.error('Please select an image first')
      return
    }
    setMockupOpen(true)
  }

  const handleCompose = () => {
    if (selectedImages.length < 2) {
      toast.error(t('canvas:compose.needTwoImages', 'Please select at least 2 images'))
      return
    }
    setComposeOpen(true)
  }

  const actions = [
    { icon: Maximize2, label: 'upscale', onClick: handleUpscale, needsImage: true },
    { icon: Eraser, label: 'removeBg', onClick: handleRemoveBg, needsImage: true },
    { icon: Pencil, label: 'editElement', onClick: handleEditElement, needsImage: false },
    { icon: Type, label: 'editText', onClick: handleEditText, needsImage: false },
    { icon: Expand, label: 'expand', onClick: handleExpand, needsImage: true },
    { icon: Paintbrush, label: 'redraw', onClick: handleRedraw, needsImage: false },
    { icon: Layers, label: 'compose', onClick: handleCompose, needsImage: false, minImages: 2 },
    { icon: Sticker, label: 'mockup', onClick: handleMockup, needsImage: false },
    { icon: Download, label: 'download', onClick: handleDownload, needsImage: true },
  ]

  return (
    <>
      <div className="w-px h-5 bg-border mx-0.5" />
      {actions.map((action) => {
        if (action.needsImage && !hasImages) return null
        if ('minImages' in action && action.minImages && selectedImages.length < action.minImages) return null
        return (
          <Button
            key={action.label}
            variant="ghost"
            size="sm"
            onClick={action.onClick}
            className="h-7 px-2 gap-1 text-xs hover:bg-primary/10 hover:text-primary"
          >
            <action.icon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t(`canvas:popbar.${action.label}`)}</span>
          </Button>
        )
      })}

      {/* 局部重绘编辑器（覆盖层 + 顶部小弹窗） */}
      <CanvasInpaintEditor
        open={inpaintOpen}
        onClose={() => setInpaintOpen(false)}
        imageFileId={imageFileId}
        imageUrl={imageUrl}
        sessionId={sessionId}
        canvasId={canvasId}
        defaultMode={inpaintMode}
        popbarPos={popbarPos}
        title={
          inpaintMode === 'editElement'
            ? t('canvas:popbar.editElement')
            : t('canvas:popbar.editText')
        }
        placeholder={
          inpaintMode === 'editElement'
            ? t(
              'canvas:inpaint.elementPlaceholder',
              'e.g., change the cat to a dog, add a hat, remove the object...'
            )
            : t(
              'canvas:inpaint.textPlaceholder',
              'e.g., replace text with "Hello World", change font color to red...'
            )
        }
      />

      {/* 图像合成对话框 */}
      <CanvasComposeDialog
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        selectedImages={selectedImages}
        sessionId={sessionId}
        canvasId={canvasId}
        popbarPos={popbarPos}
      />

      {/* Mockup 画布内编辑器：选中样机 → 拖拽贴图 → AI 自动贴合 */}
      <CanvasMockupEditor
        open={mockupOpen}
        onClose={() => setMockupOpen(false)}
        targetFileId={imageFileId}
        sessionId={sessionId}
        canvasId={canvasId}
        popbarPos={popbarPos}
      />
    </>
  )
}

export default memo(PopbarActions)
