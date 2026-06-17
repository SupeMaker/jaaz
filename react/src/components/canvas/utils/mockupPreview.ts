/** 根据贴图在样机上的归一化位置，估算曲面弯曲程度（-1 ~ 1） */
export function estimateCurvature(normalizedX: number): number {
  return Math.max(-1, Math.min(1, (normalizedX - 0.5) * 2))
}

export type CurvedStickerStyle = {
  transform: string
  transformOrigin: string
  opacity: number
  filter?: string
}

/**
 * 模拟柱面/曲面贴合的 CSS 3D 预览（如水杯侧壁弧度）。
 * normalizedX/Y 为贴图中心在样机上的 0~1 坐标。
 */
export function getCurvedStickerStyle(
  normalizedX: number,
  normalizedY: number,
  options?: { intensity?: number }
): CurvedStickerStyle {
  const intensity = options?.intensity ?? 1
  const dx = estimateCurvature(normalizedX)
  const dy = Math.max(-1, Math.min(1, (normalizedY - 0.5) * 2))

  // 水平偏移越大 → 越贴近柱面侧壁，rotateY 越大
  const rotateY = dx * 48 * intensity
  const rotateX = -dy * 12 * intensity
  const scaleX = 1 - Math.abs(dx) * 0.28 * intensity
  const scaleY = 1 - Math.abs(dy) * 0.1 * intensity
  const skewX = dx * 6 * intensity
  const perspective = 380 + Math.abs(dx) * 120

  const transforms = [
    `perspective(${perspective}px)`,
    `rotateY(${rotateY.toFixed(1)}deg)`,
    `rotateX(${rotateX.toFixed(1)}deg)`,
    `skewX(${skewX.toFixed(1)}deg)`,
    `scaleX(${scaleX.toFixed(3)})`,
    `scaleY(${scaleY.toFixed(3)})`,
  ]

  const edgeDarken = Math.abs(dx) > 0.2
  const brightness = 1 - Math.abs(dx) * 0.12 * intensity

  return {
    transform: transforms.join(' '),
    transformOrigin: 'center center',
    opacity: 0.82 + (1 - Math.abs(dx) * 0.5) * 0.18,
    filter: edgeDarken ? `brightness(${brightness.toFixed(2)})` : undefined,
  }
}

export function isPointInsideRect(
  x: number,
  y: number,
  rect: { left: number; top: number; width: number; height: number }
): boolean {
  return (
    x >= rect.left &&
    x <= rect.left + rect.width &&
    y >= rect.top &&
    y <= rect.top + rect.height
  )
}
