import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { User } from '../../types/models'

interface AuthState {
  user: User | null
  accessToken: string | null
  /** false until the initial silent-refresh attempt completes */
  initialized: boolean
}

const initialState: AuthState = {
  user: null,
  accessToken: null,
  initialized: false,
}

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials(state, action: PayloadAction<{ user: User; accessToken: string }>) {
      state.user = action.payload.user
      state.accessToken = action.payload.accessToken
      state.initialized = true
    },
    setUser(state, action: PayloadAction<User>) {
      state.user = action.payload
    },
    sessionChecked(state) {
      state.initialized = true
    },
    signedOut(state) {
      state.user = null
      state.accessToken = null
      state.initialized = true
    },
  },
})

export const { setCredentials, setUser, sessionChecked, signedOut } = authSlice.actions
export default authSlice.reducer
