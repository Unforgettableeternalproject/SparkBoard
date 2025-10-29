import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/use-auth'
import { SparkItem } from '@/lib/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Trash, NotePencil, MagnifyingGlass, ListChecks, Megaphone } from '@phosphor-icons/react'
import { formatDate } from '@/lib/helpers'
import { toast } from 'sonner'

export function AdminItemManagement() {
  const { idToken } = useAuth()
  const queryClient = useQueryClient()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedItem, setSelectedItem] = useState<SparkItem | null>(null)
  const [annotation, setAnnotation] = useState('')

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

  // Fetch all items
  const { data: itemsResponse, isLoading, error } = useQuery<{ items: SparkItem[] }>({
    queryKey: ['admin-items'],
    queryFn: async () => {
      const response = await fetch(`${API_URL}/items`, {
        headers: {
          Authorization: idToken || '',
        },
      })
      if (!response.ok) throw new Error('Failed to fetch items')
      return response.json()
    },
    enabled: !!idToken,
  })

  const items = itemsResponse?.items || []

  // Delete item mutation
  const deleteMutation = useMutation({
    mutationFn: async (item: SparkItem) => {
      // Extract just the ID part if SK is in format ITEM#id
      const skValue = item.sk.startsWith('ITEM#') ? item.sk.substring(5) : item.sk
      const response = await fetch(`${API_URL}/items/${encodeURIComponent(skValue)}`, {
        method: 'DELETE',
        headers: {
          Authorization: idToken || '',
        },
      })
      if (!response.ok) throw new Error('Failed to delete item')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-items'] })
      toast.success('Item deleted successfully')
    },
    onError: (error) => {
      toast.error(`Failed to delete item: ${error.message}`)
    },
  })

  // Add annotation mutation (for now, just log it - you can extend this to save to DB)
  const addAnnotation = (item: SparkItem, note: string) => {
    // TODO: Implement annotation storage in backend
    console.log('Adding annotation to item:', item.sk, 'Note:', note)
    toast.success('Annotation added (feature coming soon)')
    setSelectedItem(null)
    setAnnotation('')
  }

  const filteredItems = items.filter((item) => {
    const query = searchQuery.toLowerCase()
    return (
      item.title.toLowerCase().includes(query) ||
      item.content.toLowerCase().includes(query) ||
      item.userName.toLowerCase().includes(query)
    )
  })

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Item Management</CardTitle>
          <CardDescription>View, annotate, and manage user-created items</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search */}
          <div className="flex items-center gap-2">
            <MagnifyingGlass size={20} className="text-muted-foreground" />
            <Input
              placeholder="Search items by title, content, or author..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1"
            />
          </div>

          {/* Item List */}
          {isLoading && <p className="text-muted-foreground text-center py-8">Loading items...</p>}
          
          {error && (
            <p className="text-destructive text-center py-8">
              Error loading items: {error.message}
            </p>
          )}

          {filteredItems.length === 0 && !isLoading && !error && (
            <p className="text-muted-foreground text-center py-8">No items found</p>
          )}

          <div className="space-y-3">
            {filteredItems.map((item) => {
              const Icon = item.type === 'task' ? ListChecks : Megaphone
              
              return (
                <Card key={item.sk} className="border-l-4" style={{
                  borderLeftColor: item.type === 'task' ? 'hsl(var(--primary))' : 'hsl(var(--accent))'
                }}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <Icon size={20} className="mt-1 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-base mb-1">{item.title}</CardTitle>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                            <span>{item.userName}</span>
                            <span>•</span>
                            <span>{formatDate(item.createdAt)}</span>
                            <span>•</span>
                            <Badge variant="outline" className="text-xs">
                              {item.sk}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedItem(item)
                                setAnnotation('')
                              }}
                            >
                              <NotePencil size={16} />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Add Annotation</DialogTitle>
                              <DialogDescription>
                                Add an admin note to this item
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                              <div className="space-y-2">
                                <Label>Item</Label>
                                <p className="text-sm text-muted-foreground">{item.title}</p>
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="annotation">Annotation</Label>
                                <Textarea
                                  id="annotation"
                                  placeholder="Enter your admin note..."
                                  value={annotation}
                                  onChange={(e) => setAnnotation(e.target.value)}
                                  rows={4}
                                />
                              </div>
                            </div>
                            <DialogFooter>
                              <Button
                                onClick={() => {
                                  if (annotation.trim()) {
                                    addAnnotation(item, annotation)
                                  }
                                }}
                                disabled={!annotation.trim()}
                              >
                                Add Annotation
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="text-destructive">
                              <Trash size={16} />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Item</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete "{item.title}"? This action cannot be
                                undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteMutation.mutate(item)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </CardHeader>
                  {item.content && (
                    <CardContent className="pt-0">
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {item.content}
                      </p>
                    </CardContent>
                  )}
                </Card>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
