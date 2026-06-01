import type { PermissionAction, PermissionType, WorkloadType } from '../enums.js';

export interface ConnectorResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
  rollbackContext?: RollbackContext;
}

export interface RollbackContext {
  workloadType: WorkloadType;
  operation: 'ADD' | 'REMOVE';
  resourceId: string;
  targetOid: string;
  permissionType: PermissionType;
  preStateSnapshot: unknown;
}

export interface AccessChangeRequest {
  requestId: string;
  workloadType: WorkloadType;
  resourceId: string;
  targetOid: string;
  targetUpn?: string;
  permissionType: PermissionType;
  permissionAction: PermissionAction;
  accessEnd?: Date;
}

export interface DirectoryObject {
  id: string;
  displayName: string;
  type: 'user' | 'group' | 'contact' | 'resource';
  email?: string;
  upn?: string;
  sid?: string;
  distinguishedName?: string;
  objectId?: string;
  workloadType: WorkloadType;
  disambiguator: string;
}

export interface ResourceObject {
  id: string;
  displayName: string;
  type: string;
  path?: string;
  url?: string;
  workloadType: WorkloadType;
  description?: string;
}

export interface PermissionPreview {
  targetDisplay: string;
  resourceDisplay: string;
  permissionType: PermissionType;
  permissionAction: PermissionAction;
  effectivePermissions?: string[];
  warnings?: string[];
}
