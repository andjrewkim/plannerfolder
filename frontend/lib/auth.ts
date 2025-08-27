// lib/auth.ts - WITH GOOGLE OAUTH AND EXISTING CACHING
import { User, LoginCredentials, RegisterData, AuthResponse } from '../types/auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL

class AuthService {
  private authCheckPromise: Promise<boolean> | null = null;
  private lastAuthCheck: number = 0;
  private authCheckCacheTime: number = 30000; // 30 seconds cache
  private cachedAuthStatus: boolean | null = null;

  private getAuthHeaders(): Record<string, string> {
    const token = this.getToken();
    return {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Token ${token}` }),
    };
  }

  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/login/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || 'Login failed');
      }

      if (data.token && data.user) {
        this.setAuthData(data.token, data.user);
        this.invalidateAuthCache();
        this.cachedAuthStatus = true;
      }

      return data;
    } catch (error) {
      throw error;
    }
  }

  async register(userData: RegisterData): Promise<AuthResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/register/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || 'Registration failed');
      }

      return data;
    } catch (error) {
      throw error;
    }
  }

  // ✅ NEW: Google OAuth Authentication
  async googleAuth(credential: string): Promise<AuthResponse> {
    try {
      console.log('🔍 Starting Google OAuth authentication...');
      
      const response = await fetch(`${API_BASE_URL}/api/auth/google/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          credential: credential,
          client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || 'Google authentication failed');
      }

      if (data.token && data.user) {
        console.log('✅ Google OAuth successful, setting auth data...');
        this.setAuthData(data.token, data.user);
        this.invalidateAuthCache();
        this.cachedAuthStatus = true;
      }

      return data;
    } catch (error) {
      console.error('❌ Google OAuth error:', error);
      throw error;
    }
  }

  async logout(): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/logout/`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        credentials: 'include',
      });
      
      this.clearAuthData();
      this.invalidateAuthCache();
      this.cachedAuthStatus = false;
      
      // Dynamic import to avoid circular dependency
      import('../app/hooks/useAppState').then(({ resetGlobalAppState }) => {
        resetGlobalAppState();
      }).catch(() => {
        // Silent fail if module doesn't exist
      });
      
      return response.ok;
    } catch (error) {
      this.clearAuthData();
      this.invalidateAuthCache();
      this.cachedAuthStatus = false;
      return false;
    }
  }

  async checkAuthStatus(): Promise<boolean> {
    const now = Date.now();
    
    // Return cached result if still valid
    if (now - this.lastAuthCheck < this.authCheckCacheTime && this.cachedAuthStatus !== null) {
      return this.cachedAuthStatus;
    }

    // If check in progress, wait for it
    if (this.authCheckPromise) {
      return this.authCheckPromise;
    }

    // Start new check
    this.authCheckPromise = this.performAuthCheck();
    this.lastAuthCheck = now;

    try {
      const result = await this.authCheckPromise;
      this.cachedAuthStatus = result;
      return result;
    } finally {
      this.authCheckPromise = null;
    }
  }

  private async performAuthCheck(): Promise<boolean> {
    const startTime = Date.now();
    console.log(`🔍 [${new Date().toLocaleTimeString()}] Starting auth check...`);
    
    try {
      const token = this.getToken();
      if (!token) {
        console.log(`❌ [${new Date().toLocaleTimeString()}] No token found`);
        return false;
      }

      console.log(`📡 [${new Date().toLocaleTimeString()}] Making request to check-login...`);
      const response = await fetch(`${API_BASE_URL}/api/check-login/`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
        credentials: 'include',
      });
      
      const elapsed = Date.now() - startTime;
      console.log(`📥 [${new Date().toLocaleTimeString()}] Response received in ${elapsed}ms, status: ${response.status}`);
      
      if (!response.ok) {
        console.log(`❌ [${new Date().toLocaleTimeString()}] Response not OK: ${response.status}`);
        return false;
      }
      
      const data = await response.json();
      const parseTime = Date.now() - startTime;
      console.log(`📋 [${new Date().toLocaleTimeString()}] JSON parsed in ${parseTime}ms:`, data);
      
      const isAuthenticated = data.isAuthenticated;
      
      if (!isAuthenticated) {
        console.log(`❌ [${new Date().toLocaleTimeString()}] Server says not authenticated - clearing data`);
        this.clearAuthData();
      } else {
        console.log(`✅ [${new Date().toLocaleTimeString()}] Authentication confirmed`);
      }
      
      const totalTime = Date.now() - startTime;
      console.log(`⏱️ [${new Date().toLocaleTimeString()}] Total auth check time: ${totalTime}ms`);
      
      return isAuthenticated;
    } catch (error) {
      const errorTime = Date.now() - startTime;
      console.error(`💥 [${new Date().toLocaleTimeString()}] Auth check error after ${errorTime}ms:`, error);
      return false;
    }
  }

  private invalidateAuthCache(): void {
    this.lastAuthCheck = 0;
    this.authCheckPromise = null;
    this.cachedAuthStatus = null;
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

  isTokenExpired(): boolean {
    const token = this.getToken();
    if (!token) return true;
    
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const currentTime = Date.now() / 1000;
      return payload.exp < currentTime;
    } catch {
      return false;
    }
  }

  async authenticatedFetch(url: string, options: RequestInit = {}): Promise<Response> {
    const token = this.getToken();
    if (!token) {
      this.clearAuthData();
      if (typeof window !== 'undefined') {
        window.location.href = '/userlogin';
      }
      throw new Error('No authentication token');
    }

    const response = await fetch(url, {
      ...options,
      credentials: 'include',
      headers: {
        ...this.getAuthHeaders(),
        ...options.headers,
      },
    });
    
    if (response.status === 401) {
      this.clearAuthData();
      this.invalidateAuthCache();
      this.cachedAuthStatus = false;
      
      if (typeof window !== 'undefined') {
        window.location.href = '/userlogin';
      }
    }

    return response;
  }

  // ✅ NEW: Additional helper methods for better integration

  /**
   * Handle successful authentication from any source (email/password or Google OAuth)
   * Centralized logic for post-authentication setup
   */
  private handleAuthSuccess(token: string, user: User): void {
    this.setAuthData(token, user);
    this.invalidateAuthCache();
    this.cachedAuthStatus = true;
    console.log('🎉 Authentication successful, user data cached');
  }

  /**
   * Force refresh auth status (useful after login/logout)
   */
  public forceAuthRefresh(): Promise<boolean> {
    this.invalidateAuthCache();
    return this.checkAuthStatus();
  }

  /**
   * Get cached auth status without making API call
   * Useful for immediate UI decisions
   */
  public getCachedAuthStatus(): boolean | null {
    const now = Date.now();
    if (now - this.lastAuthCheck < this.authCheckCacheTime) {
      return this.cachedAuthStatus;
    }
    return null;
  }

  /**
   * Update user profile data in cache
   */
  public updateUserData(userData: Partial<User>): void {
    const currentUser = this.getUser();
    if (currentUser) {
      const updatedUser = { ...currentUser, ...userData };
      this.setAuthData(this.getToken()!, updatedUser);
    }
  }
}

export const authAPI = new AuthService();