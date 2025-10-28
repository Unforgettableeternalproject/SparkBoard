import React from 'react'
import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from "react-error-boundary";
// Temporarily disable spark import to check if it's causing issues
// import "@github/spark/spark"

import App from './App.tsx'
import { ErrorFallback } from './ErrorFallback.tsx'

import "./main.css"
import "./styles/theme.css"
import "./index.css"

console.log('SparkBoard starting...')

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary 
      FallbackComponent={ErrorFallback}
      onError={(error) => console.error('ErrorBoundary caught:', error)}
    >
      <App />
    </ErrorBoundary>
  </React.StrictMode>
)
