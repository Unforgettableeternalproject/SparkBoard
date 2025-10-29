import { SparkItem } from '@/lib/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { ListChecks, Megaphone, File, DownloadSimple, Image as ImageIcon, CalendarBlank, Warning, CheckCircle } from '@phosphor-icons/react'
import { formatDate, formatFileSize } from '@/lib/helpers'

interface ItemCardProps {
  item: SparkItem
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

export function ItemCard({ item }: ItemCardProps) {
  const Icon = item.type === 'task' ? ListChecks : Megaphone
  
  return (
    <Card className="transition-all hover:shadow-lg hover:border-primary/20">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="mt-1">
              <Icon 
                size={24} 
                className={item.type === 'task' ? 'text-primary' : 'text-accent'} 
              />
            </div>
            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg mb-1 truncate">{item.title}</CardTitle>
              <CardDescription className="text-xs flex items-center gap-2 flex-wrap">
                <span>{item.userName}</span>
                <span>•</span>
                <span>{formatDate(item.createdAt)}</span>
                <span>•</span>
                <Badge variant="outline" className="text-xs font-mono">
                  {item.sk}
                </Badge>
              </CardDescription>
            </div>
          </div>
          <div className="flex flex-col gap-2 items-end">
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
            <p className="text-sm text-foreground leading-relaxed">
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
                  <div key={subtask.id} className="flex items-center gap-2 text-sm">
                    <Checkbox 
                      checked={subtask.completed} 
                      disabled
                      className="pointer-events-none"
                    />
                    <span className={subtask.completed ? 'line-through text-muted-foreground' : ''}>
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
                          className="max-w-full h-auto rounded-lg border border-border max-h-96 object-contain"
                        />
                        <div className="flex items-center justify-between px-3 py-2 bg-muted rounded-md">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <ImageIcon size={16} className="text-muted-foreground flex-shrink-0" />
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
    </Card>
  )
}
