import type { PermissionRequest } from '@opencode/client';

export const upsertPermission = (
  prev: unknown,
  permission: PermissionRequest,
): PermissionRequest[] => {
  const permissions = Array.isArray(prev)
    ? (prev as PermissionRequest[])
    : [];
  return [...permissions.filter((p) => p.id !== permission.id), permission];
};

export const removePermission = (
  prev: unknown,
  permissionID: string,
): PermissionRequest[] =>
  Array.isArray(prev)
    ? (prev as PermissionRequest[]).filter((p) => p.id !== permissionID)
    : [];
