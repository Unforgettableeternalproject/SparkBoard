import { useState } from 'react'
import { SparkItem, User } from '@/lib/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ListChecks, Megaphone, File, DownloadSimple, Image as ImageIcon, CalendarBlank, Warning, CheckCircle, Trash, PencilSimple, X } from '@phosphor-icons/react'
import { formatDate, formatFileSize } from '@/lib/helpers'

interface ItemCardProps {
  item: SparkItem
  currentUser: User
  onDelete?: (itemSk: string) => void
  onUpdate?: (itemSk: string, updates: Partial<SparkItem>) => void
}

const isImageType = (type: string) => {
  return type.startsWith('image/')
}

const isDeadlineApproaching = (deadline?: string) => {
  if (!deadline) return false
  const deadlineDate = new Date(deadline)
  const now = new Date()
  const daysDiff = (deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  return daysDiff > 0 && daysDiff <= 3 // Within 3 days
}

const isOverdue = (deadline?: string) => {
  if (!deadline) return false
  return new Date(deadline) < new Date()
}

const getPriorityColor = (priority?: 'normal' | 'high' | 'urgent') => {
  switch (priority) {
    case 'urgent': return 'destructive'
    case 'high': return 'default'
    default: return 'secondary'
  }
}

export function ItemCard({ item, currentUser, onDelete, onUpdate }: ItemCardProps) {
  const Icon = item.type === 'task' ? ListChecks : Megaphone
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  
  // Check if current user can delete this item
  const canDelete = item.userId === currentUser.sub || 
                    currentUser['cognito:groups']?.includes('Admin')
  
  // Check if current user can edit this item (tasks only, owner or admin)
  const canEdit = item.type === 'task' && (item.userId === currentUser.sub || 
                  currentUser['cognito:groups']?.includes('Admin'))
  
  // Handle subtask toggle
  const handleSubtaskToggle = async (subtaskId: string) => {
    if (!onUpdate || !item.subtasks) return
    
    const updatedSubtasks = item.subtasks.map(st => 
      st.id === subtaskId 
        ? { ...st, completed: !st.completed, completedAt: !st.completed ? new Date().toISOString() : undefined }
        : st
    )
    
    await onUpdate(item.sk, { subtasks: updatedSubtasks })
  }
  
  return (
    <Card className="transition-all hover:shadow-lg hover:border-primary/20 flex flex-col">
      <CardHeader>
        <div className="flex items-start justify-between gap-2 sm:gap-4">
          <div className="flex items-start gap-2 sm:gap-3 flex-1 min-w-0">
            <div className="mt-1 flex-shrink-0">
              <Icon 
                size={24} 
                className={item.type === 'task' ? 'text-primary' : 'text-accent'} 
              />
            </div>
            <div className="flex-1 min-w-0">
              <CardTitle className="text-base sm:text-lg mb-1 break-words">{item.title}</CardTitle>
              <CardDescription className="text-xs flex items-center gap-1 sm:gap-2 flex-wrap">
                <span className="truncate max-w-[120px] sm:max-w-none">{item.userName}</span>
                <span className="hidden sm:inline">•</span>
                <span className="text-[10px] sm:text-xs">{formatDate(item.createdAt)}</span>
                <span className="hidden md:inline">•</span>
                <Badge variant="outline" className="text-[10px] sm:text-xs font-mono hidden md:inline-flex">
                  {item.sk}
                </Badge>
              </CardDescription>
            </div>
          </div>
          <div className="flex flex-col gap-1 sm:gap-2 items-end flex-shrink-0">
            <div className="flex gap-1">
              {canEdit && onUpdate && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {/* TODO: Open edit dialog */}}
                  className="h-7 w-7 text-muted-foreground hover:text-primary"
                  title="Edit task"
                >
                  <PencilSimple size={14} />
                </Button>
              )}
              {canDelete && onDelete && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onDelete(item.sk)}
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  title="Delete item"
                >
                  <Trash size={14} />
                </Button>
              )}
            </div>
            <Badge variant={item.type === 'task' ? 'default' : 'secondary'}>
              {item.type}
            </Badge>
            {item.type === 'task' && item.status && (
              <Badge variant={item.status === 'completed' ? 'outline' : 'secondary'} className="text-xs">
                {item.status}
              </Badge>
            )}
            {item.type === 'announcement' && item.priority && item.priority !== 'normal' && (
              <Badge variant={getPriorityColor(item.priority)} className="text-xs">
                {item.priority}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      
      {(item.content || (item.attachments && item.attachments.length > 0) || (item.type === 'task' && (item.subtasks?.length || item.deadline)) || (item.type === 'announcement' && item.expiresAt)) && (
        <CardContent className="space-y-3">
          {item.content && (
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap break-words">
              {item.content}
            </p>
          )}
          
          {/* Task-specific fields */}
          {item.type === 'task' && item.deadline && (
            <div className="flex items-center gap-2 text-sm flex-wrap">
              <CalendarBlank size={16} className="text-muted-foreground" />
              <span className="text-muted-foreground">Deadline:</span>
              <span className={isOverdue(item.deadline) ? 'text-destructive font-medium' : isDeadlineApproaching(item.deadline) ? 'text-yellow-600 dark:text-yellow-500 font-medium' : ''}>
                {formatDate(item.deadline)}
              </span>
              {isOverdue(item.deadline) && (
                <Badge variant="destructive" className="text-xs">
                  <Warning size={12} className="mr-1" />
                  Overdue
                </Badge>
              )}
              {isDeadlineApproaching(item.deadline) && !isOverdue(item.deadline) && (
                <Badge variant="outline" className="text-xs text-yellow-600 dark:text-yellow-500 border-yellow-600 dark:border-yellow-500">
                  <Warning size={12} className="mr-1" />
                  Due Soon
                </Badge>
              )}
            </div>
          )}
          
          {item.type === 'task' && item.subtasks && item.subtasks.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                <ListChecks size={14} />
                Subtasks ({item.subtasks.filter(st => st.completed).length}/{item.subtasks.length})
              </p>
              <div className="space-y-1.5">
                {item.subtasks.map((subtask) => (
                  <div key={subtask.id} className="flex items-start gap-2 text-sm">
                    <Checkbox 
                      checked={subtask.completed} 
                      disabled={!canEdit || !onUpdate}
                      onCheckedChange={() => handleSubtaskToggle(subtask.id)}
                      className={`mt-0.5 flex-shrink-0 ${canEdit && onUpdate ? 'cursor-pointer' : 'pointer-events-none'}`}
                    />
                    <span className={`break-words flex-1 ${subtask.completed ? 'line-through text-muted-foreground' : ''}`}>
                      {subtask.title}
                    </span>
                    {subtask.completed && subtask.completedAt && (
                      <span className="text-xs text-muted-foreground ml-auto">
                        <CheckCircle size={12} className="inline mr-1" />
                        {formatDate(subtask.completedAt)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Announcement-specific fields */}
          {item.type === 'announcement' && item.expiresAt && (
            <div className="flex items-center gap-2 text-sm flex-wrap">
              <CalendarBlank size={16} className="text-muted-foreground" />
              <span className="text-muted-foreground">Expires:</span>
              <span className={new Date(item.expiresAt) < new Date() ? 'text-muted-foreground line-through' : ''}>
                {formatDate(item.expiresAt)}
              </span>
              {new Date(item.expiresAt) < new Date() && (
                <Badge variant="outline" className="text-xs">
                  Expired
                </Badge>
              )}
            </div>
          )}
          
          {item.attachments && item.attachments.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Attachments:</p>
              <div className="space-y-3">
                {item.attachments.map((file, index) => (
                  <div key={index} className="space-y-2">
                    {isImageType(file.type) && (file.dataUrl || file.url) ? (
                      <div className="space-y-2">
                        <img
                          src={file.dataUrl || file.url}
                          alt={file.name}
                          className="max-w-full h-auto rounded-lg border border-border max-h-64 sm:max-h-96 object-contain cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() => setImagePreview(file.dataUrl || file.url || null)}
                        />
                        <div className="flex items-center justify-between px-2 sm:px-3 py-2 bg-muted rounded-md gap-2">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <ImageIcon size={16} className="text-muted-foreground flex-shrink-0" />
                            <span className="text-xs truncate">{file.name}</span>
                            <span className="text-xs text-muted-foreground flex-shrink-0 hidden sm:inline">
                              ({formatFileSize(file.size)})
                            </span>
                          </div>
                          {(file.dataUrl || file.url) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2"
                              asChild
                            >
                              <a
                                href={file.dataUrl || file.url}
                                download={file.name}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <DownloadSimple size={14} />
                              </a>
                            </Button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between px-3 py-2 bg-muted rounded-md">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <File size={16} className="text-muted-foreground flex-shrink-0" />
                          <span className="text-xs truncate">{file.name}</span>
                          <span className="text-xs text-muted-foreground flex-shrink-0">
                            ({formatFileSize(file.size)})
                          </span>
                        </div>
                        {(file.dataUrl || file.url) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2"
                            asChild
                          >
                            <a
                              href={file.dataUrl || file.url}
                              download={file.name}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <DownloadSimple size={14} />
                            </a>
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      )}
      
      {/* Image Preview Dialog */}
      <Dialog open={!!imagePreview} onOpenChange={(open) => !open && setImagePreview(null)}>
        <DialogContent className="max-w-4xl w-full p-0">
          <DialogHeader className="sr-only">
            <DialogTitle>Image Preview</DialogTitle>
            <DialogDescription>Full size image preview</DialogDescription>
          </DialogHeader>
          <div className="relative">
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 z-10 bg-background/80 hover:bg-background"
              onClick={() => setImagePreview(null)}
            >
              <X size={20} />
            </Button>
            {imagePreview && (
              <img
                src={imagePreview}
                alt="Preview"
                className="w-full h-auto max-h-[90vh] object-contain"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
