import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/use-auth'
import { useItems } from './hooks/use-items'
import { LoginForm } from './components/LoginForm'
import { RegisterForm } from './components/RegisterForm'
import { VerifyEmailDialog } from './components/VerifyEmailDialog'
import { ChangePasswordDialog } from './components/ChangePasswordDialog'
import { Header } from './components/Header'
import { Sidebar } from './components/Sidebar'
import { ItemList } from './components/ItemList'
import { AdminDashboard } from './pages/AdminDashboard'
import { TasksPage } from './pages/TasksPage'
import { AnnouncementsPage } from './pages/AnnouncementsPage'
import { ProfilePage } from './pages/ProfilePage'
import { PinnedAnnouncementBanner } from './components/PinnedAnnouncementBanner'
import { Toaster } from './components/ui/sonner'
import { toast } from 'sonner'

function App() {
  const { 
    user, 
    isAuthenticated, 
    isLoading, 
    requiresPasswordChange,
    login, 
    logout,
    register,
    verifyEmail,
    resendVerificationCode,
    loginWithHostedUI, 
    handleOAuthCallback,
    completeNewPasswordChallenge,
  } = useAuth()
  const { items, createItem, deleteItem, updateItem } = useItems(user)
  const [showRegister, setShowRegister] = useState(false)
  const [showVerify, setShowVerify] = useState(false)
  const [pendingUsername, setPendingUsername] = useState('')

  const handleRegister = async (username: string, email: string, password: string) => {
    const success = await register(username, email, password)
    if (success) {
      setPendingUsername(username)
      setShowRegister(false)
      setShowVerify(true)
    }
    return success
  }

  const handleVerify = async (username: string, code: string) => {
    const success = await verifyEmail(username, code)
    if (success) {
      setShowVerify(false)
      setPendingUsername('')
    }
    return success
  }

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
    if (requiresPasswordChange && completeNewPasswordChallenge) {
      return (
        <>
          <ChangePasswordDialog onPasswordChange={completeNewPasswordChallenge} />
          <Toaster />
        </>
      )
    }

    if (showVerify) {
      return (
        <>
          <VerifyEmailDialog
            username={pendingUsername}
            onVerify={handleVerify}
            onResendCode={resendVerificationCode}
            onCancel={() => {
              setShowVerify(false)
              setPendingUsername('')
            }}
          />
          <Toaster />
        </>
      )
    }

    return (
      <>
        {showRegister ? (
          <RegisterForm 
            onRegister={handleRegister} 
            onBackToLogin={() => setShowRegister(false)}
          />
        ) : (
          <LoginForm 
            onLogin={login} 
            onHostedUILogin={loginWithHostedUI}
            onShowRegister={() => setShowRegister(true)}
          />
        )}
        <Toaster />
      </>
    )
  }

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-background flex flex-col">
        <Header user={user!} onLogout={logout} items={items || []} />
        <PinnedAnnouncementBanner announcements={items || []} />
        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar - Hidden on mobile, visible on desktop */}
          <div className="hidden lg:block w-64 border-r bg-card/50 overflow-y-auto">
            <Sidebar 
              items={items || []} 
              isAdmin={user?.['cognito:groups']?.includes('Admin')}
            />
          </div>
          
          {/* Main Content */}
          <main className="flex-1 overflow-y-auto">
            <div className="container mx-auto px-4 py-8 animate-fade-in">
              <Routes>
                <Route path="/" element={<ItemList items={items || []} currentUser={user!} onCreateItem={createItem} onDeleteItem={deleteItem} onUpdateItem={updateItem} />} />
                <Route path="/tasks" element={<TasksPage />} />
                <Route path="/announcements" element={<AnnouncementsPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/admin" element={<AdminDashboard />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </div>
          </main>
        </div>
        <Toaster />
      </div>
    </BrowserRouter>
  )
}

export default App