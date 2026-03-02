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
} from 'lucide-react'
import { toast } from 'sonner'
import CanvasInpaintEditor from '../CanvasInpaintEditor'
import MockupDialog from '../MockupDialog'

type PopbarActionsProps = {
  selectedImages: TCanvasAddImagesToChatEvent
}

const PopbarActions = ({ selectedImages }: PopbarActionsProps) => {
  const { t } = useTranslation()
  const { canvasId } = useCanvas()
  const hasImages = selectedImages.length > 0

  // Inpaint editor state
  const [inpaintOpen, setInpaintOpen] = useState(false)
  const [inpaintMode, setInpaintMode] = useState<'editElement' | 'editText'>(
    'editElement'
  )

  // MockupDialog state
  const [mockupOpen, setMockupOpen] = useState(false)

  // 从 URL search params 获取 sessionId
  const sessionId = useMemo(() => {
    if (typeof window === 'undefined') return ''
    const params = new URLSearchParams(window.location.search)
    return params.get('sessionId') || ''
  }, [])

  // 获取选中图像的信息（取第一张）
  const selectedImage = selectedImages[0]
  const imageUrl = selectedImage
    ? `/api/file/${selectedImage.fileId}`
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

  const actions = [
    { icon: Maximize2, label: 'upscale', onClick: handleUpscale, needsImage: true },
    { icon: Eraser, label: 'removeBg', onClick: handleRemoveBg, needsImage: true },
    { icon: Pencil, label: 'editElement', onClick: handleEditElement, needsImage: false },
    { icon: Type, label: 'editText', onClick: handleEditText, needsImage: false },
    { icon: Expand, label: 'expand', onClick: handleExpand, needsImage: true },
    { icon: Paintbrush, label: 'redraw', onClick: handleRedraw, needsImage: false },
    { icon: Sticker, label: 'mockup', onClick: handleMockup, needsImage: false },
    { icon: Download, label: 'download', onClick: handleDownload, needsImage: true },
  ]

  return (
    <>
      <div className="w-px h-5 bg-border mx-0.5" />
      {actions.map((action) => {
        if (action.needsImage && !hasImages) return null
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
        sessionId={sessionId}
        canvasId={canvasId}
        defaultMode={inpaintMode}
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

      {/* Mockup / 贴纸粘贴对话框 */}
      <MockupDialog
        open={mockupOpen}
        onClose={() => setMockupOpen(false)}
        targetFileId={imageFileId}
        targetImageUrl={imageUrl}
        sessionId={sessionId}
        canvasId={canvasId}
      />
    </>
  )
}

export default memo(PopbarActions)
