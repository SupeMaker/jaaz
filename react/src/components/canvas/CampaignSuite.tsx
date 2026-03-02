import { motion } from 'motion/react'
import { Instagram, Youtube, Twitter, Facebook, Image as ImageIcon, Sparkles, ArrowRight } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'

export type CampaignPlatform = 'instagram' | 'tiktok' | 'youtube' | 'twitter' | 'xiaohongshu' | 'facebook'

export type CampaignAsset = {
    platform: CampaignPlatform
    title: string
    aspectRatio: string
    dimensions: string
    thumbnail?: string
    status: 'pending' | 'generating' | 'done'
}

interface CampaignSuiteProps {
    assets: CampaignAsset[]
    onGenerate?: (platform: CampaignPlatform) => void
    onGenerateAll?: () => void
    className?: string
}

const platformConfig: Record<CampaignPlatform, { icon: React.ElementType; color: string; label: string }> = {
    instagram: { icon: Instagram, color: 'from-pink-500 to-violet-500', label: 'Instagram' },
    tiktok: { icon: Youtube, color: 'from-rose-500 to-cyan-500', label: 'TikTok' },
    youtube: { icon: Youtube, color: 'from-red-500 to-red-600', label: 'YouTube' },
    twitter: { icon: Twitter, color: 'from-sky-400 to-sky-500', label: 'Twitter / X' },
    xiaohongshu: { icon: ImageIcon, color: 'from-red-400 to-rose-500', label: 'Xiaohongshu' },
    facebook: { icon: Facebook, color: 'from-blue-500 to-blue-700', label: 'Facebook' },
}

export default function CampaignSuite({
    assets,
    onGenerate,
    onGenerateAll,
    className,
}: CampaignSuiteProps) {
    const { t } = useTranslation()
    const [selectedPlatform, setSelectedPlatform] = useState<CampaignPlatform | null>(null)

    const generatingCount = assets.filter((a) => a.status === 'generating').length
    const doneCount = assets.filter((a) => a.status === 'done').length

    return (
        <div className={cn('rounded-xl border border-border/50 bg-background/50 overflow-hidden', className)}>
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border/30 bg-muted/20">
                <div className="flex items-center gap-2.5">
                    <div className="flex items-center justify-center size-8 rounded-lg bg-gradient-to-br from-fuchsia-500/15 to-violet-500/15 text-fuchsia-500">
                        <Sparkles className="size-4" />
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold">{t('canvas:campaignSuite.title', 'Campaign Suite')}</h3>
                        <p className="text-[11px] text-muted-foreground">
                            {t('canvas:campaignSuite.subtitle', 'Auto-extend to every touchpoint')}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {generatingCount > 0 && (
                        <span className="text-[10px] text-amber-500 font-medium px-2 py-0.5 rounded-md bg-amber-500/10">
                            {generatingCount} generating
                        </span>
                    )}
                    {doneCount > 0 && (
                        <span className="text-[10px] text-emerald-500 font-medium px-2 py-0.5 rounded-md bg-emerald-500/10">
                            {doneCount} ready
                        </span>
                    )}
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={onGenerateAll}
                        className="h-7 text-xs gap-1.5"
                    >
                        <Sparkles className="size-3" />
                        {t('canvas:campaignSuite.generateAll', 'Generate All')}
                    </Button>
                </div>
            </div>

            {/* Platform Grid */}
            <div className="p-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
                {assets.map((asset) => {
                    const config = platformConfig[asset.platform]
                    const Icon = config.icon
                    const isSelected = selectedPlatform === asset.platform
                    return (
                        <motion.button
                            key={asset.platform}
                            onClick={() => {
                                setSelectedPlatform(isSelected ? null : asset.platform)
                                onGenerate?.(asset.platform)
                            }}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className={cn(
                                'group relative rounded-lg border p-3 text-left transition-all duration-200 cursor-pointer overflow-hidden',
                                isSelected ? 'border-primary/40 bg-primary/5' : 'border-border/50 hover:border-border/80 hover:bg-muted/30',
                                asset.status === 'done' && 'ring-1 ring-emerald-500/20'
                            )}
                        >
                            {/* Gradient backdrop */}
                            <div className={cn(
                                'absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-5 transition-opacity',
                                config.color
                            )} />

                            {/* Platform Icon */}
                            <div className="relative flex items-center justify-between mb-2">
                                <div className={cn(
                                    'flex items-center justify-center size-8 rounded-lg bg-gradient-to-br text-white shadow-sm',
                                    config.color
                                )}>
                                    <Icon className="size-4" />
                                </div>
                                {asset.status === 'done' && (
                                    <span className="text-[10px] text-emerald-500 font-medium px-1.5 py-0.5 rounded bg-emerald-500/10">
                                        Ready
                                    </span>
                                )}
                                {asset.status === 'generating' && (
                                    <motion.div
                                        animate={{ rotate: 360 }}
                                        transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                                        className="size-3 border-2 border-amber-500/30 border-t-amber-500 rounded-full"
                                    />
                                )}
                            </div>

                            {/* Info */}
                            <div className="relative">
                                <div className="text-xs font-medium truncate">{config.label}</div>
                                <div className="text-[10px] text-muted-foreground mt-0.5">
                                    {asset.dimensions} · {asset.aspectRatio}
                                </div>
                            </div>

                            {/* Hover arrow */}
                            <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                <ArrowRight className="size-3 text-muted-foreground" />
                            </div>
                        </motion.button>
                    )
                })}
            </div>

            {/* Footer hint */}
            <div className="px-4 py-2.5 border-t border-border/30 bg-muted/20">
                <p className="text-[10px] text-muted-foreground/70 italic">
                    {t('canvas:campaignSuite.hint', 'Click a platform to generate adapted creative. Brand colors and fonts will be applied automatically.')}
                </p>
            </div>
        </div>
    )
}
