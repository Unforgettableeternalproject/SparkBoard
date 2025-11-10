import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Shield, ChartBar, Table, Users } from '@phosphor-icons/react'
import { MonitoringDashboard } from './MonitoringDashboard'
import { AdminItemManagement } from '@/components/AdminItemManagement'
import { UserManagement } from '@/components/UserManagement'

export function AdminDashboard() {
  const { user } = useAuth()
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    if (user) {
      const groups = user['cognito:groups'] || []
      setIsAdmin(groups.includes('Admin'))
    }
  }, [user])

  if (!user) {
    return (
      <div className="container mx-auto p-6">
        <Alert>
          <Shield className="h-4 w-4" />
          <AlertTitle>Authentication Required</AlertTitle>
          <AlertDescription>Please log in to access the admin dashboard.</AlertDescription>
        </Alert>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive">
          <Shield className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>
            You need administrator privileges to access this dashboard.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
        <p className="text-muted-foreground">System monitoring and content management</p>
      </div>

      <Tabs defaultValue="monitoring" className="space-y-4">
        <TabsList>
          <TabsTrigger value="monitoring">
            <ChartBar className="mr-2" size={16} />
            Monitoring
          </TabsTrigger>
          <TabsTrigger value="items">
            <Table className="mr-2" size={16} />
            Item Management
          </TabsTrigger>
          <TabsTrigger value="users">
            <Users className="mr-2" size={16} />
            User Management
          </TabsTrigger>
        </TabsList>

        <TabsContent value="monitoring">
          <MonitoringDashboard />
        </TabsContent>

        <TabsContent value="items">
          <AdminItemManagement />
        </TabsContent>

        <TabsContent value="users">
          <UserManagement />
        </TabsContent>
      </Tabs>
    </div>
  )
}
