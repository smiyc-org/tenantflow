import type { PermissionType, WorkloadType } from '../enums.js';
import type { DirectoryObject, ResourceObject } from '../types/connector.types.js';

export interface SearchQueryDto {
  q: string;
  workload?: WorkloadType;
  type?: 'user' | 'group' | 'resource';
  limit?: number;
}

export interface SearchResultDto {
  principals: DirectoryObject[];
  resources: ResourceObject[];
  query: string;
  durationMs: number;
}

export interface PermissionsForResourceDto {
  resourceId: string;
  workloadType: WorkloadType;
  availablePermissions: PermissionType[];
  descriptions: Record<PermissionType, string>;
}
