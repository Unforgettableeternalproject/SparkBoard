import { SparkItem, User } from '@/lib/types'
import { ItemCard } from './ItemCard'
import { cn } from '@/lib/utils'
import { Clock, Hourglass, CheckCircle } from '@phosphor-icons/react'

interface KanbanViewProps {
  items: SparkItem[]
  currentUser: User
  onDelete: (itemSk: string) => void
  onUpdate: (itemSk: string, updates: Partial<SparkItem>) => void
}

type TaskStatus = 'pending' | 'in-progress' | 'completed'

interface KanbanColumn {
  id: TaskStatus
  title: string
  icon: any
  color: string
  bgColor: string
}

const columns: KanbanColumn[] = [
  {
    id: 'pending',
    title: 'To Do',
    icon: Clock,
    color: 'text-muted-foreground',
    bgColor: 'bg-muted/50'
  },
  {
    id: 'in-progress',
    title: 'In Progress',
    icon: Hourglass,
    color: 'text-info',
    bgColor: 'bg-info/10'
  },
  {
    id: 'completed',
    title: 'Completed',
    icon: CheckCircle,
    color: 'text-success',
    bgColor: 'bg-success/10'
  }
]

export function KanbanView({ items, currentUser, onDelete, onUpdate }: KanbanViewProps) {
  // Group tasks by status
  const getTasksByStatus = (status: TaskStatus) => {
    return items.filter(item => {
      if (item.type !== 'task') return false
      
      // Map task status to kanban columns
      if (status === 'completed') {
        return item.status === 'completed'
      } else if (status === 'in-progress') {
        // For now, treat all active tasks as in-progress
        // Later we can add a separate in-progress status to the backend
        return false // Placeholder for future enhancement
      } else {
        // 'pending' includes all active (non-completed) tasks
        return item.status === 'active'
      }
    })
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
      {columns.map((column) => {
        const Icon = column.icon
        const columnTasks = getTasksByStatus(column.id)
        
        return (
          <div
            key={column.id}
            className="flex flex-col min-h-0"
          >
            {/* Column Header */}
            <div className={cn(
              "flex items-center justify-between p-4 rounded-t-lg border-b",
              column.bgColor
            )}>
              <div className="flex items-center gap-2">
                <Icon size={20} weight="duotone" className={column.color} />
                <h3 className="font-semibold text-sm">{column.title}</h3>
              </div>
              <div className={cn(
                "px-2.5 py-0.5 rounded-full text-xs font-medium",
                column.bgColor,
                column.color
              )}>
                {columnTasks.length}
              </div>
            </div>
            
            {/* Column Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-accent/5 rounded-b-lg border border-t-0 min-h-[400px]">
              {columnTasks.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
                  No tasks
                </div>
              ) : (
                columnTasks.map((task) => (
                  <div key={task.sk} className="animate-slide-in-up">
                    <ItemCard
                      item={task}
                      currentUser={currentUser}
                      onDelete={onDelete}
                      onUpdate={onUpdate}
                    />
                  </div>
                ))
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
