import { create } from "zustand";
import { jwtDecode } from "jwt-decode";
import { useLocation } from "wouter";
import { useEffect } from "react";

interface JwtPayload {
  id: string;
  email: string;
  actor: "USER" | "MERCHANT";
  name?: string;
  exp: number;
}

interface AuthState {
  token: string | null;
  user: JwtPayload | null;
  isAuthenticated: boolean;
  isReady: boolean;
  login: (token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => {
  const storedToken = typeof window !== "undefined" ? localStorage.getItem("darbby_token") : null;
  let initialUser: JwtPayload | null = null;

  if (storedToken) {
    try {
      const decoded = jwtDecode<JwtPayload>(storedToken);
      if (decoded.exp * 1000 > Date.now() && decoded.actor === "MERCHANT") {
        initialUser = decoded;
      } else {
        localStorage.removeItem("darbby_token");
      }
    } catch {
      localStorage.removeItem("darbby_token");
    }
  }

  return {
    token: initialUser ? storedToken : null,
    user: initialUser,
    isAuthenticated: !!initialUser,
    isReady: true,
    login: (token: string) => {
      localStorage.setItem("darbby_token", token);
      const decoded = jwtDecode<JwtPayload>(token);
      set({ token, user: decoded, isAuthenticated: true });
    },
    logout: () => {
      localStorage.removeItem("darbby_token");
      set({ token: null, user: null, isAuthenticated: false });
    },
  };
});

export function useProtectedRoute() {
  const { isAuthenticated, user, isReady } = useAuthStore();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isReady) return;
    if (!isAuthenticated || user?.actor !== "MERCHANT") {
      setLocation("/login");
    }
  }, [isAuthenticated, isReady, user, setLocation]);

  return { isAuthenticated, user };
}
