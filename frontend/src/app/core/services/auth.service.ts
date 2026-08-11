import { inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { tap } from 'rxjs/operators';
import type { AuthResponse, RegisterPayload, User } from '../models/user.model';
import { ApiService } from './api.service';

const TOKEN_KEY = 'lifehub_token';
const USER_KEY = 'lifehub_user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private api = inject(ApiService);
  private router = inject(Router);

  readonly user = signal<User | null>(this.loadStoredUser());
  readonly isAuthenticated = signal(this.user() !== null);

  get token(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  login(email: string, password: string) {
    return this.api.post<AuthResponse>('/auth/login', { email, password }).pipe(
      tap((res) => this.persist(res))
    );
  }

  register(payload: RegisterPayload) {
    return this.api.post<AuthResponse>('/auth/register', payload).pipe(
      tap((res) => this.persist(res))
    );
  }

  getProfile() {
    return this.api.get<User>('/auth/profile').pipe(
      tap((user) => {
        this.user.set(user);
        localStorage.setItem(USER_KEY, JSON.stringify(user));
      })
    );
  }

  updateProfile(payload: { name?: string; avatar?: string }) {
    return this.api.put<User>('/auth/profile', payload).pipe(
      tap((user) => {
        this.user.set(user);
        localStorage.setItem(USER_KEY, JSON.stringify(user));
      })
    );
  }

  changePassword(currentPassword: string, newPassword: string) {
    return this.api.put('/auth/change-password', { currentPassword, newPassword });
  }

  logout() {
    this.clearSession();
    this.router.navigate(['/login']);
  }

  /** Called by the auth interceptor when the API returns 401 (expired token). */
  handleUnauthorized() {
    if (!this.isAuthenticated()) return;
    this.clearSession();
    // Avoid redirect loops: only navigate when not already on a guest page.
    if (!this.router.url.startsWith('/login')) {
      this.router.navigate(['/login']);
    }
  }

  private clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this.user.set(null);
    this.isAuthenticated.set(false);
  }

  private persist(res: AuthResponse) {
    localStorage.setItem(TOKEN_KEY, res.token);
    const user: User = {
      _id: res._id,
      name: res.name,
      email: res.email,
      avatar: res.avatar,
    };
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    this.user.set(user);
    this.isAuthenticated.set(true);
  }

  private loadStoredUser(): User | null {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return null;
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? (JSON.parse(raw) as User) : null;
    } catch {
      return null;
    }
  }
}
