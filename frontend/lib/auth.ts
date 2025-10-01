// lib/auth.ts - PRODUCTION READY WITH PERSISTENT LOGIN (NEVER EXPIRES)
import { User, LoginCredentials, RegisterData, AuthResponse } from '../types/auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

// Helper function to handle unknown errors
const handleError = (error: unknown): Error => {
  if (error instanceof Error) {
    return error;
  }
  return new Error(String(error));
};

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
  async getOnboardingStatus() {
    try {
      const response = await fetch('/api/user/onboarding/', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch onboarding status');
      }
      
      const data = await response.json();
      return {
        hasSeenOnboarding: data.has_seen_onboarding || false,
      };
    } catch (error) {
      console.error('Error fetching onboarding status:', error);
      return { hasSeenOnboarding: false };
    }
  }
  
  // Mark onboarding as seen
  async markOnboardingSeen() {
    try {
      const response = await fetch('/api/user/onboarding/seen/', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to update onboarding status');
      }
      
      return true;
    } catch (error) {
      console.error('Error updating onboarding status:', error);
      return false;
    }
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
        this.handleAuthSuccess(data.token, data.user);
      }

      return data;
    } catch (error) {
      throw handleError(error);
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
      throw handleError(error);
    }
  }

  async googleAuth(credential: string): Promise<AuthResponse> {
    try {
      // Basic validation
      if (!credential || credential === 'null' || credential === 'undefined') {
        throw new Error('Invalid credential provided to Google OAuth');
      }

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
        this.handleAuthSuccess(data.token, data.user);
      }

      return data;
    } catch (error) {
      const handledError = handleError(error);
      // Only log errors in development or for critical issues
      if (process.env.NODE_ENV === 'development') {
        console.error('Google OAuth error:', handledError.message);
      }
      throw handledError;
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
      // Always clear auth data on logout, regardless of network errors
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
    } catch (error) {
      this.cachedAuthStatus = false;
      return false;
    } finally {
      this.authCheckPromise = null;
    }
  }

  private async performAuthCheck(): Promise<boolean> {
    try {
      const token = this.getToken();
      if (!token) {
        return false;
      }

      const response = await fetch(`${API_BASE_URL}/api/check-login/`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
        credentials: 'include',
      });
      
      if (!response.ok) {
        return false;
      }
      
      const data = await response.json();
      const isAuthenticated = data.isAuthenticated;
      
      if (!isAuthenticated) {
        this.clearAuthData();
      }
      
      return isAuthenticated;
    } catch (error) {
      // Only log auth check errors in development
      if (process.env.NODE_ENV === 'development') {
        console.error('Auth check failed:', handleError(error).message);
      }
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
    // Set a timestamp for when the login occurred (optional, for analytics)
    localStorage.setItem('authLoginTime', Date.now().toString());
  }

  clearAuthData(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    localStorage.removeItem('authLoginTime');
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  // Remove token expiry check since tokens never expire
  isTokenExpired(): boolean {
    return false; // Tokens never expire
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

    try {
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
    } catch (error) {
      throw handleError(error);
    }
  }

  /**
   * Handle successful authentication from any source (email/password or Google OAuth)
   * Centralized logic for post-authentication setup
   */
  private handleAuthSuccess(token: string, user: User): void {
    this.setAuthData(token, user);
    this.invalidateAuthCache();
    this.cachedAuthStatus = true;
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

  /**
   * Get how long the user has been logged in (optional utility)
   */
  public getLoginDuration(): number | null {
    if (typeof window === 'undefined') return null;
    const loginTime = localStorage.getItem('authLoginTime');
    if (!loginTime) return null;
    return Date.now() - parseInt(loginTime, 10);
  }
}

export const authAPI = new AuthService();