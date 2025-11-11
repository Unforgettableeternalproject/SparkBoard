import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { useItems } from '@/hooks/use-items'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
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
  X,
  Archive
} from '@phosphor-icons/react'
import { formatDate } from '@/lib/helpers'
import { toast } from 'sonner'

export function ProfilePage() {
  const { user, idToken, refreshUser } = useAuth()
  const { items } = useItems(user)
  const [isEditing, setIsEditing] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [bio, setBio] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const API_URL = import.meta.env.VITE_API_URL

  useEffect(() => {
    if (user) {
      setName(user.name)
      setEmail(user.email)
      // Bio would come from user profile API in the future
      setBio('')
    }
  }, [user])

  // Debug: Log authentication state
  useEffect(() => {
    console.log('[ProfilePage] Auth state:', {
      hasUser: !!user,
      hasToken: !!idToken,
      tokenLength: idToken?.length,
      apiUrl: API_URL
    })
  }, [user, idToken, API_URL])

  // Calculate user statistics
  const stats = useMemo(() => {
    if (!user || !items) {
      return {
        tasksCreated: 0,
        tasksCompleted: 0,
        tasksActive: 0,
        tasksArchived: 0,
        announcementsCreated: 0,
        totalItems: 0
      }
    }

    const userItems = items.filter(item => item.userId === user.id)
    const tasks = userItems.filter(item => item.type === 'task')
    const completedTasks = tasks.filter(task => task.status === 'completed' && !task.archivedAt)
    const activeTasks = tasks.filter(task => task.status === 'active' && !task.archivedAt)
    const archivedTasks = tasks.filter(task => task.archivedAt)
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
      tasksArchived: archivedTasks.length,
      announcementsCreated: announcements.length,
      totalItems: userItems.length
    }
  }, [user, items])

  // Load user profile from backend
  useEffect(() => {
    const loadProfile = async () => {
      if (!user || !idToken || !API_URL) return

      try {
        const response = await fetch(`${API_URL}/auth/me`, {
          method: 'GET',
          headers: {
            'Authorization': idToken,
          },
        })

        if (response.ok) {
          const data = await response.json()
          console.log('[ProfilePage] Loaded profile:', data)
          if (data.user) {
            if (data.user.name) setName(data.user.name)
            if (data.user.email) setEmail(data.user.email)
            setBio(data.user.bio || '')
            setAvatarUrl(data.user.avatarUrl)
          }
        }
      } catch (error) {
        console.error('[ProfilePage] Failed to load profile:', error)
      }
    }

    loadProfile()
  }, [user, idToken, API_URL])

  // Sync local state with user object when it updates (from refreshUser)
  useEffect(() => {
    if (user) {
      if (user.avatarUrl && user.avatarUrl !== avatarUrl) {
        console.log('[ProfilePage] Syncing avatarUrl from user object:', user.avatarUrl)
        setAvatarUrl(user.avatarUrl)
      }
      if (user.name && user.name !== name) {
        console.log('[ProfilePage] Syncing name from user object:', user.name)
        setName(user.name)
      }
      if (user.email && user.email !== email) {
        console.log('[ProfilePage] Syncing email from user object:', user.email)
        setEmail(user.email)
      }
      if (user.bio !== undefined && user.bio !== bio) {
        console.log('[ProfilePage] Syncing bio from user object:', user.bio)
        setBio(user.bio)
      }
    }
  }, [user?.avatarUrl, user?.name, user?.email, user?.bio])

  const saveProfileToBackend = async (updates: { name?: string; email?: string; bio?: string; avatarUrl?: string }) => {
    if (!API_URL || !idToken) {
      throw new Error('API URL or token not available')
    }

    console.log('[ProfilePage] Saving profile updates:', updates)

    const response = await fetch(`${API_URL}/auth/me`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': idToken,
      },
      body: JSON.stringify(updates),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[ProfilePage] Failed to save profile:', response.status, errorText)
      throw new Error(`Failed to save profile: ${response.status}`)
    }

    const data = await response.json()
    console.log('[ProfilePage] Profile saved:', data)
    return data
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file')
      return
    }

    // Validate file size (max 5MB)
    const MAX_SIZE = 5 * 1024 * 1024
    if (file.size > MAX_SIZE) {
      toast.error('Image size must be less than 5MB')
      return
    }

    // Check if API URL is configured
    if (!API_URL) {
      console.error('[ProfilePage] API_URL not configured')
      toast.error('API URL not configured. Please check environment variables.')
      return
    }

    // Check if user is authenticated
    if (!idToken) {
      console.error('[ProfilePage] No authentication token available')
      toast.error('Please log in again to upload avatar')
      return
    }

    setIsUploadingAvatar(true)

    try {
      console.log('[ProfilePage] Requesting presigned URL for:', file.name)
      
      // Step 1: Get presigned URL
      const presignResponse = await fetch(`${API_URL}/uploads/presign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': idToken,
        },
        body: JSON.stringify({
          fileName: file.name,
          contentType: file.type,
          fileSize: file.size,
        }),
      })

      if (!presignResponse.ok) {
        const errorText = await presignResponse.text()
        console.error('[ProfilePage] Presign failed:', presignResponse.status, errorText)
        throw new Error(`Failed to get upload URL: ${presignResponse.status} ${errorText}`)
      }

      const presignData = await presignResponse.json()
      console.log('[ProfilePage] Presigned URL received:', presignData)

      if (!presignData.upload || !presignData.upload.url) {
        throw new Error('Invalid presign response: missing upload URL')
      }

      const { upload } = presignData

      // Step 2: Upload file to S3
      console.log('[ProfilePage] Uploading to S3:', upload.url)
      const uploadResponse = await fetch(upload.url, {
        method: 'PUT',
        headers: {
          'Content-Type': file.type,
        },
        body: file,
      })

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text()
        console.error('[ProfilePage] S3 upload failed:', uploadResponse.status, errorText)
        throw new Error(`Failed to upload file to S3: ${uploadResponse.status}`)
      }

      // Step 3: Generate public URL (construct from bucket and key)
      const awsRegion = import.meta.env.VITE_AWS_REGION || 'ap-northeast-1'
      const publicUrl = `https://${upload.bucket}.s3.${awsRegion}.amazonaws.com/${upload.key}`
      
      console.log('[ProfilePage] Upload successful, public URL:', publicUrl)
      setAvatarUrl(publicUrl)
      
      // Save avatar URL to user profile in backend
      console.log('[ProfilePage] Saving avatar URL to backend:', publicUrl)
      await saveProfileToBackend({ avatarUrl: publicUrl })
      console.log('[ProfilePage] Avatar URL saved to backend')
      
      // Refresh user data to update avatar in navbar
      console.log('[ProfilePage] Calling refreshUser, exists:', !!refreshUser)
      if (refreshUser) {
        console.log('[ProfilePage] About to call refreshUser()')
        const result = await refreshUser()
        console.log('[ProfilePage] refreshUser result:', result)
      } else {
        console.warn('[ProfilePage] refreshUser function not available')
      }
      
      toast.success('Avatar uploaded and saved successfully!')
    } catch (error) {
      console.error('[ProfilePage] Avatar upload error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to upload avatar'
      toast.error(errorMessage)
    } finally {
      setIsUploadingAvatar(false)
    }
  }

  const handleSave = async () => {
    try {
      // Validate name and email
      if (!name.trim()) {
        toast.error('Name cannot be empty')
        return
      }
      if (!email.trim()) {
        toast.error('Email cannot be empty')
        return
      }
      
      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(email)) {
        toast.error('Please enter a valid email address')
        return
      }

      // Save name, email, bio and avatar to backend
      const result = await saveProfileToBackend({ 
        name: name.trim(),
        email: email.trim(),
        bio: bio.trim(),
        ...(avatarUrl && { avatarUrl })
      })
      
      // Refresh user data to update navbar
      if (refreshUser) {
        await refreshUser()
      }
      
      // Show warning if email verification is needed
      if (result.warning) {
        toast.warning(result.warning)
      } else {
        toast.success('Profile updated successfully!')
      }
      
      setIsEditing(false)
    } catch (error) {
      console.error('[ProfilePage] Failed to save profile:', error)
      toast.error('Failed to save profile changes')
    }
  }

  const handleCancel = () => {
    if (user) {
      setName(user.name)
      setEmail(user.email)
      // Reload bio and avatar from current state
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
  const canCreateAnnouncement = user['cognito:groups']?.includes('Admin') || user['cognito:groups']?.includes('Moderators')
  
  // Try to get join date from profile createdAt, fallback to current date if not available
  const joinedDate = (user as any).createdAt 
    ? new Date((user as any).createdAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    : 'Recently joined'

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
                  {avatarUrl && <AvatarImage src={avatarUrl} alt={user.name} />}
                  <AvatarFallback className="text-2xl bg-primary text-primary-foreground">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                {isEditing && (
                  <>
                    <input
                      type="file"
                      id="avatar-upload"
                      accept="image/*"
                      className="hidden"
                      onChange={handleAvatarUpload}
                      disabled={isUploadingAvatar}
                    />
                    <Button
                      size="sm"
                      variant="secondary"
                      className="absolute bottom-0 right-0 h-8 w-8 rounded-full p-0 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => document.getElementById('avatar-upload')?.click()}
                      disabled={isUploadingAvatar}
                    >
                      {isUploadingAvatar ? (
                        <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
                      ) : (
                        <PencilSimple size={14} />
                      )}
                    </Button>
                  </>
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
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your.email@example.com"
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      Changing your email will require verification
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bio">Bio</Label>
                    <Textarea
                      id="bio"
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      placeholder="Tell us about yourself..."
                      rows={4}
                      maxLength={500}
                    />
                    <p className="text-xs text-muted-foreground text-right">
                      {bio.length}/500 characters
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-3">
                    <UserIcon size={20} className="text-muted-foreground" weight="duotone" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-muted-foreground">Name</p>
                      <p className="font-medium truncate">{name}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Envelope size={20} className="text-muted-foreground" weight="duotone" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-muted-foreground">Email</p>
                      <p className="font-medium truncate">{email}</p>
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
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
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
                    <Archive size={14} />
                    <span>Archived</span>
                  </div>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-warning">{stats.tasksArchived}</div>
              </CardContent>
            </Card>

            {canCreateAnnouncement && (
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
            )}
          </div>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Your latest items and contributions</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="all" className="w-full">
                <TabsList className={`grid w-full ${canCreateAnnouncement ? 'grid-cols-4' : 'grid-cols-3'}`}>
                  <TabsTrigger value="all">All</TabsTrigger>
                  <TabsTrigger value="tasks">Tasks</TabsTrigger>
                  <TabsTrigger value="archived">Archived</TabsTrigger>
                  {canCreateAnnouncement && <TabsTrigger value="announcements">Announcements</TabsTrigger>}
                </TabsList>

                <TabsContent value="all" className="space-y-4 mt-4">
                  {items
                    .filter(item => {
                      // Filter by user and exclude archived tasks
                      if (item.userId !== user.id) return false
                      if (item.type === 'task' && item.archivedAt) return false
                      return true
                    })
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
                  {items.filter(item => {
                    if (item.userId !== user.id) return false
                    if (item.type === 'task' && item.archivedAt) return false
                    return true
                  }).length === 0 && (
                    <p className="text-center text-muted-foreground py-8">No items yet</p>
                  )}
                </TabsContent>

                <TabsContent value="tasks" className="space-y-4 mt-4">
                  {items
                    .filter(item => item.userId === user.id && item.type === 'task' && !item.archivedAt)
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
                  {items.filter(item => item.userId === user.id && item.type === 'task' && !item.archivedAt).length === 0 && (
                    <p className="text-center text-muted-foreground py-8">No active tasks</p>
                  )}
                </TabsContent>

                <TabsContent value="archived" className="space-y-4 mt-4">
                  {items
                    .filter(item => item.userId === user.id && item.type === 'task' && item.archivedAt)
                    .slice(0, 10)
                    .map(item => {
                      if (item.type !== 'task') return null
                      return (
                        <div key={item.sk} className="flex items-start gap-3 p-3 rounded-lg border bg-muted/30">
                          <Archive size={20} className="mt-0.5 text-warning" weight="duotone" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{item.title}</p>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              {item.archiveStatus && (
                                <Badge 
                                  variant={
                                    item.archiveStatus === 'completed' ? 'default' : 
                                    item.archiveStatus === 'partial' ? 'secondary' : 
                                    item.archiveStatus === 'forced' ? 'outline' : 
                                    'destructive'
                                  }
                                  className="text-xs"
                                >
                                  {item.archiveStatus}
                                </Badge>
                              )}
                              <span className="text-xs text-muted-foreground">
                                Archived: {item.archivedAt ? formatDate(item.archivedAt) : 'N/A'}
                              </span>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  {items.filter(item => item.userId === user.id && item.type === 'task' && item.archivedAt).length === 0 && (
                    <p className="text-center text-muted-foreground py-8">No archived tasks</p>
                  )}
                </TabsContent>

                {canCreateAnnouncement && (
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
                )}
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
