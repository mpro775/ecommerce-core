export interface PlatformAdminUser {
  id: string;
  email: string;
  fullName: string;
  status: 'active' | 'disabled';
  mfaEnabled: boolean;
  permissions: string[];
  roleCodes: string[];
  sessionId: string;
}
