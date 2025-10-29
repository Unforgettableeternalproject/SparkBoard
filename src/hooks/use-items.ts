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
        }),
      })

      if (!response.ok) {
        throw new Error(`Failed to create item: ${response.statusText}`)
      }

      const data = await response.json()
      
      // Convert API response to SparkItem format
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

      const response = await fetch(`${API_URL}/items/${itemSk}`, {
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
  
  return {
    items,
    isLoading,
    createItem,
    deleteItem
  }
}
