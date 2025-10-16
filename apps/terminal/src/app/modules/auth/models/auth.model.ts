import { UserType } from './user-type';

export class AuthResponse {
  authToken: string;
  refreshToken: string;
  expiresIn: Date;
  user: UserType;

  setAuth(auth: AuthResponse) {
    this.authToken = auth.authToken;
    this.refreshToken = auth.refreshToken;
    this.expiresIn = auth.expiresIn;
    this.user = auth.user;
  }
}
