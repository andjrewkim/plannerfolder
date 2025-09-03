import { redirect } from 'next/navigation'

export default function HomePage() {
  // This will immediately redirect to the target URL
  redirect('https://fluxplanner.netlify.app/userlogin')
}

// Alternative approach using useEffect for client-side redirect
// Uncomment below and comment above if you prefer client-side redirect

/*
'use client'

import { useEffect } from 'react'

export default function HomePage() {
  useEffect(() => {
    window.location.href = 'https://fluxplanner.netlify.app/userlogin'
  }, [])

  return (
    <div className="flex items-center justify-center min-h-screen">
      <p>Redirecting to FluxPlanner...</p>
    </div>
  )
}
*/