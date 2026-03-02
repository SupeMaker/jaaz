import { createCanvas } from '@/api/canvas'
import ChatTextarea from '@/components/chat/ChatTextarea'
import CanvasList from '@/components/home/CanvasList'
import FeatureCards from '@/components/home/FeatureCards'
import MultimodalShowcase from '@/components/home/MultimodalShowcase'
import TaskTypeSelector, { TaskType } from '@/components/home/TaskTypeSelector'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useConfigs } from '@/contexts/configs'
import { DEFAULT_SYSTEM_PROMPT } from '@/constants'
import { useMutation } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { motion } from 'motion/react'
import { nanoid } from 'nanoid'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import TopMenu from '@/components/TopMenu'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { setInitCanvas } = useConfigs()
  const [selectedTask, setSelectedTask] = useState<TaskType>('image')

  const { mutate: createCanvasMutation, isPending } = useMutation({
    mutationFn: createCanvas,
    onSuccess: (data, variables) => {
      setInitCanvas(true)
      navigate({
        to: '/canvas/$id',
        params: { id: data.id },
        search: {
          sessionId: variables.session_id,
        },
      })
    },
    onError: (error) => {
      toast.error(t('common:messages.error'), {
        description: error.message,
      })
    },
  })

  return (
    <div className='flex flex-col h-screen'>
      <ScrollArea className='h-full'>
        <TopMenu />

        {/* Hero Section */}
        <div className='relative flex flex-col items-center justify-center h-fit min-h-[calc(100vh-200px)] pt-[60px] select-none'>
          {/* Gradient background glow */}
          <div className='absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-primary/10 rounded-full blur-[120px] pointer-events-none' />

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className='text-5xl font-bold mb-3 mt-8 text-center bg-gradient-to-r from-primary via-primary/80 to-blue-500 bg-clip-text text-transparent'>
              {t('home:title')}
            </h1>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <p className='text-lg text-muted-foreground mb-6 text-center max-w-xl'>
              {t('home:subtitle')}
            </p>
          </motion.div>

          {/* Task Type Selector */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className='mb-6'
          >
            <TaskTypeSelector
              selected={selectedTask}
              onSelect={setSelectedTask}
            />
          </motion.div>

          {/* Chat Input */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className='w-full max-w-xl'
          >
            <ChatTextarea
              className='w-full'
              messages={[]}
              onSendMessages={(messages, configs) => {
                createCanvasMutation({
                  name: t('home:newCanvas'),
                  canvas_id: nanoid(),
                  messages: messages,
                  session_id: nanoid(),
                  text_model: configs.textModel,
                  tool_list: configs.toolList,
                  system_prompt: localStorage.getItem('system_prompt') || DEFAULT_SYSTEM_PROMPT,
                })
              }}
              pending={isPending}
            />
          </motion.div>
        </div>

        {/* Feature Cards Section */}
        <div className='px-6 py-12'>
          <FeatureCards />
        </div>

        {/* Multimodal Showcase Section */}
        <div className='px-6'>
          <MultimodalShowcase />
        </div>

        {/* ChatCanvas Section */}
        <div className='px-6 py-16'>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className='text-center max-w-3xl mx-auto'
          >
            <h2 className='text-3xl font-bold mb-3'>{t('home:chatCanvas.title')}</h2>
            <p className='text-muted-foreground text-lg'>
              {t('home:chatCanvas.subtitle')}
            </p>
          </motion.div>
        </div>

        {/* Canvas List */}
        <div className='px-6 pb-12'>
          <CanvasList />
        </div>
      </ScrollArea>
    </div>
  )
}
