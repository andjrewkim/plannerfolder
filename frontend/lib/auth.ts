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
    try {
      const response = await fetch(`${API_BASE_URL}/login/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      });

      const data = await response.json();
      console.log('Login response data:', data); // ← ADD THIS

      if (!response.ok) {
        throw new Error(data.error || data.message || 'Login failed');
      }

      // ✅ THIS IS THE CRITICAL PART
      if (data.token && data.user) {
        console.log('Storing token:', data.token); // ← ADD THIS
        this.setAuthData(data.token, data.user);
      } else {
        console.error('No token in response:', data); // ← ADD THIS
      }

      return data;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  async register(userData: RegisterData): Promise<AuthResponse> {
    try {
      console.log('Registering user:', userData);
      
      const response = await fetch(`${API_BASE_URL}/register/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });

      console.log('Registration response status:', response.status);
      
      const data = await response.json();
      console.log('Registration response data:', data);

      if (!response.ok) {
        throw new Error(data.error || data.message || 'Registration failed');
      }

      return data;
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  }

  async logout(): Promise<boolean> {
    console.log('=== LOGOUT METHOD CALLED ===');
    try {
      const token = this.getToken();
      const headers = this.getAuthHeaders();
      
      console.log('Sending logout request...');
      
      const response = await fetch(`${API_BASE_URL}/logout/`, {
        method: 'POST',
        headers: headers,
        credentials: 'include', // ← THIS IS CRITICAL - sends cookies
      });
      
      console.log('Response status:', response.status);
      
      // Clear auth data regardless of server response
      this.clearAuthData();
      
      return response.ok;
    } catch (error) {
      console.error('Logout error:', error);
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