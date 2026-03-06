export interface User {
  id: string;
  name: string | null;
  email: string | null;
  emailVerified: Date | null;
  image: string | null;
  hashedPassword: string | null;
  createdAt: Date;
  updatedAt: Date;
  calendarSyncAll: boolean;
  calendarToken: string | null;
}

export interface CreateUserInput {
  name: string;
  email: string;
  hashedPassword: string;
}
