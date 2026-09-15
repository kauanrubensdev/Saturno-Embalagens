// Tipos para autenticação do SaturnoEmbalagens

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  phone?: string;
  role: 'customer' | 'admin';
}

export interface RegisterData {
  name: string;
  email: string;
  phone: string;
  password: string;
  passwordConfirm: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface Profile {
  id: string;
  name: string;
  phone?: string;
  role: 'customer' | 'admin';
  created_at: string;
  updated_at: string;
}
