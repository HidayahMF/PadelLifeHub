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

export interface ProfileJourney {
  joinedAt: string;
  firstActivityAt: string | null;
  firstActivitySource: 'recorded' | 'reconstructed' | null;
  statistics: {
    notesCreated: number;
    tasksCompleted: number;
    goalsCompleted: number;
    activeDays: number;
  };
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
