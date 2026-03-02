import { cancelChat } from '@/api/chat'
import { cancelMagicGenerate } from '@/api/magic'
import { uploadImage } from '@/api/upload'
import { Button } from '@/components/ui/button'
import { useConfigs } from '@/contexts/configs'
import {
  eventBus,
  TCanvasAddImagesToChatEvent,
  TMaterialAddImagesToChatEvent,
} from '@/lib/event'
import { cn, dataURLToFile } from '@/lib/utils'
import { Message, MessageContent, Model } from '@/types/types'
import { ModelInfo, ToolInfo } from '@/api/model'
import { useMutation } from '@tanstack/react-query'
import { useDrop } from 'ahooks'
import { produce } from 'immer'
import {
  ArrowUp,
  Loader2,
  PlusIcon,
  Square,
  XIcon,
  RectangleVertical,
  ChevronDown,
  Hash,
} from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import Textarea, { TextAreaRef } from 'rc-textarea'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import ModelSelectorV2 from './ModelSelectorV2'
import ModelSelectorV3 from './ModelSelectorV3'
import OutputModeSelector, { OutputMode } from './OutputModeSelector'
import { useAuth } from '@/contexts/AuthContext'
import { useBalance } from '@/hooks/use-balance'
import { BASE_API_URL } from '@/constants'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

type ChatTextareaProps = {
  pending: boolean
  className?: string
  messages: Message[]
  sessionId?: string
  onSendMessages: (
    data: Message[],
    configs: {
      textModel: Model
      toolList: ToolInfo[]
    }
  ) => void
  onCancelChat?: () => void
}

const ChatTextarea: React.FC<ChatTextareaProps> = ({
  pending,
  className,
  messages,
  sessionId,
  onSendMessages,
  onCancelChat,
}) => {
  const { t } = useTranslation()
  const { authStatus } = useAuth()
  const { textModel, selectedTools, setShowLoginDialog } = useConfigs()
  const { balance } = useBalance()
  const [prompt, setPrompt] = useState('')
  const textareaRef = useRef<TextAreaRef>(null)
  const [images, setImages] = useState<
    {
      file_id: string
      width: number
      height: number
    }[]
  >([])
  const [isFocused, setIsFocused] = useState(false)
  const [selectedAspectRatio, setSelectedAspectRatio] = useState<string>('auto')
  const [customWidth, setCustomWidth] = useState<string>('')
  const [customHeight, setCustomHeight] = useState<string>('')
  const [quantity, setQuantity] = useState<number>(1)
  const [showQuantitySlider, setShowQuantitySlider] = useState(false)
  const quantitySliderRef = useRef<HTMLDivElement>(null)
  const MAX_QUANTITY = 40
  const [outputMode, setOutputMode] = useState<OutputMode>('image')

  const imageInputRef = useRef<HTMLInputElement>(null)

  // 充值按钮组件
  const RechargeContent = useCallback(() => (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-muted-foreground flex-1">
        {t('chat:insufficientBalanceDescription')}
      </span>
      <Button
        size="sm"
        variant="outline"
        className="shrink-0"
        onClick={() => {
          const billingUrl = `${BASE_API_URL}/billing`
          if (window.electronAPI?.openBrowserUrl) {
            window.electronAPI.openBrowserUrl(billingUrl)
          } else {
            window.open(billingUrl, '_blank')
          }
        }}
      >
        {t('common:auth.recharge')}
      </Button>
    </div>
  ), [t])

  const { mutate: uploadImageMutation } = useMutation({
    mutationFn: (file: File) => uploadImage(file),
    onSuccess: (data) => {
      console.log('🦄uploadImageMutation onSuccess', data)
      setImages((prev) => [
        ...prev,
        {
          file_id: data.file_id,
          width: data.width,
          height: data.height,
        },
      ])
    },
    onError: (error) => {
      console.error('🦄uploadImageMutation onError', error)
      toast.error('Failed to upload image', {
        description: <div>{error.toString()}</div>,
      })
    },
  })

  const handleImagesUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files
      if (files) {
        for (const file of files) {
          uploadImageMutation(file)
        }
      }
    },
    [uploadImageMutation]
  )

  const handleCancelChat = useCallback(async () => {
    if (sessionId) {
      // 同时取消普通聊天和魔法生成任务
      await Promise.all([cancelChat(sessionId), cancelMagicGenerate(sessionId)])
    }
    onCancelChat?.()
  }, [sessionId, onCancelChat])

  // Send Prompt
  const handleSendPrompt = useCallback(async () => {
    if (pending) return

    // 检查是否使用 Jaaz 服务
    const isUsingJaaz =
      textModel?.provider === 'jaaz' ||
      selectedTools?.some((tool) => tool.provider === 'jaaz')
    // console.log('👀isUsingJaaz', textModel, selectedTools, isUsingJaaz)

    // 只有当使用 Jaaz 服务且余额为 0 时才提醒充值
    if (authStatus.is_logged_in && isUsingJaaz && parseFloat(balance) <= 0) {
      toast.error(t('chat:insufficientBalance'), {
        description: <RechargeContent />,
        duration: 10000, // 10s，给用户更多时间操作
      })
      return
    }

    if (!textModel) {
      toast.error(t('chat:textarea.selectModel'))
      if (!authStatus.is_logged_in) {
        setShowLoginDialog(true)
      }
      return
    }

    if (!selectedTools || selectedTools.length === 0) {
      toast.warning(t('chat:textarea.selectTool'))
    }

    let text_content: MessageContent[] | string = prompt
    if (prompt.length === 0 || prompt.trim() === '') {
      toast.error(t('chat:textarea.enterPrompt'))
      return
    }

    // Add aspect ratio and quantity information if not default values
    let additionalInfo = ''
    if (selectedAspectRatio !== 'auto') {
      additionalInfo += `<aspect_ratio>${selectedAspectRatio}</aspect_ratio>\n`
    }
    if (quantity !== 1) {
      additionalInfo += `<quantity>${quantity}</quantity>\n`
    }

    if (additionalInfo) {
      text_content = text_content + '\n\n' + additionalInfo
    }

    if (images.length > 0) {
      text_content += `\n\n<input_images count="${images.length}">`
      images.forEach((image, index) => {
        text_content += `\n<image index="${index + 1}" file_id="${image.file_id}" width="${image.width}" height="${image.height}" />`
      })
      text_content += `\n</input_images>`
    }

    // Fetch images as base64
    const imagePromises = images.map(async (image) => {
      const response = await fetch(`/api/file/${image.file_id}`)
      const blob = await response.blob()
      return new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result as string)
        reader.readAsDataURL(blob)
      })
    })

    const base64Images = await Promise.all(imagePromises)

    const final_content = [
      {
        type: 'text',
        text: text_content as string,
      },
      ...images.map((image, index) => ({
        type: 'image_url',
        image_url: {
          url: base64Images[index],
        },
      })),
    ] as MessageContent[]

    const newMessage = messages.concat([
      {
        role: 'user',
        content: final_content,
      },
    ])

    setImages([])
    setPrompt('')

    onSendMessages(newMessage, {
      textModel: textModel,
      toolList: selectedTools && selectedTools.length > 0 ? selectedTools : [],
    })
  }, [
    pending,
    textModel,
    selectedTools,
    prompt,
    onSendMessages,
    images,
    messages,
    t,
    selectedAspectRatio,
    quantity,
    authStatus.is_logged_in,
    setShowLoginDialog,
    balance,
    RechargeContent,
  ])

  // Drop Area
  const dropAreaRef = useRef<HTMLDivElement>(null)
  const [isDragOver, setIsDragOver] = useState(false)

  const handleFilesDrop = useCallback(
    (files: File[]) => {
      for (const file of files) {
        uploadImageMutation(file)
      }
    },
    [uploadImageMutation]
  )

  useDrop(dropAreaRef, {
    onDragOver() {
      setIsDragOver(true)
    },
    onDragLeave() {
      setIsDragOver(false)
    },
    onDrop() {
      setIsDragOver(false)
    },
    onFiles: handleFilesDrop,
  })

  useEffect(() => {
    const handleAddImagesToChat = (data: TCanvasAddImagesToChatEvent) => {
      data.forEach(async (image) => {
        if (image.base64) {
          const file = dataURLToFile(image.base64, image.fileId)
          uploadImageMutation(file)
        } else {
          setImages(
            produce((prev) => {
              prev.push({
                file_id: image.fileId,
                width: image.width,
                height: image.height,
              })
            })
          )
        }
      })

      textareaRef.current?.focus()
    }

    const handleMaterialAddImagesToChat = async (
      data: TMaterialAddImagesToChatEvent
    ) => {
      data.forEach(async (image: TMaterialAddImagesToChatEvent[0]) => {
        // Convert file path to blob and upload
        try {
          const fileUrl = `/api/serve_file?file_path=${encodeURIComponent(image.filePath)}`
          const response = await fetch(fileUrl)
          const blob = await response.blob()
          const file = new File([blob], image.fileName, {
            type: `image/${image.fileType}`,
          })
          uploadImageMutation(file)
        } catch (error) {
          console.error('Failed to load image from material:', error)
          toast.error('Failed to load image from material', {
            description: `${error}`,
          })
        }
      })

      textareaRef.current?.focus()
    }

    eventBus.on('Canvas::AddImagesToChat', handleAddImagesToChat)
    eventBus.on('Material::AddImagesToChat', handleMaterialAddImagesToChat)
    return () => {
      eventBus.off('Canvas::AddImagesToChat', handleAddImagesToChat)
      eventBus.off('Material::AddImagesToChat', handleMaterialAddImagesToChat)
    }
  }, [uploadImageMutation])

  // Close quantity slider when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        quantitySliderRef.current &&
        !quantitySliderRef.current.contains(event.target as Node)
      ) {
        setShowQuantitySlider(false)
      }
    }

    if (showQuantitySlider) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showQuantitySlider])

  return (
    <motion.div
      ref={dropAreaRef}
      className={cn(
        'w-full flex flex-col items-center border border-border/60 rounded-2xl p-3 hover:border-border transition-all duration-300 cursor-text gap-4 bg-background/80 backdrop-blur-xl relative',
        isFocused && 'border-primary/30 shadow-sm shadow-primary/5',
        className
      )}
      style={{
        boxShadow: isFocused
          ? '0 0 0 3px color-mix(in oklab, var(--primary) 8%, transparent), 0 1px 3px color-mix(in oklab, var(--primary) 5%, transparent)'
          : '0 1px 2px rgba(0,0,0,0.04)',
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, ease: 'linear' }}
      onClick={() => textareaRef.current?.focus()}
    >
      <AnimatePresence>
        {isDragOver && (
          <motion.div
            className="absolute top-0 left-0 right-0 bottom-0 bg-background/50 backdrop-blur-xl rounded-2xl z-10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
          >
            <div className="flex items-center justify-center h-full">
              <p className="text-sm text-muted-foreground">
                Drop images here to upload
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {images.length > 0 && (
          <motion.div
            className="flex items-center gap-2 w-full"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
          >
            {images.map((image) => (
              <motion.div
                key={image.file_id}
                className="relative size-10"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2, ease: 'easeInOut' }}
              >
                <img
                  key={image.file_id}
                  src={`/api/file/${image.file_id}`}
                  alt="Uploaded image"
                  className="w-full h-full object-cover rounded-md"
                  draggable={false}
                />
                <Button
                  variant="secondary"
                  size="icon"
                  className="absolute -top-1 -right-1 size-4"
                  onClick={() =>
                    setImages((prev) =>
                      prev.filter((i) => i.file_id !== image.file_id)
                    )
                  }
                >
                  <XIcon className="size-3" />
                </Button>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <Textarea
        ref={textareaRef}
        className="w-full h-full border-none outline-none resize-none"
        placeholder={t('chat:textarea.placeholder')}
        value={prompt}
        autoSize
        onChange={(e) => setPrompt(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSendPrompt()
          }
        }}
      />

      <div className="flex items-center justify-between gap-2 w-full">
        <div className="flex items-center gap-1.5 max-w-[calc(100%-50px)] flex-wrap">
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleImagesUpload}
            hidden
          />
          <button
            onClick={() => imageInputRef.current?.click()}
            className="inline-flex items-center justify-center size-8 rounded-lg text-muted-foreground border border-border/50 bg-background/50 hover:bg-muted/60 hover:text-foreground hover:border-border transition-all duration-200 cursor-pointer active:scale-95"
          >
            <PlusIcon className="size-4" />
          </button>

          <div className="w-px h-5 bg-border/50 mx-0.5" />

          <ModelSelectorV3 />

          <OutputModeSelector selected={outputMode} onSelect={setOutputMode} />

          {/* Aspect Ratio Selector */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="group inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-medium text-muted-foreground border border-border/50 bg-background/50 hover:bg-muted/60 hover:text-foreground hover:border-border transition-all duration-200 cursor-pointer active:scale-95">
                <RectangleVertical className="size-3.5" />
                <span>{selectedAspectRatio}</span>
                <ChevronDown className="size-3 opacity-40 group-hover:opacity-70 transition-opacity" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-44 p-1.5 rounded-xl border-border/50 shadow-xl shadow-black/10">
              {['auto', '1:1', '4:3', '3:4', '16:9', '9:16', '3:2', '2:3'].map((ratio) => (
                <DropdownMenuItem
                  key={ratio}
                  onClick={() => setSelectedAspectRatio(ratio)}
                  className={cn(
                    'flex items-center justify-between rounded-lg px-3 py-2 text-sm cursor-pointer transition-all duration-150',
                    selectedAspectRatio === ratio && 'bg-primary/8 ring-1 ring-primary/15 font-medium'
                  )}
                >
                  <span>{ratio}</span>
                  {selectedAspectRatio === ratio && (
                    <div className="size-1.5 rounded-full bg-primary" />
                  )}
                </DropdownMenuItem>
              ))}

              {/* Custom size input */}
              <div className="my-1.5 h-px bg-border/40" />
              <div className="px-2 py-1.5">
                <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
                  Custom Size
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={64}
                    max={4096}
                    step={64}
                    placeholder="W"
                    value={customWidth}
                    onChange={(e) => setCustomWidth(e.target.value)}
                    className="h-8 w-full min-w-0 rounded-md border border-border/60 bg-background px-2 text-xs text-center focus:outline-none focus:ring-1 focus:ring-primary/30"
                  />
                  <span className="text-xs text-muted-foreground shrink-0">×</span>
                  <input
                    type="number"
                    min={64}
                    max={4096}
                    step={64}
                    placeholder="H"
                    value={customHeight}
                    onChange={(e) => setCustomHeight(e.target.value)}
                    className="h-8 w-full min-w-0 rounded-md border border-border/60 bg-background px-2 text-xs text-center focus:outline-none focus:ring-1 focus:ring-primary/30"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const w = parseInt(customWidth)
                    const h = parseInt(customHeight)
                    if (w && h && w >= 64 && h >= 64) {
                      setSelectedAspectRatio(`${w}x${h}`)
                    } else {
                      toast.error(t('chat:textarea.invalidSize'))
                    }
                  }}
                  disabled={!customWidth || !customHeight}
                  className="mt-1.5 w-full h-7 rounded-md bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Apply
                </button>
              </div>
              {selectedAspectRatio !== 'auto' && !['1:1', '4:3', '3:4', '16:9', '9:16', '3:2', '2:3'].includes(selectedAspectRatio) && (
                <DropdownMenuItem
                  onClick={() => setSelectedAspectRatio(selectedAspectRatio)}
                  className="flex items-center justify-between rounded-lg px-3 py-2 text-sm cursor-pointer bg-primary/8 ring-1 ring-primary/15 font-medium"
                >
                  <span>{selectedAspectRatio}</span>
                  <div className="size-1.5 rounded-full bg-primary" />
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Quantity Selector */}
          <div className="relative" ref={quantitySliderRef}>
            <button
              onClick={() => setShowQuantitySlider(!showQuantitySlider)}
              className="group inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-medium text-muted-foreground border border-border/50 bg-background/50 hover:bg-muted/60 hover:text-foreground hover:border-border transition-all duration-200 cursor-pointer active:scale-95"
            >
              <Hash className="size-3.5" />
              <span>{quantity}</span>
              <ChevronDown className="size-3 opacity-40 group-hover:opacity-70 transition-opacity" />
            </button>

            {/* Quantity Slider */}
            <AnimatePresence>
              {showQuantitySlider && (
                <motion.div
                  className="absolute bottom-full mb-2 left-0 bg-popover border border-border/50 rounded-xl p-4 shadow-xl shadow-black/10 min-w-52"
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ duration: 0.15, ease: 'easeOut' }}
                >
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-foreground">
                        {t('chat:textarea.quantity', 'Image Quantity')}
                      </span>
                      <span className="text-xs font-semibold text-primary tabular-nums bg-primary/10 px-2 py-0.5 rounded-md">
                        {quantity}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] text-muted-foreground tabular-nums">1</span>
                      <input
                        type="range"
                        min="1"
                        max={MAX_QUANTITY}
                        value={quantity}
                        onChange={(e) => setQuantity(Number(e.target.value))}
                        className="flex-1 h-1.5 bg-muted rounded-full appearance-none cursor-pointer
                                  [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
                                  [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary
                                  [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:shadow-primary/25
                                  [&::-webkit-slider-thumb]:ring-2 [&::-webkit-slider-thumb]:ring-primary/20
                                  [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full
                                  [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:border-0
                                  [&::-moz-range-thumb]:shadow-md"
                      />
                      <span className="text-[10px] text-muted-foreground tabular-nums">{MAX_QUANTITY}</span>
                    </div>
                    {/* Quick presets */}
                    <div className="flex items-center gap-1">
                      {[1, 4, 8, 16, 40].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setQuantity(preset)}
                          className={cn(
                            'flex-1 h-6 text-[10px] font-medium rounded-md border transition-all duration-150 cursor-pointer',
                            quantity === preset
                              ? 'bg-primary/10 text-primary border-primary/20'
                              : 'border-border/40 text-muted-foreground hover:bg-muted/40 hover:text-foreground'
                          )}
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* Arrow */}
                  <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-border/50"></div>
                  <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-popover translate-y-[-1px]"></div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {pending ? (
          <motion.button
            className="shrink-0 relative h-10 w-10 rounded-xl bg-gradient-to-br from-primary via-primary to-primary/80 text-primary-foreground shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 transition-all duration-300 cursor-pointer flex items-center justify-center"
            onClick={handleCancelChat}
            whileTap={{ scale: 0.9 }}
          >
            <Loader2 className="size-[18px] animate-spin" />
            <Square className="size-[5px] fill-current absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            <div className="absolute inset-0 rounded-xl ring-1 ring-inset ring-white/15 pointer-events-none" />
          </motion.button>
        ) : (
          <motion.button
            className={cn(
              'shrink-0 h-10 w-10 rounded-xl flex items-center justify-center transition-all duration-300 cursor-pointer relative overflow-hidden',
              (!textModel || !selectedTools || prompt.length === 0)
                ? 'bg-muted/60 text-muted-foreground/35 cursor-not-allowed'
                : 'bg-gradient-to-br from-primary via-primary to-primary/80 text-primary-foreground shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 hover:-translate-y-0.5 active:scale-90 active:translate-y-0'
            )}
            onClick={handleSendPrompt}
            disabled={!textModel || !selectedTools || prompt.length === 0}
            whileTap={{ scale: 0.9 }}
          >
            <ArrowUp className="size-[18px] relative z-10" strokeWidth={2.5} />
            {textModel && selectedTools && prompt.length > 0 && (
              <>
                <div className="absolute inset-0 rounded-xl ring-1 ring-inset ring-white/15 pointer-events-none z-10" />
                <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
              </>
            )}
          </motion.button>
        )}
      </div>
    </motion.div>
  )
}

export default ChatTextarea
