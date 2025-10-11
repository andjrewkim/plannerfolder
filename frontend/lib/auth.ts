// lib/auth.ts - Combined user status fetching
import { User, LoginCredentials, RegisterData, AuthResponse } from '../types/auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

// Add new interface for user status
interface UserStatus {
  hasSeenOnboarding: boolean;
  hasUnlockedFeatures: boolean;
}

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

  // Only return Authorization header, let callers set Content-Type when needed
  private getAuthHeaders(): Record<string, string> {
    const token = this.getToken();
    return {
      ...(token && { 'Authorization': `Token ${token}` }),
    };
  }

  // ✅ NEW: Combined status endpoint - fetches both onboarding and features status
  async getUserStatus(): Promise<UserStatus> {
    try {
      const token = this.getToken();
      
      const response = await fetch(`${API_BASE_URL}/api/user/status/`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Token ${token}` }),
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch user status');
      }
      
      const data = await response.json();
      return {
        hasSeenOnboarding: data.has_seen_onboarding || false,
        hasUnlockedFeatures: data.has_unlocked_features || false,
      };
    } catch (error) {
      console.error('Error fetching user status:', error);
      return { 
        hasSeenOnboarding: false,
        hasUnlockedFeatures: false,
      };
    }
  }

  // DEPRECATED: Use getUserStatus() instead
  async getOnboardingStatus() {
    const status = await this.getUserStatus();
    return { hasSeenOnboarding: status.hasSeenOnboarding };
  }
  
  async markOnboardingSeen() {
    try {
      const token = this.getToken();
      
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await fetch(`${API_BASE_URL}/api/user/onboarding/seen/`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Token ${token}`,
        },
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || `Server returned ${response.status}`);
      }
      
      return true;
    } catch (error) {
      console.error('Error updating onboarding status:', error);
      throw error;
    }
  }

  // ✅ NEW: Update feature unlock status
  async updateFeatureUnlock(unlocked: boolean): Promise<boolean> {
    try {
      const token = this.getToken();
      
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await fetch(`${API_BASE_URL}/api/user/features/unlock/`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Token ${token}`,
        },
        body: JSON.stringify({ has_unlocked_features: unlocked }),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || `Server returned ${response.status}`);
      }
      
      return true;
    } catch (error) {
      console.error('Error updating feature unlock status:', error);
      throw error;
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
        headers: {
          ...this.getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });
      
      this.clearAuthData();
      this.invalidateAuthCache();
      this.cachedAuthStatus = false;
      
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
    
    if (now - this.lastAuthCheck < this.authCheckCacheTime && this.cachedAuthStatus !== null) {
      return this.cachedAuthStatus;
    }

    if (this.authCheckPromise) {
      return this.authCheckPromise;
    }

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

  isTokenExpired(): boolean {
    return false;
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
      // Start with Authorization header from getAuthHeaders()
      const baseHeaders: Record<string, string> = this.getAuthHeaders();
      
      // Convert user's headers to a plain object
      const userHeaders: Record<string, string> = {};
      if (options.headers) {
        const headersObj = new Headers(options.headers);
        headersObj.forEach((value, key) => {
          userHeaders[key] = value;
        });
      }
      
      // Merge: User headers override base headers (including Content-Type)
      const finalHeaders = {
        ...baseHeaders,
        ...userHeaders,
      };

      const response = await fetch(url, {
        ...options,
        credentials: 'include',
        headers: finalHeaders,
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

  private handleAuthSuccess(token: string, user: User): void {
    this.setAuthData(token, user);
    this.invalidateAuthCache();
    this.cachedAuthStatus = true;
  }

  public forceAuthRefresh(): Promise<boolean> {
    this.invalidateAuthCache();
    return this.checkAuthStatus();
  }

  public getCachedAuthStatus(): boolean | null {
    const now = Date.now();
    if (now - this.lastAuthCheck < this.authCheckCacheTime) {
      return this.cachedAuthStatus;
    }
    return null;
  }

  public updateUserData(userData: Partial<User>): void {
    const currentUser = this.getUser();
    if (currentUser) {
      const updatedUser = { ...currentUser, ...userData };
      this.setAuthData(this.getToken()!, updatedUser);
    }
  }

  public getLoginDuration(): number | null {
    if (typeof window === 'undefined') return null;
    const loginTime = localStorage.getItem('authLoginTime');
    if (!loginTime) return null;
    return Date.now() - parseInt(loginTime, 10);
  }
}

export const authAPI = new AuthService();