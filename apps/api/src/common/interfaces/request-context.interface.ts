export interface RequestUser {
  userId: string;
  email: string;
  tenantId: string;
  tenantUserId: string;
  roleId: string;
  roleName: string;
  permissions: string[];
}

export interface AuthenticatedRequest extends Request {
  user: RequestUser;
}
