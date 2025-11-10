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
  UserGroups?: string[]
}

export function UserManagement() {
  const { idToken } = useAuth()
  const queryClient = useQueryClient()
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const API_URL = import.meta.env.VITE_API_URL

  // Fetch users from Cognito (需要後端 API 支援)
  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await fetch(`${API_URL}/admin/users`, {
        headers: {
          Authorization: idToken || '',
        },
      })
      if (!response.ok) throw new Error('Failed to fetch users')
      return response.json() as Promise<CognitoUser[]>
    },
    enabled: !!idToken,
  })

  // Update user role
  const updateRoleMutation = useMutation({
    mutationFn: async ({ username, group }: { username: string; group: string }) => {
      const response = await fetch(`${API_URL}/admin/users/${username}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: idToken || '',
        },
        body: JSON.stringify({ group }),
      })
      if (!response.ok) throw new Error('Failed to update role')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success('User role updated successfully')
    },
    onError: (error) => {
      toast.error(`Failed to update role: ${error.message}`)
    },
  })

  // Ban/Unban user
  const toggleUserStatusMutation = useMutation({
    mutationFn: async ({ username, enable }: { username: string; enable: boolean }) => {
      const response = await fetch(`${API_URL}/admin/users/${username}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: idToken || '',
        },
        body: JSON.stringify({ enable }),
      })
      if (!response.ok) throw new Error('Failed to update user status')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success('User status updated successfully')
    },
    onError: (error) => {
      toast.error(`Failed to update status: ${error.message}`)
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
                <TableHead>Role</TableHead>
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
                  const currentGroup = user.UserGroups?.[0] || 'Users'

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
                        <Select
                          value={currentGroup}
                          onValueChange={(value) =>
                            updateRoleMutation.mutate({ username: user.Username, group: value })
                          }
                        >
                          <SelectTrigger className="w-[140px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Admin">
                              <div className="flex items-center gap-2">
                                <ShieldCheck size={14} />
                                Admin
                              </div>
                            </SelectItem>
                            <SelectItem value="Moderators">
                              <div className="flex items-center gap-2">
                                <ShieldCheck size={14} />
                                Moderators
                              </div>
                            </SelectItem>
                            <SelectItem value="Users">
                              <div className="flex items-center gap-2">
                                <UserCircle size={14} />
                                Users
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.Enabled ? 'default' : 'destructive'} className="text-xs">
                          {user.Enabled ? 'Active' : 'Disabled'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant={user.Enabled ? 'destructive' : 'default'}
                              size="sm"
                              disabled={updateRoleMutation.isPending || toggleUserStatusMutation.isPending}
                            >
                              {user.Enabled ? (
                                <>
                                  <Warning size={14} className="mr-1" />
                                  Ban
                                </>
                              ) : (
                                'Enable'
                              )}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                {user.Enabled ? 'Ban User?' : 'Enable User?'}
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                {user.Enabled
                                  ? `Are you sure you want to ban ${name}? They will not be able to access the system.`
                                  : `Are you sure you want to enable ${name}? They will regain access to the system.`}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() =>
                                  toggleUserStatusMutation.mutate({
                                    username: user.Username,
                                    enable: !user.Enabled,
                                  })
                                }
                              >
                                Confirm
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
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
