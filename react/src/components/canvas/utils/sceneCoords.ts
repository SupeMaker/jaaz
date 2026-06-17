import type { AppState } from '@excalidraw/excalidraw/types'

type ScenePoint = { x: number; y: number }

type SceneRect = {
  x: number
  y: number
  width: number
  height: number
  angle?: number
}

export type ClientRect = {
  left: number
  top: number
  width: number
  height: number
}

function getExcalidrawCanvasRect(): DOMRect | null {
  const canvas = document.querySelector('.excalidraw canvas')
  if (canvas) return canvas.getBoundingClientRect()

  const container = document.querySelector('.excalidraw')
  return container?.getBoundingClientRect() ?? null
}

export function scenePointToClient(
  sceneX: number,
  sceneY: number,
  appState: AppState,
  canvasRect?: DOMRect | null
): ScenePoint {
  const rect = canvasRect ?? getExcalidrawCanvasRect()
  const zoom = appState.zoom.value
  const viewportX = (sceneX + appState.scrollX) * zoom
  const viewportY = (sceneY + appState.scrollY) * zoom

  if (!rect) {
    return { x: viewportX, y: viewportY }
  }

  return {
    x: rect.left + viewportX,
    y: rect.top + viewportY,
  }
}

export function sceneRectToClientBounds(
  element: SceneRect,
  appState: AppState
): ClientRect | null {
  const canvasRect = getExcalidrawCanvasRect()
  if (!canvasRect) return null

  const cx = element.x + element.width / 2
  const cy = element.y + element.height / 2
  const angle = element.angle ?? 0
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)

  const corners = [
    { x: -element.width / 2, y: -element.height / 2 },
    { x: element.width / 2, y: -element.height / 2 },
    { x: element.width / 2, y: element.height / 2 },
    { x: -element.width / 2, y: element.height / 2 },
  ]

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  corners.forEach((corner) => {
    const sceneX = corner.x * cos - corner.y * sin + cx
    const sceneY = corner.x * sin + corner.y * cos + cy
    const client = scenePointToClient(sceneX, sceneY, appState, canvasRect)
    minX = Math.min(minX, client.x)
    minY = Math.min(minY, client.y)
    maxX = Math.max(maxX, client.x)
    maxY = Math.max(maxY, client.y)
  })

  return {
    left: minX,
    top: minY,
    width: maxX - minX,
    height: maxY - minY,
  }
}

export function getCanvasAreaRect(): ClientRect | null {
  const rect = getExcalidrawCanvasRect()
  if (!rect) return null

  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
  }
}

export function findImageElementById(
  elements: readonly {
    type: string
    id?: string
    fileId?: string | null
    x?: number
    y?: number
    width?: number
    height?: number
    angle?: number
  }[],
  elementId: string
): SceneRect | undefined {
  const found = elements.find((el) => el.id === elementId && el.type === 'image')
  if (!found || found.x == null || found.y == null || found.width == null || found.height == null) {
    return undefined
  }
  return {
    x: found.x,
    y: found.y,
    width: found.width,
    height: found.height,
    angle: found.angle,
  }
}

export function findImageElementByFileId(
  elements: readonly { type: string; fileId?: string | null; x?: number; y?: number; width?: number; height?: number; angle?: number }[],
  files: Record<string, { id: string; dataURL: string } | undefined>,
  imageFileId: string
): SceneRect | undefined {
  const found = elements.find((el) => {
    if (el.type !== 'image' || !el.fileId) return false
    const file = files[el.fileId]
    if (!file) return el.fileId === imageFileId

    const isBase64 = file.dataURL.startsWith('data:')
    const resolvedId = isBase64
      ? file.id
      : file.dataURL.split('/').pop() || file.id

    return (
      resolvedId === imageFileId ||
      el.fileId === imageFileId ||
      file.dataURL === `/api/file/${imageFileId}` ||
      file.dataURL.endsWith(`/${imageFileId}`)
    )
  })

  if (!found || found.x == null || found.y == null || found.width == null || found.height == null) {
    return undefined
  }

  return {
    x: found.x,
    y: found.y,
    width: found.width,
    height: found.height,
    angle: found.angle,
  }
}
