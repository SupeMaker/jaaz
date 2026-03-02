import { getCanvas, renameCanvas } from '@/api/canvas'
import CanvasExcali from '@/components/canvas/CanvasExcali'
import CanvasHeader from '@/components/canvas/CanvasHeader'
import CanvasMenu from '@/components/canvas/menu'
import CanvasPopbarWrapper from '@/components/canvas/pop-bar'
import CanvasFeaturesPanel from '@/components/canvas/CanvasFeaturesPanel'
import CanvasTaskStatus from '@/components/canvas/CanvasTaskStatus'
// VideoCanvasOverlay removed - using native Excalidraw embeddable elements instead
import ChatInterface from '@/components/chat/Chat'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { CanvasProvider } from '@/contexts/canvas'
import { Session } from '@/types/types'
import { createFileRoute, useParams, useSearch } from '@tanstack/react-router'
import { Loader2, PanelRightOpen, PanelRightClose } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

export const Route = createFileRoute('/canvas/$id')({
  component: Canvas,
})

function Canvas() {
  const { t } = useTranslation()
  const { id } = useParams({ from: '/canvas/$id' })
  const [canvas, setCanvas] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [canvasName, setCanvasName] = useState('')
  const [sessionList, setSessionList] = useState<Session[]>([])
  const [chatVisible, setChatVisible] = useState(true)
  // initialVideos removed - using native Excalidraw embeddable elements instead
  const search = useSearch({ from: '/canvas/$id' }) as {
    sessionId: string
  }
  const searchSessionId = search?.sessionId || ''
  useEffect(() => {
    let mounted = true

    const fetchCanvas = async () => {
      try {
        setIsLoading(true)
        setError(null)
        const data = await getCanvas(id)
        if (mounted) {
          setCanvas(data)
          setCanvasName(data.name)
          setSessionList(data.sessions)
          // Video elements now handled by native Excalidraw embeddable elements
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err : new Error('Failed to fetch canvas data'))
          console.error('Failed to fetch canvas data:', err)
        }
      } finally {
        if (mounted) {
          setIsLoading(false)
        }
      }
    }

    fetchCanvas()

    return () => {
      mounted = false
    }
  }, [id])

  const handleNameSave = async () => {
    await renameCanvas(id, canvasName)
  }

  return (
    <CanvasProvider>
      <div className='flex flex-col w-screen h-screen'>
        <CanvasHeader
          canvasName={canvasName}
          canvasId={id}
          onNameChange={setCanvasName}
          onNameSave={handleNameSave}
        />
        <ResizablePanelGroup
          direction='horizontal'
          className='w-screen h-screen'
          autoSaveId='jaaz-chat-panel'
        >
          <ResizablePanel className='relative' defaultSize={chatVisible ? 75 : 100}>
            <div className='w-full h-full'>
              {isLoading ? (
                <div className='flex-1 flex-grow px-4 bg-accent w-[24%] absolute right-0'>
                  <div className='flex items-center justify-center h-full'>
                    <Loader2 className='w-4 h-4 animate-spin' />
                  </div>
                </div>
              ) : (
                <div className='relative w-full h-full'>
                  <CanvasExcali canvasId={id} initialData={canvas?.data} />
                  <CanvasMenu />
                  <CanvasPopbarWrapper />
                  <CanvasTaskStatus />
                  <CanvasFeaturesPanel
                    canvasId={id}
                    sessionId={searchSessionId}
                  />
                  {!chatVisible && (
                    <button
                      onClick={() => setChatVisible(true)}
                      className='absolute top-3 right-3 z-30 flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-border/60 bg-background/90 text-foreground shadow-lg hover:bg-accent transition-colors'
                      title={t('canvas:chat.showChat', 'Show chat')}
                    >
                      <PanelRightOpen className='size-3.5' />
                      {t('canvas:chat.chat', 'Chat')}
                    </button>
                  )}
                </div>
              )}
            </div>
          </ResizablePanel>

          {chatVisible && (
            <>
              <ResizableHandle />

              <ResizablePanel defaultSize={25}>
                <div className='flex-1 flex-grow bg-accent/50 w-full'>
                  <ChatInterface
                    canvasId={id}
                    sessionList={sessionList}
                    setSessionList={setSessionList}
                    sessionId={searchSessionId}
                    onToggleVisibility={() => setChatVisible(false)}
                  />
                </div>
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>
      </div>
    </CanvasProvider>
  )
}
