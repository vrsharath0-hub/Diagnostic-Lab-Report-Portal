import { eq, sql } from 'drizzle-orm';
import { db } from './index.ts';
import { patients, users } from './schema.ts';

const INITIAL_ADMIN_EMAILS = new Set([
  'vrsharath0@gmail.com',
  ...(process.env.ADMIN_EMAILS ? process.env.ADMIN_EMAILS.split(',').map((e) => e.trim().toLowerCase()) : []),
]);

export type UserRole = 'admin' | 'staff' | 'patient';

export async function getOrCreateUser(uid: string, email: string, fullName?: string) {
  try {
    const normalizedEmail = email.trim().toLowerCase();
    const displayName = (fullName && fullName.trim()) || normalizedEmail.split('@')[0];

    const existing = await db
      .select()
      .from(users)
      .where(eq(users.uid, uid))
      .limit(1);

    let userRecord = existing[0];

    if (!userRecord) {
      // Check if this is the initial owner/admin or if no admin exists yet
      const isInitialAdmin = INITIAL_ADMIN_EMAILS.has(normalizedEmail);
      const defaultRole: UserRole = isInitialAdmin ? 'admin' : 'patient';

      const inserted = await db
        .insert(users)
        .values({
          uid,
          email: normalizedEmail,
          fullName: displayName,
          role: defaultRole,
        })
        .onConflictDoUpdate({
          target: users.uid,
          set: {
            email: normalizedEmail,
            fullName: displayName,
          },
        })
        .returning();

      userRecord = inserted[0];
    } else if (INITIAL_ADMIN_EMAILS.has(normalizedEmail) && userRecord.role !== 'admin') {
      const promoted = await db
        .update(users)
        .set({ role: 'admin', email: normalizedEmail })
        .where(eq(users.id, userRecord.id))
        .returning();
      userRecord = promoted[0];
    }

    // Automatically bind any patient profile matching this email if not yet linked
    if (userRecord) {
      await db
        .update(patients)
        .set({ userId: userRecord.id })
        .where(
          sql`lower(${patients.email}) = ${normalizedEmail} AND ${patients.userId} IS NULL`
        );
    }

    return userRecord;
  } catch (error) {
    console.error('Database error in getOrCreateUser:', error);
    throw new Error('Unable to load account profile. Please try again.', { cause: error });
  }
}

export async function listAllUsers() {
  try {
    return await db
      .select({
        id: users.id,
        uid: users.uid,
        email: users.email,
        fullName: users.fullName,
        role: users.role,
        phone: users.phone,
        createdAt: users.createdAt,
      })
      .from(users);
  } catch (error) {
    console.error('Database error in listAllUsers:', error);
    throw new Error('Unable to load user directory. Please try again.', { cause: error });
  }
}

export async function updateUserRole(userId: number, role: UserRole) {
  try {
    const updated = await db
      .update(users)
      .set({ role })
      .where(eq(users.id, userId))
      .returning();
    return updated[0] ?? null;
  } catch (error) {
    console.error('Database error in updateUserRole:', error);
    throw new Error('Unable to update user role. Please try again.', { cause: error });
  }
}
