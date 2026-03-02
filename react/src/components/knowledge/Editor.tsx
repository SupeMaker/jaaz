import { useEffect, useRef, useState, useCallback } from 'react'
import '@mdxeditor/editor/style.css'
import {
  headingsPlugin,
  listsPlugin,
  quotePlugin,
  thematicBreakPlugin,
  markdownShortcutPlugin,
  MDXEditor,
  type MDXEditorMethods,
  BoldItalicUnderlineToggles,
  UndoRedo,
  toolbarPlugin,
  InsertTable,
  InsertImage,
  Separator,
  CodeToggle,
  ListsToggle,
  CreateLink,
  BlockTypeSelect,
  linkPlugin,
  imagePlugin,
} from '@mdxeditor/editor'

import { toast } from 'sonner'
import { Switch } from '../ui/switch'
import { SaveIcon } from 'lucide-react'
import { Button } from '../ui/button'

function useDebounce<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): (...args: Parameters<T>) => void {
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)

  return useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }

      timeoutRef.current = setTimeout(() => {
        callback(...args)
      }, delay)
    },
    [callback, delay]
  )
}

export default function Editor({ knowledgeID }: { knowledgeID: string }) {
  const [isPreviewMode, setIsPreviewMode] = useState(false)
  const mdxEditorRef = useRef<MDXEditorMethods>(null)
  const [editorContent, setEditorContent] = useState('')

  useEffect(() => {
    const draft = localStorage.getItem('knowledge_draft')
    if (draft) {
      setEditorContent(draft)
      mdxEditorRef.current?.setMarkdown(draft)
    }
    fetch('/api/read_file', {
      method: 'POST',
      body: JSON.stringify({ knowledge_id: knowledgeID }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (typeof data.content == 'string') {
          const { content } = getTitleAndContent(data.content)
          setEditorContent(content)
          mdxEditorRef.current?.setMarkdown(content)
        } else {
          toast.error('Failed to read file')
        }
      })
  }, [])

  const updateFile = useCallback((content: string) => {
    localStorage.setItem('knowledge_draft', content)
  }, [])

  // Create debounced versions of the functions
  const debouncedUpdateFile = useDebounce(updateFile, 500)

  const setEditorContentWrapper = (content: string) => {
    setEditorContent(content)
    debouncedUpdateFile(content)
  }

  return (
    <div className="mb-5 p-5">
      <div
        className="flex py-2 items-center gap-2 justify-between"
        style={{ height: '50px' }}
      >
        <div className="flex items-center gap-2">
          <Switch checked={isPreviewMode} onCheckedChange={setIsPreviewMode} />
          <span className="text-sm">Preview</span>
        </div>
        <Button className="w-[200px]">
          <SaveIcon />
          Save
        </Button>
      </div>
      <div className="overflow-y-auto">
        <div className="mb-5 border rounded-md overflow-hidden">
          <MDXEditor
            className="dark-theme"
            contentEditableClassName="prose"
            markdown={editorContent}
            ref={mdxEditorRef}
            onChange={setEditorContentWrapper}
            plugins={[
              headingsPlugin(),
              listsPlugin(),
              quotePlugin(),
              thematicBreakPlugin(),
              markdownShortcutPlugin(),
              toolbarPlugin({
                toolbarContents: () => (
                  <>
                    <UndoRedo />
                    <Separator />
                    <BlockTypeSelect />
                    <BoldItalicUnderlineToggles />
                    <CodeToggle />
                    <ListsToggle />
                    <Separator />
                    <CreateLink />
                    <InsertImage />
                    <InsertTable />
                  </>
                ),
              }),
              linkPlugin(),
              imagePlugin(),
            ]}
          />
        </div>
      </div>
    </div>
  )
}

function getTitleAndContent(value: string) {
  const firstNewlineIndex = value.indexOf('\n')
  if (firstNewlineIndex !== -1 && value.startsWith('# ')) {
    const title = value.substring(2, firstNewlineIndex).trim() // Extract title without '# '
    const content = value.substring(firstNewlineIndex + 1).trim() // Extract content after the first newline
    console.log('content', content)
    return { title, content }
  }
  return { title: '', content: value }
}
