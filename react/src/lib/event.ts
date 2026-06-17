import * as ISocket from '@/types/socket'
import mitt from 'mitt'

export type TCanvasAddImagesToChatEvent = {
  fileId: string
  base64?: string
  width: number
  height: number
  elementId?: string
  order?: number
}[]

export type TCanvasMagicGenerateEvent = {
  fileId: string
  base64: string
  width: number
  height: number
  timestamp: string
}

export type TCanvasImageAddedEvent = {
  canvas_id: string
  session_id: string
  element: ISocket.SessionImageGeneratedEvent['element']
  file: ISocket.SessionImageGeneratedEvent['file']
  image_url: string
}

export type TCanvasTaskStatus = 'running' | 'success' | 'error'

export type TCanvasTaskEvent = {
  id: string
  type: 'edit' | 'inpaint' | 'mockup' | 'compose'
  action?: string
  status: TCanvasTaskStatus
  message: string
}

export type TMaterialAddImagesToChatEvent = {
  filePath: string
  fileName: string
  fileType: string
  width?: number
  height?: number
}[]

export type TEvents = {
  // ********** Socket events - Start **********
  'Socket::Session::Error': ISocket.SessionErrorEvent
  'Socket::Session::Done': ISocket.SessionDoneEvent
  'Socket::Session::Info': ISocket.SessionInfoEvent
  'Socket::Session::ImageGenerated': ISocket.SessionImageGeneratedEvent
  'Socket::Session::VideoGenerated': ISocket.SessionVideoGeneratedEvent
  'Socket::Session::Delta': ISocket.SessionDeltaEvent
  'Socket::Session::ToolCall': ISocket.SessionToolCallEvent
  'Socket::Session::ToolCallArguments': ISocket.SessionToolCallArgumentsEvent
  'Socket::Session::ToolCallResult': ISocket.SessionToolCallResultEvent
  'Socket::Session::AllMessages': ISocket.SessionAllMessagesEvent
  'Socket::Session::ToolCallProgress': ISocket.SessionToolCallProgressEvent
  'Socket::Session::ToolCallPendingConfirmation': ISocket.SessionToolCallPendingConfirmationEvent
  'Socket::Session::ToolCallConfirmed': ISocket.SessionToolCallConfirmedEvent
  'Socket::Session::ToolCallCancelled': ISocket.SessionToolCallCancelledEvent
  // ********** Socket events - End **********

  // ********** Canvas events - Start **********
  'Canvas::AddImagesToChat': TCanvasAddImagesToChatEvent
  'Canvas::MagicGenerate': TCanvasMagicGenerateEvent
  'Canvas::Upscale': TCanvasAddImagesToChatEvent
  'Canvas::RemoveBg': TCanvasAddImagesToChatEvent
  'Canvas::EditElement': TCanvasAddImagesToChatEvent
  'Canvas::EditText': TCanvasAddImagesToChatEvent
  'Canvas::Expand': TCanvasAddImagesToChatEvent
  'Canvas::Redraw': TCanvasAddImagesToChatEvent
  'Canvas::Download': TCanvasAddImagesToChatEvent
  'Canvas::ImageAdded': TCanvasImageAddedEvent
  'Canvas::TaskStarted': TCanvasTaskEvent
  'Canvas::TaskUpdated': TCanvasTaskEvent
  'Canvas::TaskDone': TCanvasTaskEvent
  // ********** Canvas events - End **********

  // ********** Material events - Start **********
  'Material::AddImagesToChat': TMaterialAddImagesToChatEvent
  // ********** Material events - End **********
}

export const eventBus = mitt<TEvents>()
