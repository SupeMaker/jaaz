import { cn } from '@/lib/utils'
import { motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import {
  ImageIcon,
  Video,
  Music,
  FileCode,
  Box,
  Palette,
} from 'lucide-react'

type ModalType = 'image' | 'video' | 'audio' | 'script' | '3d' | 'brand'

const modalIcons: Record<ModalType, React.ElementType> = {
  image: ImageIcon,
  video: Video,
  audio: Music,
  script: FileCode,
  '3d': Box,
  brand: Palette,
}

const modals: ModalType[] = ['image', 'video', 'audio', 'script', '3d', 'brand']

type MultimodalShowcaseProps = {
  className?: string
}

const MultimodalShowcase: React.FC<MultimodalShowcaseProps> = ({ className }) => {
  const { t } = useTranslation()

  return (
    <div className={cn('py-16', className)}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="text-center mb-10"
      >
        <h2 className="text-3xl font-bold mb-3">{t('home:multimodal.title')}</h2>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
          {t('home:multimodal.subtitle')}
        </p>
      </motion.div>

      <div className="flex flex-wrap items-center justify-center gap-4 max-w-3xl mx-auto">
        {modals.map((modal, index) => {
          const Icon = modalIcons[modal]
          return (
            <motion.div
              key={modal}
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: index * 0.06 }}
              whileHover={{ scale: 1.08, y: -4 }}
              className="flex flex-col items-center gap-2 p-5 rounded-xl border border-border bg-card/30 hover:border-primary/30 hover:bg-primary/5 transition-all duration-300 cursor-default min-w-[100px]"
            >
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 text-primary">
                <Icon className="w-6 h-6" />
              </div>
              <span className="text-sm font-medium">{t(`home:multimodal.${modal}`)}</span>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}

export default MultimodalShowcase
