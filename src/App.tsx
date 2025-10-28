import { useEffect } from 'react'
import { useAuth } from './hooks/use-auth'
import { useItems } from './hooks/use-items'
import { LoginForm } from './components/LoginForm'
import { Header } from './components/Header'
import { ItemList } from './components/ItemList'
import { Toaster } from './components/ui/sonner'
import { toast } from 'sonner'

function App() {
  const { user, isAuthenticated, isLoading, login, logout, loginWithHostedUI, handleOAuthCallback } = useAuth()
  const { items, createItem } = useItems(user)

  // Handle OAuth callback on mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const code = urlParams.get('code')
    
    if (code) {
      handleOAuthCallback(code).then((success) => {
        if (success) {
          toast.success('Successfully logged in with Hosted UI')
          // Clean up URL
          window.history.replaceState({}, document.title, window.location.pathname)
        } else {
          toast.error('Failed to complete OAuth login')
        }
      })
    }
  }, [])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <>
        <LoginForm onLogin={login} onHostedUILogin={loginWithHostedUI} />
        <Toaster />
      </>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Header user={user!} onLogout={logout} />
      <main className="container mx-auto px-4 py-8">
        <ItemList items={items || []} onCreateItem={createItem} />
      </main>
      <Toaster />
    </div>
  )
}

export default App