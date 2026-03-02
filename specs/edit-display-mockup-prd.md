# Edit Display & Mockup Feature PRD

## Overview
Fix edited/generated images not appearing on the canvas after using **Edit Element**, **Edit Text**, and similar direct-edit actions. Add a **Mockup** feature inspired by Lovart that lets users paste a design (e.g., a logo) onto a target image like a sticker and see the result on the canvas.

## Requirements

### US-001: Direct-edit results are returned to frontend
- Backend `direct_edit` and `inpaint` endpoints must return the generated image's element, file metadata, and image URL.
- Avoid duplicate websocket broadcasts for direct-edit paths.

### US-002: Frontend renders direct-edit/inpaint results on canvas
- `CanvasEditHandler` and `InpaintDialog` emit a `Canvas::ImageAdded` event on success.
- `CanvasExcali` listens to the event and adds the image element + file to Excalidraw.

### US-003: Backend Mockup compositing endpoint
- New `/api/mockup` endpoint accepts a target image fileId, a design image fileId, and transform parameters (x, y, scale, rotate, opacity, shadow, corner radius).
- Server composites the design onto the target with PIL and saves the result to the canvas.

### US-004: Frontend Mockup dialog
- Add a `MockupDialog` component where the user can pick the design image, preview the placement, and adjust position/scale/rotation/opacity/shadow.
- Add a **Mockup** button to `PopbarActions`.

### US-005: i18n and polish
- Add Chinese/English translations for Mockup and edit-display messages.
- Ensure the generated image is selected/focused after it appears on the canvas.
