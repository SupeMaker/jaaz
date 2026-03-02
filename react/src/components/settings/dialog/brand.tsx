import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { Plus, Trash2, Upload, X } from 'lucide-react'
import { toast } from 'sonner'

type BrandColor = {
  id: string
  hex: string
  name: string
}

const SettingBrand = () => {
  const { t } = useTranslation()
  const [brandName, setBrandName] = useState('')
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [colors, setColors] = useState<BrandColor[]>([
    { id: '1', hex: '#6C63FF', name: 'Primary' },
  ])
  const [primaryFont, setPrimaryFont] = useState('')
  const [secondaryFont, setSecondaryFont] = useState('')

  const handleAddColor = () => {
    const newColor: BrandColor = {
      id: Date.now().toString(),
      hex: '#000000',
      name: '',
    }
    setColors([...colors, newColor])
  }

  const handleRemoveColor = (id: string) => {
    setColors(colors.filter((c) => c.id !== id))
  }

  const handleColorChange = (id: string, field: 'hex' | 'name', value: string) => {
    setColors(colors.map((c) => (c.id === id ? { ...c, [field]: value } : c)))
  }

  const handleLogoUpload = () => {
    // Simulate logo upload - in production this would open a file picker
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        const url = URL.createObjectURL(file)
        setLogoUrl(url)
      }
    }
    input.click()
  }

  const handleSave = () => {
    // Save brand settings to localStorage
    const brandSettings = {
      name: brandName,
      logoUrl,
      colors,
      primaryFont,
      secondaryFont,
    }
    localStorage.setItem('brand_settings', JSON.stringify(brandSettings))
    toast.success(t('settings:brand.saved'))
  }

  return (
    <div className="p-6 space-y-8 max-w-2xl">
      {/* Brand Name */}
      <div className="space-y-2">
        <label className="text-sm font-medium">{t('settings:brand.brandName')}</label>
        <Input
          placeholder={t('settings:brand.brandNamePlaceholder')}
          value={brandName}
          onChange={(e) => setBrandName(e.target.value)}
        />
      </div>

      {/* Brand Logo */}
      <div className="space-y-2">
        <label className="text-sm font-medium">{t('settings:brand.logo')}</label>
        <p className="text-xs text-muted-foreground">{t('settings:brand.logoDescription')}</p>
        <div className="flex items-center gap-4">
          {logoUrl ? (
            <div className="relative w-20 h-20 rounded-lg border border-border overflow-hidden group">
              <img src={logoUrl} alt="Brand Logo" className="w-full h-full object-contain p-2" />
              <button
                onClick={() => setLogoUrl(null)}
                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-destructive/80 text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <button
              onClick={handleLogoUpload}
              className="w-20 h-20 rounded-lg border-2 border-dashed border-border hover:border-primary/50 flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-primary transition-colors"
            >
              <Upload className="w-5 h-5" />
              <span className="text-[10px]">{t('settings:brand.uploadLogo')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Brand Colors */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <label className="text-sm font-medium">{t('settings:brand.colors')}</label>
            <p className="text-xs text-muted-foreground">{t('settings:brand.colorsDescription')}</p>
          </div>
          <Button variant="outline" size="sm" onClick={handleAddColor}>
            <Plus className="w-3.5 h-3.5 mr-1" />
            {t('settings:brand.addColor')}
          </Button>
        </div>
        <div className="space-y-2">
          {colors.map((color) => (
            <div key={color.id} className="flex items-center gap-2">
              <div className="relative">
                <input
                  type="color"
                  value={color.hex}
                  onChange={(e) => handleColorChange(color.id, 'hex', e.target.value)}
                  className="w-10 h-10 rounded-md border border-border cursor-pointer appearance-none bg-transparent [&::-webkit-color-swatch-wrapper]:p-1 [&::-webkit-color-swatch]:rounded"
                />
              </div>
              <Input
                value={color.hex}
                onChange={(e) => handleColorChange(color.id, 'hex', e.target.value)}
                className="w-28 font-mono text-xs"
                placeholder="#000000"
              />
              <Input
                value={color.name}
                onChange={(e) => handleColorChange(color.id, 'name', e.target.value)}
                className="flex-1"
                placeholder={t('settings:brand.colorName')}
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleRemoveColor(color.id)}
                className="shrink-0 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Brand Fonts */}
      <div className="space-y-3">
        <label className="text-sm font-medium">{t('settings:brand.fonts')}</label>
        <p className="text-xs text-muted-foreground">{t('settings:brand.fontsDescription')}</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">{t('settings:brand.primaryFont')}</label>
            <Input
              value={primaryFont}
              onChange={(e) => setPrimaryFont(e.target.value)}
              placeholder="Inter"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">{t('settings:brand.secondaryFont')}</label>
            <Input
              value={secondaryFont}
              onChange={(e) => setSecondaryFont(e.target.value)}
              placeholder="Fira Code"
            />
          </div>
        </div>
      </div>

      {/* Save Button */}
      <Button onClick={handleSave} className="w-full">
        {t('settings:brand.save')}
      </Button>
    </div>
  )
}

export default SettingBrand
