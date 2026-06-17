import type { ExcalidrawImageElement } from '@excalidraw/excalidraw/element/types'
import type { BinaryFiles } from '@excalidraw/excalidraw/types'
import { estimateCurvature } from './mockupPreview'

export type CanvasImageInfo = {
  fileId: string
  elementId: string
  url: string
  base64?: string
  width: number
  height: number
  order: number
}

export function resolveFileId(
  fileId: string,
  files: BinaryFiles
): { resolvedId: string; url: string; base64?: string } | null {
  const file = files[fileId]
  if (!file) return null

  const isBase64 = file.dataURL.startsWith('data:')
  const resolvedId = isBase64
    ? file.id
    : file.dataURL.split('/').pop() || file.id

  return {
    resolvedId,
    url: file.dataURL,
    base64: isBase64 ? file.dataURL : undefined,
  }
}

export function resolveImageFileId(
  imageFileId: string,
  files: BinaryFiles
): string | null {
  for (const fid of Object.keys(files)) {
    const file = files[fid]
    if (!file) continue
    const resolved = resolveFileId(fid, files)
    if (
      resolved &&
      (resolved.resolvedId === imageFileId ||
        fid === imageFileId ||
        file.dataURL === `/api/file/${imageFileId}` ||
        file.dataURL.endsWith(`/${imageFileId}`))
    ) {
      return resolved.resolvedId
    }
  }
  return imageFileId
}

export function collectCanvasImages(
  elements: readonly ExcalidrawImageElement[],
  files: BinaryFiles,
  selectedIdOrder?: string[]
): CanvasImageInfo[] {
  const orderMap = new Map(
    (selectedIdOrder ?? []).map((id, index) => [id, index + 1])
  )

  return elements
    .filter((el) => el.type === 'image' && el.fileId && !el.isDeleted)
    .map((el, sceneIndex) => {
      const resolved = resolveFileId(el.fileId!, files)
      if (!resolved) return null

      return {
        fileId: resolved.resolvedId,
        elementId: el.id,
        url: resolved.url,
        base64: resolved.base64,
        width: el.width,
        height: el.height,
        order: orderMap.get(el.id) ?? sceneIndex + 1,
      }
    })
    .filter((item): item is CanvasImageInfo => item !== null)
}

export function collectSelectedImagesInOrder(
  elements: readonly ExcalidrawImageElement[],
  files: BinaryFiles,
  selectedIdOrder: string[]
): CanvasImageInfo[] {
  return selectedIdOrder
    .map((id, index) => {
      const el = elements.find(
        (item) => item.id === id && item.type === 'image'
      ) as ExcalidrawImageElement | undefined
      if (!el?.fileId) return null

      const resolved = resolveFileId(el.fileId, files)
      if (!resolved) return null

      return {
        fileId: resolved.resolvedId,
        elementId: el.id,
        url: resolved.url,
        base64: resolved.base64,
        width: el.width,
        height: el.height,
        order: index + 1,
      }
    })
    .filter((item): item is CanvasImageInfo => item !== null)
}

export function buildComposePrompt(userPrompt: string, imageCount: number): string {
  const lines = [
    `You are composing ${imageCount} images into one cohesive result.`,
    'Images are numbered by the user\'s selection order:',
  ]

  for (let i = 1; i <= imageCount; i++) {
    lines.push(`- Image ${i}: input reference #${i}`)
  }

  lines.push('')
  lines.push(`User instruction: ${userPrompt.trim()}`)
  lines.push('')
  lines.push(
    'When the user refers to "image 2", "the second image", or similar, use the numbered list above.'
  )

  return lines.join('\n')
}

export function buildMockupAutoFitPrompt(
  dropX: number,
  dropY: number,
  targetLabel: string,
  designLabel: string
): string {
  const xPct = Math.round(dropX * 100)
  const yPct = Math.round(dropY * 100)
  const curvature = estimateCurvature(dropX)
  const absCurve = Math.abs(curvature)

  const curveSection =
    absCurve > 0.12
      ? `The target surface at this position appears curved (cylindrical/spherical, curvature ~${Math.round(curvature * 100)}%). ` +
        'Warp and bend the transparent sticker to follow the 3D surface contour — e.g. wrap around a cup, bottle, mug, or rounded product edge. ' +
        'The design must not remain flat; it should curve with the object surface, matching viewing angle and foreshortening at the edges.'
      : 'If the product surface is curved (cup, bottle, apparel fold), warp the sticker to follow the surface contour rather than staying flat.'

  return [
    `Image 1 is the mockup/product photo (${targetLabel}).`,
    `Image 2 is the transparent design/sticker/logo (${designLabel}).`,
    `Place image 2 onto image 1 at approximately ${xPct}% from left and ${yPct}% from top.`,
    curveSection,
    'Match perspective, surface curvature, material texture, fabric folds, lighting, shadows, and distance naturally.',
    'The sticker should look physically applied on the object — printed, embroidered, or labeled — not pasted flat on top.',
    'Preserve mockup photo realism and quality.',
  ].join(' ')
}
