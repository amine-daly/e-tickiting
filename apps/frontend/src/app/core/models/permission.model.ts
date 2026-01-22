export interface PermissionDefinition {
  id: string;
  name: string | null;
  code: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface PermissionGrant {
  permission: PermissionDefinition | null;
  read?: boolean | null;
  create?: boolean | null;
  update?: boolean | null;
}

export interface PermissionRole {
  id: string;
  name: string;
  permissions: PermissionGrant[];
  target?: { pos?: { id: string } } | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface PermissionGrantInput {
  permission: string;
  read?: boolean | null;
  create?: boolean | null;
  update?: boolean | null;
}

export interface PermissionInput {
  name: string;
  permissions: PermissionGrantInput[];
  target?: { pos: string } | null;
}
