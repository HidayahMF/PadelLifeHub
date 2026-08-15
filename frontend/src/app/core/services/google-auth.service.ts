import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { environment } from '../../../environments/environment';

/** Minimal typings for the Google Identity Services (GIS) API. */
interface GsiCredentialResponse {
  credential?: string;
  select_by?: string;
}

interface GsiIdApi {
  initialize: (options: {
    client_id: string;
    auto_select?: boolean;
    callback: (response: GsiCredentialResponse) => void;
  }) => void;
  renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
}

interface GsiAccounts {
  id: GsiIdApi;
}

interface GsiApi {
  accounts: GsiAccounts;
}

declare global {
  interface Window {
    google?: GsiApi;
  }
}

/**
 * Wraps Google Identity Services (GIS) so auth screens can show the official
 * "Continue with Google" button and stream the resulting ID token to the app.
 *
 * This service only talks to the GIS client — it never calls our backend.
 * `AuthService.googleLogin()` handles the API round-trip.
 */
@Injectable({ providedIn: 'root' })
export class GoogleAuthService {
  /** Emits the verified ID token when a user signs in successfully. */
  readonly success$ = new Subject<string>();
  /** Emits a user-friendly message when sign-in fails or is cancelled. */
  readonly failure$ = new Subject<string>();

  private initialized = false;

  /** Whether a Google Client ID is configured for the current environment. */
  get configured(): boolean {
    return !!environment.googleClientId;
  }

  /**
   * Render the official Google button into `container` and start listening
   * for credentials. Safe to call once per auth screen.
   */
  renderButton(container: HTMLElement): Promise<void> {
    return this.loadGsi()
      .then((gsi) => {
        this.initialize(gsi);
        const width = Math.max(280, Math.min(384, container.clientWidth || 340));
        gsi.accounts.id.renderButton(container, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          shape: 'rectangular',
          width,
          text: 'continue_with',
          logo_alignment: 'left',
        });
      })
      .catch((err: Error) => {
        this.failure$.next(err.message);
      });
  }

  /**
   * Resolve the GIS API, waiting briefly for the async script in index.html.
   * Rejects with a friendly message if the API never becomes available.
   */
  private loadGsi(): Promise<GsiApi> {
    return new Promise((resolve, reject) => {
      if (window.google) {
        resolve(window.google);
        return;
      }
      let attempts = 0;
      const timer = setInterval(() => {
        if (window.google) {
          clearInterval(timer);
          resolve(window.google);
        } else if (++attempts >= 50) {
          clearInterval(timer);
          reject(new Error('Google sign-in failed to load. Please try again.'));
        }
      }, 100);
    });
  }

  private initialize(gsi: GsiApi): void {
    if (this.initialized) return;
    this.initialized = true;
    gsi.accounts.id.initialize({
      client_id: environment.googleClientId,
      auto_select: false,
      callback: (response) => this.handleResponse(response),
    });
  }

  private handleResponse(response: GsiCredentialResponse): void {
    if (response?.credential) {
      this.success$.next(response.credential);
    } else {
      this.failure$.next('Google sign-in was cancelled.');
    }
  }
}
