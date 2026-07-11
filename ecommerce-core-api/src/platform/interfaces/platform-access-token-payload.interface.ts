export interface PlatformAccessTokenPayload {
  sub: string;
  sid: string;
  email: string;
  fullName: string;
  mfaEnabled: boolean;
  permissions: string[];
  roleCodes: string[];
  kind: 'platform_admin';
}
