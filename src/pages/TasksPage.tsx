import { useState, useMemo } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { useItems } from '@/hooks/use-items'
import { useSearchParams } from 'react-router-dom'
import { CreateItemInput } from '@/lib/types'
import { ItemCard } from '@/components/ItemCard'
import { KanbanView } from '@/components/KanbanView'
import { CreateItemDialog } from '@/components/CreateItemDialog'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Plus, Kanban, List, X } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

export function TasksPage() {
  const { user } = useAuth()
  const { items, createItem, deleteItem, updateItem } = useItems(user)
  const [searchParams, setSearchParams] = useSearchParams()
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban')

  const activeFilter = searchParams.get('filter')

  // Filter only tasks (exclude archived by default)
  const tasks = items.filter((item) => item.type === 'task' && !item.archivedAt)

  // Apply quick filters
  const filteredTasks = useMemo(() => {
    if (!activeFilter) return tasks

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    switch (activeFilter) {
      case 'due-today':
        return tasks.filter(task => {
          if (!task.deadline) return false
          const deadline = new Date(task.deadline)
          deadline.setHours(0, 0, 0, 0)
          return deadline.getTime() === today.getTime()
        })
      
      case 'my-tasks':
        return tasks.filter(task => task.userId === user?.id)
      
      case 'overdue':
        return tasks.filter(task => {
          if (!task.deadline || task.status === 'completed') return false
          return new Date(task.deadline) < new Date()
        })
      
      default:
        return tasks
    }
  }, [tasks, activeFilter, user])

  // Separate active and completed tasks from filtered results
  const activeTasks = filteredTasks.filter((task) => task.status !== 'completed')
  const completedTasks = filteredTasks.filter((task) => task.status === 'completed')
  
  // Calculate statistics (from all tasks, not filtered)
  const overdueTasks = tasks.filter(task => {
    if (!task.deadline || task.status === 'completed') return false
    return new Date(task.deadline) < new Date()
  })

  const clearFilter = () => {
    setSearchParams({})
  }

  const getFilterLabel = (filter: string | null) => {
    switch (filter) {
      case 'due-today': return 'Due Today'
      case 'my-tasks': return 'My Tasks'
      case 'overdue': return 'Overdue'
      default: return null
    }
  }

  const handleCreateItem = async (input: CreateItemInput) => {
    await createItem(input)
    setIsCreateDialogOpen(false)
  }

  const handleDeleteItem = async (itemSk: string) => {
    await deleteItem(itemSk)
  }

  return (
    <div className="space-y-6">
      {/* Active Filter Badge */}
      {activeFilter && (
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-sm">
            Filtered by: {getFilterLabel(activeFilter)}
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilter}
            className="h-6"
          >
            <X size={14} className="mr-1" />
            Clear Filter
          </Button>
        </div>
      )}

      {/* Header with Stats */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Tasks</h1>
            <p className="text-muted-foreground mt-1">
              Manage your tasks and track progress
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* View Toggle */}
            <div className="flex items-center rounded-lg border bg-background p-1">
              <Button
                variant={viewMode === 'kanban' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('kanban')}
                className="h-8"
              >
                <Kanban size={16} className="mr-2" weight="duotone" />
                Kanban
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('list')}
                className="h-8"
              >
                <List size={16} className="mr-2" weight="duotone" />
                List
              </Button>
            </div>
            
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="mr-2" size={18} weight="bold" />
              New Task
            </Button>
          </div>
        </div>
        
        {/* Statistics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-lg border bg-card smooth-transition hover-lift">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Tasks</p>
                <p className="text-2xl font-bold mt-1">{tasks.length}</p>
              </div>
              <div className="p-3 rounded-full bg-primary/10">
                <List size={24} className="text-primary" weight="duotone" />
              </div>
            </div>
          </div>
          
          <div className="p-4 rounded-lg border bg-card smooth-transition hover-lift">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active</p>
                <p className="text-2xl font-bold mt-1">{activeTasks.length}</p>
              </div>
              <div className="p-3 rounded-full bg-info/10">
                <Kanban size={24} className="text-info" weight="duotone" />
              </div>
            </div>
          </div>
          
          <div className="p-4 rounded-lg border bg-card smooth-transition hover-lift">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Completed</p>
                <p className="text-2xl font-bold mt-1">{completedTasks.length}</p>
              </div>
              <div className="p-3 rounded-full bg-success/10">
                <Plus size={24} className="text-success" weight="duotone" />
              </div>
            </div>
          </div>
          
          <div className={cn(
            "p-4 rounded-lg border smooth-transition hover-lift",
            overdueTasks.length > 0 ? "bg-destructive/10 border-destructive/20" : "bg-card"
          )}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Overdue</p>
                <p className={cn(
                  "text-2xl font-bold mt-1",
                  overdueTasks.length > 0 && "text-destructive"
                )}>
                  {overdueTasks.length}
                </p>
              </div>
              <div className={cn(
                "p-3 rounded-full",
                overdueTasks.length > 0 ? "bg-destructive/20" : "bg-muted"
              )}>
                <Plus size={24} className={overdueTasks.length > 0 ? "text-destructive" : "text-muted-foreground"} weight="duotone" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* View Content */}
      {viewMode === 'kanban' ? (
        <KanbanView
          items={filteredTasks}
          currentUser={user!}
          onDelete={handleDeleteItem}
          onUpdate={updateItem}
        />
      ) : (
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
      )}

      <CreateItemDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onCreateItem={handleCreateItem}
        defaultType="task"
        userGroups={user?.['cognito:groups'] || []}
      />
    </div>
  )
}
