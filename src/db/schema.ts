import { relations } from 'drizzle-orm';
import {
  integer,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  fullName: text('full_name').notNull(),
  role: text('role').notNull().default('patient'), // 'admin' | 'staff' | 'patient'
  phone: text('phone'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const patients = pgTable('patients', {
  id: serial('id').primaryKey(),
  patientCode: text('patient_code').notNull().unique(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  fullName: text('full_name').notNull(),
  dateOfBirth: text('date_of_birth').notNull(), // YYYY-MM-DD
  gender: text('gender').notNull(), // 'Female' | 'Male' | 'Other'
  phone: text('phone').notNull(),
  email: text('email'),
  address: text('address'),
  bloodGroup: text('blood_group'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const testOrders = pgTable('test_orders', {
  id: serial('id').primaryKey(),
  testCode: text('test_code').notNull().unique(),
  sampleCode: text('sample_code').notNull().unique(),
  patientId: integer('patient_id')
    .references(() => patients.id, { onDelete: 'cascade' })
    .notNull(),
  testName: text('test_name').notNull(),
  category: text('category').notNull(),
  status: text('status').notNull().default('registered'), // 'registered' | 'sample_collected' | 'processing' | 'report_ready'
  priority: text('priority').notNull().default('routine'), // 'routine' | 'urgent' | 'stat'
  referringPhysician: text('referring_physician'),
  sampleType: text('sample_type').notNull().default('Venous Blood (EDTA)'),
  clinicalNotes: text('clinical_notes'),
  pathologistName: text('pathologist_name').notNull().default('Dr. Evelyn Reed, MD, PhD'),
  reportFileName: text('report_file_name'),
  reportFileMime: text('report_file_mime'),
  reportFileBase64: text('report_file_base64'),
  orderedAt: timestamp('ordered_at').defaultNow().notNull(),
  collectedAt: timestamp('collected_at'),
  processingAt: timestamp('processing_at'),
  completedAt: timestamp('completed_at'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const testResultValues = pgTable('test_result_values', {
  id: serial('id').primaryKey(),
  testOrderId: integer('test_order_id')
    .references(() => testOrders.id, { onDelete: 'cascade' })
    .notNull(),
  parameterName: text('parameter_name').notNull(),
  measuredValue: text('measured_value').notNull(),
  unit: text('unit').notNull(),
  referenceRange: text('reference_range').notNull(),
  flag: text('flag').notNull().default('normal'), // 'normal' | 'low' | 'high' | 'critical'
  sortOrder: integer('sort_order').notNull().default(0),
});

export const otpChallenges = pgTable('otp_challenges', {
  id: serial('id').primaryKey(),
  testOrderId: integer('test_order_id')
    .references(() => testOrders.id, { onDelete: 'cascade' })
    .notNull(),
  patientId: integer('patient_id')
    .references(() => patients.id, { onDelete: 'cascade' })
    .notNull(),
  codeHash: text('code_hash').notNull(),
  attempts: integer('attempts').notNull().default(0),
  expiresAt: timestamp('expires_at').notNull(),
  consumedAt: timestamp('consumed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  patients: many(patients),
}));

export const patientsRelations = relations(patients, ({ one, many }) => ({
  user: one(users, {
    fields: [patients.userId],
    references: [users.id],
  }),
  testOrders: many(testOrders),
}));

export const testOrdersRelations = relations(testOrders, ({ one, many }) => ({
  patient: one(patients, {
    fields: [testOrders.patientId],
    references: [patients.id],
  }),
  results: many(testResultValues),
}));

export const testResultValuesRelations = relations(testResultValues, ({ one }) => ({
  testOrder: one(testOrders, {
    fields: [testResultValues.testOrderId],
    references: [testOrders.id],
  }),
}));
