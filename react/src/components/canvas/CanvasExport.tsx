import { useCanvas } from '@/contexts/canvas'
import { saveAs } from 'file-saver'
import JSZip from 'jszip'
import { ImageDown, ChevronDown, FileImage, FileType, FileCode, FileText } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '../ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

type ExportFormat = 'png' | 'jpg' | 'svg' | 'pdf' | 'zip'

const formatIcons = {
  png: FileImage,
  jpg: FileImage,
  svg: FileCode,
  pdf: FileText,
  zip: FileType,
}

const CanvasExport = () => {
  const { excalidrawAPI } = useCanvas()
  const { t } = useTranslation()

  const downloadImage = async (imageUrl: string): Promise<string> => {
    const image = new Image()
    image.src = imageUrl
    return new Promise((resolve, reject) => {
      image.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = image.width
        canvas.height = image.height
        const ctx = canvas.getContext('2d')
        ctx?.drawImage(image, 0, 0)
        const dataURL = canvas.toDataURL('image/png')
        resolve(dataURL)
      }
      image.onerror = () => {
        reject(new Error('Failed to load image'))
      }
    })
  }

  const getSelectedAssets = async () => {
    if (!excalidrawAPI) return null
    const appState = excalidrawAPI.getAppState()
    const elements = excalidrawAPI.getSceneElements()
    const files = excalidrawAPI.getFiles()

    const selectedIds = Object.keys(appState.selectedElementIds).filter(
      (id) => appState.selectedElementIds[id]
    )

    const images = elements.filter(
      (element) =>
        selectedIds.includes(element.id) &&
        (element.type === 'image' || element.type === 'embeddable')
    )

    if (images.length === 0) {
      toast.error(t('canvas:messages.nothingSelected'))
      return null
    }

    const embeddableElements = images.filter(element => element.type === 'embeddable')
    const imageElements = images.filter(element => element.type === 'image')

    const videoUrls = embeddableElements
      .map((element) => ('link' in element && element.link ? element.link : null))
      .filter((url): url is string => url !== null)

    const imageUrls = imageElements
      .map((element) => {
        if ('fileId' in element && element.fileId) {
          const file = files[element.fileId]
          return file?.dataURL
        }
        return null
      })
      .filter((url): url is string => url !== null && url !== undefined)

    if (imageUrls.length === 0 && videoUrls.length === 0) {
      toast.error(t('canvas:messages.nothingSelected'))
      return null
    }

    return { imageUrls, videoUrls }
  }

  const handleExport = async (format: ExportFormat) => {
    const toastId = toast.loading(t('canvas:messages.exportingAssets'))
    try {
      const assets = await getSelectedAssets()
      if (!assets) return
      const { imageUrls, videoUrls } = assets

      const randomId = Math.random().toString(36).substring(2, 15)

      // Single video
      if (videoUrls.length === 1 && imageUrls.length === 0) {
        const response = await fetch(videoUrls[0])
        const blob = await response.blob()
        saveAs(blob, `Asset-${randomId}.mp4`)
        return
      }

      // Single image
      if (imageUrls.length === 1 && videoUrls.length === 0) {
        const dataURL = await downloadImage(imageUrls[0])

        if (format === 'jpg') {
          // Convert PNG to JPG
          const img = new Image()
          img.src = dataURL
          await new Promise((r) => { img.onload = r })
          const canvas = document.createElement('canvas')
          canvas.width = img.width
          canvas.height = img.height
          const ctx = canvas.getContext('2d')
          ctx!.fillStyle = '#ffffff'
          ctx!.fillRect(0, 0, canvas.width, canvas.height)
          ctx!.drawImage(img, 0, 0)
          saveAs(canvas.toDataURL('image/jpeg', 0.92), `Asset-${randomId}.jpg`)
        } else if (format === 'svg') {
          // Wrap raster in SVG
          const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${img.width || 1024}" height="${img.height || 1024}"><image xlink:href="${dataURL}" width="100%" height="100%"/></svg>`
          const blob = new Blob([svg], { type: 'image/svg+xml' })
          saveAs(blob, `Asset-${randomId}.svg`)
        } else if (format === 'pdf') {
          // Simple PDF wrapper using jsPDF-like approach via print
          const img = new Image()
          img.src = dataURL
          await new Promise((r) => { img.onload = r })
          const pdfWindow = window.open('', '_blank')
          if (pdfWindow) {
            pdfWindow.document.write(`<html><head><title>Asset-${randomId}</title></head><body style="margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;"><img src="${dataURL}" style="max-width:100%;max-height:100vh;"/></body></html>`)
            pdfWindow.document.close()
            setTimeout(() => pdfWindow.print(), 500)
          }
        } else {
          saveAs(dataURL, `Asset-${randomId}.png`)
        }
        return
      }

      // Multiple assets - always zip
      const zip = new JSZip()

      await Promise.all(
        videoUrls.map(async (videoUrl, index) => {
          const response = await fetch(videoUrl)
          const blob = await response.blob()
          zip.file(`video-${index + 1}.mp4`, blob)
        })
      )

      await Promise.all(
        imageUrls.map(async (imageUrl, index) => {
          const dataURL = await downloadImage(imageUrl)
          if (dataURL) {
            if (format === 'jpg') {
              const img = new Image()
              img.src = dataURL
              await new Promise((r) => { img.onload = r })
              const canvas = document.createElement('canvas')
              canvas.width = img.width
              canvas.height = img.height
              const ctx = canvas.getContext('2d')
              ctx!.fillStyle = '#ffffff'
              ctx!.fillRect(0, 0, canvas.width, canvas.height)
              ctx!.drawImage(img, 0, 0)
              zip.file(`image-${index + 1}.jpg`, canvas.toDataURL('image/jpeg', 0.92).replace('data:image/jpeg;base64,', ''), { base64: true })
            } else if (format === 'svg') {
              const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><image xlink:href="${dataURL}" width="100%" height="100%"/></svg>`
              zip.file(`image-${index + 1}.svg`, svg)
            } else {
              zip.file(`image-${index + 1}.png`, dataURL.replace('data:image/png;base64,', ''), { base64: true })
            }
          }
        })
      )

      const content = await zip.generateAsync({ type: 'blob' })
      saveAs(content, `Asset-${randomId}.zip`)
    } catch (error) {
      toast.error(t('canvas:messages.failedToExportImages'), {
        id: toastId,
      })
    } finally {
      toast.dismiss(toastId)
    }
  }

  const formats: ExportFormat[] = ['png', 'jpg', 'svg', 'pdf', 'zip']

  return (
    <div className="inline-flex -space-x-px rounded-md shadow-xs rtl:space-x-reverse">
      <Button
        className="rounded-none shadow-none first:rounded-s-md last:rounded-e-md h-8"
        variant="outline"
        onClick={() => handleExport('png')}
      >
        <ImageDown />
        {t('canvas:exportImages')}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="rounded-none shadow-none last:rounded-e-md h-8 px-2"
          >
            <ChevronDown className="size-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          {formats.map((format) => {
            const Icon = formatIcons[format]
            return (
              <DropdownMenuItem
                key={format}
                onClick={() => handleExport(format)}
                className="flex items-center gap-2 cursor-pointer"
              >
                <Icon className="size-3.5" />
                <span className="uppercase text-xs font-medium">{format}</span>
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

export default CanvasExport
