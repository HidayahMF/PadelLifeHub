import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastHostComponent } from './toast-host.component';
import { AuthService } from './core/services/auth.service';
import { SettingService } from './core/services/data.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ToastHostComponent],
  template: `
    <router-outlet />
    <app-toast-host />
  `,
})
export class App implements OnInit {
  private auth = inject(AuthService);
  private settings = inject(SettingService);

  ngOnInit(): void {
    // Preload the user's settings once on boot so theme and notification
    // preferences are correct across the whole app immediately after sign-in.
    if (this.auth.isAuthenticated()) {
      this.settings.load();
    }
  }
}
