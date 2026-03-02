import { directEdit } from '@/api/directEdit'
import { eventBus, TCanvasAddImagesToChatEvent, TCanvasImageAddedEvent } from '@/lib/event'
import { useCallback, useEffect, useRef } from 'react'
import { nanoid } from 'nanoid'
import { useTranslation } from 'react-i18next'

type CanvasEditHandlerProps = {
  sessionId: string
  canvasId: string
}

/**
 * Listens for Canvas image editing events (Upscale, RemoveBg, EditElement, etc.)
 * and invokes the backend direct_edit API to perform the operation.
 *
 * This component renders nothing - it is a pure logic component.
 */
const CanvasEditHandler: React.FC<CanvasEditHandlerProps> = ({
  sessionId,
  canvasId,
}) => {
  const { t } = useTranslation()
  // Ref to hold the latest edit prompt for edit_element/edit_text actions
  const pendingPromptRef = useRef<string>('')

  const handleEditAction = useCallback(
    async (
      action: 'upscale' | 'remove_bg' | 'edit_element' | 'edit_text' | 'expand' | 'redraw',
      data: TCanvasAddImagesToChatEvent
    ) => {
      if (!data || data.length === 0) {
        eventBus.emit('Canvas::TaskDone', {
          id: nanoid(),
          type: 'edit',
          action,
          status: 'error',
          message: t('canvas:edit.noImageSelected', 'No image selected'),
        })
        return
      }

      // Extract file IDs from the selected images
      const inputImages = data.map((img) => img.fileId)
      const actionLabels: Record<string, string> = {
        upscale: t('canvas:popbar.upscale'),
        remove_bg: t('canvas:popbar.removeBg'),
        edit_element: t('canvas:popbar.editElement'),
        edit_text: t('canvas:popbar.editText'),
        expand: t('canvas:popbar.expand'),
        redraw: t('canvas:popbar.redraw'),
      }

      // For edit_element/edit_text, use the prompt captured from the dialog
      const prompt =
        action === 'edit_element' || action === 'edit_text'
          ? pendingPromptRef.current
          : ''
      // Clear the pending prompt after use
      if (action === 'edit_element' || action === 'edit_text') {
        pendingPromptRef.current = ''
      }

      const taskId = nanoid()
      eventBus.emit('Canvas::TaskStarted', {
        id: taskId,
        type: 'edit',
        action,
        status: 'running',
        message: t('canvas:edit.processing', { action: actionLabels[action] }),
      })

      try {
        const result = await directEdit({
          sessionId,
          canvasId,
          action,
          inputImages,
          prompt,
        })

        if (result.status === 'success') {
          eventBus.emit('Canvas::TaskDone', {
            id: taskId,
            type: 'edit',
            action,
            status: 'success',
            message: t('canvas:edit.completed', { action: actionLabels[action] }),
          })
          // Emit event so CanvasExcali can render the generated image immediately
          const addEvent: TCanvasImageAddedEvent = {
            canvas_id: canvasId,
            session_id: sessionId,
            element: result.result.element,
            file: result.result.file,
            image_url: result.result.image_url,
          }
          eventBus.emit('Canvas::ImageAdded', addEvent)
        } else {
          eventBus.emit('Canvas::TaskDone', {
            id: taskId,
            type: 'edit',
            action,
            status: 'error',
            message: t('canvas:edit.failed', { action: actionLabels[action] }),
          })
        }
      } catch (error) {
        console.error(`Canvas edit action ${action} failed:`, error)
        eventBus.emit('Canvas::TaskDone', {
          id: taskId,
          type: 'edit',
          action,
          status: 'error',
          message: t('canvas:edit.failedWithError', {
            action: actionLabels[action],
            error: String(error),
          }),
        })
      }
    },
    [sessionId, canvasId, t]
  )

  // Handle download action separately (client-side only)
  const handleDownload = useCallback(
    async (data: TCanvasAddImagesToChatEvent) => {
      if (!data || data.length === 0) {
        eventBus.emit('Canvas::TaskDone', {
          id: nanoid(),
          type: 'edit',
          action: 'download',
          status: 'error',
          message: t('canvas:edit.noImageSelected', 'No image selected'),
        })
        return
      }

      for (const image of data) {
        try {
          const url = `/api/file/${image.fileId}`
          const response = await fetch(url)
          if (!response.ok) {
            throw new Error(`Failed to fetch image: ${response.status}`)
          }
          const blob = await response.blob()
          const downloadUrl = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = downloadUrl
          a.download = image.fileId || `image-${Date.now()}.png`
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
          URL.revokeObjectURL(downloadUrl)
        } catch (error) {
          console.error('Download failed:', error)
          eventBus.emit('Canvas::TaskDone', {
            id: nanoid(),
            type: 'edit',
            action: 'download',
            status: 'error',
            message: t('canvas:edit.downloadFailed', { error: String(error) }),
          })
        }
      }
    },
    [t]
  )

  useEffect(() => {
    const onUpscale = (data: TCanvasAddImagesToChatEvent) =>
      handleEditAction('upscale', data)
    const onRemoveBg = (data: TCanvasAddImagesToChatEvent) =>
      handleEditAction('remove_bg', data)
    const onEditElement = (data: TCanvasAddImagesToChatEvent) =>
      handleEditAction('edit_element', data)
    const onEditText = (data: TCanvasAddImagesToChatEvent) =>
      handleEditAction('edit_text', data)
    const onExpand = (data: TCanvasAddImagesToChatEvent) =>
      handleEditAction('expand', data)
    const onRedraw = (data: TCanvasAddImagesToChatEvent) =>
      handleEditAction('redraw', data)
    const onDownload = (data: TCanvasAddImagesToChatEvent) =>
      handleDownload(data)

    eventBus.on('Canvas::Upscale', onUpscale)
    eventBus.on('Canvas::RemoveBg', onRemoveBg)
    eventBus.on('Canvas::EditElement', onEditElement)
    eventBus.on('Canvas::EditText', onEditText)
    eventBus.on('Canvas::Expand', onExpand)
    eventBus.on('Canvas::Redraw', onRedraw)
    eventBus.on('Canvas::Download', onDownload)

    // Listen for prompt from the PopbarActions edit dialog
    const onPromptEvent = (e: Event) => {
      const detail = (e as CustomEvent).detail as {
        prompt: string
        action: string
      }
      if (detail?.prompt) {
        pendingPromptRef.current = detail.prompt
      }
    }
    window.addEventListener('canvas-edit-prompt', onPromptEvent as EventListener)

    return () => {
      eventBus.off('Canvas::Upscale', onUpscale)
      eventBus.off('Canvas::RemoveBg', onRemoveBg)
      eventBus.off('Canvas::EditElement', onEditElement)
      eventBus.off('Canvas::EditText', onEditText)
      eventBus.off('Canvas::Expand', onExpand)
      eventBus.off('Canvas::Redraw', onRedraw)
      eventBus.off('Canvas::Download', onDownload)
      window.removeEventListener('canvas-edit-prompt', onPromptEvent as EventListener)
    }
  }, [
    handleEditAction,
    handleDownload,
  ])

  return null
}

export default CanvasEditHandler
