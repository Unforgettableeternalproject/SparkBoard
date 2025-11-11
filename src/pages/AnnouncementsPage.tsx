import { useState, useMemo } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { useItems } from '@/hooks/use-items'
import { SparkItem, CreateItemInput } from '@/lib/types'
import { ItemCard } from '@/components/ItemCard'
import { CreateItemDialog } from '@/components/CreateItemDialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, MegaphoneSimple } from '@phosphor-icons/react'

export function AnnouncementsPage() {
  const { user } = useAuth()
  const { items, createItem, deleteItem, updateItem } = useItems(user)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)

  // Filter only announcements
  const announcements = items.filter((item) => item.type === 'announcement')

  // Sort by priority: urgent > high > normal, then by creation date
  const sortedAnnouncements = useMemo(() => {
    const priorityOrder = { urgent: 0, high: 1, normal: 2 }
    
    return [...announcements].sort((a, b) => {
      const priorityA = a.priority || 'normal'
      const priorityB = b.priority || 'normal'
      
      // First sort by priority
      const priorityDiff = priorityOrder[priorityA] - priorityOrder[priorityB]
      if (priorityDiff !== 0) return priorityDiff
      
      // Then sort by creation date (newest first)
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })
  }, [announcements])

  // Separate by expiration status
  const activeAnnouncements = sortedAnnouncements.filter((item) => {
    if (!item.expiresAt) return true
    return new Date(item.expiresAt) > new Date()
  })

  const expiredAnnouncements = sortedAnnouncements.filter((item) => {
    if (!item.expiresAt) return false
    return new Date(item.expiresAt) <= new Date()
  })

  const handleCreateItem = async (input: CreateItemInput) => {
    await createItem(input)
    setIsCreateDialogOpen(false)
  }

  const handleDeleteItem = async (itemSk: string) => {
    await deleteItem(itemSk)
  }

  // Check if user can create announcements (moderator or admin)
  const canCreateAnnouncement = user?.['cognito:groups']?.some(
    (group) => group === 'Admin' || group === 'Moderators'
  )

  // Check if user can edit/delete announcements
  const canManageAnnouncements = canCreateAnnouncement

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <MegaphoneSimple size={32} weight="fill" />
            Announcements
          </h1>
          <p className="text-muted-foreground mt-1">
            Important updates and announcements
          </p>
        </div>
        {canCreateAnnouncement && (
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="mr-2" size={18} weight="bold" />
            New Announcement
          </Button>
        )}
      </div>

      {/* Priority Legend */}
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">Priority:</span>
        <Badge variant="destructive">Urgent</Badge>
        <Badge variant="default">High</Badge>
        <Badge variant="secondary">Normal</Badge>
      </div>

      {/* Active Announcements */}
      {activeAnnouncements.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Active Announcements</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {activeAnnouncements.map((announcement) => (
              <div key={announcement.sk} data-announcement-id={announcement.sk}>
                <ItemCard
                  item={announcement}
                  currentUser={user!}
                  onDelete={canManageAnnouncements ? handleDeleteItem : undefined}
                  onUpdate={canManageAnnouncements ? updateItem : undefined}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Expired Announcements */}
      {expiredAnnouncements.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-muted-foreground">
            Expired Announcements
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 opacity-60">
            {expiredAnnouncements.map((announcement) => (
              <div key={announcement.sk} data-announcement-id={announcement.sk}>
                <ItemCard
                  item={announcement}
                  currentUser={user!}
                  onDelete={canManageAnnouncements ? handleDeleteItem : undefined}
                  onUpdate={canManageAnnouncements ? updateItem : undefined}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {activeAnnouncements.length === 0 && expiredAnnouncements.length === 0 && (
        <div className="text-center py-12 border-2 border-dashed rounded-lg">
          <MegaphoneSimple size={48} className="mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">No announcements available</p>
          {canCreateAnnouncement && (
            <p className="text-sm text-muted-foreground mt-1">
              Create a new announcement to get started
            </p>
          )}
        </div>
      )}

      {canCreateAnnouncement && (
        <CreateItemDialog
          open={isCreateDialogOpen}
          onOpenChange={setIsCreateDialogOpen}
          onCreateItem={handleCreateItem}
          defaultType="announcement"
          userGroups={user?.['cognito:groups'] || []}
        />
      )}
    </div>
  )
}
