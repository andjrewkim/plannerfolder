"use client"

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Calendar, Mail, Lock } from 'lucide-react';
import { authAPI } from '../../lib/auth';
import { FormData, FormErrors, LoginCredentials, RegisterData } from '../../types/auth';

// Remove this duplicate declaration - it conflicts with the one in auth.ts

const GoogleSignInButton: React.FC<{ 
  onSuccess: (token: string) => void; 
  onError: (error: string) => void; 
  isLoading: boolean;
}> = ({ onSuccess, onError, isLoading }) => {
  const [isGoogleLoaded, setIsGoogleLoaded] = useState(false);
  const buttonRef = useRef<HTMLDivElement>(null);
  const scriptLoadedRef = useRef(false);
  const initAttempted = useRef(false);

  const getGoogleClientId = (): string | undefined => {
    return process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  };

  useEffect(() => {
    if (initAttempted.current) return;
    initAttempted.current = true;

    const loadGoogleScript = () => {
      const existingScripts = document.querySelectorAll('script[src*="accounts.google.com"]');
      existingScripts.forEach(script => script.remove());

      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      
      script.onload = () => {
        scriptLoadedRef.current = true;
        setTimeout(initializeGoogle, 500);
      };

      script.onerror = () => {
        onError('Failed to load Google Sign-In');
      };

      document.head.appendChild(script);
    };

    const initializeGoogle = () => {
      if (!window.google?.accounts?.id) {
        onError('Google Sign-In API not available');
        return;
      }

      try {
        const clientId = getGoogleClientId();
        if (!clientId) {
          onError('Google Client ID not configured. Please set NEXT_PUBLIC_GOOGLE_CLIENT_ID.');
          return;
        }
        
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: handleGoogleResponse,
          auto_select: false,
          cancel_on_tap_outside: true,
          ux_mode: 'popup',
          use_fedcm_for_prompt: false,
          context: 'signin',
          itp_support: true,
        } as any);

        if (buttonRef.current) {
          try {
            window.google.accounts.id.renderButton(buttonRef.current, {
              theme: 'outline',
              size: 'large',
              type: 'standard',
              shape: 'rectangular',
              text: 'signin_with',
              logo_alignment: 'left',
              width: 350,
            } as any);
          } catch (renderError) {
            console.error('Failed to render Google button:', renderError);
          }
        }

        setIsGoogleLoaded(true);
        
      } catch (error) {
        onError('Failed to initialize Google Sign-In');
      }
    };

    const handleRedirectResult = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const credential = urlParams.get('credential');
      
      if (credential) {
        handleGoogleResponse({ credential });
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    };

    handleRedirectResult();
    loadGoogleScript();

  }, []);

  const handleGoogleResponse = async (response: any) => {
    try {
      if (!response.credential) {
        throw new Error('No credential received from Google');
      }

      const result = await authAPI.googleAuth(response.credential);
      
      if (result.token && result.user) {
        onSuccess(result.token);
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Google sign-in failed');
    }
  };

  const handleCustomButtonClick = () => {
    if (!isGoogleLoaded || !window.google?.accounts?.id) {
      onError('Google Sign-In not ready yet. Please try again.');
      return;
    }

    try {
      (window.google.accounts.id as any).prompt((notification: any) => {
        if (notification.isNotDisplayed && notification.isNotDisplayed()) {
          (window.google?.accounts?.id as any)?.disableAutoSelect();
          setTimeout(() => {
            (window.google?.accounts?.id as any)?.prompt();
          }, 1000);
        }
      });
      
    } catch (error) {
      onError('Failed to start Google Sign-In');
    }
  };

  return (
    <div className="w-full">
      <div 
        ref={buttonRef} 
        className={`w-full transition-opacity duration-300 ${!isGoogleLoaded ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
        style={{ minHeight: '48px' }}
      />
      
      <button
        type="button"
        onClick={handleCustomButtonClick}
        disabled={isLoading || !isGoogleLoaded}
        className={`w-full flex items-center justify-center px-4 py-3 border border-gray-300 rounded-lg shadow-sm bg-white text-gray-700 hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
          isGoogleLoaded ? 'hidden' : ''
        }`}
      >
        <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        {isLoading ? 'Signing in...' : isGoogleLoaded ? 'Continue with Google' : 'Loading Google Sign-In...'}
      </button>
      
      {!isGoogleLoaded && (
        <div className="w-full flex items-center justify-center py-3 text-gray-500">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500 mr-2"></div>
          Loading Google Sign-In...
        </div>
      )}
    </div>
  );
};

export { GoogleSignInButton };

const LoginPage: React.FC = () => {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState<boolean>(true);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [formData, setFormData] = useState<FormData>({
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    username: '',
    password_confirm: ''
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState<boolean>(false);

  useEffect(() => {
    const checkAuth = async () => {
      const isAuth = await authAPI.checkAuthStatus();
      if (isAuth) {
        router.push('/calendar');
      }
    };
    checkAuth();
  }, [router]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    if (errors[name as keyof FormErrors]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    if (!isLogin) {
      if (!formData.first_name.trim()) {
        newErrors.first_name = 'First name is required';
      }
      if (!formData.last_name.trim()) {
        newErrors.last_name = 'Last name is required';
      }
      if (!formData.password_confirm) {
        newErrors.password_confirm = 'Please confirm your password';
      } else if (formData.password !== formData.password_confirm) {
        newErrors.password_confirm = 'Passwords do not match';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLoginSuccess = () => {
    setIsLoading(true);
    setIsGoogleLoading(true);
    
    setTimeout(() => {
      window.location.href = '/calendar';
      
      setTimeout(() => {
        router.replace('/calendar');
      }, 500);
      
    }, 1000);
  };

  const handleGoogleSuccess = (token: string) => {
    handleLoginSuccess();
  };

  const handleGoogleError = (error: string) => {
    setErrors({ submit: error });
    setIsGoogleLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setIsLoading(true);
    setErrors({});
    
    try {
      if (isLogin) {
        const loginData: LoginCredentials = {
          email: formData.email,
          password: formData.password
        };
        
        const response = await authAPI.login(loginData);
        handleLoginSuccess();
        
      } else {
        const registerData: RegisterData = {
          email: formData.email,
          password: formData.password,
          password_confirm: formData.password_confirm,
          first_name: formData.first_name,
          last_name: formData.last_name,
          username: formData.email,
        };
        
        const response = await authAPI.register(registerData);
        
        if (response.token && response.user) {
          authAPI.setAuthData(response.token, response.user);
        }
        
        handleLoginSuccess();
      }
      
    } catch (error) {
      setErrors({ 
        submit: error instanceof Error ? error.message : `${isLogin ? 'Login' : 'Registration'} failed. Please try again.`
      });
      setIsLoading(false);
    }
  };

  const toggleMode = (): void => {
    setIsLogin(!isLogin);
    setFormData({
      email: '',
      password: '',
      first_name: '',
      last_name: '',
      username: '',
      password_confirm: ''
    });
    setErrors({});
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-blue-600 rounded-full">
              <Calendar className="h-8 w-8 text-white" />
            </div>
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            {isLogin ? 'Welcome back' : 'Create account'}
          </h2>
          <p className="text-gray-600">
            {isLogin 
              ? 'Sign in to access your calendar' 
              : 'Join us to start organizing your schedule'
            }
          </p>
        </div>

        <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-100">
          <div className="mb-6">
            <GoogleSignInButton
              onSuccess={handleGoogleSuccess}
              onError={handleGoogleError}
              isLoading={isGoogleLoading}
            />
          </div>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">Or continue with email</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {!isLogin && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="first_name" className="block text-sm font-medium text-gray-700 mb-2">
                    First Name
                  </label>
                  <input
                    id="first_name"
                    name="first_name"
                    type="text"
                    value={formData.first_name}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200 ${
                      errors.first_name ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="First name"
                  />
                  {errors.first_name && <p className="mt-1 text-sm text-red-600">{errors.first_name}</p>}
                </div>
                <div>
                  <label htmlFor="last_name" className="block text-sm font-medium text-gray-700 mb-2">
                    Last Name
                  </label>
                  <input
                    id="last_name"
                    name="last_name"
                    type="text"
                    value={formData.last_name}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200 ${
                      errors.last_name ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Last name"
                  />
                  {errors.last_name && <p className="mt-1 text-sm text-red-600">{errors.last_name}</p>}
                </div>
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200 ${
                    errors.email ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Enter your email"
                />
              </div>
              {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={handleInputChange}
                  className={`w-full pl-10 pr-12 py-3 rounded-lg border focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200 text-black ${
                    errors.password ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {errors.password && <p className="mt-1 text-sm text-red-600">{errors.password}</p>}
            </div>

            {!isLogin && (
              <div>
                <label htmlFor="password_confirm" className="block text-sm font-medium text-gray-700 mb-2">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    id="password_confirm"
                    name="password_confirm"
                    type="password"
                    value={formData.password_confirm}
                    onChange={handleInputChange}
                    className={`w-full pl-10 pr-4 py-3 rounded-lg border focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200 text-black ${
                      errors.password_confirm ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Confirm your password"
                  />
                </div>
                {errors.password_confirm && (
                  <p className="mt-1 text-sm text-red-600">{errors.password_confirm}</p>
                )}
              </div>
            )}

            {errors.submit && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">{errors.submit}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || isGoogleLoading}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  {isLogin ? 'Signing in...' : 'Creating account...'}
                </div>
              ) : (
                isLogin ? 'Sign In' : 'Create Account'
              )}
            </button>
          </form>
        </div>

        <div className="text-center">
          <p className="text-gray-600">
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <button
              onClick={toggleMode}
              className="text-blue-600 hover:text-blue-800 font-medium"
              disabled={isLoading || isGoogleLoading}
            >
              {isLogin ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;