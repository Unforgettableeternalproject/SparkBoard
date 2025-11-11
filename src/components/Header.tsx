import { User } from '@/lib/types'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import LogoImage from '@/assets/Logo.png'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { getAvatarColor } from '@/lib/avatar-utils'
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
  avatarVersion?: number
}

export function Header({ user, onLogout, items = [], avatarVersion = 0 }: HeaderProps) {
  const [isDark, setIsDark] = useState(() => {
    // Initialize from current DOM state
    return document.documentElement.classList.contains('dark')
  })
  
  useEffect(() => {
    // Sync with DOM state on mount (in case it was changed elsewhere)
    const currentIsDark = document.documentElement.classList.contains('dark')
    if (currentIsDark !== isDark) {
      setIsDark(currentIsDark)
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

  const avatarColor = getAvatarColor(user.id)

  const isAdmin = user['cognito:groups']?.includes('Admin') || false
  const isModerator = user['cognito:groups']?.includes('Moderators') || false

  return (
    <header className="border-b border-border bg-card sticky top-0 z-10">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity group">
              <img 
                src={LogoImage} 
                alt="SparkBoard Logo" 
                className="h-8 w-8 object-contain transition-transform group-hover:scale-110"
              />
              <h1 className="text-2xl font-semibold tracking-tight">SparkBoard</h1>
            </Link>
            <Badge variant="secondary" className="font-mono text-xs">
              {user.orgId}
            </Badge>
            {isAdmin && (
              <Badge variant="default" className="text-xs">
                Admin
              </Badge>
            )}
            {!isAdmin && isModerator && (
              <Badge variant="secondary" className="text-xs">
                Moderator
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
                  <Avatar key={avatarVersion}>
                    {user.avatarUrl && (
                      <AvatarImage 
                        src={user.avatarUrl} 
                        alt={user.name}
                      />
                    )}
                    <AvatarFallback className={`${avatarColor} text-white`}>
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
