"""
Image generation core module
Contains the main orchestration logic for image generation across different providers
"""

from typing import Optional, Dict, Any
from common import DEFAULT_PORT
from tools.utils.image_utils import process_input_image
from ..image_providers.image_base_provider import ImageProviderBase

# 导入所有提供商以确保自动注册 (不要删除这些导入)
from ..image_providers.jaaz_provider import JaazImageProvider
from ..image_providers.openai_provider import OpenAIImageProvider
from ..image_providers.replicate_provider import ReplicateImageProvider
from ..image_providers.volces_provider import VolcesProvider
from ..image_providers.wavespeed_provider import WavespeedProvider
from ..image_providers.agnes_provider import AgnesImageProvider

# from ..image_providers.comfyui_provider import ComfyUIProvider
from .image_canvas_utils import (
    save_image_to_canvas,
)
import time

IMAGE_PROVIDERS: dict[str, ImageProviderBase] = {
    "jaaz": JaazImageProvider(),
    "openai": OpenAIImageProvider(),
    "replicate": ReplicateImageProvider(),
    "volces": VolcesProvider(),
    "wavespeed": WavespeedProvider(),
    "agnes": AgnesImageProvider(),
}


async def _generate_and_save_image(
    canvas_id: str,
    session_id: str,
    provider: str,
    model: str,
    prompt: str,
    aspect_ratio: str = "1:1",
    input_images: Optional[list[str]] = None,
    mask: Optional[str] = None,
    broadcast: bool = True,
) -> Dict[str, Any]:
    """
    内部通用图像生成与保存函数。

    Args:
        broadcast: 是否通过 websocket 广播 image_generated 事件。
                   直接编辑接口通常设为 False，由前端根据返回数据渲染。

    Returns:
        Dict[str, Any]: 包含 element, file, image_url 的字典。
    """
    provider_instance = IMAGE_PROVIDERS.get(provider)
    if not provider_instance:
        raise ValueError(f"Unknown provider: {provider}")

    # Process input images for the provider
    processed_input_images: list[str] | None = None
    if input_images:
        processed_input_images = []
        for image_path in input_images:
            processed_image = await process_input_image(image_path)
            if processed_image:
                processed_input_images.append(processed_image)

        print(f"Using {len(processed_input_images)} input images for generation")

    # Process mask image if provided
    processed_mask: Optional[str] = None
    if mask:
        processed_mask = await process_input_image(mask)
        if processed_mask:
            print(f"Using mask for inpainting: {processed_mask[:80]}...")

    # Prepare metadata with all generation parameters
    metadata: Dict[str, Any] = {
        "prompt": prompt,
        "model": model,
        "provider": provider,
        "aspect_ratio": aspect_ratio,
        "input_images": input_images or [],
        "mask": mask or None,
    }

    # Build provider kwargs
    provider_kwargs: Dict[str, Any] = {"metadata": metadata}
    if processed_mask:
        provider_kwargs["mask"] = processed_mask

    # Generate image using the selected provider
    mime_type, width, height, filename = await provider_instance.generate(
        prompt=prompt,
        model=model,
        aspect_ratio=aspect_ratio,
        input_images=processed_input_images,
        **provider_kwargs,
    )

    # Save image to canvas (optionally broadcast)
    result = await save_image_to_canvas(
        session_id, canvas_id, filename, mime_type, width, height, broadcast=broadcast
    )

    return result


async def generate_image_with_provider(
    canvas_id: str,
    session_id: str,
    provider: str,
    model: str,
    # image generator args
    prompt: str,
    aspect_ratio: str = "1:1",
    input_images: Optional[list[str]] = None,
    mask: Optional[str] = None,
) -> str:
    """
    通用图像生成函数，支持不同的模型和提供商。
    保持原有字符串返回类型以兼容现有工具调用链。

    Returns:
        str: 生成结果消息
    """
    result = await _generate_and_save_image(
        canvas_id=canvas_id,
        session_id=session_id,
        provider=provider,
        model=model,
        prompt=prompt,
        aspect_ratio=aspect_ratio,
        input_images=input_images,
        mask=mask,
        broadcast=True,
    )

    image_url = result.get("image_url", "")
    filename = image_url.split("/")[-1] if image_url else "unknown"
    return f"image generated successfully ![image_id: {filename}](http://localhost:{DEFAULT_PORT}{image_url})"


async def generate_image_with_provider_ex(
    canvas_id: str,
    session_id: str,
    provider: str,
    model: str,
    prompt: str,
    aspect_ratio: str = "1:1",
    input_images: Optional[list[str]] = None,
    mask: Optional[str] = None,
    broadcast: bool = False,
) -> Dict[str, Any]:
    """
    扩展版图像生成函数，返回完整的 element/file/image_url 数据。
    供直接编辑接口使用，避免重复 websocket 广播。
    """
    return await _generate_and_save_image(
        canvas_id=canvas_id,
        session_id=session_id,
        provider=provider,
        model=model,
        prompt=prompt,
        aspect_ratio=aspect_ratio,
        input_images=input_images,
        mask=mask,
        broadcast=broadcast,
    )
