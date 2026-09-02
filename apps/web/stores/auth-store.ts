import { create } from 'zustand'
import { User } from '@/types'
import { api } from '@/lib/api'
import { clearTokens } from '@/lib/auth'
import { isSupportedLocale, setLocaleCookie } from '@/lib/locale'

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isSuperAdmin: boolean
  isLoading: boolean
  setUser: (user: User) => void
  logout: () => void
  fetchUser: () => Promise<void>
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  isAuthenticated: false,
  isSuperAdmin: false,
  isLoading: false,

  setUser: (user: User) => {
    set({
      user,
      isAuthenticated: true,
      isSuperAdmin: user.is_superadmin,
    })
  },

  logout: () => {
    clearTokens()
    set({
      user: null,
      isAuthenticated: false,
      isSuperAdmin: false,
    })
  },

  fetchUser: async () => {
    set({ isLoading: true })
    try {
      const user = await api.get<User>('/auth/me')
      set({
        user,
        isAuthenticated: true,
        isSuperAdmin: user.is_superadmin,
      })
      // A saved language preference wins over whatever the browser/instance
      // negotiation in middleware.ts already picked for this session.
      const preferredLocale = user.preferences?.locale
      if (isSupportedLocale(preferredLocale as string | undefined)) {
        setLocaleCookie(preferredLocale as 'fr' | 'en')
      }
    } catch {
      set({
        user: null,
        isAuthenticated: false,
        isSuperAdmin: false,
      })
    } finally {
      set({ isLoading: false })
    }
  },
}))
