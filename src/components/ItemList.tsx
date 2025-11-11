import { SparkItem, User, CreateItemInput } from '@/lib/types'
import { ItemCard } from './ItemCard'
import { CreateItemDialog } from './CreateItemDialog'
import { FileText } from '@phosphor-icons/react'

interface ItemListProps {
  items: SparkItem[]
  currentUser: User
  onCreateItem: (input: CreateItemInput) => void
  onDeleteItem: (itemSk: string) => void
  onUpdateItem: (itemSk: string, updates: Partial<SparkItem>) => void
}

export function ItemList({ items, currentUser, onCreateItem, onDeleteItem, onUpdateItem }: ItemListProps) {
  // Filter out archived tasks
  const activeItems = items.filter(item => {
    // Keep all announcements
    if (item.type === 'announcement') return true
    // Filter out archived tasks
    if (item.type === 'task' && item.archivedAt) return false
    return true
  })

  if (activeItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4">
        <div className="text-center space-y-4 max-w-md">
          <div className="flex justify-center">
            <div className="p-4 bg-muted rounded-full">
              <FileText size={48} className="text-muted-foreground" />
            </div>
          </div>
          <h3 className="text-xl font-semibold">No items yet</h3>
          <p className="text-sm text-muted-foreground">
            Create your first task or announcement to get started with SparkBoard
          </p>
          <CreateItemDialog onCreateItem={onCreateItem} userGroups={currentUser?.['cognito:groups'] || []} />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Items</h2>
          <p className="text-sm text-muted-foreground">
            {activeItems.length} {activeItems.length === 1 ? 'item' : 'items'} in your organization
          </p>
        </div>
        <CreateItemDialog onCreateItem={onCreateItem} userGroups={currentUser?.['cognito:groups'] || []} />
      </div>

      <div className="grid gap-4">
        {activeItems.map((item) => (
          <ItemCard 
            key={item.id} 
            item={item} 
            currentUser={currentUser}
            onDelete={onDeleteItem}
            onUpdate={onUpdateItem}
          />
        ))}
      </div>
    </div>
  )
}
