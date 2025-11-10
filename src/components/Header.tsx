import { User } from '@/lib/types'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Sidebar } from './Sidebar'
import { SignOut, User as UserIcon, ChartBar, Table, ListChecks, MegaphoneSimple, Moon, Sun, List as ListIcon } from '@phosphor-icons/react'
import { useState, useEffect } from 'react'
import { SparkItem } from '@/lib/types'

interface HeaderProps {
  user: User
  onLogout: () => void
  items?: SparkItem[]
}

export function Header({ user, onLogout, items = [] }: HeaderProps) {
  const [isDark, setIsDark] = useState(false)
  
  useEffect(() => {
    // Check for saved theme preference or default to light mode
    const savedTheme = localStorage.getItem('theme')
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const shouldBeDark = savedTheme === 'dark' || (!savedTheme && prefersDark)
    
    setIsDark(shouldBeDark)
    if (shouldBeDark) {
      document.documentElement.classList.add('dark')
    }
  }, [])
  
  const toggleTheme = () => {
    const newIsDark = !isDark
    setIsDark(newIsDark)
    
    if (newIsDark) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }
  
  const initials = user.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const isAdmin = user['cognito:groups']?.includes('Admin') || false

  return (
    <header className="border-b border-border bg-card sticky top-0 z-10">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-semibold tracking-tight">SparkBoard</h1>
            <Badge variant="secondary" className="font-mono text-xs">
              {user.orgId}
            </Badge>
            {isAdmin && (
              <Badge variant="default" className="text-xs">
                Admin
              </Badge>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {/* Mobile Sidebar Toggle */}
            <Sheet>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="lg:hidden smooth-transition"
                >
                  <ListIcon size={20} weight="duotone" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 p-0">
                <SheetHeader className="px-4 py-6 border-b">
                  <SheetTitle>Navigation</SheetTitle>
                </SheetHeader>
                <Sidebar 
                  items={items} 
                  isAdmin={isAdmin}
                />
              </SheetContent>
            </Sheet>
            
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="smooth-transition"
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {isDark ? <Sun size={18} weight="duotone" /> : <Moon size={18} weight="duotone" />}
            </Button>
            
            <div className="flex gap-1 mr-2">
              <Button
                variant="ghost"
                size="sm"
                asChild
              >
                <Link to="/">
                  <Table className="mr-2" size={16} />
                  All
                </Link>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                asChild
              >
                <Link to="/tasks">
                  <ListChecks className="mr-2" size={16} />
                  Tasks
                </Link>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                asChild
              >
                <Link to="/announcements">
                  <MegaphoneSimple className="mr-2" size={16} />
                  Announcements
                </Link>
              </Button>
              {isAdmin && (
                <Button
                  variant="ghost"
                  size="sm"
                  asChild
                >
                  <Link to="/admin">
                    <ChartBar className="mr-2" size={16} />
                    Admin
                  </Link>
                </Button>
              )}
            </div>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full">
                  <Avatar>
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col gap-1">
                    <p className="text-sm font-medium">{user.name}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/profile" className="cursor-pointer">
                    <UserIcon className="mr-2" size={16} />
                    Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onLogout} className="text-destructive focus:text-destructive">
                  <SignOut className="mr-2" size={16} />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  )
}
