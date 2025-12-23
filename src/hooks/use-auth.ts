import { useState, useEffect, useRef } from 'react'
import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
  CognitoUserSession,
  CognitoUserAttribute,
} from 'amazon-cognito-identity-js'
import { User } from '@/lib/types'

// Cognito Configuration from environment variables
const poolData = {
  UserPoolId: import.meta.env.VITE_USER_POOL_ID || 'ap-northeast-1_59qRuLzAB',
  ClientId: import.meta.env.VITE_USER_POOL_CLIENT_ID || '3mare5vo5cqqtbialfbhpddaqq',
}

const userPool = new CognitoUserPool(poolData)

// Helper to convert Cognito session to User type
function sessionToUser(session: CognitoUserSession, username: string): User {
  const idToken = session.getIdToken()
  const payload = idToken.payload

  const groups = payload['cognito:groups'] || []
  const role = groups.includes('Admin') 
    ? 'Admin' 
    : groups.includes('Moderators') 
    ? 'Moderators' 
    : 'Users'

  return {
    id: payload.sub,
    email: payload.email || username,
    name: payload.name || payload['cognito:username'] || username,
    orgId: payload['custom:orgId'] || 'ORG#sparkboard-demo',
    'cognito:groups': groups,
    role,
  }
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [idToken, setIdToken] = useState<string | null>(null)
  const [requiresPasswordChange, setRequiresPasswordChange] = useState(false)
  const [avatarVersion, setAvatarVersion] = useState(0)
  const cognitoUserForPasswordChangeRef = useRef<CognitoUser | null>(null)

  // Save ID token to localStorage
  const saveIdToken = (token: string | null) => {
    if (token) {
      localStorage.setItem('cognito_id_token', token)
    } else {
      localStorage.removeItem('cognito_id_token')
    }
    setIdToken(token)
  }

  // Check for existing session on mount
  useEffect(() => {
    // First check for OAuth tokens in localStorage (from Hosted UI login)
    const storedIdToken = localStorage.getItem('cognito_id_token')
    const storedAccessToken = localStorage.getItem('cognito_access_token')
    const storedRefreshToken = localStorage.getItem('cognito_refresh_token')
    
    if (storedIdToken && storedAccessToken && storedRefreshToken) {
      try {
        // Decode and validate ID token
        const idTokenPayload = JSON.parse(atob(storedIdToken.split('.')[1]))
        const expiration = idTokenPayload.exp * 1000 // Convert to milliseconds
        
        if (expiration > Date.now()) {
          // Token is still valid, restore user session
          const groups = idTokenPayload['cognito:groups'] || []
          const role = groups.includes('Admin') 
            ? 'Admin' 
            : groups.includes('Moderators') 
            ? 'Moderators' 
            : 'Users'
          
          const user: User = {
            id: idTokenPayload.sub,
            email: idTokenPayload.email,
            name: idTokenPayload.name || idTokenPayload['cognito:username'],
            orgId: idTokenPayload['custom:orgId'] || 'ORG#sparkboard-demo',
            'cognito:groups': groups,
            role,
          }
          
          setUser(user)
          saveIdToken(storedIdToken)
          
          // Load profile data from backend API
          fetch(`${import.meta.env.VITE_API_URL}/auth/me`, {
            method: 'GET',
            headers: { 'Authorization': storedIdToken },
          })
            .then(response => response.ok ? response.json() : null)
            .then(data => {
              if (data?.user) {
                // Apply user's theme preference
                if (data.user.theme && data.user.theme !== 'system') {
                  if (data.user.theme === 'dark') {
                    document.documentElement.classList.add('dark')
                  } else {
                    document.documentElement.classList.remove('dark')
                  }
                  localStorage.setItem('theme', data.user.theme)
                }
                
                setUser(prevUser => {
                  if (!prevUser) return null
                  return {
                    ...prevUser,
                    name: data.user.name || prevUser.name,
                    email: data.user.email || prevUser.email,
                    avatarUrl: data.user.avatarUrl,
                    bio: data.user.bio,
                    theme: data.user.theme,
                  }
                })
              }
            })
            .catch(error => console.error('Failed to load profile on mount:', error))
            .finally(() => setIsLoading(false))
          
          return
        }
      } catch (error) {
        console.error('Failed to restore OAuth session:', error)
      }
    }
    
    // Fallback to checking Cognito SDK session
    const cognitoUser = userPool.getCurrentUser()
    
    if (cognitoUser) {
      cognitoUser.getSession(async (err: Error | null, session: CognitoUserSession | null) => {
        if (err || !session?.isValid()) {
          setUser(null)
          saveIdToken(null)
          setIsLoading(false)
          return
        }

        const user = sessionToUser(session, cognitoUser.getUsername())
        const token = session.getIdToken().getJwtToken()
        
        setUser(user)
        saveIdToken(token)
        
        // Load profile data from backend API
        try {
          const apiUrl = import.meta.env.VITE_API_URL
          if (apiUrl) {
            const response = await fetch(`${apiUrl}/auth/me`, {
              method: 'GET',
              headers: {
                'Authorization': token,
              },
            })

            if (response.ok) {
              const data = await response.json()
              if (data.user) {
                // Apply user's theme preference
                if (data.user.theme && data.user.theme !== 'system') {
                  if (data.user.theme === 'dark') {
                    document.documentElement.classList.add('dark')
                  } else {
                    document.documentElement.classList.remove('dark')
                  }
                  localStorage.setItem('theme', data.user.theme)
                }
                
                setUser(prevUser => {
                  if (!prevUser) return null
                  return {
                    ...prevUser,
                    name: data.user.name || prevUser.name,
                    email: data.user.email || prevUser.email,
                    avatarUrl: data.user.avatarUrl,
                    bio: data.user.bio,
                    theme: data.user.theme,
                  }
                })
              }
            }
          }
        } catch (error) {
          console.error('Failed to load profile on mount:', error)
          // Continue with Cognito data even if profile load fails
        }
        
        setIsLoading(false)
      })
    } else {
      setIsLoading(false)
    }
  }, [])

  const login = (email: string, password: string): Promise<boolean> => {
    return new Promise((resolve) => {
      const authenticationDetails = new AuthenticationDetails({
        Username: email,
        Password: password,
      })

      const cognitoUser = new CognitoUser({
        Username: email,
        Pool: userPool,
      })

      cognitoUser.authenticateUser(authenticationDetails, {
        onSuccess: async (session: CognitoUserSession) => {
          const user = sessionToUser(session, email)
          const token = session.getIdToken().getJwtToken()
          
          setRequiresPasswordChange(false)
          cognitoUserForPasswordChangeRef.current = null
          setUser(user)
          saveIdToken(token)
          
          // Load profile data from backend API
          try {
            const apiUrl = import.meta.env.VITE_API_URL
            if (apiUrl) {
              const response = await fetch(`${apiUrl}/auth/me`, {
                method: 'GET',
                headers: {
                  'Authorization': token,
                },
              })

              if (response.ok) {
                const data = await response.json()
                if (data.user) {
                  setUser(prevUser => {
                    if (!prevUser) return null
                    return {
                      ...prevUser,
                      name: data.user.name || prevUser.name,
                      email: data.user.email || prevUser.email,
                      avatarUrl: data.user.avatarUrl,
                      bio: data.user.bio,
                    }
                  })
                }
              }
            }
          } catch (error) {
            console.error('Failed to load profile after login:', error)
          }
          
          resolve(true)
        },
        onFailure: (err) => {
          console.error('Login failed:', err)
          setUser(null)
          saveIdToken(null)
          setRequiresPasswordChange(false)
          cognitoUserForPasswordChangeRef.current = null
          resolve(false)
        },
        newPasswordRequired: (userAttributes, requiredAttributes) => {
          console.log('New password required', { userAttributes, requiredAttributes })
          // Store cognito user reference first
          cognitoUserForPasswordChangeRef.current = cognitoUser
          // Use setTimeout to ensure state update happens after callback completes
          setTimeout(() => {
            setRequiresPasswordChange(true)
          }, 0)
          // Resolve to indicate password change is required (not an error)
          resolve(true)
        },
      })
    })
  }

  const logout = () => {
    const cognitoUser = userPool.getCurrentUser()
    
    if (cognitoUser) {
      cognitoUser.signOut()
    }
    
    // Clear OAuth tokens
    localStorage.removeItem('cognito_access_token')
    localStorage.removeItem('cognito_refresh_token')
    
    setUser(null)
    saveIdToken(null)
    setRequiresPasswordChange(false)
    cognitoUserForPasswordChangeRef.current = null
  }

  // Hosted UI Login
  const loginWithHostedUI = () => {
    const cognitoDomain = import.meta.env.VITE_COGNITO_DOMAIN || 'sparkboard-434824683139.auth.ap-northeast-1.amazoncognito.com'
    const redirectUri = import.meta.env.VITE_OAUTH_REDIRECT_URI || window.location.origin
    const clientId = poolData.ClientId

    const hostedUIUrl = `https://${cognitoDomain}/login?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}`
    
    window.location.href = hostedUIUrl
  }

  // Handle OAuth callback (authorization code)
  const handleOAuthCallback = async (code: string): Promise<boolean> => {
    try {
      // Exchange authorization code for tokens via Cognito token endpoint
      const cognitoDomain = import.meta.env.VITE_COGNITO_DOMAIN || 'sparkboard-434824683139.auth.ap-northeast-1.amazoncognito.com'
      const redirectUri = import.meta.env.VITE_OAUTH_REDIRECT_URI || window.location.origin
      const clientId = poolData.ClientId

      const tokenEndpoint = `https://${cognitoDomain}/oauth2/token`
      
      const response = await fetch(tokenEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: clientId,
          code: code,
          redirect_uri: redirectUri,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to exchange code for tokens')
      }

      const tokens = await response.json()
      
      // Decode ID token to get user info
      const idTokenPayload = JSON.parse(atob(tokens.id_token.split('.')[1]))
      
      // Create Cognito session to persist login
      const username = idTokenPayload['cognito:username'] || idTokenPayload.email
      const cognitoUser = new CognitoUser({
        Username: username,
        Pool: userPool,
      })

      // Store tokens in local storage for session persistence
      localStorage.setItem('cognito_id_token', tokens.id_token)
      localStorage.setItem('cognito_access_token', tokens.access_token)
      localStorage.setItem('cognito_refresh_token', tokens.refresh_token)
      
      const groups = idTokenPayload['cognito:groups'] || []
      const role = groups.includes('Admin') 
        ? 'Admin' 
        : groups.includes('Moderators') 
        ? 'Moderators' 
        : 'Users'
      
      const user: User = {
        id: idTokenPayload.sub,
        email: idTokenPayload.email,
        name: idTokenPayload.name || idTokenPayload['cognito:username'],
        orgId: idTokenPayload['custom:orgId'] || 'ORG#sparkboard-demo',
        'cognito:groups': groups,
        role,
      }

      setRequiresPasswordChange(false)
      cognitoUserForPasswordChangeRef.current = null
      setUser(user)
      saveIdToken(tokens.id_token)
      
      // Load profile data from backend API
      try {
        const apiUrl = import.meta.env.VITE_API_URL
        if (apiUrl) {
          const profileResponse = await fetch(`${apiUrl}/auth/me`, {
            method: 'GET',
            headers: {
              'Authorization': tokens.id_token,
            },
          })

          if (profileResponse.ok) {
            const data = await profileResponse.json()
            if (data.user) {
              setUser(prevUser => {
                if (!prevUser) return null
                return {
                  ...prevUser,
                  name: data.user.name || prevUser.name,
                  email: data.user.email || prevUser.email,
                  avatarUrl: data.user.avatarUrl,
                  bio: data.user.bio,
                }
              })
            }
          }
        }
      } catch (error) {
        console.error('Failed to load profile after OAuth:', error)
      }
      
      return true
    } catch (error) {
      console.error('OAuth callback error:', error)
      return false
    }
  }

  // Refresh user data from backend API
  const refreshUser = async () => {
    console.log('[use-auth] refreshUser called, idToken:', idToken ? 'exists' : 'missing')
    if (!idToken) return false

    try {
      const apiUrl = import.meta.env.VITE_API_URL
      console.log('[use-auth] API URL:', apiUrl)
      if (!apiUrl) return false

      const response = await fetch(`${apiUrl}/auth/me`, {
        method: 'GET',
        headers: {
          'Authorization': idToken,
        },
      })

      console.log('[use-auth] Response status:', response.status)
      if (response.ok) {
        const data = await response.json()
        console.log('[use-auth] Profile data received:', data)
        if (data.user) {
          console.log('[use-auth] About to update user state...')
          // Update user state with profile data from backend
          // Create a completely new object to ensure React detects the change
          setUser(prevUser => {
            console.log('[use-auth] Inside setUser callback, prevUser:', prevUser)
            if (!prevUser) {
              console.warn('[use-auth] prevUser is null, cannot update')
              return null
            }
            
            // Add timestamp to avatarUrl to bust cache
            let avatarUrlWithCache = data.user.avatarUrl
            if (avatarUrlWithCache) {
              const timestamp = Date.now()
              const separator = avatarUrlWithCache.includes('?') ? '&' : '?'
              avatarUrlWithCache = `${avatarUrlWithCache}${separator}t=${timestamp}`
              console.log('[use-auth] Avatar URL with cache buster:', avatarUrlWithCache)
            }
            
            const updatedUser = {
              ...prevUser,
              name: data.user.name || prevUser.name,
              email: data.user.email || prevUser.email,
              avatarUrl: avatarUrlWithCache,
              bio: data.user.bio,
            }
            console.log('[use-auth] Updated user state:', updatedUser)
            return updatedUser
          })
          
          // Increment avatar version to force Header re-render
          setAvatarVersion(prev => prev + 1)
          console.log('[use-auth] setUser and avatarVersion updated')
          return true
        } else {
          console.warn('[use-auth] No user data in response')
        }
      } else {
        const errorText = await response.text()
        console.error('[use-auth] API error:', response.status, errorText)
      }
      return false
    } catch (error) {
      console.error('[use-auth] Failed to refresh user:', error)
      return false
    }
  }

  // Complete password change for users with temporary passwords
  const completeNewPasswordChallenge = (newPassword: string): Promise<boolean> => {
    return new Promise((resolve) => {
      const cognitoUser = cognitoUserForPasswordChangeRef.current
      if (!cognitoUser) {
        console.error('No cognito user for password change')
        resolve(false)
        return
      }

      cognitoUser.completeNewPasswordChallenge(
        newPassword,
        {},
        {
          onSuccess: async (session: CognitoUserSession) => {
            try {
              const user = sessionToUser(session, cognitoUser.getUsername())
              const token = session.getIdToken().getJwtToken()
              
              // Load profile data from backend API first (before any state updates)
              let finalUser = user
              const apiUrl = import.meta.env.VITE_API_URL
              if (apiUrl) {
                try {
                  const response = await fetch(`${apiUrl}/auth/me`, {
                    method: 'GET',
                    headers: {
                      'Authorization': token,
                    },
                  })

                  if (response.ok) {
                    const data = await response.json()
                    if (data.user) {
                      finalUser = {
                        ...user,
                        name: data.user.name || user.name,
                        email: data.user.email || user.email,
                        avatarUrl: data.user.avatarUrl,
                        bio: data.user.bio,
                      }
                    }
                  }
                } catch (error) {
                  console.error('Failed to load profile after password change:', error)
                }
              }
              
              // Use setTimeout to break out of the callback execution context
              setTimeout(() => {
                setRequiresPasswordChange(false)
                cognitoUserForPasswordChangeRef.current = null
                setUser(finalUser)
                saveIdToken(token)
              }, 0)
              
              resolve(true)
            } catch (error) {
              console.error('Failed to complete password change:', error)
              resolve(false)
            }
          },
          onFailure: (err) => {
            console.error('Password change failed:', err)
            resolve(false)
          },
        }
      )
    })
  }

  // Register new user
  const register = (username: string, email: string, password: string): Promise<boolean> => {
    return new Promise((resolve) => {
      const attributeList = [
        new CognitoUserAttribute({
          Name: 'email',
          Value: email,
        }),
      ]

      userPool.signUp(username, password, attributeList, [], (err, result) => {
        if (err) {
          console.error('Registration failed:', err)
          resolve(false)
          return
        }

        console.log('Registration successful:', result)
        resolve(true)
      })
    })
  }

  // Verify email with confirmation code
  const verifyEmail = (username: string, code: string): Promise<boolean> => {
    return new Promise((resolve) => {
      const cognitoUser = new CognitoUser({
        Username: username,
        Pool: userPool,
      })

      cognitoUser.confirmRegistration(code, true, (err, result) => {
        if (err) {
          console.error('Email verification failed:', err)
          resolve(false)
          return
        }

        console.log('Email verified successfully:', result)
        resolve(true)
      })
    })
  }

  // Resend verification code
  const resendVerificationCode = (username: string): Promise<boolean> => {
    return new Promise((resolve) => {
      const cognitoUser = new CognitoUser({
        Username: username,
        Pool: userPool,
      })

      cognitoUser.resendConfirmationCode((err, result) => {
        if (err) {
          console.error('Resend code failed:', err)
          resolve(false)
          return
        }

        console.log('Verification code resent:', result)
        resolve(true)
      })
    })
  }

  // Forgot password - send reset code
  const forgotPassword = (email: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const cognitoUser = new CognitoUser({
        Username: email,
        Pool: userPool,
      })

      cognitoUser.forgotPassword({
        onSuccess: (result) => {
          console.log('Password reset code sent:', result)
          resolve()
        },
        onFailure: (err) => {
          console.error('Forgot password failed:', err)
          reject(err)
        },
      })
    })
  }

  // Confirm password reset with code
  const confirmPassword = (email: string, code: string, newPassword: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const cognitoUser = new CognitoUser({
        Username: email,
        Pool: userPool,
      })

      cognitoUser.confirmPassword(code, newPassword, {
        onSuccess: () => {
          console.log('Password reset successful')
          resolve()
        },
        onFailure: (err) => {
          console.error('Confirm password failed:', err)
          reject(err)
        },
      })
    })
  }

  return {
    user,
    isAuthenticated: !!user,
    isLoading,
    idToken,
    requiresPasswordChange,
    avatarVersion,
    login,
    logout,
    register,
    verifyEmail,
    resendVerificationCode,
    forgotPassword,
    confirmPassword,
    loginWithHostedUI,
    handleOAuthCallback,
    refreshUser,
    completeNewPasswordChallenge,
  }
}
