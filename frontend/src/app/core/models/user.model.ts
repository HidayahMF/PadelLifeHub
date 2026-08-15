export interface User {
  _id: string;
  name: string;
  email: string;
  avatar?: string;
  token?: string;
  provider?: 'email' | 'google';
  hasPassword?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface AuthResponse {
  _id: string;
  name: string;
  email: string;
  avatar?: string;
  provider?: 'email' | 'google';
  hasPassword?: boolean;
  token: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
}
