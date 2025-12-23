import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { CalendarBlank, ListChecks, Plus, X, CheckCircle, PushPin } from '@phosphor-icons/react'
import { SparkItem, SubTask } from '@/lib/types'
import { toast } from 'sonner'
import { formatDate } from '@/lib/helpers'

// Convert UTC ISO string to datetime-local format (YYYY-MM-DDTHH:mm)
function utcToLocal(utcString: string | undefined): string {
  if (!utcString) return ''
  const date = new Date(utcString)
  // Get local time offset and adjust
  const offset = date.getTimezoneOffset() * 60000
  const localDate = new Date(date.getTime() - offset)
  return localDate.toISOString().slice(0, 16)
}

interface EditItemDialogProps {
  item: SparkItem
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (itemSk: string, updates: Partial<SparkItem>) => Promise<void>
}

export function EditItemDialog({ item, open, onOpenChange, onSave }: EditItemDialogProps) {
  const [title, setTitle] = useState(item.title)
  const [content, setContent] = useState(item.content || '')
  const [deadline, setDeadline] = useState(item.type === 'task' ? utcToLocal(item.deadline) : '')
  const [subtasks, setSubtasks] = useState<SubTask[]>(item.type === 'task' ? item.subtasks || [] : [])
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  // Announcement-specific fields
  const [priority, setPriority] = useState<'normal' | 'high' | 'urgent'>(
    item.type === 'announcement' ? (item.priority as 'normal' | 'high' | 'urgent' || 'normal') : 'normal'
  )
  const [expiresAt, setExpiresAt] = useState(item.type === 'announcement' ? utcToLocal(item.expiresAt) : '')
  const [isPinned, setIsPinned] = useState(item.type === 'announcement' ? item.isPinned || false : false)
  const [pinnedUntil, setPinnedUntil] = useState(item.type === 'announcement' ? utcToLocal(item.pinnedUntil) : '')

  // Reset form ONLY when dialog opens (not when item changes during editing)
  useEffect(() => {
    if (open) {
      console.log('EditItemDialog - Opening with item:', item)
      setTitle(item.title)
      setContent(item.content || '')
      setDeadline(item.type === 'task' ? utcToLocal(item.deadline) : '')
      setSubtasks(item.type === 'task' ? item.subtasks || [] : [])
      setNewSubtaskTitle('')
      
      if (item.type === 'announcement') {
        console.log('EditItemDialog - Setting announcement fields:', {
          priority: item.priority,
          expiresAt: item.expiresAt,
          isPinned: item.isPinned,
          pinnedUntil: item.pinnedUntil
        })
        setPriority((item.priority as 'normal' | 'high' | 'urgent') || 'normal')
        setExpiresAt(utcToLocal(item.expiresAt))
        setIsPinned(item.isPinned || false)
        setPinnedUntil(utcToLocal(item.pinnedUntil))
      }
    }
    // Only depend on 'open' - don't reset when item changes during editing
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

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

    // Validate dates for announcements
    if (item.type === 'announcement') {
      // Check if isPinned and pinnedUntil is set
      if (isPinned && pinnedUntil && expiresAt) {
        const pinnedDate = new Date(pinnedUntil)
        const expiresDate = new Date(expiresAt)
        if (pinnedDate >= expiresDate) {
          toast.error('Pin until date must be earlier than expiration date')
          return
        }
      }
    }

    setIsSaving(true)
    try {
      const updates: any = {
        title: title.trim(),
        content: content.trim(),
      }

      if (item.type === 'task') {
        // Convert datetime-local to ISO UTC format
        if (deadline) {
          const localDate = new Date(deadline)
          updates.deadline = localDate.toISOString()
        } else {
          updates.deadline = undefined
        }
        updates.subtasks = subtasks.length > 0 ? subtasks : undefined
      } else if (item.type === 'announcement') {
        updates.priority = priority
        
        // Convert datetime-local to ISO UTC format
        if (expiresAt) {
          const localDate = new Date(expiresAt)
          updates.expiresAt = localDate.toISOString()
        } else {
          updates.expiresAt = undefined
        }
        
        updates.isPinned = isPinned
        
        if (pinnedUntil) {
          const localDate = new Date(pinnedUntil)
          updates.pinnedUntil = localDate.toISOString()
        } else {
          updates.pinnedUntil = undefined
        }
      }

      await onSave(item.sk, updates as Partial<SparkItem>)
      toast.success(item.type === 'task' ? 'Task updated successfully' : 'Announcement updated successfully')
      onOpenChange(false)
    } catch (error) {
      console.error(`Error updating ${item.type}:`, error)
      toast.error(`Failed to update ${item.type}`)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit {item.type === 'task' ? 'Task' : 'Announcement'}</DialogTitle>
          <DialogDescription>
            Update the {item.type === 'task' ? 'task' : 'announcement'} details below
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
              placeholder={`Enter ${item.type} title`}
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
              placeholder={`Enter ${item.type} description`}
              rows={4}
              maxLength={2000}
            />
          </div>

          {/* Task-specific fields */}
          {item.type === 'task' && (
            <>
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
                  min={new Date().toISOString().slice(0, 16)}
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
                <div key={subtask.id} className="flex items-center gap-2 p-2 rounded-lg border bg-card transition-all duration-200 hover:bg-muted/50">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => toggleSubtask(subtask.id)}
                    className="h-6 w-6 flex-shrink-0 transition-transform hover:scale-110"
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
                    className="h-6 w-6 flex-shrink-0 text-muted-foreground hover:text-destructive transition-transform hover:scale-110"
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
                className="transition-transform hover:scale-110"
              >
                <Plus size={16} />
              </Button>
            </div>
          </div>
            </>
          )}

          {/* Announcement-specific fields */}
          {item.type === 'announcement' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="edit-priority">Priority</Label>
                <Select value={priority} onValueChange={(value: 'normal' | 'high' | 'urgent') => setPriority(value)}>
                  <SelectTrigger id="edit-priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-expiresAt" className="flex items-center gap-2">
                  <CalendarBlank size={16} />
                  Expires At (optional)
                </Label>
                <Input
                  id="edit-expiresAt"
                  type="datetime-local"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  min={new Date().toISOString().slice(0, 16)}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="edit-isPinned"
                    checked={isPinned}
                    onCheckedChange={(checked) => {
                      console.log('[EditItemDialog] Pin checkbox onCheckedChange:', checked, 'current isPinned:', isPinned)
                      setIsPinned(checked as boolean)
                    }}
                  />
                  <span 
                    className="flex items-center gap-2 text-sm font-medium leading-none cursor-pointer select-none"
                    onClick={() => {
                      console.log('[EditItemDialog] Span clicked, toggling isPinned from', isPinned, 'to', !isPinned)
                      setIsPinned(!isPinned)
                    }}
                  >
                    <PushPin size={16} weight="duotone" />
                    Pin this announcement to top banner
                  </span>
                </div>
              </div>

              {isPinned && (
                <div className="space-y-2">
                  <Label htmlFor="edit-pinnedUntil" className="flex items-center gap-2">
                    <CalendarBlank size={16} />
                    Auto-unpin after (optional)
                  </Label>
                  <Input
                    id="edit-pinnedUntil"
                    type="datetime-local"
                    value={pinnedUntil}
                    onChange={(e) => setPinnedUntil(e.target.value)}
                    min={new Date().toISOString().slice(0, 16)}
                    max={expiresAt || undefined}
                  />
                  <p className="text-xs text-muted-foreground">
                    Leave empty to pin indefinitely. Announcement will automatically unpin after this date.
                  </p>
                </div>
              )}
            </>
          )}
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
