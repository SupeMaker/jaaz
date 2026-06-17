"""
In-Context LoRA style Mockup service.

Reference: https://ali-vilab.github.io/In-Context-LoRA-Page/
Visual Identity Design: concatenate design (LEFT) + product (RIGHT),
structured prompt with [LEFT]/[RIGHT] markers.
"""

from __future__ import annotations

import os
from typing import Optional, Tuple

from PIL import Image, ImageDraw

from services.config_service import FILES_DIR
from tools.utils.image_utils import generate_image_id
from utils.image_warp import apply_cylindrical_warp

IC_LORA_WIDTH = 1472
IC_LORA_HEIGHT = 1024
PANEL_BG = (245, 247, 250, 255)


def _fit_contain(img: Image.Image, max_w: int, max_h: int) -> Image.Image:
    w, h = img.size
    if w == 0 or h == 0:
        return img
    ratio = min(max_w / w, max_h / h)
    return img.resize((max(1, int(w * ratio)), max(1, int(h * ratio))), Image.Resampling.LANCZOS)


def _center_paste(
    canvas: Image.Image, img: Image.Image, panel_w: int, panel_h: int, offset_x: int = 0
) -> None:
    x = offset_x + (panel_w - img.width) // 2
    y = (panel_h - img.height) // 2
    if img.mode == "RGBA":
        canvas.paste(img, (x, y), img)
    else:
        canvas.paste(img, (x, y))


def build_ic_lora_composite(
    design: Image.Image,
    target: Image.Image,
    canvas_w: int = IC_LORA_WIDTH,
    canvas_h: int = IC_LORA_HEIGHT,
) -> Image.Image:
    """IC-LoRA 双 panel 拼接：左=设计稿，右=样机产品图。"""
    panel_w = canvas_w // 2
    design_rgba = design.convert("RGBA")
    target_rgba = target.convert("RGBA")

    left = Image.new("RGBA", (panel_w, canvas_h), PANEL_BG)
    right = Image.new("RGBA", (panel_w, canvas_h), PANEL_BG)

    design_fit = _fit_contain(design_rgba, int(panel_w * 0.82), int(canvas_h * 0.82))
    target_fit = _fit_contain(target_rgba, panel_w, canvas_h)

    _center_paste(left, design_fit, panel_w, canvas_h)
    _center_paste(right, target_fit, panel_w, canvas_h)

    composite = Image.new("RGBA", (canvas_w, canvas_h), PANEL_BG)
    composite.paste(left, (0, 0))
    composite.paste(right, (panel_w, 0))

    draw = ImageDraw.Draw(composite)
    draw.line([(panel_w, 0), (panel_w, canvas_h)], fill=(200, 205, 212, 255), width=2)
    return composite


def build_placement_hint(
    target: Image.Image,
    design: Image.Image,
    x: float,
    y: float,
    scale: float,
    curvature: float = 0.0,
) -> Image.Image:
    """样机上的粗略贴图位置提示（IC-LoRA SDEdit 风格条件）。"""
    base = target.convert("RGBA").copy()
    tw, th = base.size
    min_side = min(tw, th)
    design_rgba = design.convert("RGBA")

    target_px = int(min_side * max(0.02, min(scale, 1.0)))
    ratio = target_px / max(design_rgba.width, design_rgba.height)
    sticker = design_rgba.resize(
        (max(1, int(design_rgba.width * ratio)), max(1, int(design_rgba.height * ratio))),
        Image.Resampling.LANCZOS,
    )

    if abs(curvature) > 0.06:
        sticker = apply_cylindrical_warp(sticker, curvature)

    cx = int(tw * max(0.0, min(1.0, x)))
    cy = int(th * max(0.0, min(1.0, y)))
    alpha = sticker.split()[-1].point(lambda p: int(p * 0.55))
    sticker.putalpha(alpha)
    base.paste(sticker, (cx - sticker.width // 2, cy - sticker.height // 2), sticker)
    return base


def build_ic_lora_mockup_prompt(
    x: float,
    y: float,
    curvature: float = 0.0,
    product_hint: str = "product",
    design_hint: str = "design",
) -> str:
    """IC-LoRA Visual Identity Design 风格 prompt。"""
    x_pct = round(x * 100)
    y_pct = round(y * 100)
    curve_note = ""
    if abs(curvature) > 0.1:
        direction = "left side" if curvature < 0 else "right side"
        curve_note = (
            f" The product surface curves toward the {direction}; "
            f"warp the {design_hint} to follow cylindrical/spherical contour naturally."
        )

    return (
        "[VISUAL-IDENTITY-MOCKUP] The two-panel image showcases applying a brand design onto a real "
        f"{product_hint}. "
        f"[LEFT] shows the isolated {design_hint} (logo/sticker/label) on a clean flat background. "
        f"[RIGHT] shows the {product_hint} photo where the same {design_hint} should be applied "
        f"at approximately {x_pct}% from left and {y_pct}% from top. "
        f"Generate a photorealistic mockup: the {design_hint} must conform to the product surface — "
        "matching perspective, curvature, material texture, lighting, shadows, and viewing distance. "
        "The result should look physically printed, embroidered, labeled, or UV-applied on the object, "
        f"not flat-pasted.{curve_note} "
        "Preserve product realism and high fidelity."
    )


def extract_mockup_panel(generated: Image.Image) -> Image.Image:
    """从双 panel 输出提取右侧 mockup；单图则原样返回。"""
    w, h = generated.size
    if w >= h * 1.35:
        return generated.crop((w // 2, 0, w, h))
    return generated


def save_temp_image(image: Image.Image, prefix: str) -> str:
    output_id = generate_image_id()
    filename = f"{prefix}_{output_id}.png"
    path = os.path.join(FILES_DIR, filename)
    image.convert("RGBA").save(path, format="PNG", optimize=True)
    return filename


def load_rgba(path: str) -> Image.Image:
    return Image.open(path).convert("RGBA")


def prepare_ic_lora_mockup_inputs(
    target: Image.Image,
    design: Image.Image,
    x: float,
    y: float,
    scale: float,
    curvature: float,
) -> Tuple[str, str, str]:
    """Returns (composite_filename, hint_filename, prompt)."""
    composite = build_ic_lora_composite(design, target)
    composite_filename = save_temp_image(composite, "ic_lora_composite")

    hint = build_placement_hint(target, design, x, y, scale, curvature)
    hint_filename = save_temp_image(hint, "ic_lora_hint")

    prompt = build_ic_lora_mockup_prompt(x, y, curvature)
    return composite_filename, hint_filename, prompt
