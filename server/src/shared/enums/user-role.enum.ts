export enum UserRole {
  /** Full access to everything, every company. */
  ADMIN = 'admin',
  /** Owner account of a company: sees only its own objects/devices. */
  COMPANY = 'company',
  /** Hired by a company, sees only the devices explicitly assigned to them. */
  MANAGER = 'manager',
}

export const ALL_ROLES = Object.values(UserRole);
