import { useState, useEffect, useRef, useCallback } from 'react'
import { SparkItem, CreateItemInput } from '@/lib/types'
import { User } from '@/lib/types'
import { toast } from 'sonner'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'
const POLLING_INTERVAL = 120000 // 2 minutes (120 seconds)

export function useItems(user: User | null) {
  const [items, setItems] = useState<SparkItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const lastFetchTimeRef = useRef<number>(Date.now())
  
  // Fetch items from API
  const fetchItems = useCallback(async (silent = false) => {
    if (!user) {
      setItems([])
      return
    }
    
    if (!silent) setIsLoading(true)
    
    try {
      const idToken = localStorage.getItem('cognito_id_token')
      if (!idToken) {
        console.error('[use-items] No ID token found')
        return
      }

      const response = await fetch(`${API_URL}/items`, {
        headers: {
          'Authorization': idToken,
        },
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch items: ${response.statusText}`)
      }

      const data = await response.json()
      const newItems = data.items || []
      
      // Check if there are changes (for polling)
      if (silent && items.length > 0) {
        const hasChanges = 
          newItems.length !== items.length ||
          JSON.stringify(newItems.map((i: SparkItem) => i.sk).sort()) !== 
          JSON.stringify(items.map(i => i.sk).sort())
        
        if (hasChanges) {
          console.log('[use-items] Changes detected, updating items')
          toast.info('New updates loaded', {
            description: 'The content has been refreshed',
            duration: 3000,
          })
        }
      }
      
      setItems(newItems)
      lastFetchTimeRef.current = Date.now()
    } catch (error) {
      console.error('[use-items] Error fetching items:', error)
      if (!silent) {
        toast.error('Failed to load items')
      }
    } finally {
      if (!silent) setIsLoading(false)
    }
  }, [user, items])
  
  // Initial fetch and setup polling
  useEffect(() => {
    if (!user) {
      setItems([])
      // Clear polling interval if user logs out
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
        pollingIntervalRef.current = null
      }
      return
    }
    
    // Initial fetch
    fetchItems(false)
    
    // Setup polling interval
    console.log('[use-items] Setting up polling interval (30s)')
    pollingIntervalRef.current = setInterval(() => {
      console.log('[use-items] Polling for updates...')
      fetchItems(true)
    }, POLLING_INTERVAL)
    
    // Cleanup on unmount
    return () => {
      if (pollingIntervalRef.current) {
        console.log('[use-items] Clearing polling interval')
        clearInterval(pollingIntervalRef.current)
        pollingIntervalRef.current = null
      }
    }
  }, [user, fetchItems])
  
  const createItem = async (input: CreateItemInput) => {
    if (!user) return
    
    try {
      const idToken = localStorage.getItem('cognito_id_token')
      if (!idToken) {
        toast.error('Authentication required')
        return
      }

      console.log('use-items createItem - Sending to API:', input)
      const response = await fetch(`${API_URL}/items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': idToken,
        },
        body: JSON.stringify({
          title: input.title,
          content: input.content,
          type: input.type,
          attachments: input.attachments,
          // Task-specific fields
          subtasks: input.type === 'task' ? input.subtasks : undefined,
          deadline: input.type === 'task' ? input.deadline : undefined,
          // Announcement-specific fields
          priority: input.type === 'announcement' ? input.priority : undefined,
          expiresAt: input.type === 'announcement' ? input.expiresAt : undefined,
          isPinned: input.type === 'announcement' ? input.isPinned : undefined,
          pinnedUntil: input.type === 'announcement' ? input.pinnedUntil : undefined,
        }),
      })

      if (!response.ok) {
        throw new Error(`Failed to create item: ${response.statusText}`)
      }

      const data = await response.json()
      console.log('use-items createItem - API response:', data)
      
      // Convert API response to SparkItem format with all fields
      const newItem: SparkItem = {
        id: data.item.id || data.item.itemId,
        pk: data.item.pk || `ORG#${user.orgId}`,
        sk: data.item.sk || `ITEM#${data.item.itemId}`,
        type: data.item.type,
        title: data.item.title,
        content: data.item.content,
        createdAt: data.item.createdAt,
        userId: data.item.userId,
        userName: data.item.userName || data.item.username,
        attachments: data.item.attachments,
        // Task-specific fields
        ...(data.item.type === 'task' && {
          status: data.item.status,
          subtasks: data.item.subtasks,
          deadline: data.item.deadline,
          completedAt: data.item.completedAt,
        }),
        // Announcement-specific fields
        ...(data.item.type === 'announcement' && {
          priority: data.item.priority,
          expiresAt: data.item.expiresAt,
          isPinned: data.item.isPinned,
          pinnedUntil: data.item.pinnedUntil,
        }),
      }
      console.log('use-items createItem - Created newItem:', newItem)
      
      setItems((current) => [newItem, ...current])
      toast.success('Item created successfully')
    } catch (error) {
      console.error('Error creating item:', error)
      toast.error('Failed to create item')
    }
  }
  
  const deleteItem = async (itemSk: string) => {
    try {
      const idToken = localStorage.getItem('cognito_id_token')
      if (!idToken) {
        toast.error('Authentication required')
        return
      }

      // Extract just the ID part if SK is in format ITEM#id
      const skValue = itemSk.startsWith('ITEM#') ? itemSk.substring(5) : itemSk

      const response = await fetch(`${API_URL}/items/${encodeURIComponent(skValue)}`, {
        method: 'DELETE',
        headers: {
          'Authorization': idToken,
        },
      })

      if (!response.ok) {
        throw new Error(`Failed to delete item: ${response.statusText}`)
      }

      setItems((current) => current.filter((item) => item.sk !== itemSk))
      toast.success('Item deleted successfully')
    } catch (error) {
      console.error('Error deleting item:', error)
      toast.error('Failed to delete item')
    }
  }
  
  const updateItem = async (itemSk: string, updates: Partial<SparkItem>) => {
    try {
      const idToken = localStorage.getItem('cognito_id_token')
      if (!idToken) {
        toast.error('Authentication required')
        return
      }

      // Extract just the ID part if SK is in format ITEM#id
      const skValue = itemSk.startsWith('ITEM#') ? itemSk.substring(5) : itemSk

      const response = await fetch(`${API_URL}/items/${encodeURIComponent(skValue)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': idToken,
        },
        body: JSON.stringify(updates),
      })

      if (!response.ok) {
        throw new Error(`Failed to update item: ${response.statusText}`)
      }

      const data = await response.json()
      
      // Update local state with the updated item
      setItems((current) =>
        current.map((item) => {
          if (item.sk === itemSk) {
            // Merge the updates with existing item data
            return {
              ...item,
              ...updates,
              // Ensure updatedAt is set
              updatedAt: data.item?.updatedAt || new Date().toISOString()
            }
          }
          return item
        })
      )
      
      toast.success('Item updated successfully')
    } catch (error) {
      console.error('Error updating item:', error)
      toast.error('Failed to update item')
    }
  }
  
  return {
    items,
    isLoading,
    createItem,
    deleteItem,
    updateItem
  }
}
