import crypto from 'crypto';
import { and, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm';
import { db } from './index.ts';
import { otpChallenges, patients, testOrders, testResultValues } from './schema.ts';
import {
  generateSixDigitOtp,
  hashOtpCode,
  normalizePhoneDigits,
  verifyOtpCode,
} from '../lib/session.ts';

export type OrderStatus = 'registered' | 'sample_collected' | 'processing' | 'report_ready';
export type ResultFlag = 'normal' | 'low' | 'high' | 'critical';

function generateUniqueSuffix(): string {
  return String(crypto.randomInt(1000, 9999));
}

export async function getDashboardMetrics() {
  try {
    const [patientCountRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(patients);

    const statusRows = await db
      .select({
        status: testOrders.status,
        count: sql<number>`count(*)::int`,
      })
      .from(testOrders)
      .groupBy(testOrders.status);

    const counts: Record<string, number> = {
      registered: 0,
      sample_collected: 0,
      processing: 0,
      report_ready: 0,
    };

    let totalOrders = 0;
    for (const row of statusRows) {
      counts[row.status] = row.count;
      totalOrders += row.count;
    }

    return {
      totalPatients: patientCountRow?.count ?? 0,
      totalOrders,
      registeredCount: counts.registered,
      collectedCount: counts.sample_collected,
      processingCount: counts.processing,
      reportReadyCount: counts.report_ready,
    };
  } catch (error) {
    console.error('Database error in getDashboardMetrics:', error);
    throw new Error('Unable to load laboratory summary metrics.', { cause: error });
  }
}

export async function listPatients(search?: string) {
  try {
    const trimmed = search?.trim();
    let rows;

    if (trimmed) {
      const pattern = `%${trimmed}%`;
      rows = await db
        .select()
        .from(patients)
        .where(
          or(
            ilike(patients.patientCode, pattern),
            ilike(patients.fullName, pattern),
            ilike(patients.phone, pattern),
            ilike(patients.email, pattern)
          )
        )
        .orderBy(desc(patients.createdAt));
    } else {
      rows = await db.select().from(patients).orderBy(desc(patients.createdAt));
    }

    if (rows.length === 0) return [];

    const patientIds = rows.map((p) => p.id);
    const orderCounts = await db
      .select({
        patientId: testOrders.patientId,
        totalTests: sql<number>`count(*)::int`,
        readyTests: sql<number>`count(*) filter (where ${testOrders.status} = 'report_ready')::int`,
      })
      .from(testOrders)
      .where(inArray(testOrders.patientId, patientIds))
      .groupBy(testOrders.patientId);

    const countMap = new Map(orderCounts.map((c) => [c.patientId, c]));
    return rows.map((p) => ({
      ...p,
      totalTests: countMap.get(p.id)?.totalTests ?? 0,
      readyTests: countMap.get(p.id)?.readyTests ?? 0,
    }));
  } catch (error) {
    console.error('Database error in listPatients:', error);
    throw new Error('Unable to search patient records.', { cause: error });
  }
}

export async function createPatient(input: {
  fullName: string;
  dateOfBirth: string;
  gender: string;
  phone: string;
  email?: string | null;
  address?: string | null;
  bloodGroup?: string | null;
}) {
  try {
    const year = new Date().getFullYear();
    const patientCode = `PAT-${year}-${generateUniqueSuffix()}`;

    const [created] = await db
      .insert(patients)
      .values({
        patientCode,
        fullName: input.fullName.trim(),
        dateOfBirth: input.dateOfBirth.trim(),
        gender: input.gender.trim(),
        phone: input.phone.trim(),
        email: input.email?.trim() || null,
        address: input.address?.trim() || null,
        bloodGroup: input.bloodGroup?.trim() || null,
      })
      .returning();

    return created;
  } catch (error) {
    console.error('Database error in createPatient:', error);
    throw new Error('Unable to register patient. Please check the entered fields.', {
      cause: error,
    });
  }
}

export async function updatePatient(
  patientId: number,
  input: {
    fullName: string;
    dateOfBirth: string;
    gender: string;
    phone: string;
    email?: string | null;
    address?: string | null;
    bloodGroup?: string | null;
  }
) {
  try {
    const [updated] = await db
      .update(patients)
      .set({
        fullName: input.fullName.trim(),
        dateOfBirth: input.dateOfBirth.trim(),
        gender: input.gender.trim(),
        phone: input.phone.trim(),
        email: input.email?.trim() || null,
        address: input.address?.trim() || null,
        bloodGroup: input.bloodGroup?.trim() || null,
      })
      .where(eq(patients.id, patientId))
      .returning();

    return updated ?? null;
  } catch (error) {
    console.error('Database error in updatePatient:', error);
    throw new Error('Unable to update patient record.', { cause: error });
  }
}

export async function deletePatient(patientId: number) {
  try {
    const [deleted] = await db
      .delete(patients)
      .where(eq(patients.id, patientId))
      .returning();
    return deleted ?? null;
  } catch (error) {
    console.error('Database error in deletePatient:', error);
    throw new Error('Unable to delete patient record.', { cause: error });
  }
}

export async function listTestOrders(filters?: {
  search?: string;
  status?: string;
  patientId?: number;
}) {
  try {
    const conditions = [];

    if (filters?.status && filters.status !== 'all') {
      conditions.push(eq(testOrders.status, filters.status));
    }
    if (filters?.patientId) {
      conditions.push(eq(testOrders.patientId, filters.patientId));
    }
    if (filters?.search && filters.search.trim()) {
      const pattern = `%${filters.search.trim()}%`;
      conditions.push(
        or(
          ilike(testOrders.testCode, pattern),
          ilike(testOrders.sampleCode, pattern),
          ilike(testOrders.testName, pattern),
          ilike(patients.patientCode, pattern),
          ilike(patients.fullName, pattern),
          ilike(patients.phone, pattern)
        )
      );
    }

    const baseQuery = db
      .select({
        id: testOrders.id,
        testCode: testOrders.testCode,
        sampleCode: testOrders.sampleCode,
        patientId: testOrders.patientId,
        testName: testOrders.testName,
        category: testOrders.category,
        status: testOrders.status,
        priority: testOrders.priority,
        referringPhysician: testOrders.referringPhysician,
        sampleType: testOrders.sampleType,
        clinicalNotes: testOrders.clinicalNotes,
        pathologistName: testOrders.pathologistName,
        reportFileName: testOrders.reportFileName,
        hasUploadedPdf: sql<boolean>`${testOrders.reportFileBase64} IS NOT NULL`,
        orderedAt: testOrders.orderedAt,
        collectedAt: testOrders.collectedAt,
        processingAt: testOrders.processingAt,
        completedAt: testOrders.completedAt,
        updatedAt: testOrders.updatedAt,
        patientCode: patients.patientCode,
        patientName: patients.fullName,
        patientPhone: patients.phone,
        patientEmail: patients.email,
        patientDob: patients.dateOfBirth,
        patientGender: patients.gender,
      })
      .from(testOrders)
      .innerJoin(patients, eq(testOrders.patientId, patients.id));

    const orders =
      conditions.length > 0
        ? await baseQuery.where(and(...conditions)).orderBy(desc(testOrders.orderedAt))
        : await baseQuery.orderBy(desc(testOrders.orderedAt));

    if (orders.length === 0) return [];

    const orderIds = orders.map((o) => o.id);
    const resultCounts = await db
      .select({
        testOrderId: testResultValues.testOrderId,
        count: sql<number>`count(*)::int`,
        abnormalCount: sql<number>`count(*) filter (where ${testResultValues.flag} <> 'normal')::int`,
      })
      .from(testResultValues)
      .where(inArray(testResultValues.testOrderId, orderIds))
      .groupBy(testResultValues.testOrderId);

    const resultMap = new Map(resultCounts.map((r) => [r.testOrderId, r]));

    return orders.map((order) => ({
      ...order,
      resultCount: resultMap.get(order.id)?.count ?? 0,
      abnormalCount: resultMap.get(order.id)?.abnormalCount ?? 0,
    }));
  } catch (error) {
    console.error('Database error in listTestOrders:', error);
    throw new Error('Unable to load diagnostic test orders.', { cause: error });
  }
}

export async function getTestOrderByCode(testCode: string, includePdfBinary = false) {
  try {
    const [row] = await db
      .select({
        id: testOrders.id,
        testCode: testOrders.testCode,
        sampleCode: testOrders.sampleCode,
        patientId: testOrders.patientId,
        testName: testOrders.testName,
        category: testOrders.category,
        status: testOrders.status,
        priority: testOrders.priority,
        referringPhysician: testOrders.referringPhysician,
        sampleType: testOrders.sampleType,
        clinicalNotes: testOrders.clinicalNotes,
        pathologistName: testOrders.pathologistName,
        reportFileName: testOrders.reportFileName,
        reportFileMime: testOrders.reportFileMime,
        reportFileBase64: includePdfBinary
          ? testOrders.reportFileBase64
          : sql<string | null>`NULL`,
        hasUploadedPdf: sql<boolean>`${testOrders.reportFileBase64} IS NOT NULL`,
        orderedAt: testOrders.orderedAt,
        collectedAt: testOrders.collectedAt,
        processingAt: testOrders.processingAt,
        completedAt: testOrders.completedAt,
        updatedAt: testOrders.updatedAt,
        patient: {
          id: patients.id,
          patientCode: patients.patientCode,
          userId: patients.userId,
          fullName: patients.fullName,
          dateOfBirth: patients.dateOfBirth,
          gender: patients.gender,
          phone: patients.phone,
          email: patients.email,
          address: patients.address,
          bloodGroup: patients.bloodGroup,
        },
      })
      .from(testOrders)
      .innerJoin(patients, eq(testOrders.patientId, patients.id))
      .where(ilike(testOrders.testCode, testCode.trim()))
      .limit(1);

    if (!row) return null;

    const results = await db
      .select()
      .from(testResultValues)
      .where(eq(testResultValues.testOrderId, row.id))
      .orderBy(testResultValues.sortOrder, testResultValues.id);

    return {
      ...row,
      results,
    };
  } catch (error) {
    console.error('Database error in getTestOrderByCode:', error);
    throw new Error('Unable to load test order details.', { cause: error });
  }
}

export async function createTestOrder(input: {
  patientId: number;
  testName: string;
  category: string;
  priority: string;
  referringPhysician?: string | null;
  sampleType: string;
  clinicalNotes?: string | null;
}) {
  try {
    const year = new Date().getFullYear();
    const suffix = generateUniqueSuffix();
    const testCode = `LAB-${year}-${suffix}`;
    const sampleCode = `SMP-${suffix}-${String.fromCharCode(65 + crypto.randomInt(0, 6))}`;

    const [created] = await db
      .insert(testOrders)
      .values({
        testCode,
        sampleCode,
        patientId: input.patientId,
        testName: input.testName.trim(),
        category: input.category.trim(),
        status: 'registered',
        priority: input.priority.trim(),
        referringPhysician: input.referringPhysician?.trim() || null,
        sampleType: input.sampleType.trim(),
        clinicalNotes: input.clinicalNotes?.trim() || null,
      })
      .returning();

    return created;
  } catch (error) {
    console.error('Database error in createTestOrder:', error);
    throw new Error('Unable to create diagnostic test order.', { cause: error });
  }
}

export async function updateTestOrderStatus(orderId: number, status: OrderStatus) {
  try {
    const now = new Date();
    const [existing] = await db
      .select()
      .from(testOrders)
      .where(eq(testOrders.id, orderId))
      .limit(1);

    if (!existing) return null;

    const updates: Partial<typeof testOrders.$inferInsert> = {
      status,
      updatedAt: now,
    };

    if (status === 'sample_collected' && !existing.collectedAt) {
      updates.collectedAt = now;
    } else if (status === 'processing') {
      if (!existing.collectedAt) updates.collectedAt = now;
      if (!existing.processingAt) updates.processingAt = now;
    } else if (status === 'report_ready') {
      if (!existing.collectedAt) updates.collectedAt = now;
      if (!existing.processingAt) updates.processingAt = now;
      updates.completedAt = existing.completedAt ?? now;
    }

    const [updated] = await db
      .update(testOrders)
      .set(updates)
      .where(eq(testOrders.id, orderId))
      .returning();

    return updated ?? null;
  } catch (error) {
    console.error('Database error in updateTestOrderStatus:', error);
    throw new Error('Unable to update test status.', { cause: error });
  }
}

export async function saveStructuredResults(
  orderId: number,
  input: {
    clinicalNotes?: string | null;
    pathologistName?: string;
    markReportReady?: boolean;
    values: Array<{
      parameterName: string;
      measuredValue: string;
      unit: string;
      referenceRange: string;
      flag: ResultFlag;
    }>;
  }
) {
  try {
    const [existing] = await db
      .select()
      .from(testOrders)
      .where(eq(testOrders.id, orderId))
      .limit(1);

    if (!existing) return null;

    await db
      .delete(testResultValues)
      .where(eq(testResultValues.testOrderId, orderId));

    if (input.values.length > 0) {
      await db.insert(testResultValues).values(
        input.values.map((v, idx) => ({
          testOrderId: orderId,
          parameterName: v.parameterName.trim(),
          measuredValue: v.measuredValue.trim(),
          unit: v.unit.trim(),
          referenceRange: v.referenceRange.trim(),
          flag: v.flag,
          sortOrder: idx + 1,
        }))
      );
    }

    const now = new Date();
    const orderUpdates: Partial<typeof testOrders.$inferInsert> = {
      clinicalNotes: input.clinicalNotes?.trim() || null,
      updatedAt: now,
    };

    if (input.pathologistName?.trim()) {
      orderUpdates.pathologistName = input.pathologistName.trim();
    }

    if (input.markReportReady) {
      orderUpdates.status = 'report_ready';
      if (!existing.collectedAt) orderUpdates.collectedAt = now;
      if (!existing.processingAt) orderUpdates.processingAt = now;
      orderUpdates.completedAt = existing.completedAt ?? now;
    }

    const [updatedOrder] = await db
      .update(testOrders)
      .set(orderUpdates)
      .where(eq(testOrders.id, orderId))
      .returning();

    return updatedOrder;
  } catch (error) {
    console.error('Database error in saveStructuredResults:', error);
    throw new Error('Unable to save diagnostic results.', { cause: error });
  }
}

export async function saveUploadedPdfReport(
  orderId: number,
  fileName: string,
  mimeType: string,
  base64Content: string,
  markReportReady = true
) {
  try {
    const [existing] = await db
      .select()
      .from(testOrders)
      .where(eq(testOrders.id, orderId))
      .limit(1);

    if (!existing) return null;

    const now = new Date();
    const updates: Partial<typeof testOrders.$inferInsert> = {
      reportFileName: fileName,
      reportFileMime: mimeType,
      reportFileBase64: base64Content,
      updatedAt: now,
    };

    if (markReportReady) {
      updates.status = 'report_ready';
      if (!existing.collectedAt) updates.collectedAt = now;
      if (!existing.processingAt) updates.processingAt = now;
      updates.completedAt = existing.completedAt ?? now;
    }

    const [updated] = await db
      .update(testOrders)
      .set(updates)
      .where(eq(testOrders.id, orderId))
      .returning({
        id: testOrders.id,
        testCode: testOrders.testCode,
        status: testOrders.status,
        reportFileName: testOrders.reportFileName,
      });

    return updated ?? null;
  } catch (error) {
    console.error('Database error in saveUploadedPdfReport:', error);
    throw new Error('Unable to store uploaded PDF report.', { cause: error });
  }
}

export async function removeUploadedPdfReport(orderId: number) {
  try {
    const [updated] = await db
      .update(testOrders)
      .set({
        reportFileName: null,
        reportFileMime: null,
        reportFileBase64: null,
        updatedAt: new Date(),
      })
      .where(eq(testOrders.id, orderId))
      .returning({ id: testOrders.id, testCode: testOrders.testCode });
    return updated ?? null;
  } catch (error) {
    console.error('Database error in removeUploadedPdfReport:', error);
    throw new Error('Unable to remove uploaded PDF report.', { cause: error });
  }
}

export async function deleteTestOrder(orderId: number) {
  try {
    const [deleted] = await db
      .delete(testOrders)
      .where(eq(testOrders.id, orderId))
      .returning({ id: testOrders.id });
    return deleted ?? null;
  } catch (error) {
    console.error('Database error in deleteTestOrder:', error);
    throw new Error('Unable to delete test order.', { cause: error });
  }
}

// Patient Portal Helpers
export async function getPatientPortalDataForUser(userId: number, userEmail: string) {
  try {
    const normalizedEmail = userEmail.trim().toLowerCase();
    const matchedPatients = await db
      .select()
      .from(patients)
      .where(
        or(
          eq(patients.userId, userId),
          sql`lower(${patients.email}) = ${normalizedEmail}`
        )
      )
      .orderBy(desc(patients.createdAt));

    if (matchedPatients.length === 0) {
      return { patient: null, orders: [] };
    }

    const primaryPatient = matchedPatients[0];
    const patientIds = matchedPatients.map((p) => p.id);

    const orders = await db
      .select({
        id: testOrders.id,
        testCode: testOrders.testCode,
        sampleCode: testOrders.sampleCode,
        patientId: testOrders.patientId,
        testName: testOrders.testName,
        category: testOrders.category,
        status: testOrders.status,
        priority: testOrders.priority,
        referringPhysician: testOrders.referringPhysician,
        sampleType: testOrders.sampleType,
        clinicalNotes: testOrders.clinicalNotes,
        pathologistName: testOrders.pathologistName,
        reportFileName: testOrders.reportFileName,
        hasUploadedPdf: sql<boolean>`${testOrders.reportFileBase64} IS NOT NULL`,
        orderedAt: testOrders.orderedAt,
        collectedAt: testOrders.collectedAt,
        processingAt: testOrders.processingAt,
        completedAt: testOrders.completedAt,
      })
      .from(testOrders)
      .where(inArray(testOrders.patientId, patientIds))
      .orderBy(desc(testOrders.orderedAt));

    const orderIds = orders.map((o) => o.id);
    const allResults =
      orderIds.length > 0
        ? await db
            .select()
            .from(testResultValues)
            .where(inArray(testResultValues.testOrderId, orderIds))
            .orderBy(testResultValues.sortOrder, testResultValues.id)
        : [];

    const resultsByOrder = new Map<number, typeof allResults>();
    for (const r of allResults) {
      const list = resultsByOrder.get(r.testOrderId) ?? [];
      list.push(r);
      resultsByOrder.set(r.testOrderId, list);
    }

    return {
      patient: primaryPatient,
      orders: orders.map((o) => ({
        ...o,
        results: resultsByOrder.get(o.id) ?? [],
      })),
    };
  } catch (error) {
    console.error('Database error in getPatientPortalDataForUser:', error);
    throw new Error('Unable to load your diagnostic history.', { cause: error });
  }
}

export async function getPatientPortalDataByPatientId(patientId: number) {
  try {
    const [patient] = await db
      .select()
      .from(patients)
      .where(eq(patients.id, patientId))
      .limit(1);

    if (!patient) return { patient: null, orders: [] };

    const orders = await db
      .select({
        id: testOrders.id,
        testCode: testOrders.testCode,
        sampleCode: testOrders.sampleCode,
        patientId: testOrders.patientId,
        testName: testOrders.testName,
        category: testOrders.category,
        status: testOrders.status,
        priority: testOrders.priority,
        referringPhysician: testOrders.referringPhysician,
        sampleType: testOrders.sampleType,
        clinicalNotes: testOrders.clinicalNotes,
        pathologistName: testOrders.pathologistName,
        reportFileName: testOrders.reportFileName,
        hasUploadedPdf: sql<boolean>`${testOrders.reportFileBase64} IS NOT NULL`,
        orderedAt: testOrders.orderedAt,
        collectedAt: testOrders.collectedAt,
        processingAt: testOrders.processingAt,
        completedAt: testOrders.completedAt,
      })
      .from(testOrders)
      .where(eq(testOrders.patientId, patient.id))
      .orderBy(desc(testOrders.orderedAt));

    const orderIds = orders.map((o) => o.id);
    const allResults =
      orderIds.length > 0
        ? await db
            .select()
            .from(testResultValues)
            .where(inArray(testResultValues.testOrderId, orderIds))
            .orderBy(testResultValues.sortOrder, testResultValues.id)
        : [];

    const resultsByOrder = new Map<number, typeof allResults>();
    for (const r of allResults) {
      const list = resultsByOrder.get(r.testOrderId) ?? [];
      list.push(r);
      resultsByOrder.set(r.testOrderId, list);
    }

    return {
      patient,
      orders: orders.map((o) => ({
        ...o,
        results: resultsByOrder.get(o.id) ?? [],
      })),
    };
  } catch (error) {
    console.error('Database error in getPatientPortalDataByPatientId:', error);
    throw new Error('Unable to load patient report history.', { cause: error });
  }
}

// OTP Verification Challenge Flow for Secure Patient Report Access (Report ID + Phone -> OTP)
export async function createPatientOtpChallenge(testCode: string, phoneInput: string) {
  try {
    const normalizedInputDigits = normalizePhoneDigits(phoneInput);
    if (normalizedInputDigits.length < 7) {
      return { ok: false as const, error: 'Please enter a valid registered phone number.' };
    }

    const [match] = await db
      .select({
        orderId: testOrders.id,
        testCode: testOrders.testCode,
        patientId: patients.id,
        patientCode: patients.patientCode,
        patientPhone: patients.phone,
        patientName: patients.fullName,
      })
      .from(testOrders)
      .innerJoin(patients, eq(testOrders.patientId, patients.id))
      .where(ilike(testOrders.testCode, testCode.trim()))
      .limit(1);

    if (!match) {
      return {
        ok: false as const,
        error: 'We could not match that Report ID and phone number. Please check your laboratory receipt.',
      };
    }

    const storedDigits = normalizePhoneDigits(match.patientPhone);
    const isMatch =
      storedDigits === normalizedInputDigits ||
      (storedDigits.length >= 7 &&
        normalizedInputDigits.length >= 7 &&
        storedDigits.slice(-7) === normalizedInputDigits.slice(-7));

    if (!isMatch) {
      return {
        ok: false as const,
        error: 'We could not match that Report ID and phone number. Please check your laboratory receipt.',
      };
    }

    const otpCode = generateSixDigitOtp();
    const codeHash = hashOtpCode(otpCode);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    const [challenge] = await db
      .insert(otpChallenges)
      .values({
        testOrderId: match.orderId,
        patientId: match.patientId,
        codeHash,
        expiresAt,
      })
      .returning();

    const maskedPhone = `***-***-${storedDigits.slice(-4)}`;

    return {
      ok: true as const,
      challengeId: challenge.id,
      maskedPhone,
      expiresAt,
      // Preview OTP returned for self-contained testing without external SMS gateway
      previewOtp: otpCode,
    };
  } catch (error) {
    console.error('Database error in createPatientOtpChallenge:', error);
    throw new Error('Unable to initiate verification code. Please try again.', { cause: error });
  }
}

export async function verifyPatientOtpChallenge(challengeId: number, otpInput: string) {
  try {
    const [challenge] = await db
      .select({
        id: otpChallenges.id,
        testOrderId: otpChallenges.testOrderId,
        patientId: otpChallenges.patientId,
        codeHash: otpChallenges.codeHash,
        attempts: otpChallenges.attempts,
        expiresAt: otpChallenges.expiresAt,
        consumedAt: otpChallenges.consumedAt,
        patientCode: patients.patientCode,
        testCode: testOrders.testCode,
      })
      .from(otpChallenges)
      .innerJoin(patients, eq(otpChallenges.patientId, patients.id))
      .innerJoin(testOrders, eq(otpChallenges.testOrderId, testOrders.id))
      .where(eq(otpChallenges.id, challengeId))
      .limit(1);

    if (!challenge) {
      return { ok: false as const, error: 'Verification request not found. Request a new code.' };
    }
    if (challenge.consumedAt) {
      return { ok: false as const, error: 'This verification code has already been used.' };
    }
    if (challenge.attempts >= 5) {
      return { ok: false as const, error: 'Maximum verification attempts exceeded. Request a new code.' };
    }
    if (new Date(challenge.expiresAt).getTime() < Date.now()) {
      return { ok: false as const, error: 'Verification code has expired. Please request a new code.' };
    }

    const valid = verifyOtpCode(otpInput.trim(), challenge.codeHash);
    if (!valid) {
      await db
        .update(otpChallenges)
        .set({ attempts: challenge.attempts + 1 })
        .where(eq(otpChallenges.id, challenge.id));
      return {
        ok: false as const,
        error: `Incorrect verification code. ${Math.max(0, 4 - challenge.attempts)} attempts remaining.`,
      };
    }

    await db
      .update(otpChallenges)
      .set({ consumedAt: new Date() })
      .where(eq(otpChallenges.id, challenge.id));

    return {
      ok: true as const,
      patientId: challenge.patientId,
      patientCode: challenge.patientCode,
      testCode: challenge.testCode,
    };
  } catch (error) {
    console.error('Database error in verifyPatientOtpChallenge:', error);
    throw new Error('Unable to verify code. Please try again.', { cause: error });
  }
}

export async function linkPatientToUserAccount(
  userId: number,
  patientCodeInput: string,
  phoneInput: string
) {
  try {
    const normalizedInputDigits = normalizePhoneDigits(phoneInput);
    const [patient] = await db
      .select()
      .from(patients)
      .where(ilike(patients.patientCode, patientCodeInput.trim()))
      .limit(1);

    if (!patient) {
      return { ok: false as const, error: 'Patient ID and phone number did not match our records.' };
    }

    const storedDigits = normalizePhoneDigits(patient.phone);
    const isMatch =
      storedDigits === normalizedInputDigits ||
      (storedDigits.length >= 7 &&
        normalizedInputDigits.length >= 7 &&
        storedDigits.slice(-7) === normalizedInputDigits.slice(-7));

    if (!isMatch) {
      return { ok: false as const, error: 'Patient ID and phone number did not match our records.' };
    }

    const [updated] = await db
      .update(patients)
      .set({ userId })
      .where(eq(patients.id, patient.id))
      .returning();

    return { ok: true as const, patient: updated };
  } catch (error) {
    console.error('Database error in linkPatientToUserAccount:', error);
    throw new Error('Unable to link patient record.', { cause: error });
  }
}
