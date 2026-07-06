export type UserRole = "superadmin" | "admin" | "user";
export type UserStatus = "active" | "suspended";

export interface User {
  id: string;
  username: string;
  email: string;
  fullName?: string;
  role: UserRole;
  status: UserStatus;
  isProtected: boolean;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface UserStats {
  total: number;
  active: number;
  suspended: number;
  admins: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse extends AuthTokens {
  user: User;
}
