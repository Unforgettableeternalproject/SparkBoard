import { useState, useEffect } from 'react'
import { SparkItem, CreateItemInput } from '@/lib/types'
import { User } from '@/lib/types'
import { toast } from 'sonner'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export function useItems(user: User | null) {
  const [items, setItems] = useState<SparkItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  
  // Fetch items from API when user is authenticated
  useEffect(() => {
    if (!user) {
      setItems([])
      return
    }
    
    const fetchItems = async () => {
      setIsLoading(true)
      try {
        const idToken = localStorage.getItem('cognito_id_token')
        if (!idToken) {
          console.error('No ID token found')
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
        setItems(data.items || [])
      } catch (error) {
        console.error('Error fetching items:', error)
        toast.error('Failed to load items')
      } finally {
        setIsLoading(false)
      }
    }

    fetchItems()
  }, [user])
  
  const createItem = async (input: CreateItemInput) => {
    if (!user) return
    
    try {
      const idToken = localStorage.getItem('cognito_id_token')
      if (!idToken) {
        toast.error('Authentication required')
        return
      }

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
        }),
      })

      if (!response.ok) {
        throw new Error(`Failed to create item: ${response.statusText}`)
      }

      const data = await response.json()
      
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
        }),
      }
      
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
