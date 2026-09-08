import {
  pgTable, uuid, text, boolean, timestamp, jsonb, index, uniqueIndex, primaryKey,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { aksiAuditEnum } from './enum'

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull(),
  nama: text('nama').notNull(),
  passwordHash: text('password_hash').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  dibuatPada: timestamp('dibuat_pada', { withTimezone: true }).notNull().defaultNow(),
  diubahPada: timestamp('diubah_pada', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex('users_email_unik').on(t.email)])

export const roles = pgTable('roles', {
  id: uuid('id').primaryKey().defaultRandom(),
  kode: text('kode').notNull(),
  nama: text('nama').notNull(),
  isSystem: boolean('is_system').notNull().default(false),
  dibuatPada: timestamp('dibuat_pada', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex('roles_kode_unik').on(t.kode)])

export const permissions = pgTable('permissions', {
  id: uuid('id').primaryKey().defaultRandom(),
  kode: text('kode').notNull(),
  modul: text('modul').notNull(),
  deskripsi: text('deskripsi'),
}, (t) => [
  uniqueIndex('permissions_kode_unik').on(t.kode),
  index('permissions_modul_idx').on(t.modul),
])

export const rolePermissions = pgTable('role_permissions', {
  roleId: uuid('role_id').notNull().references(() => roles.id, { onDelete: 'cascade' }),
  permissionId: uuid('permission_id').notNull().references(() => permissions.id, { onDelete: 'cascade' }),
}, (t) => [primaryKey({ columns: [t.roleId, t.permissionId] })])

export const userRoles = pgTable('user_roles', {
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  roleId: uuid('role_id').notNull().references(() => roles.id, { onDelete: 'cascade' }),
}, (t) => [primaryKey({ columns: [t.userId, t.roleId] })])

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  entitas: text('entitas').notNull(),
  entitasId: text('entitas_id'),
  aksi: aksiAuditEnum('aksi').notNull(),
  dataLama: jsonb('data_lama'),
  dataBaru: jsonb('data_baru'),
  alamatIp: text('alamat_ip'),
  waktu: timestamp('waktu', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('audit_logs_entitas_idx').on(t.entitas, t.entitasId),
  index('audit_logs_waktu_idx').on(t.waktu),
])

export const usersRelations = relations(users, ({ many }) => ({
  peran: many(userRoles),
}))

export const rolesRelations = relations(roles, ({ many }) => ({
  pengguna: many(userRoles),
  izin: many(rolePermissions),
}))

export const userRolesRelations = relations(userRoles, ({ one }) => ({
  pengguna: one(users, { fields: [userRoles.userId], references: [users.id] }),
  peran: one(roles, { fields: [userRoles.roleId], references: [roles.id] }),
}))

export const rolePermissionsRelations = relations(rolePermissions, ({ one }) => ({
  peran: one(roles, { fields: [rolePermissions.roleId], references: [roles.id] }),
  izin: one(permissions, { fields: [rolePermissions.permissionId], references: [permissions.id] }),
}))
