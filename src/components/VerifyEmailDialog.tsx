import { useState } from 'react'
import { Button } from './ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { toast } from 'sonner'

interface VerifyEmailDialogProps {
  username: string
  onVerify: (username: string, code: string) => Promise<boolean>
  onResendCode: (username: string) => Promise<boolean>
  onCancel: () => void
}

export function VerifyEmailDialog({ 
  username, 
  onVerify, 
  onResendCode,
  onCancel 
}: VerifyEmailDialogProps) {
  const [code, setCode] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)
  const [isResending, setIsResending] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (code.length !== 6) {
      toast.error('Verification code must be 6 digits')
      return
    }

    setIsVerifying(true)
    try {
      const success = await onVerify(username, code)
      if (success) {
        toast.success('Email verified successfully! You can now log in.')
        setCode('')
      } else {
        toast.error('Invalid verification code. Please try again.')
      }
    } catch (error) {
      console.error('Verification error:', error)
      toast.error('An error occurred during verification')
    } finally {
      setIsVerifying(false)
    }
  }

  const handleResend = async () => {
    setIsResending(true)
    try {
      const success = await onResendCode(username)
      if (success) {
        toast.success('Verification code resent to your email')
      } else {
        toast.error('Failed to resend code. Please try again.')
      }
    } catch (error) {
      console.error('Resend error:', error)
      toast.error('An error occurred while resending code')
    } finally {
      setIsResending(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 animate-in fade-in duration-300">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-3">
          <CardTitle className="text-2xl font-semibold tracking-tight">Verify Your Email</CardTitle>
          <CardDescription className="text-sm">
            We've sent a 6-digit verification code to your email address.
            Please enter it below to complete your registration.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                value={username}
                disabled
                className="bg-muted"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="code">Verification Code</Label>
              <Input
                id="code"
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="Enter 6-digit code"
                required
                disabled={isVerifying}
                maxLength={6}
              />
            </div>
            
            <div className="flex flex-col gap-2">
              <Button 
                type="submit" 
                disabled={isVerifying || code.length !== 6}
                className="w-full"
              >
                {isVerifying ? 'Verifying...' : 'Verify'}
              </Button>
              
              <Button
                type="button"
                variant="outline"
                onClick={handleResend}
                disabled={isResending || isVerifying}
                className="w-full"
              >
                {isResending ? 'Resending...' : 'Resend Code'}
              </Button>
              
              <Button
                type="button"
                variant="ghost"
                onClick={onCancel}
                disabled={isVerifying}
                className="w-full"
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
