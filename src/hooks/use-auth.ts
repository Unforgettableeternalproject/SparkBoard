import { useState, useEffect } from 'react'
import { useKV } from '@github/spark/hooks'
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

  return {
    id: payload.sub,
    email: payload.email || username,
    name: payload.name || payload['cognito:username'] || username,
    orgId: payload['custom:orgId'] || 'ORG#sparkboard-demo',
  }
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [idToken, setIdToken] = useKV<string | null>('cognito_id_token', null)

  // Check for existing session on mount
  useEffect(() => {
    const cognitoUser = userPool.getCurrentUser()
    
    if (cognitoUser) {
      cognitoUser.getSession((err: Error | null, session: CognitoUserSession | null) => {
        if (err || !session?.isValid()) {
          setUser(null)
          setIdToken(null)
          setIsLoading(false)
          return
        }

        const user = sessionToUser(session, cognitoUser.getUsername())
        const token = session.getIdToken().getJwtToken()
        
        setUser(user)
        setIdToken(token)
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
        onSuccess: (session: CognitoUserSession) => {
          const user = sessionToUser(session, email)
          const token = session.getIdToken().getJwtToken()
          
          setUser(user)
          setIdToken(token)
          resolve(true)
        },
        onFailure: (err) => {
          console.error('Login failed:', err)
          setUser(null)
          setIdToken(null)
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
    setIdToken(null)
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
      
      const user: User = {
        id: idTokenPayload.sub,
        email: idTokenPayload.email,
        name: idTokenPayload.name || idTokenPayload['cognito:username'],
        orgId: idTokenPayload['custom:orgId'] || 'ORG#sparkboard-demo',
      }

      setUser(user)
      setIdToken(tokens.id_token)
      
      return true
    } catch (error) {
      console.error('OAuth callback error:', error)
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
  }
}
