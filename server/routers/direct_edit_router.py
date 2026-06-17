"""
Direct image editing API endpoint.
Allows the frontend to invoke image editing tools without going through the text model.
Supports: upscale, remove_bg, edit_element, edit_text, expand, redraw, download, inpaint
"""

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from services.websocket_service import send_to_websocket
from tools.utils.image_generation_core import generate_image_with_provider_ex
from tools.utils.image_canvas_utils import save_image_to_canvas
from tools.utils.image_utils import generate_image_id
from services.config_service import FILES_DIR
from services.db_service import db_service
from utils.image_warp import apply_cylindrical_warp
from PIL import Image, ImageDraw, ImageFilter
import numpy as np
import os
import base64
import traceback
import math

router = APIRouter(prefix="/api")


class DirectEditRequest(BaseModel):
    session_id: str
    canvas_id: str
    action: str  # upscale | remove_bg | edit_element | edit_text | expand | redraw | compose
    prompt: str = ""
    input_images: List[str] = []
    aspect_ratio: str = "1:1"
    provider: str = "agnes"
    model: str = "agnes-image-2.0-flash"


class InpaintRequest(BaseModel):
    """局部重绘请求"""
    session_id: str
    canvas_id: str
    image_file_id: str  # 原图文件ID
    prompt: str  # 编辑提示词
    # 选区信息（归一化坐标 0-1）
    bbox: Optional[Dict[str, float]] = None  # {x, y, width, height} 归一化坐标
    # mask 图像（base64，白色为要编辑的区域）
    mask_base64: Optional[str] = None
    provider: str = "agnes"
    model: str = "agnes-image-2.0-flash"
    aspect_ratio: str = "1:1"


class MockupRequest(BaseModel):
    """Mockup / sticker paste 请求"""
    session_id: str
    canvas_id: str
    target_file_id: str  # 背景/目标图像文件ID（canvas 中的 fileId 或磁盘文件名）
    design_file_id: str  # 设计/贴纸图像文件ID
    # 设计图在目标图上的位置（归一化中心点，0-1）
    x: float = 0.5
    y: float = 0.5
    scale: float = 0.25  # 设计图相对目标图短边的缩放比例
    rotate: float = 0.0  # 旋转角度（度）
    opacity: float = 1.0  # 透明度 0-1
    shadow: bool = True  # 是否添加投影
    corner_radius: float = 0.0  # 圆角半径相对设计图短边的比例 0-1
    blend_mode: str = "auto"  # auto | overlay | multiply | screen | soft_light | hard_light | color_burn | color_dodge | normal
    curvature: float = 0.0  # 柱面弯曲 -1~1，贴图随曲面弧度变形
    prompt: str = ""  # 可选 AI 增强提示词（保留扩展）


class IcMockupRequest(BaseModel):
    """In-Context LoRA 风格 Mockup 请求（Visual Identity Design 范式）"""
    session_id: str
    canvas_id: str
    target_file_id: str
    design_file_id: str
    x: float = 0.5
    y: float = 0.5
    scale: float = 0.25
    curvature: float = 0.0
    provider: str = "agnes"
    model: str = "agnes-image-2.0-flash"
    aspect_ratio: str = "16:9"  # IC-LoRA 双 panel 宽屏布局
    fallback_pil: bool = True  # AI 失败时回退 PIL 合成


# Action -> default prompt mapping
ACTION_DEFAULT_PROMPTS = {
    "upscale": "Upscale this image to a higher resolution while preserving all details, textures, and composition. Maintain the exact same content with enhanced clarity.",
    "remove_bg": "Remove the background from this image completely, making it transparent. Keep the main subject with clean edges and no background remnants.",
    "expand": "Expand this image by extending the scene naturally in all directions. Maintain the same style, lighting, and content continuity. The expanded areas should blend seamlessly with the original.",
    "redraw": "Redraw this image with enhanced quality, better composition, and refined details while keeping the same subject and overall concept.",
    "edit_element": "Edit this image according to the user's instructions.",
    "edit_text": "Edit the text in this image according to the user's instructions.",
    "compose": "Compose and merge the provided images into a single cohesive image according to the user's instructions.",
}


@router.post("/direct_edit")
async def direct_edit(request: DirectEditRequest):
    """
    Directly invoke an image editing tool without going through the text model.

    This endpoint is used by the Canvas popbar actions (upscale, remove_bg, etc.)
    so that image editing works even when no text model is available.
    """
    try:
        action = request.action
        if action not in ACTION_DEFAULT_PROMPTS:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid action: {action}. Must be one of {list(ACTION_DEFAULT_PROMPTS.keys())}",
            )

        # Use provided prompt or default for the action
        prompt = request.prompt.strip() or ACTION_DEFAULT_PROMPTS[action]

        if action == "compose" and request.input_images:
            image_list = "\n".join(
                f"- Image {index + 1}: input reference #{index + 1}"
                for index in range(len(request.input_images))
            )
            prompt = (
                f"You are composing {len(request.input_images)} images into one cohesive result.\n"
                f"Images are numbered by the user's selection order:\n"
                f"{image_list}\n\n"
                f"User instruction: {prompt}\n\n"
                "When the user refers to image numbers (e.g. image 2, the second image), "
                "follow the numbered list above."
            )

        if not request.input_images:
            raise HTTPException(
                status_code=400, detail="input_images is required"
            )

        # Notify frontend that processing has started
        await send_to_websocket(request.session_id, {
            'type': 'image_generation_start',
            'message': f'Processing {action}...',
            'action': action,
        })

        # Call the image generation/editing provider directly.
        # Use the extended helper so we can return the generated element/file
        # without relying solely on the websocket broadcast.
        result = await generate_image_with_provider_ex(
            canvas_id=request.canvas_id,
            session_id=request.session_id,
            provider=request.provider,
            model=request.model,
            prompt=prompt,
            aspect_ratio=request.aspect_ratio,
            input_images=request.input_images,
            broadcast=False,
        )

        return {
            "status": "success",
            "result": result,
            "action": action,
        }

    except Exception as e:
        print(f"❌ Direct edit error ({request.action}): {e}")
        traceback.print_exc()
        # Notify frontend of the error
        try:
            await send_to_websocket(request.session_id, {
                'type': 'error',
                'error': f"Image edit failed: {str(e)}",
                'action': request.action,
            })
        except Exception:
            pass
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/inpaint")
async def inpaint(request: InpaintRequest):
    """
    局部重绘 API。

    接收原图 + 选区信息 + 提示词，调用图生图 API 进行局部编辑。

    由于 Agnes API 当前不直接支持 mask 参数，采用以下策略：
    1. 将选区信息（bbox）编码到 prompt 中，明确告诉模型要编辑哪个区域
    2. 将原图作为输入图片，让模型根据 prompt 编辑图像
    3. 如果提供了 mask_base64，保存 mask 图像供未来扩展使用
    """
    try:
        if not request.image_file_id:
            raise HTTPException(status_code=400, detail="image_file_id is required")
        if not request.prompt.strip():
            raise HTTPException(status_code=400, detail="prompt is required")

        # 构建增强的 prompt，包含选区信息
        enhanced_prompt = request.prompt.strip()

        if request.bbox:
            # 将归一化坐标转换为百分比描述
            x = request.bbox.get('x', 0)
            y = request.bbox.get('y', 0)
            w = request.bbox.get('width', 0)
            h = request.bbox.get('height', 0)
            # 添加区域描述到 prompt
            region_desc = (
                f" Focus on the region at "
                f"horizontal {int(x*100)}%-{int((x+w)*100)}%, "
                f"vertical {int(y*100)}%-{int((y+h)*100)}% of the image. "
                f"Edit only the element in this selected area, "
                f"keep all other parts of the image unchanged."
            )
            enhanced_prompt = enhanced_prompt + region_desc

        # 如果有 mask，保存它并作为局部重绘的 mask 传入 provider
        mask_filename = None
        if request.mask_base64:
            try:
                mask_data = request.mask_base64
                # 移除 data:image/png;base64, 前缀
                if ',' in mask_data:
                    mask_data = mask_data.split(',', 1)[1]
                mask_bytes = base64.b64decode(mask_data)
                mask_filename = f"mask_{request.image_file_id.replace('.', '_')}.png"
                mask_path = os.path.join(FILES_DIR, mask_filename)
                with open(mask_path, 'wb') as f:
                    f.write(mask_bytes)
                print(f"✅ Mask saved: {mask_filename}")
            except Exception as me:
                print(f"⚠️ Mask save failed (non-fatal): {me}")

        # 通知前端开始处理
        await send_to_websocket(request.session_id, {
            'type': 'image_generation_start',
            'message': f'Processing inpaint: {request.prompt[:50]}...',
            'action': 'inpaint',
        })

        # 调用图生图 API（原图作为输入，mask 控制局部重绘区域）
        result = await generate_image_with_provider_ex(
            canvas_id=request.canvas_id,
            session_id=request.session_id,
            provider=request.provider,
            model=request.model,
            prompt=enhanced_prompt,
            aspect_ratio=request.aspect_ratio,
            input_images=[request.image_file_id],
            mask=mask_filename,
            broadcast=False,
        )

        return {
            "status": "success",
            "result": result,
            "action": "inpaint",
            "mask_saved": mask_filename is not None,
        }

    except Exception as e:
        print(f"❌ Inpaint error: {e}")
        traceback.print_exc()
        try:
            await send_to_websocket(request.session_id, {
                'type': 'error',
                'error': f"Inpaint failed: {str(e)}",
                'action': 'inpaint',
            })
        except Exception:
            pass
        raise HTTPException(status_code=500, detail=str(e))


async def _resolve_file_id_to_path(canvas_id: str, file_id: str) -> Optional[str]:
    """将 canvas file_id 解析为磁盘文件路径。

    file_id 可能是：
    1. 磁盘文件名（如 im_abc123.png）——直接检查 FILES_DIR
    2. canvas 中 files 的 id——需要从 canvas data 的 dataURL 提取文件名
    """
    if not file_id:
        return None

    # 情况 1：直接是磁盘文件名
    direct_path = os.path.join(FILES_DIR, file_id)
    if os.path.exists(direct_path):
        return direct_path

    # 情况 2：canvas files 中的 id
    try:
        canvas = await db_service.get_canvas_data(canvas_id)
        if canvas and 'files' in canvas:
            file_data = canvas['files'].get(file_id)
            if file_data and isinstance(file_data, dict):
                data_url = file_data.get('dataURL', '')
                if data_url.startswith('/api/file/'):
                    filename = data_url.split('/')[-1]
                    resolved = os.path.join(FILES_DIR, filename)
                    if os.path.exists(resolved):
                        return resolved
    except Exception as e:
        print(f"⚠️ resolve file_id failed: {e}")

    return None


def _round_corners(image: Image.Image, radius: int) -> Image.Image:
    """为 RGBA 图像应用圆角蒙版"""
    if radius <= 0:
        return image

    width, height = image.size
    radius = min(radius, width // 2, height // 2)

    mask = Image.new('L', (width, height), 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle((0, 0, width, height), radius=radius, fill=255)

    result = image.copy()
    result.putalpha(mask)
    return result


def _create_shadow(design: Image.Image, opacity: float) -> Image.Image:
    """为设计图创建投影层"""
    shadow = design.copy()
    alpha = shadow.split()[-1]
    # 将 alpha 通道变暗并模糊
    shadow_alpha = alpha.point(lambda p: int(p * 0.35 * opacity))
    shadow = Image.merge('RGBA', (0, 0, 0, shadow_alpha))
    shadow = shadow.filter(ImageFilter.GaussianBlur(radius=max(4, min(design.size) // 20)))
    return shadow


def _match_color_to_target(design_rgb: np.ndarray, target_rgb: np.ndarray,
                           mask: np.ndarray) -> np.ndarray:
    """将设计图颜色统计特征匹配到目标区域，使其融入环境光照。"""
    if mask.sum() < 10:
        return design_rgb

    design_masked = design_rgb[mask]
    target_masked = target_rgb[mask]

    # 分别对 RGB 三个通道做均值/标准差匹配
    result = design_rgb.astype(np.float32)
    for c in range(3):
        d_mean = float(design_masked[:, c].mean())
        d_std = float(design_masked[:, c].std()) + 1e-6
        t_mean = float(target_masked[:, c].mean())
        t_std = float(target_masked[:, c].std()) + 1e-6

        result[:, :, c] = (result[:, :, c] - d_mean) * (t_std / d_std) + t_mean

    # 保留一点原始饱和度，避免完全失去设计图颜色
    result = np.clip(result, 0, 255)
    return (0.65 * result + 0.35 * design_rgb).astype(np.uint8)


def _blend_images(design_rgb: np.ndarray, target_rgb: np.ndarray,
                  mode: str) -> np.ndarray:
    """使用指定混合模式融合两张 RGB 图像。"""
    d = design_rgb.astype(np.float32) / 255.0
    t = target_rgb.astype(np.float32) / 255.0

    if mode == 'multiply':
        out = d * t
    elif mode == 'screen':
        out = 1.0 - (1.0 - d) * (1.0 - t)
    elif mode == 'overlay':
        out = np.where(t < 0.5, 2 * d * t, 1.0 - 2 * (1.0 - d) * (1.0 - t))
    elif mode == 'hard_light':
        out = np.where(d < 0.5, 2 * d * t, 1.0 - 2 * (1.0 - d) * (1.0 - t))
    elif mode == 'soft_light':
        out = np.where(
            t < 0.5,
            2 * d * t + d * d * (1.0 - 2 * t),
            2 * d * (1.0 - t) + np.sqrt(d) * (2 * t - 1.0)
        )
    elif mode == 'color_dodge':
        out = np.clip(t / (1.0 - d + 1e-6), 0, 1)
    elif mode == 'color_burn':
        out = 1.0 - np.clip((1.0 - t) / (d + 1e-6), 0, 1)
    elif mode == 'vivid_light':
        dodge = np.clip(t / (1.0 - d + 1e-6), 0, 1)
        burn = 1.0 - np.clip((1.0 - t) / (d + 1e-6), 0, 1)
        out = np.where(d < 0.5, burn, dodge)
    else:  # normal
        out = d

    return np.clip(out * 255, 0, 255).astype(np.uint8)


def _auto_blend_mode(design_rgb: np.ndarray, target_rgb: np.ndarray,
                     mask: np.ndarray) -> str:
    """根据目标区域亮度和设计图颜色自动选择最合适的混合模式。"""
    if mask.sum() < 10:
        return 'overlay'

    target_lum = target_rgb[mask].mean()
    design_contrast = design_rgb[mask].std()

    if target_lum < 80:
        # 暗背景：提亮设计图，像印刷在深色材质上
        return 'screen' if design_contrast > 60 else 'soft_light'
    elif target_lum > 200:
        # 亮背景：压暗设计图
        return 'multiply' if design_contrast > 60 else 'overlay'
    else:
        # 中等亮度： vivid_light 能得到强烈的"印上去"效果
        return 'vivid_light' if design_contrast > 50 else 'overlay'


def _fuse_design(design: Image.Image, target_patch: Image.Image,
                 blend_mode: str, opacity: float) -> Image.Image:
    """将设计图与目标区域纹理融合，看起来像画/印上去的一样。"""
    design_rgba = np.array(design)
    patch_rgba = np.array(target_patch)

    if design_rgba.shape[2] == 3:
        design_rgba = np.dstack([design_rgba, np.full(design_rgba.shape[:2], 255, dtype=np.uint8)])

    design_rgb = design_rgba[:, :, :3]
    patch_rgb = patch_rgba[:, :, :3]
    alpha = design_rgba[:, :, 3].astype(np.float32) / 255.0

    # 只处理有内容的不透明区域
    content_mask = alpha > 0.05

    # 颜色匹配
    matched = _match_color_to_target(design_rgb, patch_rgb, content_mask)

    # 自动选择混合模式
    actual_mode = blend_mode
    if actual_mode == 'auto':
        actual_mode = _auto_blend_mode(matched, patch_rgb, content_mask)

    # 混合
    blended = _blend_images(matched, patch_rgb, actual_mode)

    # 加入目标区域的光照/阴影变化（ambient occlusion）
    patch_gray = np.array(Image.fromarray(patch_rgb).convert('L'))
    lum = patch_gray.astype(np.float32) / 255.0
    # 用目标亮度轻微影响结果，使边缘更自然
    ao = 0.75 + 0.25 * lum
    blended = np.clip(blended.astype(np.float32) * ao[:, :, None], 0, 255).astype(np.uint8)

    # 重新组合：在 alpha 区域内使用融合结果，外部保持原目标
    alpha_3 = alpha[:, :, None]
    result_rgb = (blended * alpha_3 + patch_rgb * (1 - alpha_3)).astype(np.uint8)

    # 透明度 = 设计图 alpha * 用户透明度 + 目标在透明区保持原样
    result_a = (alpha * opacity * 255 + (1 - alpha) * patch_rgba[:, :, 3]).astype(np.uint8)

    result = np.dstack([result_rgb, result_a])
    return Image.fromarray(result, 'RGBA')


async def _composite_mockup(request: MockupRequest) -> str:
    """合成 Mockup 图像并返回保存后的磁盘文件名"""
    target_path = await _resolve_file_id_to_path(request.canvas_id, request.target_file_id)
    design_path = await _resolve_file_id_to_path(request.canvas_id, request.design_file_id)

    if not target_path or not os.path.exists(target_path):
        raise HTTPException(status_code=400, detail=f"Target image not found: {request.target_file_id}")
    if not design_path or not os.path.exists(design_path):
        raise HTTPException(status_code=400, detail=f"Design image not found: {request.design_file_id}")

    target = Image.open(target_path).convert('RGBA')
    design = Image.open(design_path).convert('RGBA')

    target_w, target_h = target.size
    min_target = min(target_w, target_h)

    # 计算设计图目标尺寸（保持宽高比）
    design_w, design_h = design.size
    target_design_size = int(min_target * max(0.01, request.scale))
    ratio = target_design_size / max(design_w, design_h)
    new_w = max(1, int(design_w * ratio))
    new_h = max(1, int(design_h * ratio))
    design = design.resize((new_w, new_h), Image.Resampling.LANCZOS)

    # 柱面弯曲（贴合圆杯/曲面产品）
    if abs(request.curvature) > 0.06:
        design = apply_cylindrical_warp(design, request.curvature)

    # 应用圆角
    if request.corner_radius > 0:
        radius = int(min(new_w, new_h) * min(1.0, request.corner_radius))
        design = _round_corners(design, radius)

    # 旋转（扩展画布以容纳旋转后的图像）
    if request.rotate % 360 != 0:
        design = design.rotate(
            -request.rotate,  # PIL 顺时针为正，前端通常逆时针为正
            resample=Image.Resampling.BICUBIC,
            expand=True,
        )

    final_w, final_h = design.size

    # 计算左上角位置（x,y 为中心点归一化坐标）
    center_x = int(target_w * max(0.0, min(1.0, request.x)))
    center_y = int(target_h * max(0.0, min(1.0, request.y)))
    paste_x = center_x - final_w // 2
    paste_y = center_y - final_h // 2

    # 创建目标区域 patch（包含透明区用原图填充）
    target_patch = Image.new('RGBA', (final_w, final_h), (0, 0, 0, 0))
    target_crop_x = max(0, paste_x)
    target_crop_y = max(0, paste_y)
    crop_w = min(final_w, target_w - target_crop_x)
    crop_h = min(final_h, target_h - target_crop_y)
    if crop_w > 0 and crop_h > 0:
        cropped = target.crop((target_crop_x, target_crop_y,
                               target_crop_x + crop_w, target_crop_y + crop_h))
        target_patch.paste(cropped, (target_crop_x - paste_x, target_crop_y - paste_y))

    # 融合设计图与目标 patch
    fused = _fuse_design(design, target_patch, request.blend_mode, request.opacity)

    # 创建投影
    if request.shadow:
        shadow = _create_shadow(fused, request.opacity)
        shadow_x = paste_x + max(2, final_w // 25)
        shadow_y = paste_y + max(2, final_h // 25)
        target.paste(shadow, (shadow_x, shadow_y), shadow)

    # 将融合结果贴到目标图
    target.paste(fused, (paste_x, paste_y), fused)

    # 保存结果
    output_id = generate_image_id()
    output_filename = f"mockup_{output_id}.png"
    output_path = os.path.join(FILES_DIR, output_filename)
    target.save(output_path, format='PNG', optimize=True)

    return output_filename


@router.post("/mockup")
async def mockup(request: MockupRequest):
    """
    Mockup / 贴纸粘贴接口。

    将 design 图像合成到 target 图像上，支持位置、缩放、旋转、透明度、投影和圆角。
    返回生成的图像 element/file/image_url，不通过 websocket 广播。
    """
    try:
        await send_to_websocket(request.session_id, {
            'type': 'image_generation_start',
            'message': 'Processing mockup...',
            'action': 'mockup',
        })

        output_filename = await _composite_mockup(request)

        # 读取合成后的图像尺寸
        output_path = os.path.join(FILES_DIR, output_filename)
        with Image.open(output_path) as img:
            width, height = img.size
            mime_type = 'image/png'

        # 保存到 canvas（不广播，由前端直接渲染）
        result = await save_image_to_canvas(
            session_id=request.session_id,
            canvas_id=request.canvas_id,
            filename=output_filename,
            mime_type=mime_type,
            width=width,
            height=height,
            broadcast=False,
        )

        return {
            "status": "success",
            "result": result,
            "action": "mockup",
        }

    except Exception as e:
        print(f"❌ Mockup error: {e}")
        traceback.print_exc()
        try:
            await send_to_websocket(request.session_id, {
                'type': 'error',
                'error': f"Mockup failed: {str(e)}",
                'action': 'mockup',
            })
        except Exception:
            pass
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/ic_mockup")
async def ic_mockup(request: IcMockupRequest):
    """
    In-Context LoRA 风格 Mockup（Visual Identity Design 范式）。

    1. 拼接 [LEFT] 设计稿 + [RIGHT] 样机图为 in-context 条件
    2. 生成 placement hint 图作为附加条件
    3. 使用 IC-LoRA 结构化 prompt 调用图像模型
    4. 提取右侧 mockup 面板作为结果

    参考: https://github.com/ali-vilab/In-Context-LoRA
    """
    from services.ic_lora_mockup_service import (
        prepare_ic_lora_mockup_inputs,
        load_rgba,
        extract_mockup_panel,
        save_temp_image,
    )

    try:
        await send_to_websocket(request.session_id, {
            'type': 'image_generation_start',
            'message': 'Processing IC-LoRA mockup...',
            'action': 'ic_mockup',
        })

        target_path = await _resolve_file_id_to_path(request.canvas_id, request.target_file_id)
        design_path = await _resolve_file_id_to_path(request.canvas_id, request.design_file_id)
        if not target_path or not os.path.exists(target_path):
            raise HTTPException(status_code=400, detail=f"Target image not found: {request.target_file_id}")
        if not design_path or not os.path.exists(design_path):
            raise HTTPException(status_code=400, detail=f"Design image not found: {request.design_file_id}")

        target = load_rgba(target_path)
        design = load_rgba(design_path)

        composite_filename, hint_filename, prompt = prepare_ic_lora_mockup_inputs(
            target, design, request.x, request.y, request.scale, request.curvature
        )

        output_filename: Optional[str] = None
        method = "pil_fallback"

        try:
            from tools.utils.image_generation_core import IMAGE_PROVIDERS
            from tools.utils.image_utils import process_input_image

            provider_instance = IMAGE_PROVIDERS.get(request.provider)
            if not provider_instance:
                raise ValueError(f"Unknown provider: {request.provider}")

            input_paths = [composite_filename, hint_filename, request.target_file_id]
            processed_inputs: list[str] = []
            for image_path in input_paths:
                processed = await process_input_image(image_path)
                if processed:
                    processed_inputs.append(processed)

            mime_type, _w, _h, generated_name = await provider_instance.generate(
                prompt=prompt,
                model=request.model,
                aspect_ratio=request.aspect_ratio,
                input_images=processed_inputs or None,
            )

            gen_path = os.path.join(FILES_DIR, generated_name)
            if os.path.exists(gen_path):
                with Image.open(gen_path) as gen_img:
                    extracted = extract_mockup_panel(gen_img.convert("RGBA"))
                    output_filename = save_temp_image(extracted, "ic_mockup_result")
                    method = "ic_lora"
                # 清理中间生成文件，避免污染画布文件目录
                try:
                    os.remove(gen_path)
                except OSError:
                    pass
        except Exception as gen_err:
            print(f"⚠️ IC-LoRA AI generation failed, will fallback: {gen_err}")
            traceback.print_exc()

        if not output_filename and request.fallback_pil:
            pil_request = MockupRequest(
                session_id=request.session_id,
                canvas_id=request.canvas_id,
                target_file_id=request.target_file_id,
                design_file_id=request.design_file_id,
                x=request.x,
                y=request.y,
                scale=request.scale,
                curvature=request.curvature,
                blend_mode="auto",
            )
            output_filename = await _composite_mockup(pil_request)
            method = "pil_fallback"

        if not output_filename:
            raise HTTPException(status_code=500, detail="IC-LoRA mockup generation failed")

        output_path = os.path.join(FILES_DIR, output_filename)
        with Image.open(output_path) as img:
            width, height = img.size
            mime_type = 'image/png'

        result = await save_image_to_canvas(
            session_id=request.session_id,
            canvas_id=request.canvas_id,
            filename=output_filename,
            mime_type=mime_type,
            width=width,
            height=height,
            broadcast=False,
        )

        return {
            "status": "success",
            "result": result,
            "action": "ic_mockup",
            "method": method,
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ IC-LoRA Mockup error: {e}")
        traceback.print_exc()
        try:
            await send_to_websocket(request.session_id, {
                'type': 'error',
                'error': f"IC-LoRA mockup failed: {str(e)}",
                'action': 'ic_mockup',
            })
        except Exception:
            pass
        raise HTTPException(status_code=500, detail=str(e))
