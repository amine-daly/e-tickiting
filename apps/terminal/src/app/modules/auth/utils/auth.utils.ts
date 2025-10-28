export class AuthUtils {
  // Checks if a JWT token is expired
  static isTokenExpired(token: string): boolean {
    if (!token) return true;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (!payload.exp) return false; // No exp claim, treat as not expired
      const now = Math.floor(Date.now() / 1000);
      return payload.exp < now;
    } catch (e) {
      // Invalid token format
      return true;
    }
  }
}
