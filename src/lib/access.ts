import type { BusinessRole } from "./types";

export const roleLabels: Record<BusinessRole, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  staff: "Staff",
};

export const canManageUsers = (role: BusinessRole | null) => role === "super_admin" || role === "admin";

export const canCreateUsers = (role: BusinessRole | null, allowAdminCreateStaff: boolean) =>
  role === "super_admin" || (role === "admin" && allowAdminCreateStaff);

export const canManageMenus = (role: BusinessRole | null) => role === "super_admin";

export const getAssignableRoles = (role: BusinessRole | null): BusinessRole[] => {
  if (role === "super_admin") return ["admin"];
  if (role === "admin") return ["staff"];
  return [];
};

export const canManageMember = (actorRole: BusinessRole | null, targetRole: BusinessRole) => {
  if (actorRole === "super_admin") return targetRole === "admin";
  if (actorRole === "admin") return targetRole === "staff";
  return false;
};

export const getManagedRoleForActor = (role: BusinessRole | null): BusinessRole | null => {
  if (role === "super_admin") return "admin";
  if (role === "admin") return "staff";
  return null;
};

export const getRoleLabel = (role: BusinessRole | null) => {
  if (!role) return "-";
  return roleLabels[role] || role;
};
