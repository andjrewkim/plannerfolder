// types/auth.ts
export interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
}

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
  success: boolean;
  message: string;
  token: string;
  user: User;
}

export interface ErrorResponse {
  success: false;
  message?: string;
  errors?: Record<string, string[]>;
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
  first_name?: string;
  last_name?: string;
  username?: string;
  password_confirm?: string;
  submit?: string;
}