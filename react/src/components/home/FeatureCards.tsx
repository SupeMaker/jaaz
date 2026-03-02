import { cn } from '@/lib/utils'
import { motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import {
  Eye,
  Maximize,
  MessageSquare,
  MousePointerClick,
  Layers,
  Download,
} from 'lucide-react'

type FeatureKey =
  | 'visualContext'
  | 'spatialPrompt'
  | 'canvasGeneration'
  | 'localRefine'
  | 'smartLayers'
  | 'batchExport'

const featureIcons: Record<FeatureKey, React.ElementType> = {
  visualContext: Eye,
  spatialPrompt: Maximize,
  canvasGeneration: MessageSquare,
  localRefine: MousePointerClick,
  smartLayers: Layers,
  batchExport: Download,
}

const features: FeatureKey[] = [
  'visualContext',
  'spatialPrompt',
  'canvasGeneration',
  'localRefine',
  'smartLayers',
  'batchExport',
]

type FeatureCardsProps = {
  className?: string
}

const FeatureCards: React.FC<FeatureCardsProps> = ({ className }) => {
  const { t } = useTranslation()

  return (
    <div className={cn('grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto', className)}>
      {features.map((key, index) => {
        const Icon = featureIcons[key]
        return (
          <motion.div
            key={key}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: index * 0.08 }}
            whileHover={{ scale: 1.02, y: -2 }}
            className="group relative p-6 rounded-xl border border-border bg-card/50 backdrop-blur-sm hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors">
                <Icon className="w-5 h-5" />
              </div>
              <h3 className="text-base font-semibold">{t(`home:features.${key}`)}</h3>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t(`home:features.${key}Desc`)}
            </p>
          </motion.div>
        )
      })}
    </div>
  )
}

export default FeatureCards
