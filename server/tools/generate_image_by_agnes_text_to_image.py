"""
Agnes Image 2.0 Flash - Text-to-Image Generation Tool

Generate high-quality images from text prompts using Agnes Image 2.0 Flash model.
Supports various aspect ratios and is optimized for fast creative production.
"""
from typing import Annotated
from pydantic import BaseModel, Field
from langchain_core.tools import tool, InjectedToolCallId
from langchain_core.runnables import RunnableConfig
from tools.utils.image_generation_core import generate_image_with_provider


class GenerateImageByAgnesTextToImageInputSchema(BaseModel):
    prompt: str = Field(
        description="Required. Detailed text prompt describing the image you want to generate. Include details about subject, scene, style, lighting, composition, and quality."
    )
    aspect_ratio: str = Field(
        description="Required. Aspect ratio of the image, only these values are allowed: 1:1, 16:9, 4:3, 3:4, 9:16. Choose the best fitting aspect ratio according to the prompt.",
        default="1:1"
    )
    tool_call_id: Annotated[str, InjectedToolCallId]


@tool("generate_image_by_agnes_text_to_image",
      description="Generate an image from text prompt using Agnes Image 2.0 Flash model. This high-performance model is suitable for fast creative production, marketing visuals, and professional content creation. Supports text-to-image generation with various aspect ratios.",
      args_schema=GenerateImageByAgnesTextToImageInputSchema)
async def generate_image_by_agnes_text_to_image(
    prompt: str,
    aspect_ratio: str = "1:1",
    config: RunnableConfig = None,
    tool_call_id: Annotated[str, InjectedToolCallId] = None,
) -> str:
    """
    Generate an image using Agnes Image 2.0 Flash model via text-to-image
    """
    ctx = config.get('configurable', {}) if config else {}
    canvas_id = ctx.get('canvas_id', '')
    session_id = ctx.get('session_id', '')

    return await generate_image_with_provider(
        canvas_id=canvas_id,
        session_id=session_id,
        provider='agnes',
        model="agnes-image-2.0-flash",
        prompt=prompt,
        aspect_ratio=aspect_ratio,
        input_images=None,
    )


# Export the tool for easy import
__all__ = ["generate_image_by_agnes_text_to_image"]
