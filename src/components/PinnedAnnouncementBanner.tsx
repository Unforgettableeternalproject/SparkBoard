import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { SparkItem, Announcement } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PushPin, X } from '@phosphor-icons/react'
import { formatDate } from '@/lib/helpers'
import { cn } from '@/lib/utils'

interface PinnedAnnouncementBannerProps {
  announcements: SparkItem[]
}

export function PinnedAnnouncementBanner({ announcements }: PinnedAnnouncementBannerProps) {
  const navigate = useNavigate()
  const [currentIndex, setCurrentIndex] = useState(0)
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => {
    const stored = localStorage.getItem('dismissedPinnedAnnouncements')
    return stored ? new Set(JSON.parse(stored)) : new Set()
  })

  // Filter for pinned, non-expired, non-dismissed announcements
  const pinnedAnnouncements = announcements
    .filter((item): item is Announcement => item.type === 'announcement')
    .filter((item) => item.isPinned)
    .filter((item) => {
      // Check if pinnedUntil has passed
      if (item.pinnedUntil) {
        return new Date(item.pinnedUntil) > new Date()
      }
      return true
    })
    .filter((item) => {
      // Check if announcement has expired
      if (item.expiresAt) {
        return new Date(item.expiresAt) > new Date()
      }
      return true
    })
    .filter((item) => !dismissedIds.has(item.sk))
    .sort((a, b) => {
      // Sort by priority then creation date
      const priorityOrder = { urgent: 0, high: 1, normal: 2 }
      const priorityA = a.priority || 'normal'
      const priorityB = b.priority || 'normal'
      const priorityDiff = priorityOrder[priorityA] - priorityOrder[priorityB]
      if (priorityDiff !== 0) return priorityDiff
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })

  // Auto-rotate announcements every 5 seconds
  useEffect(() => {
    if (pinnedAnnouncements.length <= 1) {
      console.log('[PinnedBanner] No rotation needed, count:', pinnedAnnouncements.length)
      return
    }

    console.log('[PinnedBanner] Starting rotation for', pinnedAnnouncements.length, 'announcements')
    const interval = setInterval(() => {
      setCurrentIndex((prev) => {
        const next = (prev + 1) % pinnedAnnouncements.length
        console.log('[PinnedBanner] Rotating from', prev, 'to', next)
        return next
      })
    }, 5000)

    return () => {
      console.log('[PinnedBanner] Stopping rotation')
      clearInterval(interval)
    }
  }, [pinnedAnnouncements.length])

  // Reset index when announcements change
  useEffect(() => {
    console.log('[PinnedBanner] Resetting index, announcements count:', pinnedAnnouncements.length)
    setCurrentIndex(0)
  }, [pinnedAnnouncements.length])

  const handleDismiss = (itemSk: string) => {
    const newDismissed = new Set(dismissedIds)
    newDismissed.add(itemSk)
    setDismissedIds(newDismissed)
    localStorage.setItem('dismissedPinnedAnnouncements', JSON.stringify([...newDismissed]))
  }

  const handleClick = (announcement: Announcement) => {
    // Navigate to announcements page with the specific announcement in view
    navigate('/announcements')
    // Scroll to the announcement after navigation (small delay to ensure page is loaded)
    setTimeout(() => {
      const element = document.querySelector(`[data-announcement-id="${announcement.sk}"]`)
      element?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 100)
  }

  if (pinnedAnnouncements.length === 0) {
    console.log('[PinnedBanner] No pinned announcements to display')
    return null
  }

  const currentAnnouncement = pinnedAnnouncements[currentIndex]
  console.log('[PinnedBanner] Displaying announcement', currentIndex + 1, 'of', pinnedAnnouncements.length, ':', currentAnnouncement.title)

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'urgent':
        return 'destructive'
      case 'high':
        return 'default'
      default:
        return 'secondary'
    }
  }

  return (
    <div className="border-b bg-card/50 animate-fade-in">
      <div className="container mx-auto px-4">
        <div 
          className="relative w-full border rounded-none py-2.5 px-4 cursor-pointer hover:bg-accent/50 transition-colors bg-card"
          onClick={() => handleClick(currentAnnouncement)}
        >
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <PushPin size={16} weight="fill" className="text-primary flex-shrink-0" />
              
              <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
                <Badge variant={getPriorityColor(currentAnnouncement.priority)} className="flex-shrink-0">
                  {currentAnnouncement.priority || 'normal'}
                </Badge>
                
                <span className="font-medium truncate flex-1 min-w-0 text-sm">
                  {currentAnnouncement.title}
                </span>
              </div>

              <div className="flex items-center gap-2 text-xs text-muted-foreground flex-shrink-0">
                {currentAnnouncement.pinnedUntil && (
                  <span className="hidden sm:inline">
                    Until {formatDate(currentAnnouncement.pinnedUntil)}
                  </span>
                )}
                
                {pinnedAnnouncements.length > 1 && (
                  <Badge variant="outline" className="text-xs">
                    {currentIndex + 1} / {pinnedAnnouncements.length}
                  </Badge>
                )}
              </div>
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 flex-shrink-0"
              onClick={(e) => {
                e.stopPropagation()
                handleDismiss(currentAnnouncement.sk)
              }}
            >
              <X size={14} />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
