import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Plus, File, X, CalendarBlank, ListChecks, PushPin } from '@phosphor-icons/react'
import { CreateItemInput, FileAttachment, SubTask } from '@/lib/types'
import { toast } from 'sonner'
import { formatFileSize } from '@/lib/helpers'

const API_URL = import.meta.env.VITE_API_URL

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

// File upload limits
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB per file
const MAX_TOTAL_SIZE = 10 * 1024 * 1024 // 10MB total
const MAX_FILES = 5 // Maximum number of files

interface CreateItemDialogProps {
  onCreateItem: (input: CreateItemInput) => Promise<boolean>
  open?: boolean
  onOpenChange?: (open: boolean) => void
  defaultType?: 'task' | 'announcement'
  userGroups?: string[]
  triggerButtonText?: string
}

export function CreateItemDialog({ 
  onCreateItem, 
  open: controlledOpen, 
  onOpenChange, 
  defaultType = 'task',
  userGroups = [],
  triggerButtonText
}: CreateItemDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen
  const setOpen = onOpenChange || setInternalOpen
  
  const [showCloseConfirm, setShowCloseConfirm] = useState(false)
  
  const canCreateAnnouncement = userGroups.includes('Admin') || userGroups.includes('Moderators')
  const [type, setType] = useState<'task' | 'announcement'>(defaultType)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [attachments, setAttachments] = useState<FileAttachment[]>([])
  
  // Task-specific fields
  const [deadline, setDeadline] = useState('')
  const [subtasks, setSubtasks] = useState<SubTask[]>([])
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('')
  
  // Announcement-specific fields
  const [priority, setPriority] = useState<'normal' | 'high' | 'urgent'>('normal')
  const [expiresAt, setExpiresAt] = useState('')
  const [isPinned, setIsPinned] = useState(false)
  const [pinnedUntil, setPinnedUntil] = useState('')
  const [sendEmailNotification, setSendEmailNotification] = useState(true) // Default to true

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      // Reset all fields when dialog opens
      setType(defaultType)
      setTitle('')
      setContent('')
      setAttachments([])
      setDeadline('')
      setSubtasks([])
      setNewSubtaskTitle('')
      setPriority('normal')
      setExpiresAt('')
      setIsPinned(false)
      setPinnedUntil('')
      setSendEmailNotification(true)
    }
  }, [open, defaultType])

  // Check if form has any content
  const hasFormContent = () => {
    return title.trim() !== '' || 
           content.trim() !== '' || 
           attachments.length > 0 || 
           deadline !== '' || 
           subtasks.length > 0 || 
           expiresAt !== '' || 
           pinnedUntil !== ''
  }

  // Handle dialog close with confirmation if needed
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && hasFormContent()) {
      setShowCloseConfirm(true)
    } else {
      setOpen(newOpen)
    }
  }

  // Confirm close and discard changes
  const handleConfirmClose = () => {
    setShowCloseConfirm(false)
    setOpen(false)
  }

  // Cancel close confirmation
  const handleCancelClose = () => {
    setShowCloseConfirm(false)
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return

    // Check total number of files
    if (attachments.length + files.length > MAX_FILES) {
      toast.error(`Maximum ${MAX_FILES} files allowed`)
      return
    }

    const fileArray = Array.from(files)
    const currentTotalSize = attachments.reduce((sum, file) => sum + file.size, 0)
    const newTotalSize = fileArray.reduce((sum, file) => sum + file.size, 0)

    // Check total size
    if (currentTotalSize + newTotalSize > MAX_TOTAL_SIZE) {
      toast.error(`Total file size exceeds ${formatFileSize(MAX_TOTAL_SIZE)} limit`)
      return
    }

    fileArray.forEach((file) => {
      // Check individual file size
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`${file.name} exceeds ${formatFileSize(MAX_FILE_SIZE)} limit`)
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
            dataUrl: reader.result as string,
            file: file // Keep original file for upload
          }
        ])
      }
      reader.readAsDataURL(file)
    })

    // Clear input to allow re-uploading same file
    e.target.value = ''
  }

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index))
  }

  const addSubtask = () => {
    if (!newSubtaskTitle.trim()) {
      toast.error('Subtask title is required')
      return
    }
    const newSubtask: SubTask = {
      id: `st-${Date.now()}`,
      title: newSubtaskTitle.trim(),
      completed: false
    }
    setSubtasks((prev) => [...prev, newSubtask])
    setNewSubtaskTitle('')
  }

  const removeSubtask = (index: number) => {
    setSubtasks((prev) => prev.filter((_, i) => i !== index))
  }

  const uploadFilesToS3 = async (files: FileAttachment[]): Promise<FileAttachment[]> => {
    const idToken = localStorage.getItem('cognito_id_token')
    if (!idToken) {
      throw new Error('Authentication required')
    }

    const uploadedFiles: FileAttachment[] = []

    for (const fileAttachment of files) {
      if (!fileAttachment.file) {
        // If no file object (e.g., existing attachment), keep as is
        uploadedFiles.push(fileAttachment)
        continue
      }

      try {
        // Step 1: Get presigned URL
        const presignResponse = await fetch(`${API_URL}/uploads/presign`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': idToken,
          },
          body: JSON.stringify({
            fileName: fileAttachment.name,
            contentType: fileAttachment.type,
            fileSize: fileAttachment.size,
          }),
        })

        if (!presignResponse.ok) {
          throw new Error(`Failed to get upload URL: ${presignResponse.statusText}`)
        }

        const presignData = await presignResponse.json()
        const { upload } = presignData

        // Step 2: Upload file to S3
        const uploadResponse = await fetch(upload.url, {
          method: 'PUT',
          headers: {
            'Content-Type': fileAttachment.type,
          },
          body: fileAttachment.file,
        })

        if (!uploadResponse.ok) {
          throw new Error(`Failed to upload file: ${uploadResponse.statusText}`)
        }

        // Step 3: Store metadata with S3 key
        uploadedFiles.push({
          name: fileAttachment.name,
          size: fileAttachment.size,
          type: fileAttachment.type,
          key: upload.key,
          url: `https://${upload.bucket}.s3.ap-northeast-1.amazonaws.com/${upload.key}`,
        })
      } catch (error) {
        console.error(`Error uploading ${fileAttachment.name}:`, error)
        throw error
      }
    }

    return uploadedFiles
  }

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error('Title is required')
      return
    }

    // Validate dates for announcements
    if (type === 'announcement') {
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

    // Upload files to S3 first if there are attachments
    let uploadedAttachments: FileAttachment[] | undefined = undefined
    if (attachments.length > 0) {
      try {
        toast.loading('Uploading files...')
        uploadedAttachments = await uploadFilesToS3(attachments)
        toast.dismiss()
        toast.success('Files uploaded successfully')
      } catch (error) {
        toast.dismiss()
        toast.error('Failed to upload files')
        console.error('File upload error:', error)
        return
      }
    }

    let success = false
    if (type === 'task') {
      // Convert datetime-local to ISO UTC format
      let deadlineISO: string | undefined = undefined
      if (deadline) {
        // datetime-local format: YYYY-MM-DDTHH:mm (local time)
        // Convert to UTC ISO string
        const localDate = new Date(deadline)
        deadlineISO = localDate.toISOString()
      }
      
      success = await onCreateItem({
        type: 'task',
        title: title.trim(),
        content: content.trim(),
        deadline: deadlineISO,
        subtasks: subtasks.length > 0 ? subtasks : undefined,
        attachments: uploadedAttachments
      })
    } else {
      // Convert datetime-local to ISO UTC format
      let expiresAtISO: string | undefined = undefined
      let pinnedUntilISO: string | undefined = undefined
      
      if (expiresAt) {
        const localDate = new Date(expiresAt)
        expiresAtISO = localDate.toISOString()
      }
      
      if (pinnedUntil) {
        const localDate = new Date(pinnedUntil)
        pinnedUntilISO = localDate.toISOString()
      }
      
      const announcementData = {
        type: 'announcement' as const,
        title: title.trim(),
        content: content.trim(),
        priority,
        expiresAt: expiresAtISO,
        isPinned,
        pinnedUntil: pinnedUntilISO,
        sendEmailNotification, // Add this flag
        attachments: uploadedAttachments
      }
      console.log('CreateItemDialog - Creating announcement with data:', announcementData)
      success = await onCreateItem(announcementData)
    }

    // Only reset form and close dialog if creation was successful
    if (success) {
      setTitle('')
      setContent('')
      setAttachments([])
      setDeadline('')
      setSubtasks([])
      setNewSubtaskTitle('')
      setPriority('normal')
      setExpiresAt('')
      setIsPinned(false)
      setPinnedUntil('')
      setOpen(false)
    }
  }

  // Only use specific button text if explicitly provided via triggerButtonText
  // Otherwise use generic "New Item" for flexibility
  const buttonText = triggerButtonText || 'New Item'
  
  return (
    <>
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {controlledOpen === undefined && (
        <DialogTrigger asChild>
          <Button size="lg" className="gap-2">
            <Plus size={20} />
            {buttonText}
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Create New Item</DialogTitle>
          <DialogDescription>
            Add a new task or announcement to the board
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4 overflow-y-auto flex-1">
          <div className="space-y-2">
            <Label>Type</Label>
            <div className="flex gap-2">
              <Badge
                variant={type === 'task' ? 'default' : 'outline'}
                className="cursor-pointer px-4 py-2 transition-all duration-200"
                onClick={() => setType('task')}
              >
                Task
              </Badge>
              {canCreateAnnouncement && (
                <Badge
                  variant={type === 'announcement' ? 'default' : 'outline'}
                  className="cursor-pointer px-4 py-2 transition-all duration-200"
                  onClick={() => setType('announcement')}
                >
                  Announcement
                </Badge>
              )}
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

          {/* Task-specific fields */}
          {type === 'task' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="deadline" className="flex items-center gap-2">
                  <CalendarBlank size={16} />
                  Deadline (optional)
                </Label>
                <Input
                  id="deadline"
                  type="datetime-local"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  min={new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)}
                  className="cursor-pointer"
                />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <ListChecks size={16} />
                  Subtasks (optional)
                </Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add a subtask..."
                    value={newSubtaskTitle}
                    onChange={(e) => setNewSubtaskTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addSubtask()
                      }
                    }}
                  />
                  <Button type="button" onClick={addSubtask} size="icon" className="transition-transform">
                    <Plus size={16} />
                  </Button>
                </div>
                {subtasks.length > 0 && (
                  <div className="space-y-2 mt-2 max-h-48 overflow-y-auto pr-2">
                    {subtasks.map((subtask, index) => (
                      <div
                        key={subtask.id}
                        className="flex items-center gap-2 p-2 bg-muted rounded-md transition-all duration-200 hover:bg-muted/80"
                      >
                        <span className="text-sm flex-1">{subtask.title}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeSubtask(index)}
                          className="transition-transform hover:text-destructive"
                        >
                          <X size={16} />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Announcement-specific fields */}
          {type === 'announcement' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <Select value={priority} onValueChange={(value: 'normal' | 'high' | 'urgent') => setPriority(value)}>
                  <SelectTrigger id="priority">
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
                <Label htmlFor="expiresAt" className="flex items-center gap-2">
                  <CalendarBlank size={16} />
                  Expires At (optional)
                </Label>
                <Input
                  id="expiresAt"
                  type="datetime-local"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  min={new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)}
                  className="cursor-pointer"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="isPinned"
                    checked={isPinned}
                    onCheckedChange={(checked) => setIsPinned(checked as boolean)}
                  />
                  <label 
                    htmlFor="isPinned" 
                    className="flex items-center gap-2 text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    <PushPin size={16} weight="duotone" />
                    Pin this announcement to top banner
                  </label>
                </div>
              </div>

              {isPinned && (
                <div className="space-y-2">
                  <Label htmlFor="pinnedUntil" className="flex items-center gap-2">
                    <CalendarBlank size={16} />
                    Auto-unpin after (optional)
                  </Label>
                  <Input
                    id="pinnedUntil"
                    type="datetime-local"
                    value={pinnedUntil}
                    onChange={(e) => setPinnedUntil(e.target.value)}
                    disabled={!isPinned}
                    min={new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)}
                    max={expiresAt || undefined}
                    className="cursor-pointer"
                  />
                  <p className="text-xs text-muted-foreground">
                    Leave empty to pin indefinitely. Announcement will automatically unpin after this date.
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="sendEmailNotification"
                    checked={sendEmailNotification}
                    onCheckedChange={(checked) => setSendEmailNotification(checked as boolean)}
                  />
                  <label 
                    htmlFor="sendEmailNotification" 
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    📧 Send email notification to all members
                  </label>
                </div>
                <p className="text-xs text-muted-foreground ml-6">
                  Unchecking this will only post the announcement without sending emails
                </p>
              </div>
            </>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Attachments</Label>
              <p className="text-xs text-muted-foreground">
                Max {MAX_FILES} files, {formatFileSize(MAX_FILE_SIZE)} each, {formatFileSize(MAX_TOTAL_SIZE)} total
              </p>
            </div>
            <div className="space-y-2">
              <Input
                type="file"
                multiple
                onChange={handleFileUpload}
                className="cursor-pointer"
                disabled={attachments.length >= MAX_FILES}
              />
              {attachments.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground px-2">
                    <span>{attachments.length} / {MAX_FILES} files</span>
                    <span>
                      {formatFileSize(attachments.reduce((sum, f) => sum + f.size, 0))} / {formatFileSize(MAX_TOTAL_SIZE)}
                    </span>
                  </div>
                  {attachments.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 p-2 bg-muted rounded-md transition-all duration-200 hover:bg-muted/80"
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
                        className="transition-transform hover:scale-110 hover:text-destructive"
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
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <AlertDialog open={showCloseConfirm} onOpenChange={setShowCloseConfirm}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Discard changes?</AlertDialogTitle>
          <AlertDialogDescription>
            You have unsaved changes in the form. Are you sure you want to close and discard these changes?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancelClose}>Continue Editing</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirmClose}>Discard Changes</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  )
}
