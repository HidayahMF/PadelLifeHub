import { inject, Injectable } from '@angular/core';
import type { SearchResults } from '../models/misc.model';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class SearchService {
  private api = inject(ApiService);

  search(query: string) {
    return this.api.get<{ query: string; results: SearchResults }>('/search', {
      q: query,
    });
  }
}
