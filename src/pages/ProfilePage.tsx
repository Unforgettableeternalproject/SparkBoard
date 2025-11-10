import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { useItems } from '@/hooks/use-items'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  User as UserIcon,
  Envelope,
  Buildings,
  Calendar,
  ListChecks,
  CheckCircle,
  MegaphoneSimple,
  PencilSimple,
  FloppyDisk,
  X
} from '@phosphor-icons/react'
import { formatDate } from '@/lib/helpers'
import { toast } from 'sonner'

export function ProfilePage() {
  const { user } = useAuth()
  const { items } = useItems(user)
  const [isEditing, setIsEditing] = useState(false)
  const [name, setName] = useState('')
  const [bio, setBio] = useState('')

  useEffect(() => {
    if (user) {
      setName(user.name)
      // Bio would come from user profile API in the future
      setBio('')
    }
  }, [user])

  // Calculate user statistics
  const stats = useMemo(() => {
    if (!user || !items) {
      return {
        tasksCreated: 0,
        tasksCompleted: 0,
        tasksActive: 0,
        announcementsCreated: 0,
        totalItems: 0
      }
    }

    const userItems = items.filter(item => item.userId === user.id)
    const tasks = userItems.filter(item => item.type === 'task')
    const completedTasks = tasks.filter(task => task.status === 'completed')
    const activeTasks = tasks.filter(task => task.status === 'active')
    const announcements = userItems.filter(item => item.type === 'announcement')

    // Debug: Log statistics calculation
    console.log('[ProfilePage] Stats calculation:', {
      userId: user.id,
      totalItemsInOrg: items.length,
      userItems: userItems.length,
      tasks: tasks.length,
      completedTasks: completedTasks.length,
      activeTasks: activeTasks.length,
      announcements: announcements.length
    })

    return {
      tasksCreated: tasks.length,
      tasksCompleted: completedTasks.length,
      tasksActive: activeTasks.length,
      announcementsCreated: announcements.length,
      totalItems: userItems.length
    }
  }, [user, items])

  const handleSave = () => {
    // TODO: Implement profile update API
    toast.success('Profile updated (API integration pending)')
    setIsEditing(false)
  }

  const handleCancel = () => {
    if (user) {
      setName(user.name)
      setBio('')
    }
    setIsEditing(false)
  }

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>Please log in to view your profile</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  const initials = user.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const userRole = user['cognito:groups']?.[0] || 'Users'
  const joinedDate = new Date(user.id).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Profile</h1>
          <p className="text-muted-foreground mt-1">Manage your account and view your activity</p>
        </div>
        {!isEditing && (
          <Button onClick={() => setIsEditing(true)}>
            <PencilSimple size={18} className="mr-2" weight="duotone" />
            Edit Profile
          </Button>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Profile Card */}
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>Account Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Avatar */}
            <div className="flex flex-col items-center space-y-4">
              <div className="relative group">
                <Avatar className="h-24 w-24">
                  <AvatarFallback className="text-2xl bg-primary text-primary-foreground">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                {isEditing && (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="absolute bottom-0 right-0 h-8 w-8 rounded-full p-0 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => toast.info('Avatar upload coming soon!')}
                  >
                    <PencilSimple size={14} />
                  </Button>
                )}
              </div>
              <div className="text-center">
                <Badge variant={userRole === 'Admin' ? 'default' : userRole === 'Moderators' ? 'secondary' : 'outline'}>
                  {userRole}
                </Badge>
              </div>
            </div>

            <Separator />

            {/* Info Fields */}
            <div className="space-y-4">
              {isEditing ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bio">Bio</Label>
                    <Textarea
                      id="bio"
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      placeholder="Tell us about yourself..."
                      rows={4}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-3">
                    <UserIcon size={20} className="text-muted-foreground" weight="duotone" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-muted-foreground">Name</p>
                      <p className="font-medium truncate">{user.name}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Envelope size={20} className="text-muted-foreground" weight="duotone" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-muted-foreground">Email</p>
                      <p className="font-medium truncate">{user.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Buildings size={20} className="text-muted-foreground" weight="duotone" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-muted-foreground">Organization</p>
                      <p className="font-medium truncate">{user.orgId}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Calendar size={20} className="text-muted-foreground" weight="duotone" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-muted-foreground">Member Since</p>
                      <p className="font-medium">{joinedDate}</p>
                    </div>
                  </div>

                  {bio && (
                    <>
                      <Separator />
                      <div>
                        <p className="text-sm text-muted-foreground mb-2">Bio</p>
                        <p className="text-sm whitespace-pre-wrap">{bio}</p>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>

            {isEditing && (
              <>
                <Separator />
                <div className="flex gap-2">
                  <Button onClick={handleSave} className="flex-1">
                    <FloppyDisk size={18} className="mr-2" weight="duotone" />
                    Save
                  </Button>
                  <Button onClick={handleCancel} variant="outline" className="flex-1">
                    <X size={18} className="mr-2" />
                    Cancel
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Statistics and Activity */}
        <div className="md:col-span-2 space-y-6">
          {/* Statistics Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Items</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalItems}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>
                  <div className="flex items-center gap-1">
                    <ListChecks size={14} />
                    <span>Tasks Created</span>
                  </div>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.tasksCreated}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>
                  <div className="flex items-center gap-1">
                    <CheckCircle size={14} />
                    <span>Completed</span>
                  </div>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-success">{stats.tasksCompleted}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>
                  <div className="flex items-center gap-1">
                    <MegaphoneSimple size={14} />
                    <span>Announcements</span>
                  </div>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.announcementsCreated}</div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Your latest items and contributions</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="all" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="all">All</TabsTrigger>
                  <TabsTrigger value="tasks">Tasks</TabsTrigger>
                  <TabsTrigger value="announcements">Announcements</TabsTrigger>
                </TabsList>

                <TabsContent value="all" className="space-y-4 mt-4">
                  {items
                    .filter(item => item.userId === user.id)
                    .slice(0, 5)
                    .map(item => {
                      const Icon = item.type === 'task' ? ListChecks : MegaphoneSimple
                      return (
                        <div key={item.sk} className="flex items-start gap-3 p-3 rounded-lg border">
                          <Icon size={20} className="mt-0.5" weight="duotone" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{item.title}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-xs">
                                {item.type}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {formatDate(item.createdAt)}
                              </span>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  {items.filter(item => item.userId === user.id).length === 0 && (
                    <p className="text-center text-muted-foreground py-8">No items yet</p>
                  )}
                </TabsContent>

                <TabsContent value="tasks" className="space-y-4 mt-4">
                  {items
                    .filter(item => item.userId === user.id && item.type === 'task')
                    .slice(0, 5)
                    .map(item => {
                      if (item.type !== 'task') return null
                      return (
                        <div key={item.sk} className="flex items-start gap-3 p-3 rounded-lg border">
                          <ListChecks size={20} className="mt-0.5" weight="duotone" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{item.title}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant={item.status === 'completed' ? 'default' : 'secondary'} className="text-xs">
                                {item.status}
                              </Badge>
                            <span className="text-xs text-muted-foreground">
                              {formatDate(item.createdAt)}
                            </span>
                          </div>
                        </div>
                      </div>
                      )
                    })}
                  {items.filter(item => item.userId === user.id && item.type === 'task').length === 0 && (
                    <p className="text-center text-muted-foreground py-8">No tasks yet</p>
                  )}
                </TabsContent>

                <TabsContent value="announcements" className="space-y-4 mt-4">
                  {items
                    .filter(item => item.userId === user.id && item.type === 'announcement')
                    .slice(0, 5)
                    .map(item => {
                      if (item.type !== 'announcement') return null
                      return (
                        <div key={item.sk} className="flex items-start gap-3 p-3 rounded-lg border">
                          <MegaphoneSimple size={20} className="mt-0.5" weight="duotone" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{item.title}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                            {item.priority && (
                              <Badge 
                                variant={item.priority === 'urgent' ? 'destructive' : item.priority === 'high' ? 'default' : 'secondary'}
                                className="text-xs"
                              >
                                {item.priority}
                              </Badge>
                            )}
                            <span className="text-xs text-muted-foreground">
                              {formatDate(item.createdAt)}
                            </span>
                          </div>
                        </div>
                      </div>
                      )
                    })}
                  {items.filter(item => item.userId === user.id && item.type === 'announcement').length === 0 && (
                    <p className="text-center text-muted-foreground py-8">No announcements yet</p>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
