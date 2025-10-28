import { useKV } from '@github/spark/hooks'
import { SparkItem, CreateItemInput } from '@/lib/types'
import { User } from '@/lib/types'

export function useItems(user: User | null) {
  const [items, setItems] = useKV<SparkItem[]>('spark_items', [])
  
  const createItem = (input: CreateItemInput) => {
    if (!user) return
    
    const newItem: SparkItem = {
      id: `item-${Date.now()}`,
      pk: user.orgId,
      sk: `ITEM#${Date.now()}`,
      type: input.type,
      title: input.title,
      content: input.content,
      createdAt: new Date().toISOString(),
      userId: user.id,
      userName: user.name,
      attachments: input.attachments
    }
    
    setItems((current) => [newItem, ...(current || [])])
  }
  
  const deleteItem = (itemId: string) => {
    setItems((current) => (current || []).filter((item) => item.id !== itemId))
  }
  
  return {
    items,
    createItem,
    deleteItem
  }
}
