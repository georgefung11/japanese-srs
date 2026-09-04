'use client'

import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'

export default function SignUpPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    const supabase = createClient()

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // Optional: Redirect back to your app after email confirmation
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    setLoading(false)

    if (error) {
      setMessage(`Error: ${error.message}`)
      return
    }

    if (data.session) {
      setMessage('Account created successfully! You are now logged in.')
    } else {
      setMessage('Check your email for the confirmation link!')
    }
  }

  return (
    <form onSubmit={handleSignUp} className="flex flex-col gap-4 max-w-sm m-auto">
      <h2>Sign Up</h2>
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      <button type="submit" disabled={loading}>
        {loading ? 'Creating account...' : 'Sign Up'}
      </button>
      {message && <p>{message}</p>}
    </form>
  )
}