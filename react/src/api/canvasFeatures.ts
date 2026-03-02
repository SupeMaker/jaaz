/**
 * Canvas Features API.
 * Wraps the backend canvas_features_router endpoints:
 *   - History Snapshots (save/list/delete)
 *   - Smart Layers (detect layers for an image)
 *   - Campaign Suite (list platforms, generate multi-platform creatives)
 */

// -------------------------------------------------------------------
// Types
// -------------------------------------------------------------------
export interface Snapshot {
  id: string
  canvas_id: string
  label: string
  thumbnail?: string
  prompt?: string
  timestamp: string
}

export interface SmartLayer {
  id: string
  name: string
  type: 'subject' | 'background' | 'text' | 'foreground' | 'effect'
  visible: boolean
  locked: boolean
  opacity: number
  thumbnail?: string
}

export interface CampaignPlatformInfo {
  platform: string
  aspect_ratio: string
  dimensions: string
}

export interface CampaignResult {
  platform: string
  status: 'done' | 'failed' | 'skipped' | 'generating'
  result?: string
  dimensions?: string
  aspect_ratio?: string
  error?: string
}

// -------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------
async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  })
  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Request failed (${response.status}): ${text}`)
  }
  return (await response.json()) as T
}

// -------------------------------------------------------------------
// History Snapshots
// -------------------------------------------------------------------
export async function listSnapshots(canvasId: string): Promise<Snapshot[]> {
  const data = await jsonFetch<{ snapshots: Snapshot[] }>(
    `/api/canvas_snapshots?canvas_id=${encodeURIComponent(canvasId)}`
  )
  return data.snapshots || []
}

export async function saveSnapshot(payload: {
  canvasId: string
  label: string
  thumbnail?: string
  prompt?: string
}): Promise<Snapshot> {
  const data = await jsonFetch<{ status: string; snapshot: Snapshot }>(
    `/api/canvas_snapshots/save`,
    {
      method: 'POST',
      body: JSON.stringify({
        canvas_id: payload.canvasId,
        label: payload.label,
        thumbnail: payload.thumbnail ?? '',
        prompt: payload.prompt ?? '',
      }),
    }
  )
  return data.snapshot
}

export async function deleteSnapshot(
  canvasId: string,
  id: string
): Promise<void> {
  await jsonFetch<{ status: string }>(`/api/canvas_snapshots/delete`, {
    method: 'POST',
    body: JSON.stringify({ canvas_id: canvasId, id }),
  })
}

// -------------------------------------------------------------------
// Smart Layers
// -------------------------------------------------------------------
export async function detectSmartLayers(
  canvasId: string,
  imageFileId: string
): Promise<SmartLayer[]> {
  const data = await jsonFetch<{ status: string; layers: SmartLayer[] }>(
    `/api/smart_layers`,
    {
      method: 'POST',
      body: JSON.stringify({
        canvas_id: canvasId,
        image_file_id: imageFileId,
      }),
    }
  )
  return data.layers || []
}

// -------------------------------------------------------------------
// Campaign Suite
// -------------------------------------------------------------------
export async function listCampaignPlatforms(): Promise<CampaignPlatformInfo[]> {
  const data = await jsonFetch<{ platforms: CampaignPlatformInfo[] }>(
    `/api/campaign_platforms`
  )
  return data.platforms || []
}

export async function generateCampaign(payload: {
  sessionId: string
  canvasId: string
  sourceImage: string
  platforms: string[]
  prompt?: string
  provider?: string
  model?: string
}): Promise<CampaignResult[]> {
  const data = await jsonFetch<{ status: string; results: CampaignResult[] }>(
    `/api/campaign_generate`,
    {
      method: 'POST',
      body: JSON.stringify({
        session_id: payload.sessionId,
        canvas_id: payload.canvasId,
        source_image: payload.sourceImage,
        platforms: payload.platforms,
        prompt: payload.prompt ?? '',
        provider: payload.provider ?? 'agnes',
        model: payload.model ?? 'agnes-image-2.0-flash',
      }),
    }
  )
  return data.results || []
}
