import os
import traceback
from typing import Optional, Any
import httpx
from .image_base_provider import ImageProviderBase
from ..utils.image_utils import get_image_info_and_save, generate_image_id
from services.config_service import FILES_DIR
from services.config_service import config_service


class AgnesImageProvider(ImageProviderBase):
    """Agnes Image 2.0 Flash provider implementation
    
    Supports:
    - Text-to-image generation
    - Image-to-image editing
    - Multi-image composition
    
    Uses OpenAI-compatible API format
    """

    def __init__(self):
        self.base_url = "https://apihub.agnes-ai.com"
        self.endpoint = "/v1/images/generations"
        self.model = "agnes-image-2.0-flash"

    async def generate(
        self,
        prompt: str,
        model: str,
        aspect_ratio: str = "1:1",
        input_images: Optional[list[str]] = None,
        **kwargs: Any
    ) -> tuple[str, int, int, str]:
        """
        Generate image using Agnes Image 2.0 Flash API

        Returns:
            tuple[str, int, int, str]: (mime_type, width, height, filename)
        """

        config = config_service.app_config.get('agnes', {})
        api_key = str(config.get("api_key", ""))

        if not api_key:
            raise ValueError("Agnes API key is not configured")

        try:
            # Map aspect ratio to size
            size_map = {
                "1:1": "1024x1024",
                "16:9": "1024x576",
                "9:16": "576x1024",
                "4:3": "1024x768",
                "3:4": "768x1024"
            }
            size = size_map.get(aspect_ratio, "1024x1024")

            # Prepare request body
            request_body: dict[str, Any] = {
                "model": self.model,
                "prompt": prompt,
                "size": size,
            }

            # Handle response format (default to URL)
            response_format = kwargs.get("response_format", "url")
            extra_body = kwargs.get("extra_body", {})
            extra_body["response_format"] = response_format
            request_body["extra_body"] = extra_body

            # Handle mask for inpainting
            mask_image = kwargs.get("mask")
            if mask_image:
                if mask_image.startswith("data:"):
                    request_body["extra_body"]["mask"] = mask_image
                elif mask_image.startswith("http://") or mask_image.startswith("https://"):
                    request_body["extra_body"]["mask"] = mask_image
                else:
                    # Local file path
                    full_path = os.path.join(FILES_DIR, mask_image)
                    if os.path.exists(full_path):
                        request_body["extra_body"]["mask"] = await self._file_to_data_uri(full_path)

            # Handle input images for image-to-image or composition
            if input_images and len(input_images) > 0:
                # For image-to-image operations, place images in extra_body
                image_urls = []
                for image_path in input_images:
                    if image_path.startswith("http://") or image_path.startswith("https://"):
                        # Already a URL
                        image_urls.append(image_path)
                    elif image_path.startswith("data:"):
                        # Data URI
                        image_urls.append(image_path)
                    else:
                        # Local file path, need to convert to URL or data URI
                        full_path = os.path.join(FILES_DIR, image_path)
                        if os.path.exists(full_path):
                            # Convert to data URI
                            data_uri = await self._file_to_data_uri(full_path)
                            image_urls.append(data_uri)

                if image_urls:
                    request_body["extra_body"]["image"] = image_urls

            # Make API call
            headers = {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            }

            async with httpx.AsyncClient(timeout=300) as client:  # 5 minute timeout for image generation
                response = await client.post(
                    f"{self.base_url}{self.endpoint}",
                    json=request_body,
                    headers=headers
                )

            if response.status_code != 200:
                error_detail = f"Status {response.status_code}: {response.text}"
                print(f"Agnes API error: {error_detail}")
                raise Exception(f"Agnes API error: {error_detail}")

            result = response.json()

            # Extract image from response
            if not result.get('data') or len(result['data']) == 0:
                raise Exception("No image data returned from Agnes API")

            image_data = result['data'][0]
            image_id = generate_image_id()

            if response_format == "b64_json" and image_data.get('b64_json'):
                # Base64 response
                image_b64 = image_data['b64_json']
                mime_type, width, height, extension = await get_image_info_and_save(
                    image_b64, os.path.join(FILES_DIR, f'{image_id}'), is_b64=True
                )
            elif response_format == "url" and image_data.get('url'):
                # URL response
                image_url = image_data['url']
                mime_type, width, height, extension = await get_image_info_and_save(
                    image_url, os.path.join(FILES_DIR, f'{image_id}')
                )
            else:
                raise Exception("Invalid response format from Agnes API")

            # Ensure mime_type is not None
            if mime_type is None:
                raise Exception('Failed to determine image MIME type')

            filename = f'{image_id}.{extension}'
            return mime_type, width, height, filename

        except Exception as e:
            print('Error generating image with Agnes:', e)
            traceback.print_exc()
            raise e

    async def _file_to_data_uri(self, file_path: str) -> str:
        """Convert local file to data URI"""
        import base64
        from PIL import Image

        try:
            # Determine MIME type
            if file_path.lower().endswith(('.png', '.jpg', '.jpeg')):
                # Get actual MIME type
                with Image.open(file_path) as img:
                    if img.format == 'PNG':
                        mime_type = 'image/png'
                    elif img.format in ('JPEG', 'JPG'):
                        mime_type = 'image/jpeg'
                    else:
                        mime_type = 'image/png'
            else:
                mime_type = 'image/png'

            with open(file_path, 'rb') as f:
                image_data = f.read()

            b64_string = base64.b64encode(image_data).decode('utf-8')
            return f"data:{mime_type};base64,{b64_string}"
        except Exception as e:
            print(f"Error converting file to data URI: {e}")
            raise
