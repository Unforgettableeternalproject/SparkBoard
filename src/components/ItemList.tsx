import { SparkItem } from '@/lib/types'
import { ItemCard } from './ItemCard'
import { CreateItemDialog } from './CreateItemDialog'
import { CreateItemInput } from '@/lib/types'
import { FileText } from '@phosphor-icons/react'

interface ItemListProps {
  items: SparkItem[]
  onCreateItem: (input: CreateItemInput) => void
}

export function ItemList({ items, onCreateItem }: ItemListProps) {
  if (items.length === 0) {
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
          <CreateItemDialog onCreateItem={onCreateItem} />
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
            {items.length} {items.length === 1 ? 'item' : 'items'} in your organization
          </p>
        </div>
        <CreateItemDialog onCreateItem={onCreateItem} />
      </div>

      <div className="grid gap-4">
        {items.map((item) => (
          <ItemCard key={item.id} item={item} />
        ))}
      </div>
    </div>
  )
}
