import { useState, useEffect } from 'react'
import { SparkItem } from '@/lib/types'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { X, MegaphoneSimple, Warning, Info } from '@phosphor-icons/react'
import { formatDate } from '@/lib/helpers'

interface AnnouncementBannerProps {
  announcements: SparkItem[]
}

export function AnnouncementBanner({ announcements }: AnnouncementBannerProps) {
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set())
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<SparkItem | null>(null)

  // Load dismissed announcements from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('dismissed-announcements')
      if (stored) {
        setDismissedIds(new Set(JSON.parse(stored)))
      }
    } catch (error) {
      console.error('Failed to load dismissed announcements:', error)
    }
  }, [])

  // Get the latest high/urgent priority announcement that hasn't been dismissed
  const latestImportantAnnouncement = announcements
    .filter((item) => item.type === 'announcement')
    .filter((item) => item.priority === 'high' || item.priority === 'urgent')
    .filter((item) => {
      // Filter out expired announcements
      if (item.expiresAt) {
        return new Date(item.expiresAt) > new Date()
      }
      return true
    })
    .filter((item) => !dismissedIds.has(item.sk))
    .sort((a, b) => {
      // Sort by priority (urgent > high) then by creation date
      const priorityOrder = { urgent: 0, high: 1, normal: 2 }
      const priorityA = a.priority || 'normal'
      const priorityB = b.priority || 'normal'
      const priorityDiff = priorityOrder[priorityA] - priorityOrder[priorityB]
      if (priorityDiff !== 0) return priorityDiff
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })[0]

  if (!latestImportantAnnouncement) {
    return null
  }

  const handleDismiss = (announcementSk: string) => {
    const newDismissed = new Set(dismissedIds)
    newDismissed.add(announcementSk)
    setDismissedIds(newDismissed)
    
    // Save to localStorage
    try {
      localStorage.setItem('dismissed-announcements', JSON.stringify([...newDismissed]))
    } catch (error) {
      console.error('Failed to save dismissed announcement:', error)
    }
  }

  const handleOpenDetails = (announcement: SparkItem) => {
    setSelectedAnnouncement(announcement)
  }

  const isUrgent = latestImportantAnnouncement.priority === 'urgent'
  const Icon = isUrgent ? Warning : Info

  return (
    <>
      <div className="border-b bg-muted/30">
        <div className="container mx-auto px-4 py-3">
          <Alert 
            variant={isUrgent ? 'destructive' : 'default'}
            className="relative pr-12"
          >
            <Icon className="h-4 w-4" />
            <AlertTitle className="flex items-center gap-2">
              <MegaphoneSimple size={16} weight="fill" />
              {latestImportantAnnouncement.title}
              <Badge 
                variant={isUrgent ? 'destructive' : 'default'} 
                className="ml-2 text-xs"
              >
                {latestImportantAnnouncement.priority}
              </Badge>
            </AlertTitle>
            <AlertDescription className="mt-2">
              <p className="line-clamp-2">{latestImportantAnnouncement.content}</p>
              <div className="flex items-center gap-4 mt-2">
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => handleOpenDetails(latestImportantAnnouncement)}
                  className="h-auto p-0 text-xs"
                >
                  View full announcement
                </Button>
                <span className="text-xs text-muted-foreground">
                  Posted by {latestImportantAnnouncement.userName} • {formatDate(latestImportantAnnouncement.createdAt)}
                </span>
              </div>
            </AlertDescription>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleDismiss(latestImportantAnnouncement.sk)}
              className="absolute right-2 top-2 h-6 w-6 rounded-full"
            >
              <X size={14} />
            </Button>
          </Alert>
        </div>
      </div>

      {/* Full announcement dialog */}
      <Dialog open={!!selectedAnnouncement} onOpenChange={(open) => !open && setSelectedAnnouncement(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <MegaphoneSimple size={24} weight="fill" />
              <DialogTitle>{selectedAnnouncement?.title}</DialogTitle>
              {selectedAnnouncement?.type === 'announcement' && selectedAnnouncement?.priority && (
                <Badge 
                  variant={selectedAnnouncement.priority === 'urgent' ? 'destructive' : 'default'}
                >
                  {selectedAnnouncement.priority}
                </Badge>
              )}
            </div>
            <DialogDescription>
              Posted by {selectedAnnouncement?.userName} on {selectedAnnouncement && formatDate(selectedAnnouncement.createdAt)}
              {selectedAnnouncement?.type === 'announcement' && selectedAnnouncement?.expiresAt && (
                <span className="ml-2">
                  • Expires {formatDate(selectedAnnouncement.expiresAt)}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          
          <div className="mt-4 space-y-4">
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <p className="whitespace-pre-wrap">{selectedAnnouncement?.content}</p>
            </div>
            
            {selectedAnnouncement?.attachments && selectedAnnouncement.attachments.length > 0 && (
              <div className="border-t pt-4">
                <p className="text-sm font-medium mb-2">Attachments ({selectedAnnouncement.attachments.length})</p>
                <div className="space-y-2">
                  {selectedAnnouncement.attachments.map((file, index) => (
                    <div key={index} className="flex items-center gap-2 text-sm">
                      <Badge variant="outline">{file.type}</Badge>
                      <span>{file.name}</span>
                      <span className="text-muted-foreground text-xs">({file.size} bytes)</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
