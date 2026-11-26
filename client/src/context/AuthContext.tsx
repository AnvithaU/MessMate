import React, { createContext, useContext, useState, useEffect } from "react";
import { User, UserRole } from "../types";
import { api, setAuthToken } from "../services/api";

export interface RegisterInput {
  fullName: string;
  studentId: string;
  email: string;
  password: string;
  course?: string;
  department?: string;
  roomNumber?: string;
  semester?: number;
  phone?: string;
}

interface AuthContextType {
  user: User | null;
  role: UserRole;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: RegisterInput) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole>("student");
  // isLoading is ONLY for initial session restoration, never for login/register form submits
  // so <Login /> stays mounted and displays validation/server errors properly.
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshUser = async () => {
    try {
      const data = await api.getMe();
      if (data && data.user) {
        setUser({
          ...data.user,
          studentDbId: data.studentProfile?.id,
          studentId: data.studentProfile?.studentId || data.user.studentId,
        });
        setRole(data.user.role);
      } else {
        setUser(null);
      }
    } catch {
      setAuthToken("");
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const existingToken = localStorage.getItem("messmate_token");
    if (existingToken) {
      setAuthToken(existingToken);
      refreshUser();
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api.login({ email, password });
    setAuthToken(res.token);
    setUser(res.user);
    setRole(res.user.role);
  };

  const register = async (payload: RegisterInput) => {
    const res = await api.register(payload);
    setAuthToken(res.token);
    setUser(res.user);
    setRole(res.user.role);
  };

  const logout = () => {
    setAuthToken("");
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        isLoading,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
