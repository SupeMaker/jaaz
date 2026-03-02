# Agnes Image 2.0 Flash Integration Guide

## Overview

Agnes Image 2.0 Flash is a high-performance image generation and editing model integrated into JAAZ. It supports:

- **Text-to-Image**: Generate images from text prompts
- **Image-to-Image**: Edit, transform, or enhance existing images
- **Multi-Image Composition**: Combine multiple reference images into a new image

**Current Pricing**: FREE ($0 per image)

## Setup Instructions

### 1. Get API Key

1. Visit [Agnes AI Platform](https://platform.agnes-ai.com/)
2. Sign up for an account
3. Generate your API key from the settings

### 2. Configure JAAZ

Add your Agnes API key to the configuration file:

**File**: `server/user_data/config.toml`

```toml
[agnes]
api_key = "YOUR_AGNES_API_KEY_HERE"
```

If the `config.toml` file doesn't exist, it will be created automatically when the server starts.

### 3. Restart the Server

After adding the configuration, restart the JAAZ server. The Agnes tools will automatically register once the API key is detected.

## Available Tools

Once configured, two tools will be available:

### 1. Agnes Image 2.0 Flash (Text-to-Image)
- **Tool ID**: `generate_image_by_agnes_text_to_image`
- **Purpose**: Generate images from text descriptions
- **Inputs**:
  - `prompt` (required): Detailed description of the image
  - `aspect_ratio` (optional): 1:1, 16:9, 4:3, 3:4, 9:16 (default: 1:1)

**Example Prompt**:
```
A professional product photo of a wireless headphone on a clean white background, 
soft studio lighting, sharp details, commercial photography style
```

### 2. Agnes Image 2.0 Flash (Image-to-Image)
- **Tool ID**: `generate_image_by_agnes_image_to_image`
- **Purpose**: Edit, transform, or enhance existing images
- **Inputs**:
  - `prompt` (required): Description of changes or transformation
  - `input_images` (required): List of image file IDs to edit
  - `aspect_ratio` (optional): Output image dimensions (default: 1:1)

**Example Prompt for Editing**:
```
Change the background to a futuristic city at night while keeping the person's 
face, outfit, and pose unchanged
```

**Example Prompt for Composition**:
```
Place the person from the first image beside the robot from the second image 
in a cinematic sci-fi battle scene
```

## Best Practices

### Text-to-Image Prompting
Provide clear visual instructions including:
- Subject and main elements
- Scene and background
- Style (e.g., photorealistic, oil painting, 3D render)
- Lighting and mood
- Composition details
- Quality requirements

### Image Editing Prompting
Clearly describe:
- What should be changed
- What should remain unchanged
- New style or scene if applicable
- Preserve specific elements in the image

### Multi-Image Composition
When combining multiple images:
- Describe the relationship between images
- Specify spatial arrangement
- Mention desired style and mood
- Detail lighting requirements

## Troubleshooting

### Agnes tools not appearing
1. Verify API key is correctly set in `config.toml`
2. Check that the file is in the correct location: `server/user_data/config.toml`
3. Restart the server
4. Check server logs for configuration errors

### API errors
1. Verify your API key is valid and not expired
2. Check that you have API credits available
3. Ensure your network allows HTTPS connections to `apihub.agnes-ai.com`
4. Review error messages in server logs

### Image generation timeout
- Image generation may take 30-360 seconds depending on complexity
- If requests timeout, try reducing prompt complexity or using simpler prompts
- Consider reducing image resolution (use 4:3 instead of 1:1 if appropriate)

## API Documentation

For complete API documentation, visit:
- [Agnes Image 2.0 Flash Documentation](https://agnes-ai.com/doc/agnes-image-20-flash)
- [Agnes Developer Docs](https://agnes-ai.com/doc/overview)

## Technical Details

### Implementation Files
- Provider: `server/tools/image_providers/agnes_provider.py`
- Text-to-Image Tool: `server/tools/generate_image_by_agnes_text_to_image.py`
- Image-to-Image Tool: `server/tools/generate_image_by_agnes_image_to_image.py`

### Configuration
- Service: `server/services/config_service.py`
- Tool Registry: `server/services/tool_service.py`
- Image Processing: `server/tools/utils/image_generation_core.py`

### API Endpoint
- Base URL: `https://apihub.agnes-ai.com`
- Endpoint: `/v1/images/generations`
- Model: `agnes-image-2.0-flash`

### Supported Aspect Ratios
- 1:1 (1024×1024)
- 16:9 (1024×576)
- 9:16 (576×1024)
- 4:3 (1024×768)
- 3:4 (768×1024)

## Features and Capabilities

✅ Text-to-image generation  
✅ Image-to-image editing  
✅ Multi-image composition  
✅ Prompt-based image transformation  
✅ Public URL and Data URI Base64 image input  
✅ URL and Base64 output formats  
✅ Fast generation optimized for production  
✅ OpenAI-compatible API structure  

## License & Terms

- Current Pricing: Free
- For terms and policies, visit: [Agnes Terms of Service](https://agnes-ai.com/doc/terms-of-service)
