import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Megaphone, CalendarBlank, PushPin, File, DownloadSimple, Image as ImageIcon } from '@phosphor-icons/react'
import { Announcement } from '@/lib/types'
import { formatDate, formatFileSize } from '@/lib/helpers'

interface ItemDetailDialogProps {
  announcement: Announcement
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ItemDetailDialog({ announcement, open, onOpenChange }: ItemDetailDialogProps) {
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'destructive'
      case 'high':
        return 'default'
      default:
        return 'secondary'
    }
  }

  const isImageType = (type: string) => type.startsWith('image/')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Megaphone size={24} weight="duotone" className="text-secondary" />
            <DialogTitle>{announcement.title}</DialogTitle>
          </div>
          <DialogDescription className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm">By {announcement.userName}</span>
              <span>•</span>
              <time className="text-sm">{formatDate(announcement.createdAt)}</time>
              {announcement.priority && (
                <>
                  <span>•</span>
                  <Badge variant={getPriorityColor(announcement.priority)}>{announcement.priority}</Badge>
                </>
              )}
            </div>
            {announcement.expiresAt && (
              <div className="flex items-center gap-2 text-sm">
                <CalendarBlank size={16} />
                <span>Expires: {formatDate(announcement.expiresAt)}</span>
              </div>
            )}
            {announcement.isPinned && (
              <div className="flex items-center gap-2 text-sm text-primary">
                <PushPin size={16} weight="fill" />
                <span>Pinned announcement</span>
                {announcement.pinnedUntil && <span>until {formatDate(announcement.pinnedUntil)}</span>}
              </div>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {announcement.content && (
            <p className="text-sm whitespace-pre-wrap break-words">{announcement.content}</p>
          )}
          {announcement.attachments && announcement.attachments.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <File size={16} />
                Attachments ({announcement.attachments.length})
              </h4>
              <div className="grid gap-2">
                {announcement.attachments.map((file, idx) => (
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
                        window.open(file.url, '_blank')
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
  )
}
