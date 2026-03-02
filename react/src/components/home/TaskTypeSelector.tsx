import { cn } from '@/lib/utils'
import { motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import {
  ImageIcon,
  LayoutTemplate,
  Palette,
  Brush,
  ShoppingBag,
  Video,
} from 'lucide-react'

export type TaskType = 'image' | 'design' | 'brand' | 'illustration' | 'ecommerce' | 'video'

type TaskTypeSelectorProps = {
  selected: TaskType
  onSelect: (type: TaskType) => void
  className?: string
}

const taskIcons: Record<TaskType, React.ElementType> = {
  image: ImageIcon,
  design: LayoutTemplate,
  brand: Palette,
  illustration: Brush,
  ecommerce: ShoppingBag,
  video: Video,
}

const TaskTypeSelector: React.FC<TaskTypeSelectorProps> = ({
  selected,
  onSelect,
  className,
}) => {
  const { t } = useTranslation()

  const taskTypes: TaskType[] = ['image', 'design', 'brand', 'illustration', 'ecommerce', 'video']

  return (
    <div className={cn('flex flex-wrap items-center justify-center gap-2', className)}>
      {taskTypes.map((type) => {
        const Icon = taskIcons[type]
        const isActive = selected === type
        return (
          <motion.button
            key={type}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => onSelect(type)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 border',
              isActive
                ? 'bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/25'
                : 'bg-secondary/50 text-muted-foreground border-border hover:bg-secondary hover:text-foreground'
            )}
          >
            <Icon className="w-4 h-4" />
            <span>{t(`home:taskTypes.${type}`)}</span>
          </motion.button>
        )
      })}
    </div>
  )
}

export default TaskTypeSelector
