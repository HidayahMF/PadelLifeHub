export interface User {
  _id: string;
  name: string;
  email: string;
  avatar?: string;
  token?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AuthResponse {
  _id: string;
  name: string;
  email: string;
  avatar?: string;
  token: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
}
