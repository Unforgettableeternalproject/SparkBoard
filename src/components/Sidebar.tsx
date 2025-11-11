import { Link, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { 
  Table, 
  ListChecks, 
  MegaphoneSimple, 
  ChartBar,
  Funnel,
  CalendarBlank,
  CheckCircle,
  Clock,
  Warning
} from '@phosphor-icons/react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { SparkItem } from '@/lib/types'

interface SidebarProps {
  items?: SparkItem[]
  isAdmin?: boolean
  className?: string
}

export function Sidebar({ items = [], isAdmin = false, className }: SidebarProps) {
  const location = useLocation()
  
  // Calculate statistics (exclude archived tasks)
  const tasks = items.filter(item => item.type === 'task' && !item.archivedAt)
  const activeTasks = tasks.filter(task => task.type === 'task' && task.status !== 'completed')
  const completedTasks = tasks.filter(task => task.type === 'task' && task.status === 'completed')
  const overdueTasks = tasks.filter(task => {
    if (task.type !== 'task' || !task.deadline || task.status === 'completed') return false
    return new Date(task.deadline) < new Date()
  })
  // Only count non-expired announcements
  const announcements = items.filter(item => {
    if (item.type !== 'announcement') return false
    if (!item.expiresAt) return true
    return new Date(item.expiresAt) > new Date()
  })
  // Count active items (non-archived tasks + announcements)
  const activeItemsCount = tasks.length + announcements.length
  
  const navigation: Array<{
    name: string
    href: string
    icon: any
    count?: number
    current: boolean
  }> = [
    {
      name: 'All Items',
      href: '/',
      icon: Table,
      count: activeItemsCount,
      current: location.pathname === '/'
    },
    {
      name: 'Tasks',
      href: '/tasks',
      icon: ListChecks,
      count: tasks.length,
      current: location.pathname === '/tasks'
    },
    {
      name: 'Announcements',
      href: '/announcements',
      icon: MegaphoneSimple,
      count: announcements.length,
      current: location.pathname === '/announcements'
    }
  ]
  
  if (isAdmin) {
    navigation.push({
      name: 'Admin',
      href: '/admin',
      icon: ChartBar,
      current: location.pathname === '/admin'
    })
  }
  
  return (
    <aside className={cn("flex flex-col gap-6 p-4", className)}>
      {/* Navigation Links */}
      <nav className="space-y-1">
        <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Navigation
        </div>
        {navigation.map((item) => {
          const Icon = item.icon
          return (
            <Link
              key={item.name}
              to={item.href}
              className={cn(
                "flex items-center justify-between gap-3 px-3 py-2 text-sm font-medium rounded-lg smooth-transition",
                item.current
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <div className="flex items-center gap-3">
                <Icon size={18} weight={item.current ? "fill" : "regular"} />
                <span>{item.name}</span>
              </div>
              {item.count !== undefined && (
                <Badge 
                  variant={item.current ? "secondary" : "outline"}
                  className="min-w-[24px] justify-center"
                >
                  {item.count}
                </Badge>
              )}
            </Link>
          )
        })}
      </nav>
      
      <Separator />
      
      {/* Task Statistics */}
      <div className="space-y-3">
        <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Task Overview
        </div>
        
        <div className="space-y-2">
          <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-card border border-border">
            <div className="flex items-center gap-2 text-sm">
              <Clock size={16} className="text-info" weight="duotone" />
              <span className="text-foreground">Active</span>
            </div>
            <Badge variant="secondary">{activeTasks.length}</Badge>
          </div>
          
          <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-card border border-border">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle size={16} className="text-success" weight="duotone" />
              <span className="text-foreground">Completed</span>
            </div>
            <Badge variant="secondary">{completedTasks.length}</Badge>
          </div>
          
          {overdueTasks.length > 0 && (
            <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/20">
              <div className="flex items-center gap-2 text-sm">
                <Warning size={16} className="text-destructive" weight="duotone" />
                <span className="text-destructive font-medium">Overdue</span>
              </div>
              <Badge variant="destructive">{overdueTasks.length}</Badge>
            </div>
          )}
        </div>
      </div>
      
      <Separator />
      
      {/* Quick Filters */}
      <div className="space-y-3">
        <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Quick Filters
        </div>
        
        <div className="space-y-1">
          <Link to="/tasks?filter=due-today" className="block">
            <Button
              variant="ghost"
              className="w-full justify-start text-sm font-normal"
              size="sm"
            >
              <CalendarBlank size={16} className="mr-2" />
              Due Today
            </Button>
          </Link>
          
          <Link to="/tasks?filter=my-tasks" className="block">
            <Button
              variant="ghost"
              className="w-full justify-start text-sm font-normal"
              size="sm"
            >
              <Funnel size={16} className="mr-2" />
              My Tasks
            </Button>
          </Link>
          
          <Link to="/tasks?filter=overdue" className="block">
            <Button
              variant="ghost"
              className={cn(
                "w-full justify-start text-sm font-normal",
                overdueTasks.length > 0 && "text-destructive"
              )}
              size="sm"
            >
              <Warning size={16} className="mr-2" />
              Overdue
              {overdueTasks.length > 0 && (
                <Badge variant="destructive" className="ml-auto">{overdueTasks.length}</Badge>
              )}
            </Button>
          </Link>
        </div>
      </div>
    </aside>
  )
}
