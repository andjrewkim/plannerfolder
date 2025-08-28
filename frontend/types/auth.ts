// types/auth.ts - UPDATED TO MATCH EXISTING PATTERNS

export interface User {
  id: number;
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  date_joined: string;
  // Optional: Add Google-specific fields if needed
  google_id?: string;
  avatar_url?: string;
}

// ✅ MATCHING YOUR EXISTING PATTERNS
export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  password_confirm: string;
  first_name: string;
  last_name: string;
  username: string;
}

export interface AuthResponse {
  token: string;
  refresh?: string;
  user: User;
  message?: string;
}

// ✅ NEW: Google OAuth types
export interface GoogleAuthData {
  credential: string;
  client_id?: string;
}

export interface GoogleAuthResponse extends AuthResponse {
  // Same as AuthResponse, but could extend with Google-specific data
  provider?: 'google';
}

export interface FormData {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  username: string;
  password_confirm: string;
}

export interface FormErrors {
  email?: string;
  password?: string;
  password_confirm?: string;
  first_name?: string;
  last_name?: string;
  username?: string;
  submit?: string;
}

// ✅ NEW: Google Identity Services types for window.google
export interface GoogleIdentityServices {
  accounts: {
    id: {
      initialize: (config: GoogleInitConfig) => void;
      prompt: (momentListener?: (notification: PromptMomentNotification) => void) => void;
      renderButton: (parent: HTMLElement, options: GoogleButtonConfig) => void;
      disableAutoSelect: () => void;
      storeCredential: (credential: { id: string; password: string }) => void;
      cancel: () => void;
      onGoogleLibraryLoad: () => void;
      revoke: (hint: string, callback: (response: RevocationResponse) => void) => void;
    };
    oauth2: {
      initTokenClient: (config: TokenClientConfig) => GoogleTokenClient;
      hasGrantedAnyScope: (tokenResponse: TokenResponse, ...scopes: string[]) => boolean;
      hasGrantedAllScopes: (tokenResponse: TokenResponse, ...scopes: string[]) => boolean;
      revoke: (accessToken: string, done?: () => void) => void;
    };
  };
}

export interface GoogleInitConfig {
  client_id: string;
  callback: (response: CredentialResponse) => void;
  auto_select?: boolean;
  cancel_on_tap_outside?: boolean;
  context?: 'signin' | 'signup' | 'use';
  state_cookie_domain?: string;
  ux_mode?: 'popup' | 'redirect';
  login_uri?: string;
  native_callback?: (response: CredentialResponse) => void;
  intermediate_iframe_close_callback?: () => void;
  itp_support?: boolean;
}

export interface CredentialResponse {
  credential: string;
  select_by: 'auto' | 'user' | 'user_1tap' | 'user_2tap' | 'btn' | 'btn_confirm';
  client_id?: string;
}

export interface GoogleButtonConfig {
  type?: 'standard' | 'icon';
  theme?: 'outline' | 'filled_blue' | 'filled_black';
  size?: 'large' | 'medium' | 'small';
  text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
  shape?: 'rectangular' | 'pill' | 'circle' | 'square';
  logo_alignment?: 'left' | 'center';
  width?: number;
  locale?: string;
}

export interface PromptMomentNotification {
  getMomentType: () => 'display' | 'skipped' | 'dismissed';
  getNotDisplayedReason: () => 'browser_not_supported' | 'invalid_client' | 'missing_client_id' | 'opt_out_or_no_session' | 'secure_http_required' | 'suppressed_by_user' | 'unregistered_origin' | 'unknown_reason';
  getSkippedReason: () => 'auto_cancel' | 'user_cancel' | 'tap_outside' | 'issuing_failed';
  getDismissedReason: () => 'credential_returned' | 'cancel_called' | 'flow_restarted';
}

export interface TokenClientConfig {
  client_id: string;
  scope: string;
  callback?: (response: TokenResponse) => void;
  error_callback?: (response: ErrorResponse) => void;
  state?: string;
  enable_serial_consent?: boolean;
  hint?: string;
  hosted_domain?: string;
}

export interface GoogleTokenClient {
  requestAccessToken: (overrideConfig?: Partial<TokenClientConfig>) => void;
}

export interface TokenResponse {
  access_token: string;
  authuser: string;
  expires_in: number;
  prompt: string;
  scope: string;
  token_type: string;
  state?: string;
  error?: string;
  error_description?: string;
  error_uri?: string;
}

export interface ErrorResponse {
  type: string;
  [key: string]: any;
}

export interface RevocationResponse {
  successful: boolean;
  error?: string;
  error_description?: string;
}

// Extend the Window interface
declare global {
  interface Window {
    google?: GoogleIdentityServices;
  }
}