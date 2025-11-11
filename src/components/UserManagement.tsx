import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/use-auth'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import { MagnifyingGlass, UserCircle, ShieldCheck, Warning } from '@phosphor-icons/react'
import { toast } from 'sonner'

interface CognitoUser {
  Username: string
  Attributes: Array<{ Name: string; Value: string }>
  UserStatus: string
  Enabled: boolean
  UserCreateDate: string
  Groups?: string[]
}

export function UserManagement() {
  const { idToken } = useAuth()
  const queryClient = useQueryClient()
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const API_URL = import.meta.env.VITE_API_URL

  // Fetch users from Cognito
  const { data: usersData, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      console.log('Fetching users from:', `${API_URL}/users`)
      const response = await fetch(`${API_URL}/users`, {
        headers: {
          Authorization: idToken || '',
        },
      })
      if (!response.ok) {
        const errorText = await response.text()
        console.error('Failed to fetch users:', response.status, errorText)
        throw new Error(`Failed to fetch users: ${response.status}`)
      }
      const data = await response.json()
      console.log('Users response:', data)
      return data.users as CognitoUser[]
    },
    enabled: !!idToken,
  })

  const users = usersData || []

  // Add user to group
  const addToGroupMutation = useMutation({
    mutationFn: async ({ username, groupName }: { username: string; groupName: string }) => {
      console.log('Adding user to group:', username, groupName)
      const response = await fetch(`${API_URL}/users/add-to-group`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: idToken || '',
        },
        body: JSON.stringify({ username, groupName }),
      })
      if (!response.ok) {
        const errorText = await response.text()
        console.error('Failed to add to group:', errorText)
        throw new Error('Failed to add user to group')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success('User added to group successfully')
    },
    onError: (error) => {
      toast.error(`Failed to add to group: ${error.message}`)
    },
  })

  // Remove user from group
  const removeFromGroupMutation = useMutation({
    mutationFn: async ({ username, groupName }: { username: string; groupName: string }) => {
      console.log('Removing user from group:', username, groupName)
      const response = await fetch(`${API_URL}/users/remove-from-group`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: idToken || '',
        },
        body: JSON.stringify({ username, groupName }),
      })
      if (!response.ok) {
        const errorText = await response.text()
        console.error('Failed to remove from group:', errorText)
        throw new Error('Failed to remove user from group')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success('User removed from group successfully')
    },
    onError: (error) => {
      toast.error(`Failed to remove from group: ${error.message}`)
    },
  })

  // Disable user
  const disableUserMutation = useMutation({
    mutationFn: async (username: string) => {
      console.log('Disabling user:', username)
      const response = await fetch(`${API_URL}/users/disable`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: idToken || '',
        },
        body: JSON.stringify({ username }),
      })
      if (!response.ok) {
        const errorText = await response.text()
        console.error('Failed to disable user:', errorText)
        throw new Error('Failed to disable user')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success('User disabled successfully')
    },
    onError: (error) => {
      toast.error(`Failed to disable user: ${error.message}`)
    },
  })

  // Enable user
  const enableUserMutation = useMutation({
    mutationFn: async (username: string) => {
      console.log('Enabling user:', username)
      const response = await fetch(`${API_URL}/users/enable`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: idToken || '',
        },
        body: JSON.stringify({ username }),
      })
      if (!response.ok) {
        const errorText = await response.text()
        console.error('Failed to enable user:', errorText)
        throw new Error('Failed to enable user')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success('User enabled successfully')
    },
    onError: (error) => {
      toast.error(`Failed to enable user: ${error.message}`)
    },
  })

  // Delete user
  const deleteUserMutation = useMutation({
    mutationFn: async (username: string) => {
      console.log('Deleting user:', username)
      const response = await fetch(`${API_URL}/users`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: idToken || '',
        },
        body: JSON.stringify({ username }),
      })
      if (!response.ok) {
        const errorText = await response.text()
        console.error('Failed to delete user:', errorText)
        throw new Error('Failed to delete user')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success('User deleted successfully')
    },
    onError: (error) => {
      toast.error(`Failed to delete user: ${error.message}`)
    },
  })

  const filteredUsers = users.filter((user) => {
    const email = user.Attributes.find((attr) => attr.Name === 'email')?.Value || ''
    const name = user.Attributes.find((attr) => attr.Name === 'name')?.Value || ''
    const matchesSearch =
      email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.Username.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'enabled' && user.Enabled) ||
      (statusFilter === 'disabled' && !user.Enabled)

    return matchesSearch && matchesStatus
  })

  const getRoleColor = (group?: string) => {
    switch (group) {
      case 'Admin':
        return 'default'
      case 'Moderators':
        return 'secondary'
      default:
        return 'outline'
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>User Management</CardTitle>
          <CardDescription>Loading users...</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>User Management</CardTitle>
        <CardDescription>Manage user roles and permissions</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <Input
              placeholder="Search by name, email, or username..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Users</SelectItem>
              <SelectItem value="enabled">Enabled</SelectItem>
              <SelectItem value="disabled">Disabled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Users Table */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Groups</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No users found
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((user) => {
                  const email = user.Attributes.find((attr) => attr.Name === 'email')?.Value || ''
                  const name = user.Attributes.find((attr) => attr.Name === 'name')?.Value || user.Username
                  const userGroups = user.Groups || []
                  const primaryGroup = userGroups[0] || 'Users'

                  return (
                    <TableRow key={user.Username}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <UserCircle size={24} weight="duotone" className="text-muted-foreground" />
                          <div>
                            <p className="font-medium">{name}</p>
                            <p className="text-xs text-muted-foreground">{user.Username}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{email}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {userGroups.length > 0 ? (
                            userGroups.map((group) => (
                              <Badge key={group} variant={getRoleColor(group)} className="text-xs">
                                {group}
                              </Badge>
                            ))
                          ) : (
                            <Badge variant="outline" className="text-xs">
                              None
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.Enabled ? 'default' : 'destructive'} className="text-xs">
                          {user.Enabled ? 'Active' : 'Disabled'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end flex-wrap">
                          {/* Add to Group */}
                          <Select
                            value=""
                            onValueChange={(groupName) => {
                              if (groupName) {
                                addToGroupMutation.mutate({ username: user.Username, groupName })
                              }
                            }}
                            disabled={addToGroupMutation.isPending || removeFromGroupMutation.isPending}
                          >
                            <SelectTrigger className="w-[100px] h-8 text-xs">
                              <SelectValue placeholder="Add to..." />
                            </SelectTrigger>
                            <SelectContent>
                              {!userGroups.includes('Admin') && (
                                <SelectItem value="Admin">
                                  <div className="flex items-center gap-2">
                                    <ShieldCheck size={12} />
                                    Admin
                                  </div>
                                </SelectItem>
                              )}
                              {!userGroups.includes('Moderators') && (
                                <SelectItem value="Moderators">
                                  <div className="flex items-center gap-2">
                                    <ShieldCheck size={12} />
                                    Moderators
                                  </div>
                                </SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                          
                          {/* Remove from Group */}
                          {userGroups.length > 0 && (
                            <Select
                              value=""
                              onValueChange={(groupName) => {
                                if (groupName) {
                                  removeFromGroupMutation.mutate({ username: user.Username, groupName })
                                }
                              }}
                              disabled={addToGroupMutation.isPending || removeFromGroupMutation.isPending}
                            >
                              <SelectTrigger className="w-[120px] h-8 text-xs">
                                <SelectValue placeholder="Remove..." />
                              </SelectTrigger>
                              <SelectContent>
                                {userGroups.map((group) => (
                                  <SelectItem key={group} value={group}>
                                    Remove {group}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}

                          {/* Enable/Disable User */}
                          <Button
                            variant={user.Enabled ? 'outline' : 'default'}
                            size="sm"
                            className="h-8 text-xs"
                            onClick={() => {
                              if (user.Enabled) {
                                if (confirm(`Are you sure you want to disable ${name}?`)) {
                                  disableUserMutation.mutate(user.Username)
                                }
                              } else {
                                enableUserMutation.mutate(user.Username)
                              }
                            }}
                            disabled={disableUserMutation.isPending || enableUserMutation.isPending}
                          >
                            {user.Enabled ? 'Disable' : 'Enable'}
                          </Button>

                          {/* Delete User (only if disabled) */}
                          {!user.Enabled && (
                            <Button
                              variant="destructive"
                              size="sm"
                              className="h-8 text-xs"
                              onClick={() => {
                                if (confirm(`Are you sure you want to permanently delete ${name}? This action cannot be undone.`)) {
                                  deleteUserMutation.mutate(user.Username)
                                }
                              }}
                              disabled={deleteUserMutation.isPending}
                            >
                              Delete
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>

        <div className="text-sm text-muted-foreground">
          Showing {filteredUsers.length} of {users.length} users
        </div>
      </CardContent>
    </Card>
  )
}
