/**
 * Direct image editing API.
 * Calls the backend direct_edit endpoint to invoke image editing tools
 * without going through the text model.
 */

import { ExcalidrawImageElement } from '@excalidraw/excalidraw/element/types'
import { BinaryFileData } from '@excalidraw/excalidraw/types'

export interface DirectEditRequest {
  sessionId: string
  canvasId: string
  action: 'upscale' | 'remove_bg' | 'edit_element' | 'edit_text' | 'expand' | 'redraw'
  prompt?: string
  inputImages: string[]
  aspectRatio?: string
  provider?: string
  model?: string
}

export interface DirectEditResponse {
  status: string
  result: {
    element: ExcalidrawImageElement
    file: BinaryFileData
    image_url: string
  }
  action: string
}

export const directEdit = async (
  payload: DirectEditRequest
): Promise<DirectEditResponse> => {
  const response = await fetch(`/api/direct_edit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      session_id: payload.sessionId,
      canvas_id: payload.canvasId,
      action: payload.action,
      prompt: payload.prompt ?? '',
      input_images: payload.inputImages,
      aspect_ratio: payload.aspectRatio ?? '1:1',
      provider: payload.provider ?? 'agnes',
      model: payload.model ?? 'agnes-image-2.0-flash',
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Direct edit failed: ${errorText}`)
  }

  return (await response.json()) as DirectEditResponse
}

// -------------------------------------------------------------------
// Inpaint (局部重绘)
// -------------------------------------------------------------------
export interface BBox {
  x: number // 归一化坐标 0-1
  y: number
  width: number
  height: number
}

export interface InpaintRequest {
  sessionId: string
  canvasId: string
  imageFileId: string
  prompt: string
  bbox?: BBox
  maskBase64?: string
  provider?: string
  model?: string
  aspectRatio?: string
}

export interface InpaintResponse {
  status: string
  result: {
    element: ExcalidrawImageElement
    file: BinaryFileData
    image_url: string
  }
  action: string
  mask_saved: boolean
}

export const inpaint = async (
  payload: InpaintRequest
): Promise<InpaintResponse> => {
  const response = await fetch(`/api/inpaint`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      session_id: payload.sessionId,
      canvas_id: payload.canvasId,
      image_file_id: payload.imageFileId,
      prompt: payload.prompt,
      bbox: payload.bbox,
      mask_base64: payload.maskBase64,
      provider: payload.provider ?? 'agnes',
      model: payload.model ?? 'agnes-image-2.0-flash',
      aspect_ratio: payload.aspectRatio ?? '1:1',
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Inpaint failed: ${errorText}`)
  }

  return (await response.json()) as InpaintResponse
}

// -------------------------------------------------------------------
// Mockup / 贴纸粘贴
// -------------------------------------------------------------------
export interface MockupRequest {
  sessionId: string
  canvasId: string
  targetFileId: string
  designFileId: string
  x?: number
  y?: number
  scale?: number
  rotate?: number
  opacity?: number
  shadow?: boolean
  cornerRadius?: number
  blendMode?: string
  prompt?: string
}

export interface MockupResponse {
  status: string
  result: {
    element: ExcalidrawImageElement
    file: BinaryFileData
    image_url: string
  }
  action: string
}

export const mockup = async (
  payload: MockupRequest
): Promise<MockupResponse> => {
  const response = await fetch(`/api/mockup`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      session_id: payload.sessionId,
      canvas_id: payload.canvasId,
      target_file_id: payload.targetFileId,
      design_file_id: payload.designFileId,
      x: payload.x ?? 0.5,
      y: payload.y ?? 0.5,
      scale: payload.scale ?? 0.25,
      rotate: payload.rotate ?? 0,
      opacity: payload.opacity ?? 1,
      shadow: payload.shadow ?? true,
      corner_radius: payload.cornerRadius ?? 0,
      blend_mode: payload.blendMode ?? 'auto',
      prompt: payload.prompt ?? '',
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Mockup failed: ${errorText}`)
  }

  return (await response.json()) as MockupResponse
}
