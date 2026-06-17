"""Image warp utilities for mockup / IC-LoRA pipeline."""

import numpy as np
from PIL import Image


def apply_cylindrical_warp(
    design: Image.Image, curvature: float, strength: float = 0.42
) -> Image.Image:
    """柱面弯曲变形：模拟贴图贴合圆柱/曲面（如水杯侧壁）。"""
    if abs(curvature) < 0.06:
        return design

    arr = np.array(design).astype(np.float32)
    h, w = arr.shape[:2]
    if h < 2 or w < 2:
        return design

    y_coords, x_coords = np.mgrid[0:h, 0:w]
    ny = (y_coords / max(h - 1, 1) - 0.5) * 2.0
    profile = 1.0 - ny ** 2 * 0.55
    barrel = curvature * strength * profile * w * 0.14
    src_x = np.clip(x_coords - barrel, 0, w - 1).astype(np.int32)

    nx = (x_coords / max(w - 1, 1) - 0.5) * 2.0
    edge_scale = 1.0 - np.abs(nx) * abs(curvature) * 0.18 * profile[:, None]

    warped = np.zeros_like(arr)
    channels = arr.shape[2]
    for c in range(channels):
        sampled = arr[y_coords, src_x, c]
        if c < 3:
            warped[:, :, c] = sampled * edge_scale
        else:
            warped[:, :, c] = sampled

    return Image.fromarray(np.clip(warped, 0, 255).astype(np.uint8), 'RGBA')
