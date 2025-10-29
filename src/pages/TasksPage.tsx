import { useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { useItems } from '@/hooks/use-items'
import { SparkItem, CreateItemInput } from '@/lib/types'
import { ItemCard } from '@/components/ItemCard'
import { CreateItemDialog } from '@/components/CreateItemDialog'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Plus } from '@phosphor-icons/react'

export function TasksPage() {
  const { user } = useAuth()
  const { items, createItem, deleteItem, updateItem } = useItems(user)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)

  // Filter only tasks
  const tasks = items.filter((item) => item.type === 'task')

  // Separate active and completed tasks
  const activeTasks = tasks.filter((task) => task.status !== 'completed')
  const completedTasks = tasks.filter((task) => task.status === 'completed')

  const handleCreateItem = async (input: CreateItemInput) => {
    await createItem(input)
    setIsCreateDialogOpen(false)
  }

  const handleDeleteItem = async (itemSk: string) => {
    if (window.confirm('Are you sure you want to delete this task?')) {
      await deleteItem(itemSk)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tasks</h1>
          <p className="text-muted-foreground mt-1">
            Manage your tasks and track progress
          </p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="mr-2" size={18} weight="bold" />
          New Task
        </Button>
      </div>

      <Tabs defaultValue="active" className="w-full">
        <TabsList>
          <TabsTrigger value="active">
            Active ({activeTasks.length})
          </TabsTrigger>
          <TabsTrigger value="completed">
            Completed ({completedTasks.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-6">
          {activeTasks.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed rounded-lg">
              <p className="text-muted-foreground">No active tasks</p>
              <p className="text-sm text-muted-foreground mt-1">
                Create a new task to get started
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {activeTasks.map((task) => (
                <ItemCard
                  key={task.sk}
                  item={task}
                  currentUser={user!}
                  onDelete={handleDeleteItem}
                  onUpdate={updateItem}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="completed" className="mt-6">
          {completedTasks.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed rounded-lg">
              <p className="text-muted-foreground">No completed tasks</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {completedTasks.map((task) => (
                <ItemCard
                  key={task.sk}
                  item={task}
                  currentUser={user!}
                  onDelete={handleDeleteItem}
                  onUpdate={updateItem}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <CreateItemDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onCreateItem={handleCreateItem}
        defaultType="task"
      />
    </div>
  )
}
