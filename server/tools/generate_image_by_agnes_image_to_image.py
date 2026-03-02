"""
Agnes Image 2.0 Flash - Image-to-Image and Image Editing Tool

Edit, transform, or enhance existing images using Agnes Image 2.0 Flash model.
Supports image editing, style transfer, background changes, object replacement, and multi-image composition.
"""
from typing import Annotated, Optional
from pydantic import BaseModel, Field
from langchain_core.tools import tool, InjectedToolCallId
from langchain_core.runnables import RunnableConfig
from tools.utils.image_generation_core import generate_image_with_provider


class GenerateImageByAgnesImageToImageInputSchema(BaseModel):
    prompt: str = Field(
        description="Required. Detailed editing instruction describing what changes you want to make to the image. Clearly specify what should be changed and what should remain unchanged."
    )
    input_images: list[str] = Field(
        description="Required. List of input image file IDs or URLs to edit or reference. Can be one image for editing or multiple images for composition."
    )
    aspect_ratio: str = Field(
        description="Required. Aspect ratio of the output image, only these values are allowed: 1:1, 16:9, 4:3, 3:4, 9:16. If not specified, will match input image aspect ratio.",
        default="1:1"
    )
    tool_call_id: Annotated[str, InjectedToolCallId]


@tool("generate_image_by_agnes_image_to_image",
      description="Edit, transform, or enhance existing images using Agnes Image 2.0 Flash model. Supports image editing (object replacement, background changes, style transfer), and multi-image composition. For editing tasks, describe what should be changed in the prompt.",
      args_schema=GenerateImageByAgnesImageToImageInputSchema)
async def generate_image_by_agnes_image_to_image(
    prompt: str,
    input_images: list[str],
    aspect_ratio: str = "1:1",
    config: RunnableConfig = None,
    tool_call_id: Annotated[str, InjectedToolCallId] = None,
) -> str:
    """
    Edit or transform images using Agnes Image 2.0 Flash model
    
    Supports:
    - Image editing: Change composition, style, objects, backgrounds, scenes
    - Style transfer: Apply different artistic styles
    - Multi-image composition: Combine multiple reference images into new scene
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
        input_images=input_images,
    )


# Export the tool for easy import
__all__ = ["generate_image_by_agnes_image_to_image"]
