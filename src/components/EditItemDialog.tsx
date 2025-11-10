import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { CalendarBlank, ListChecks, Plus, X, CheckCircle } from '@phosphor-icons/react'
import { SparkItem, SubTask } from '@/lib/types'
import { toast } from 'sonner'
import { formatDate } from '@/lib/helpers'

interface EditItemDialogProps {
  item: SparkItem
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (itemSk: string, updates: Partial<SparkItem>) => Promise<void>
}

export function EditItemDialog({ item, open, onOpenChange, onSave }: EditItemDialogProps) {
  const [title, setTitle] = useState(item.title)
  const [content, setContent] = useState(item.content || '')
  const [deadline, setDeadline] = useState(item.type === 'task' ? item.deadline || '' : '')
  const [subtasks, setSubtasks] = useState<SubTask[]>(item.type === 'task' ? item.subtasks || [] : [])
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  // Reset form when item changes or dialog opens
  useEffect(() => {
    if (open) {
      setTitle(item.title)
      setContent(item.content || '')
      setDeadline(item.type === 'task' ? item.deadline || '' : '')
      setSubtasks(item.type === 'task' ? item.subtasks || [] : [])
      setNewSubtaskTitle('')
    }
  }, [open, item])

  const addSubtask = () => {
    if (!newSubtaskTitle.trim()) {
      toast.error('Please enter a subtask title')
      return
    }

    const newSubtask: SubTask = {
      id: crypto.randomUUID(),
      title: newSubtaskTitle.trim(),
      completed: false,
    }

    setSubtasks([...subtasks, newSubtask])
    setNewSubtaskTitle('')
  }

  const removeSubtask = (id: string) => {
    setSubtasks(subtasks.filter(st => st.id !== id))
  }

  const toggleSubtask = (id: string) => {
    setSubtasks(subtasks.map(st => 
      st.id === id 
        ? { ...st, completed: !st.completed, completedAt: !st.completed ? new Date().toISOString() : undefined }
        : st
    ))
  }

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error('Title is required')
      return
    }

    setIsSaving(true)
    try {
      const updates: Partial<SparkItem> = {
        title: title.trim(),
        content: content.trim(),
        deadline: deadline || undefined,
        subtasks: subtasks.length > 0 ? subtasks : undefined,
      }

      await onSave(item.sk, updates)
      toast.success('Task updated successfully')
      onOpenChange(false)
    } catch (error) {
      console.error('Error updating task:', error)
      toast.error('Failed to update task')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Task</DialogTitle>
          <DialogDescription>
            Update the task details below
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="edit-title">
              Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="edit-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter task title"
              maxLength={200}
            />
          </div>

          {/* Content */}
          <div className="space-y-2">
            <Label htmlFor="edit-content">Description</Label>
            <Textarea
              id="edit-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Enter task description"
              rows={4}
              maxLength={2000}
            />
          </div>

          {/* Deadline */}
          <div className="space-y-2">
            <Label htmlFor="edit-deadline" className="flex items-center gap-2">
              <CalendarBlank size={16} />
              Deadline
            </Label>
            <Input
              id="edit-deadline"
              type="datetime-local"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </div>

          {/* Subtasks */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <ListChecks size={16} />
              Subtasks {subtasks.length > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {subtasks.filter(st => st.completed).length}/{subtasks.length} completed
                </Badge>
              )}
            </Label>
            
            <div className="space-y-2">
              {subtasks.map((subtask) => (
                <div key={subtask.id} className="flex items-center gap-2 p-2 rounded-lg border bg-card">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => toggleSubtask(subtask.id)}
                    className="h-6 w-6 flex-shrink-0"
                  >
                    {subtask.completed ? (
                      <CheckCircle size={16} weight="fill" className="text-green-600" />
                    ) : (
                      <div className="w-4 h-4 border-2 border-muted-foreground rounded-full" />
                    )}
                  </Button>
                  <span className={`flex-1 text-sm ${subtask.completed ? 'line-through text-muted-foreground' : ''}`}>
                    {subtask.title}
                  </span>
                  {subtask.completed && subtask.completedAt && (
                    <span className="text-xs text-muted-foreground">
                      {formatDate(subtask.completedAt)}
                    </span>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeSubtask(subtask.id)}
                    className="h-6 w-6 flex-shrink-0 text-muted-foreground hover:text-destructive"
                  >
                    <X size={14} />
                  </Button>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <Input
                value={newSubtaskTitle}
                onChange={(e) => setNewSubtaskTitle(e.target.value)}
                placeholder="Add a subtask..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addSubtask()
                  }
                }}
                maxLength={200}
              />
              <Button
                type="button"
                onClick={addSubtask}
                variant="outline"
                size="icon"
                disabled={!newSubtaskTitle.trim()}
              >
                <Plus size={16} />
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || !title.trim()}
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
