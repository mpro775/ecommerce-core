export interface PlatformAuthResult {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    fullName: string;
    status: 'active' | 'disabled';
    mfaEnabled: boolean;
    permissions: string[];
    roleCodes: string[];
    sessionId: string;
  };
}
