import { useState } from 'react'
import { SparkItem, User } from '@/lib/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { EditItemDialog } from '@/components/EditItemDialog'
import { MarkdownContent } from '@/components/MarkdownContent'
import { ListChecks, Megaphone, File, DownloadSimple, Image as ImageIcon, CalendarBlank, Warning, CheckCircle, Trash, PencilSimple, X, Note, Archive } from '@phosphor-icons/react'
import { formatDate, formatFileSize } from '@/lib/helpers'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

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
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [viewDialogOpen, setViewDialogOpen] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false)
  const [archivePreview, setArchivePreview] = useState<'aborted' | 'partial' | 'completed' | 'forced'>('completed')
  
  // Check permissions
  const isAdmin = currentUser['cognito:groups']?.includes('Admin')
  const isModerator = currentUser['cognito:groups']?.includes('Moderators')
  const isOwner = item.userId === currentUser.sub || item.userId === currentUser.id
  
  // For tasks:
  // - If never been in progress: show delete button (owner/mod/admin)
  // - If has been in progress: show archive button (owner/mod/admin)
  // - Admin always sees delete button
  // For announcements: moderators or admin can delete
  const canDelete = item.type === 'announcement' 
    ? (isAdmin || isModerator)
    : isAdmin || ((isOwner || isModerator) && !item.hasBeenInProgress)
  
  // Can archive if task has been in progress (has subtasks history)
  // Owner/moderator can archive tasks that have been in progress with normal statuses
  // Admin non-owners can only force archive (not normal archive)
  // Archive status will be calculated based on completion state:
  // - 'completed': all subtasks done
  // - 'partial': some subtasks done
  // - 'aborted': no subtasks done
  // - 'forced': admin forced archive
  const canArchive = item.type === 'task' && onUpdate && item.hasBeenInProgress && (isOwner || isModerator)
  
  // Admin can force archive any task (even without subtasks)
  // Non-owner admin can only force archive
  const canForceArchive = item.type === 'task' && onUpdate && isAdmin
  
  // Check if current user can edit this item
  // Tasks: owner, moderators, or admin can edit
  // Announcements: moderators or admin can edit
  const canEdit = onUpdate && (
    (item.type === 'task' && (
      item.userId === currentUser.sub || 
      item.userId === currentUser.id || 
      currentUser['cognito:groups']?.includes('Admin') ||
      currentUser['cognito:groups']?.includes('Moderators')
    )) ||
    (item.type === 'announcement' && (
      currentUser['cognito:groups']?.includes('Admin') || 
      currentUser['cognito:groups']?.includes('Moderators')
    ))
  )
  
  // Calculate archive status preview
  const calculateArchiveStatus = (forced: boolean = false): 'aborted' | 'partial' | 'completed' | 'forced' => {
    if (forced) return 'forced'
    
    const subtasks = item.type === 'task' ? item.subtasks : []
    if (!subtasks || subtasks.length === 0) {
      return item.status === 'completed' ? 'completed' : 'aborted'
    }
    
    const completedCount = subtasks.filter(st => st.completed).length
    if (completedCount === 0) return 'aborted'
    if (completedCount === subtasks.length) return 'completed'
    return 'partial'
  }
  
  const handleArchiveClick = (forced: boolean = false) => {
    const status = calculateArchiveStatus(forced)
    setArchivePreview(status)
    setArchiveDialogOpen(true)
  }
  
  const handleArchive = async (forced: boolean = false) => {
    if (!onUpdate || item.type !== 'task') return
    
    setIsUpdating(true)
    try {
      await onUpdate(item.sk, {
        archivedAt: new Date().toISOString(),
        forcedArchive: forced
      })
      toast.success('Task archived successfully')
      setArchiveDialogOpen(false)
    } catch (error) {
      console.error('Failed to archive task:', error)
      toast.error('Failed to archive task')
    } finally {
      setIsUpdating(false)
    }
  }
  
  // ✨ Enhanced subtask toggle with loading state and visual feedback
  const handleSubtaskToggle = async (subtaskId: string) => {
    if (!onUpdate || item.type !== 'task' || !item.subtasks) return
    
    setIsUpdating(true)
    const updatedSubtasks = item.subtasks.map(st => 
      st.id === subtaskId 
        ? { ...st, completed: !st.completed, completedAt: !st.completed ? new Date().toISOString() : undefined }
        : st
    )
    
    // Check if all subtasks are completed to update task status
    const allCompleted = updatedSubtasks.every(st => st.completed)
    const anyCompleted = updatedSubtasks.some(st => st.completed)
    
    // Determine new task status
    let newStatus: 'active' | 'completed' = 'active'
    if (allCompleted) {
      newStatus = 'completed'
    }
    
    try {
      await onUpdate(item.sk, { 
        subtasks: updatedSubtasks,
        status: newStatus,
        completedAt: allCompleted ? new Date().toISOString() : undefined
      })
    } catch (error) {
      console.error('Failed to update subtask:', error)
    } finally {
      setIsUpdating(false)
    }
  }
  
  return (
    <Card 
      className={cn(
        "smooth-transition hover-lift flex flex-col animate-slide-in-up",
        isUpdating && "opacity-60 pointer-events-none"
      )}
    >
      <CardHeader 
        className={cn(item.type === 'announcement' && "cursor-pointer")}
        onClick={(e) => {
          if (item.type === 'announcement') {
            // Only trigger if not clicking on buttons or badges
            const target = e.target as HTMLElement
            if (!target.closest('button') && !target.closest('[role="button"]')) {
              setViewDialogOpen(true)
            }
          }
        }}
      >
        <div className="flex items-start justify-between gap-2 sm:gap-4">
          <div className="flex items-start gap-2 sm:gap-3 flex-1 min-w-0">
            <div className="mt-1 flex-shrink-0 transition-transform duration-200 hover:scale-110">
              <Icon 
                size={24}
                weight="duotone"
                className={cn(
                  "transition-colors",
                  item.type === 'task' ? 'text-primary' : 'text-secondary'
                )} 
              />
            </div>
            <div className="flex-1 min-w-0">
              <CardTitle className="text-base sm:text-lg mb-1.5 break-words overflow-wrap-anywhere font-semibold">{item.title}</CardTitle>
              <div className="flex flex-col gap-1 text-xs">
                <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
                  <span className="truncate max-w-[100px] xs:max-w-[120px] sm:max-w-[200px] font-medium text-muted-foreground">{item.userName}</span>
                  <span className="text-muted-foreground shrink-0">•</span>
                  <time dateTime={item.createdAt} className="text-[10px] sm:text-xs text-muted-foreground shrink-0">{formatDate(item.createdAt)}</time>
                </div>
                <Badge 
                  variant="outline" 
                  className="text-[10px] font-mono w-fit cursor-pointer hover:bg-accent transition-colors group relative"
                  title={`${item.sk} (Click to copy)`}
                  onClick={(e) => {
                    e.stopPropagation()
                    navigator.clipboard.writeText(item.sk)
                    toast.success('ID copied to clipboard!')
                  }}
                >
                  <span className="block max-w-[120px] sm:max-w-[150px] truncate group-hover:max-w-none">
                    {item.sk.length > 20 ? `${item.sk.slice(0, 20)}...` : item.sk}
                  </span>
                </Badge>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-1 sm:gap-2 items-end flex-shrink-0">
            <div className="flex gap-1">
              {canEdit && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation()
                    setEditDialogOpen(true)
                  }}
                  disabled={isUpdating}
                  className="h-7 w-7 text-muted-foreground hover:text-primary smooth-transition hover:scale-110"
                  title={`Edit ${item.type}`}
                >
                  <PencilSimple size={14} weight="duotone" />
                </Button>
              )}
              {canArchive && !item.archivedAt && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleArchiveClick(false)
                  }}
                  disabled={isUpdating}
                  className="h-7 w-7 text-muted-foreground hover:text-warning smooth-transition hover:scale-110"
                  title="Archive task"
                >
                  <Archive size={14} weight="duotone" />
                </Button>
              )}
              {canDelete && onDelete && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation()
                    if (window.confirm(`Are you sure you want to delete "${item.title}"?`)) {
                      onDelete(item.sk)
                    }
                  }}
                  disabled={isUpdating}
                  className="h-7 w-7 text-muted-foreground hover:text-destructive smooth-transition hover:scale-110"
                  title={item.type === 'task' && item.hasBeenInProgress ? 'Cannot delete task that has been in progress' : 'Delete item'}
                >
                  <Trash size={14} weight="duotone" />
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
            {item.type === 'task' && item.archivedAt && (
              <Badge variant="outline" className="text-xs border-warning text-warning">
                <Archive size={10} className="mr-1" weight="fill" />
                Archived
              </Badge>
            )}
            {item.type === 'task' && item.archiveStatus && (
              <Badge 
                variant={
                  item.archiveStatus === 'completed' ? 'default' : 
                  item.archiveStatus === 'partial' ? 'secondary' : 
                  item.archiveStatus === 'forced' ? 'outline' : 
                  'destructive'
                }
                className="text-xs"
              >
                {item.archiveStatus}
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
        <CardContent 
          className={cn("space-y-3", item.type === 'announcement' && "cursor-pointer")}
          onClick={(e) => {
            if (item.type === 'announcement') {
              const target = e.target as HTMLElement
              if (!target.closest('button') && !target.closest('[role="button"]') && !target.closest('a')) {
                setViewDialogOpen(true)
              }
            }
          }}
        >
          {item.content && (
            <div className="text-sm text-foreground leading-relaxed break-words overflow-wrap-anywhere">
              <MarkdownContent content={item.content} />
            </div>
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
          
          {/* Admin Annotations */}
          {item.annotations && item.annotations.length > 0 && (
            <div className="space-y-2 p-3 bg-muted/50 rounded-lg border border-border">
              <div className="flex items-center gap-2">
                <Note size={16} weight="duotone" className="text-warning" />
                <p className="text-xs font-semibold">Admin Notes</p>
              </div>
              {item.annotations.map((annotation) => (
                <div key={annotation.id} className="space-y-1 pl-5">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-medium">{annotation.adminName}</p>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(annotation.createdAt)}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {annotation.content}
                  </p>
                </div>
              ))}
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
                  <div key={subtask.id} className="group flex items-start gap-2 text-sm px-2 py-1.5 -mx-2 rounded-md hover:bg-accent/5 smooth-transition">
                    <Checkbox 
                      checked={subtask.completed} 
                      disabled={!canEdit || !onUpdate || isUpdating}
                      onCheckedChange={() => handleSubtaskToggle(subtask.id)}
                      className={cn(
                        "mt-0.5 flex-shrink-0 smooth-transition",
                        canEdit && onUpdate && !isUpdating ? "cursor-pointer hover:scale-110" : "pointer-events-none"
                      )}
                    />
                    <span className={cn(
                      "break-words flex-1 smooth-transition",
                      subtask.completed && "line-through text-muted-foreground opacity-60"
                    )}>
                      {subtask.title}
                    </span>
                    {subtask.completed && subtask.completedAt && (
                      <span className="text-xs text-muted-foreground ml-auto shrink-0 opacity-0 group-hover:opacity-100 smooth-transition">
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

      {/* Edit Dialog */}
      {canEdit && (
        <EditItemDialog
          item={item}
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          onSave={async (itemSk, updates) => {
            await onUpdate!(itemSk, updates)
          }}
        />
      )}

      {/* View Announcement Dialog */}
      {item.type === 'announcement' && (
        <Dialog open={viewDialogOpen} onOpenChange={(open) => setViewDialogOpen(open)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <Megaphone size={24} weight="duotone" className="text-secondary" />
                <DialogTitle>{item.title}</DialogTitle>
              </div>
              <DialogDescription className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm">By {item.userName}</span>
                  <span>•</span>
                  <time className="text-sm">{formatDate(item.createdAt)}</time>
                  {item.priority && (
                    <>
                      <span>•</span>
                      <Badge variant={getPriorityColor(item.priority)}>{item.priority}</Badge>
                    </>
                  )}
                </div>
                {item.expiresAt && (
                  <div className="flex items-center gap-2 text-sm">
                    <CalendarBlank size={16} />
                    <span>Expires: {formatDate(item.expiresAt)}</span>
                  </div>
                )}
                {item.isPinned && (
                  <div className="flex items-center gap-2 text-sm text-primary">
                    <Note size={16} weight="fill" />
                    <span>Pinned announcement</span>
                    {item.pinnedUntil && <span>until {formatDate(item.pinnedUntil)}</span>}
                  </div>
                )}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {item.content && (
                <div className="text-sm break-words">
                  <MarkdownContent content={item.content} />
                </div>
              )}
              {item.attachments && item.attachments.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <File size={16} />
                    Attachments ({item.attachments.length})
                  </h4>
                  <div className="grid gap-2">
                    {item.attachments.map((file, idx) => (
                      <div key={idx} className="flex items-center gap-2 p-2 rounded border bg-card">
                        {isImageType(file.type) ? (
                          <ImageIcon size={16} className="text-muted-foreground" />
                        ) : (
                          <File size={16} className="text-muted-foreground" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate">{file.name}</p>
                          <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (isImageType(file.type)) {
                              setImagePreview(file.url)
                            } else {
                              window.open(file.url, '_blank')
                            }
                          }}
                          className="h-8 w-8"
                        >
                          <DownloadSimple size={16} />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Archive Confirmation Dialog */}
      {canArchive && (
        <Dialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <Archive size={24} weight="duotone" className="text-warning" />
                <DialogTitle>Archive Task</DialogTitle>
              </div>
              <DialogDescription>
                Are you sure you want to archive "{item.title}"?
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="p-4 rounded-lg border bg-muted/50">
                <p className="text-sm font-medium mb-2">Archive Status Preview:</p>
                <Badge 
                  variant={
                    archivePreview === 'completed' ? 'default' : 
                    archivePreview === 'partial' ? 'secondary' : 
                    archivePreview === 'forced' ? 'outline' : 
                    'destructive'
                  }
                  className="text-sm"
                >
                  {archivePreview.toUpperCase()}
                </Badge>
                <p className="text-xs text-muted-foreground mt-2">
                  {archivePreview === 'completed' && 'All subtasks completed'}
                  {archivePreview === 'partial' && 'Some subtasks completed'}
                  {archivePreview === 'aborted' && 'No subtasks completed'}
                  {archivePreview === 'forced' && 'Forced archive by admin'}
                </p>
              </div>
              
              {item.type === 'task' && item.subtasks && item.subtasks.length > 0 && (
                <div className="text-xs space-y-1">
                  <p className="font-medium">Completion Summary:</p>
                  <p className="text-muted-foreground">
                    {item.subtasks.filter(st => st.completed).length} of {item.subtasks.length} subtasks completed
                  </p>
                </div>
              )}
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                onClick={() => setArchiveDialogOpen(false)}
                disabled={isUpdating}
              >
                Cancel
              </Button>
              {canForceArchive && (
                <Button
                  variant="secondary"
                  onClick={() => handleArchive(true)}
                  disabled={isUpdating}
                >
                  Force Archive
                </Button>
              )}
              <Button
                variant="default"
                onClick={() => handleArchive(false)}
                disabled={isUpdating}
              >
                {isUpdating ? 'Archiving...' : 'Archive'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  )
}
