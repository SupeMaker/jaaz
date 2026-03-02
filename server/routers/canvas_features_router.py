"""
Canvas features API endpoints.
Implements:
- History Snapshots: save/list/restore/delete canvas state snapshots
- Smart Layers: detect layers in a generated image
- Campaign Suite: generate adapted creatives for multiple platforms
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import json
import os
import time
import uuid
from pathlib import Path
from services.config_service import FILES_DIR, config_service
from services.websocket_service import send_to_websocket
from tools.utils.image_generation_core import generate_image_with_provider

router = APIRouter(prefix="/api")


# -------------------------------------------------------------------
# History Snapshots
# -------------------------------------------------------------------
class SnapshotSaveRequest(BaseModel):
    canvas_id: str
    label: str
    thumbnail: Optional[str] = ""
    prompt: Optional[str] = ""


class SnapshotListResponse(BaseModel):
    snapshots: List[Dict[str, Any]]


def _snapshot_dir(canvas_id: str) -> Path:
    return Path(FILES_DIR) / "snapshots" / canvas_id


def _read_snapshots(canvas_id: str) -> List[Dict[str, Any]]:
    sdir = _snapshot_dir(canvas_id)
    if not sdir.exists():
        return []
    out: List[Dict[str, Any]] = []
    for fp in sorted(sdir.glob("*.json"), key=lambda p: -p.stat().st_mtime):
        try:
            with open(fp, "r", encoding="utf-8") as f:
                data = json.load(f)
            data.setdefault("id", fp.stem)
            out.append(data)
        except Exception:
            continue
    return out


@router.get("/canvas_snapshots")
async def list_snapshots(canvas_id: str):
    return {"snapshots": _read_snapshots(canvas_id)}


@router.post("/canvas_snapshots/save")
async def save_snapshot(req: SnapshotSaveRequest):
    sdir = _snapshot_dir(req.canvas_id)
    sdir.mkdir(parents=True, exist_ok=True)
    sid = uuid.uuid4().hex[:12]
    data = {
        "id": sid,
        "canvas_id": req.canvas_id,
        "label": req.label,
        "thumbnail": req.thumbnail or "",
        "prompt": req.prompt or "",
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S"),
    }
    fp = sdir / f"{sid}.json"
    with open(fp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    return {"status": "success", "snapshot": data}


@router.post("/canvas_snapshots/delete")
async def delete_snapshot(req: Dict[str, str]):
    sid = req.get("id")
    canvas_id = req.get("canvas_id")
    if not sid or not canvas_id:
        raise HTTPException(status_code=400, detail="id and canvas_id required")
    fp = _snapshot_dir(canvas_id) / f"{sid}.json"
    if fp.exists():
        fp.unlink()
    return {"status": "success"}


# -------------------------------------------------------------------
# Smart Layers
# -------------------------------------------------------------------
class SmartLayersRequest(BaseModel):
    canvas_id: str
    image_file_id: str


@router.post("/smart_layers")
async def detect_smart_layers(req: SmartLayersRequest):
    """
    Provide a simple layer breakdown for a generated image.
    Real detection would call an ML model; for now we return a synthetic
    but useful default set so the UI is fully functional.
    """
    if not req.image_file_id:
        raise HTTPException(status_code=400, detail="image_file_id required")

    layers = [
        {
            "id": f"{req.image_file_id}-subject",
            "name": "Subject",
            "type": "subject",
            "visible": True,
            "locked": False,
            "opacity": 1.0,
            "thumbnail": f"/api/file/{req.image_file_id}",
        },
        {
            "id": f"{req.image_file_id}-background",
            "name": "Background",
            "type": "background",
            "visible": True,
            "locked": False,
            "opacity": 1.0,
            "thumbnail": "",
        },
        {
            "id": f"{req.image_file_id}-foreground",
            "name": "Foreground",
            "type": "foreground",
            "visible": True,
            "locked": False,
            "opacity": 1.0,
            "thumbnail": "",
        },
        {
            "id": f"{req.image_file_id}-effect",
            "name": "Effects",
            "type": "effect",
            "visible": True,
            "locked": False,
            "opacity": 0.8,
            "thumbnail": "",
        },
    ]
    return {"status": "success", "layers": layers}


# -------------------------------------------------------------------
# Campaign Suite
# -------------------------------------------------------------------
PLATFORM_SPECS: Dict[str, Dict[str, str]] = {
    "instagram": {"aspect_ratio": "1:1", "dimensions": "1080x1080"},
    "instagram_story": {"aspect_ratio": "9:16", "dimensions": "1080x1920"},
    "tiktok": {"aspect_ratio": "9:16", "dimensions": "1080x1920"},
    "youtube": {"aspect_ratio": "16:9", "dimensions": "1280x720"},
    "twitter": {"aspect_ratio": "16:9", "dimensions": "1200x675"},
    "xiaohongshu": {"aspect_ratio": "3:4", "dimensions": "1242x1660"},
    "facebook": {"aspect_ratio": "1.91:1", "dimensions": "1200x630"},
}


class CampaignGenerateRequest(BaseModel):
    session_id: str
    canvas_id: str
    source_image: str
    platforms: List[str]
    prompt: Optional[str] = ""
    provider: str = "agnes"
    model: str = "agnes-image-2.0-flash"


@router.post("/campaign_generate")
async def campaign_generate(req: CampaignGenerateRequest):
    """
    For each platform, call image generation with the platform's aspect ratio
    and the provided source image as the input reference.
    """
    if not req.source_image:
        raise HTTPException(status_code=400, detail="source_image is required")
    if not req.platforms:
        raise HTTPException(status_code=400, detail="platforms is required")

    base_prompt = req.prompt.strip() or (
        "Adapt this creative for the platform. Maintain brand identity, "
        "key visual elements, and message. Use the appropriate aspect ratio."
    )

    results: List[Dict[str, Any]] = []
    for platform in req.platforms:
        spec = PLATFORM_SPECS.get(platform)
        if not spec:
            results.append({"platform": platform, "status": "skipped", "error": "unknown platform"})
            continue

        try:
            await send_to_websocket(req.session_id, {
                "type": "campaign_progress",
                "platform": platform,
                "status": "generating",
            })
            platform_prompt = f"{base_prompt} (Platform: {platform})"
            result = await generate_image_with_provider(
                canvas_id=req.canvas_id,
                session_id=req.session_id,
                provider=req.provider,
                model=req.model,
                prompt=platform_prompt,
                aspect_ratio=spec["aspect_ratio"],
                input_images=[req.source_image],
            )
            results.append({
                "platform": platform,
                "status": "done",
                "result": result,
                "dimensions": spec["dimensions"],
                "aspect_ratio": spec["aspect_ratio"],
            })
        except Exception as e:
            print(f"❌ Campaign generate failed for {platform}: {e}")
            results.append({
                "platform": platform,
                "status": "failed",
                "error": str(e),
            })

    return {"status": "success", "results": results}


@router.get("/campaign_platforms")
async def list_platforms():
    """List all supported campaign platforms with their default dimensions."""
    return {
        "platforms": [
            {"platform": k, "aspect_ratio": v["aspect_ratio"], "dimensions": v["dimensions"]}
            for k, v in PLATFORM_SPECS.items()
        ]
    }
