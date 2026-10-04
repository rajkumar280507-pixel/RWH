import { create } from "zustand";
import { persist } from "zustand/middleware";
import { login as apiLogin, register as apiRegister, getMe } from "../services/api.js";

// Real accounts (civil engineer / municipal employee / builder / consultant
// / researcher / office staff) backed by the backend's users table — see
// backend/app/api/auth.py. Token + user are persisted to localStorage so a
// page refresh doesn't sign the operator out; the token is also attached to
// every request by the axios interceptor set up in services/api.js.
export const useAuthStore = create(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      authLoading: false,
      authError: null,

      isAuthenticated: () => get().token != null,

      login: async (username, password) => {
        set({ authLoading: true, authError: null });
        try {
          const { access_token } = await apiLogin({ username, password });
          set({ token: access_token });
          const user = await getMe();
          set({ user, authLoading: false });
          return { ok: true };
        } catch (err) {
          const detail = err?.response?.data?.detail ?? "Login failed";
          set({ authLoading: false, authError: detail, token: null, user: null });
          return { ok: false, error: detail };
        }
      },

      register: async (payload) => {
        set({ authLoading: true, authError: null });
        try {
          await apiRegister(payload);
          // Register endpoint doesn't itself return a token — log in right
          // after so registering also signs the operator in immediately.
          return await get().login(payload.username, payload.password);
        } catch (err) {
          const detail = err?.response?.data?.detail ?? "Registration failed";
          set({ authLoading: false, authError: detail });
          return { ok: false, error: detail };
        }
      },

      logout: () => set({ token: null, user: null, authError: null }),
    }),
    {
      name: "rwh-auth",
      partialize: (state) => ({ token: state.token, user: state.user }),
    }
  )
);
