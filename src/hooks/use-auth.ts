import { useState, useEffect } from 'react'
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
          resolve(false)
        },
      })
    })
  }

  const logout = () => {
    const cognitoUser = userPool.getCurrentUser()
    
    if (cognitoUser) {
      cognitoUser.signOut()
    }
    
    setUser(null)
    saveIdToken(null)
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
          setUser(prevUser => {
            console.log('[use-auth] Inside setUser callback, prevUser:', prevUser)
            if (!prevUser) {
              console.warn('[use-auth] prevUser is null, cannot update')
              return null
            }
            const updatedUser = {
              ...prevUser,
              name: data.user.name || prevUser.name,
              email: data.user.email || prevUser.email,
              avatarUrl: data.user.avatarUrl,
              bio: data.user.bio,
            }
            console.log('[use-auth] Updated user state:', updatedUser)
            return updatedUser
          })
          console.log('[use-auth] setUser called successfully')
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

  return {
    user,
    isAuthenticated: !!user,
    isLoading,
    idToken,
    login,
    logout,
    loginWithHostedUI,
    handleOAuthCallback,
    refreshUser,
  }
}
