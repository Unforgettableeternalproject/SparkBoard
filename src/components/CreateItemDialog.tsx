import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Plus, File, X } from '@phosphor-icons/react'
import { CreateItemInput, FileAttachment } from '@/lib/types'
import { toast } from 'sonner'
import { formatFileSize } from '@/lib/helpers'

interface CreateItemDialogProps {
  onCreateItem: (input: CreateItemInput) => void
}

export function CreateItemDialog({ onCreateItem }: CreateItemDialogProps) {
  const [open, setOpen] = useState(false)
  const [type, setType] = useState<'task' | 'announcement'>('task')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [attachments, setAttachments] = useState<FileAttachment[]>([])

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return

    Array.from(files).forEach((file) => {
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`${file.name} is too large (max 5MB)`)
        return
      }

      const reader = new FileReader()
      reader.onload = () => {
        setAttachments((prev) => [
          ...prev,
          {
            name: file.name,
            size: file.size,
            type: file.type,
            dataUrl: reader.result as string
          }
        ])
      }
      reader.readAsDataURL(file)
    })
  }

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = () => {
    if (!title.trim()) {
      toast.error('Title is required')
      return
    }

    onCreateItem({
      type,
      title: title.trim(),
      content: content.trim(),
      attachments: attachments.length > 0 ? attachments : undefined
    })

    setTitle('')
    setContent('')
    setAttachments([])
    setOpen(false)
    toast.success(`${type === 'task' ? 'Task' : 'Announcement'} created`)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg" className="gap-2">
          <Plus size={20} />
          New Item
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create New Item</DialogTitle>
          <DialogDescription>
            Add a new task or announcement to the board
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Type</Label>
            <div className="flex gap-2">
              <Badge
                variant={type === 'task' ? 'default' : 'outline'}
                className="cursor-pointer px-4 py-2"
                onClick={() => setType('task')}
              >
                Task
              </Badge>
              <Badge
                variant={type === 'announcement' ? 'default' : 'outline'}
                className="cursor-pointer px-4 py-2"
                onClick={() => setType('announcement')}
              >
                Announcement
              </Badge>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              placeholder="Enter title..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="content">Content</Label>
            <Textarea
              id="content"
              placeholder="Enter description..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={5}
            />
          </div>

          <div className="space-y-2">
            <Label>Attachments (S3 Upload Simulation)</Label>
            <div className="space-y-2">
              <Input
                type="file"
                multiple
                onChange={handleFileUpload}
                className="cursor-pointer"
              />
              {attachments.length > 0 && (
                <div className="space-y-2">
                  {attachments.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 p-2 bg-muted rounded-md"
                    >
                      <File size={20} className="text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{file.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(file.size)}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeAttachment(index)}
                      >
                        <X size={16} />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
