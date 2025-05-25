// lib/auth.ts
import { User, LoginCredentials, RegisterData, AuthResponse } from '../types/auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api';

class AuthService {
  private getAuthHeaders(): Record<string, string> {
    const token = this.getToken();
    return {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Token ${token}` }),
    };
  }

  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const response = await fetch(`${API_BASE_URL}/login/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Login failed');
    }

    return data;
  }

  async register(userData: RegisterData): Promise<AuthResponse> {
    const response = await fetch(`${API_BASE_URL}/register/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Registration failed');
    }

    return data;
  }

  async logout(): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/logout/`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
      });

      this.clearAuthData();
      return response.ok;
    } catch (error) {
      this.clearAuthData();
      return false;
    }
  }

  getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('authToken');
  }

  getUser(): User | null {
    if (typeof window === 'undefined') return null;
    const userString = localStorage.getItem('user');
    return userString ? JSON.parse(userString) : null;
  }

  setAuthData(token: string, user: User): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem('authToken', token);
    localStorage.setItem('user', JSON.stringify(user));
  }

  clearAuthData(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  // Helper method for making authenticated API calls
  async authenticatedFetch(url: string, options: RequestInit = {}): Promise<Response> {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...this.getAuthHeaders(),
        ...options.headers,
      },
    });

    // If token is invalid, clear auth data and redirect to login
    if (response.status === 401) {
      this.clearAuthData();
      if (typeof window !== 'undefined') {
        window.location.href = '/userlogin';
      }
    }

    return response;
  }
}

export const authAPI = new AuthService();