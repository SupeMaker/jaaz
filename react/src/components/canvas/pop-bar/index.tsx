import { useCanvas } from '@/contexts/canvas'
import { TCanvasAddImagesToChatEvent } from '@/lib/event'
import {
  ExcalidrawImageElement,
  OrderedExcalidrawElement,
} from '@excalidraw/excalidraw/element/types'
import { AnimatePresence } from 'motion/react'
import { useRef, useState } from 'react'
import CanvasPopbarContainer from './CanvasPopbarContainer'
import { collectSelectedImagesInOrder } from '../utils/canvasImages'

const CanvasPopbarWrapper = () => {
  const { excalidrawAPI } = useCanvas()

  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const [showAddToChat, setShowAddToChat] = useState(false)
  const [showMagicGenerate, setShowMagicGenerate] = useState(false)

  const selectedImagesRef = useRef<TCanvasAddImagesToChatEvent>([])
  const selectedElementsRef = useRef<OrderedExcalidrawElement[]>([])

  excalidrawAPI?.onChange((elements, appState, files) => {
    const selectedIds = appState.selectedElementIds
    const selectedIdList = Object.keys(selectedIds)

    if (selectedIdList.length === 0) {
      setPos(null)
      setShowAddToChat(false)
      setShowMagicGenerate(false)
      return
    }

    const selectedImages = selectedIdList
      .map((id) =>
        elements.find((element) => element.id === id && element.type === 'image')
      )
      .filter((element): element is ExcalidrawImageElement => !!element)

    const hasSelectedImages = selectedImages.length > 0
    setShowAddToChat(hasSelectedImages)

    const selectedCount = selectedIdList.length
    setShowMagicGenerate(selectedCount >= 2)

    if (!hasSelectedImages && selectedCount < 2) {
      setPos(null)
      return
    }

    // 按选中顺序编号（Object.keys 保留 Excalidraw 选中顺序）
    selectedImagesRef.current = collectSelectedImagesInOrder(
      elements.filter((el) => el.type === 'image') as ExcalidrawImageElement[],
      files,
      selectedIdList.filter((id) =>
        elements.some((el) => el.id === id && el.type === 'image')
      )
    )

    selectedElementsRef.current = selectedIdList
      .map((id) => elements.find((element) => element.id === id))
      .filter(
        (element): element is OrderedExcalidrawElement =>
          !!element && element.index !== null
      )

    let centerX: number
    let bottomY: number

    if (hasSelectedImages) {
      centerX =
        selectedImages.reduce((acc, image) => acc + image.x + image.width / 2, 0) /
        selectedImages.length

      bottomY = selectedImages.reduce(
        (acc, image) => Math.max(acc, image.y + image.height),
        Number.NEGATIVE_INFINITY
      )
    } else {
      const selectedElements = selectedElementsRef.current

      centerX =
        selectedElements.reduce(
          (acc, element) => acc + element.x + (element.width || 0) / 2,
          0
        ) / selectedElements.length

      bottomY = selectedElements.reduce(
        (acc, element) => Math.max(acc, element.y + (element.height || 0)),
        Number.NEGATIVE_INFINITY
      )
    }

    const scrollX = appState.scrollX
    const scrollY = appState.scrollY
    const zoom = appState.zoom.value
    const offsetX = (scrollX + centerX) * zoom
    const offsetY = (scrollY + bottomY) * zoom
    setPos({ x: offsetX, y: offsetY })
  })

  return (
    <div id='canvas-popbar-wrapper' className='absolute left-0 bottom-0 w-full h-full z-20 pointer-events-none'>
      <AnimatePresence>
        {pos && (showAddToChat || showMagicGenerate) && (
          <CanvasPopbarContainer
            pos={pos}
            selectedImages={selectedImagesRef.current}
            selectedElements={selectedElementsRef.current}
            showAddToChat={showAddToChat}
            showMagicGenerate={showMagicGenerate}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

export default CanvasPopbarWrapper
