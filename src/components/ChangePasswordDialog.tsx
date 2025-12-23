import { useState } from 'react'
import { Button } from './ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { toast } from 'sonner'
import { Eye, EyeSlash } from '@phosphor-icons/react'

interface ChangePasswordDialogProps {
  onPasswordChange: (newPassword: string) => Promise<boolean>
}

export function ChangePasswordDialog({ onPasswordChange }: ChangePasswordDialogProps) {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isChanging, setIsChanging] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!onPasswordChange) {
      toast.error('Password change function is not available')
      return
    }

    // Validate passwords
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters long')
      return
    }

    if (!/[A-Z]/.test(newPassword)) {
      toast.error('Password must contain at least one uppercase letter')
      return
    }

    if (!/[a-z]/.test(newPassword)) {
      toast.error('Password must contain at least one lowercase letter')
      return
    }

    if (!/[0-9]/.test(newPassword)) {
      toast.error('Password must contain at least one number')
      return
    }

    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }

    setIsChanging(true)
    try {
      const success = await onPasswordChange(newPassword)
      if (success) {
        toast.success('Password changed successfully!')
        setNewPassword('')
        setConfirmPassword('')
      } else {
        toast.error('Failed to change password. Please try again.')
      }
    } catch (error) {
      console.error('Password change error:', error)
      toast.error('An error occurred while changing password')
    } finally {
      setIsChanging(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 animate-in fade-in duration-300">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-3">
          <CardTitle className="text-2xl font-semibold tracking-tight">Change Your Password</CardTitle>
          <CardDescription className="text-sm">
            You are required to change your temporary password before continuing.
            Your password must be at least 8 characters long and contain uppercase, lowercase, and numbers.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  required
                  disabled={isChanging}
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  disabled={isChanging}
                >
                  {showNewPassword ? (
                    <EyeSlash className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <div className="relative">
                <Input
                  id="confirm-password"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  required
                  disabled={isChanging}
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  disabled={isChanging}
                >
                  {showConfirmPassword ? (
                    <EyeSlash className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
            </div>
            
            <Button type="submit" className="w-full" disabled={isChanging}>
              {isChanging ? 'Changing Password...' : 'Change Password'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
