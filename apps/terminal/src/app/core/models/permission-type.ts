import { TargetAciInput } from './account.model';

export interface PermissionDefinitionType {
  id?: string;
  name?: string;
  code?: string;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface PermissionPermissionsType {
  permission?: string | PermissionDefinitionType;
  read?: boolean;
  create?: boolean;
  update?: boolean;
}

export interface PermissionTarget {
  pos?: { id?: string };
  company?: { id?: string };
}

export interface PermissionType {
  id?: string;
  name?: string;
  permissions?: PermissionPermissionsType[];
  target?: PermissionTarget;
  createdAt?: string | null;
  updatedAt?: string | null;
}
export interface PermissionInput {
  name?: string;
  permissions?: PermissionPermissionsInput[];
  target?: TargetAciInput;
}

export type PermissionPermissionsInput = {
  create?: boolean;
  permission: string;
  read?: boolean;
  update?: boolean;
};

export default PermissionType;
