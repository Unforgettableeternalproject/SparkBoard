// Simple test app to check if React is working
import { useState } from 'react'

function TestApp() {
  const [count, setCount] = useState(0)

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>SparkBoard Test</h1>
      <p>If you can see this, React is working!</p>
      <button onClick={() => setCount(count + 1)}>
        Count: {count}
      </button>
    </div>
  )
}

export default TestApp
