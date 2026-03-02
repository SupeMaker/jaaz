import { Input } from '@/components/ui/input'
import CanvasExport from './CanvasExport'
import WorkModeIndicator, { WorkMode } from './WorkModeIndicator'
import TopMenu from '../TopMenu'
import { useState } from 'react'

type CanvasHeaderProps = {
  canvasName: string
  canvasId: string
  onNameChange: (name: string) => void
  onNameSave: () => void
}

const CanvasHeader: React.FC<CanvasHeaderProps> = ({
  canvasName,
  canvasId,
  onNameChange,
  onNameSave,
}) => {
  const [workMode, setWorkMode] = useState<WorkMode>('talk')

  return (
    <TopMenu
      middle={
        <div className="flex items-center gap-3">
          <Input
            className="text-sm text-muted-foreground text-center bg-transparent border-none shadow-none w-fit h-7 hover:bg-primary-foreground transition-all"
            value={canvasName}
            onChange={(e) => onNameChange(e.target.value)}
            onBlur={onNameSave}
          />
          <WorkModeIndicator activeMode={workMode} onModeChange={setWorkMode} />
        </div>
      }
      right={<CanvasExport />}
    />
  )
}

export default CanvasHeader
