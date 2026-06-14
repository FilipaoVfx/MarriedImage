'use client'

import { useState, useActionState } from 'react'
import { signIn, signUp } from '@/app/actions'

export default function LoginForm() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [loginState, loginAction, loginPending] = useActionState(signIn, null)
  const [signupState, signupAction, signupPending] = useActionState(signUp, null)

  const state = mode === 'login' ? loginState : signupState
  const action = mode === 'login' ? loginAction : signupAction
  const pending = mode === 'login' ? loginPending : signupPending

  return (
    <div className="bg-white rounded-2xl shadow-lg p-8">
      <h2 className="text-2xl font-semibold text-gray-800 mb-6 text-center">
        {mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
      </h2>

      <form action={action} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-rose-400 transition"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
          <input
            name="password"
            type="password"
            required
            minLength={6}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-rose-400 transition"
          />
        </div>

        {state?.error && (
          <p className="text-red-500 text-sm bg-red-50 px-3 py-2 rounded-lg">{state.error}</p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full bg-rose-500 hover:bg-rose-600 text-white font-semibold py-3 rounded-xl transition disabled:opacity-60"
        >
          {pending ? 'Cargando...' : mode === 'login' ? 'Entrar' : 'Crear cuenta'}
        </button>
      </form>

      <p className="text-center text-sm text-gray-500 mt-5">
        {mode === 'login' ? '¿No tienes cuenta?' : '¿Ya tienes cuenta?'}{' '}
        <button
          onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
          className="text-rose-500 hover:underline font-medium"
        >
          {mode === 'login' ? 'Regístrate' : 'Inicia sesión'}
        </button>
      </p>
    </div>
  )
}
