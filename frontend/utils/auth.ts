import { UserRole } from '../types';

const TOKEN_KEY = 'zimplexline_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export interface DecodedUser {
  id: string;
  fullName: string;
  email?: string;
  role: UserRole;
  status: string;
  parentId?: string;
  exp?: number;
}

export function decodeToken(token: string | null): DecodedUser | null {
  if (!token) return null;
  try {
    const base64Url = token.split('.')[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    console.error('Error decoding JWT token:', e);
    return null;
  }
}

/**
 * Centered utility for checking if a user has sufficient roles.
 * hierarchy: admin > manager > agent > subagent
 */
const ROLE_HIERARCHY: { [key in UserRole]: number } = {
  admin: 4,
  manager: 3,
  agent: 2,
  subagent: 1,
};

export function hasRole(userRole: UserRole, requiredRole: UserRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

export function isExactRole(userRole: UserRole, targetRole: UserRole): boolean {
  return userRole === targetRole;
}
