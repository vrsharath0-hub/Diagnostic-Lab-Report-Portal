import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { z } from 'zod';
import {
  createPatient,
  createPatientOtpChallenge,
  createTestOrder,
  deletePatient,
  deleteTestOrder,
  getDashboardMetrics,
  getPatientPortalDataByPatientId,
  getPatientPortalDataForUser,
  getTestOrderByCode,
  linkPatientToUserAccount,
  listPatients,
  listTestOrders,
  removeUploadedPdfReport,
  saveStructuredResults,
  saveUploadedPdfReport,
  updatePatient,
  updateTestOrderStatus,
  verifyPatientOtpChallenge,
} from './src/db/diagnostics.ts';
import { listAllUsers, updateUserRole } from './src/db/users.ts';
import { generateDiagnosticReportPdf } from './src/lib/pdf-generator.ts';
import { isPdfBuffer, signPatientSessionToken } from './src/lib/session.ts';
import {
  AuthRequest,
  requireAdmin,
  requireAnyAuthenticatedActor,
  requireFirebaseAuth,
  requireStaff,
} from './src/middleware/auth.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '2mb' }));

// Configure memory-based multer upload with strict 5MB limit and PDF MIME filter
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf')) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files (.pdf) are accepted.'));
    }
  },
});

// Validation schemas
const patientSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  dateOfBirth: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD format'),
  gender: z.enum(['Female', 'Male', 'Other']),
  phone: z.string().trim().min(7).max(30),
  email: z.string().trim().email().optional().or(z.literal('')).nullable(),
  address: z.string().trim().max(240).optional().nullable(),
  bloodGroup: z.string().trim().max(10).optional().nullable(),
});

const testOrderSchema = z.object({
  patientId: z.coerce.number().int().positive(),
  testName: z.string().trim().min(2).max(180),
  category: z.enum([
    'Hematology',
    'Biochemistry',
    'Endocrinology',
    'Microbiology',
    'Immunology',
    'Pathology',
  ]),
  priority: z.enum(['routine', 'urgent', 'stat']).default('routine'),
  referringPhysician: z.string().trim().max(120).optional().nullable(),
  sampleType: z.string().trim().min(2).max(120),
  clinicalNotes: z.string().trim().max(1500).optional().nullable(),
});

const statusUpdateSchema = z.object({
  status: z.enum(['registered', 'sample_collected', 'processing', 'report_ready']),
});

const structuredResultsSchema = z.object({
  clinicalNotes: z.string().trim().max(2000).optional().nullable(),
  pathologistName: z.string().trim().min(2).max(120).optional(),
  markReportReady: z.boolean().optional().default(true),
  values: z
    .array(
      z.object({
        parameterName: z.string().trim().min(1).max(140),
        measuredValue: z.string().trim().min(1).max(60),
        unit: z.string().trim().max(40),
        referenceRange: z.string().trim().max(80),
        flag: z.enum(['normal', 'low', 'high', 'critical']).default('normal'),
      })
    )
    .max(60),
});

const otpRequestSchema = z.object({
  testCode: z.string().trim().min(4).max(40),
  phone: z.string().trim().min(7).max(30),
});

const otpVerifySchema = z.object({
  challengeId: z.coerce.number().int().positive(),
  otp: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit verification code'),
});

const linkRecordSchema = z.object({
  patientCode: z.string().trim().min(4).max(40),
  phone: z.string().trim().min(7).max(30),
});

const roleUpdateSchema = z.object({
  role: z.enum(['admin', 'staff', 'patient']),
});

function parseIdParam(raw: string): number | null {
  const num = Number(raw);
  if (!Number.isInteger(num) || num <= 0) return null;
  return num;
}

// ---------------------------------------------------------------------------
// Authenticated Account Profile
// ---------------------------------------------------------------------------
app.get('/api/me', requireFirebaseAuth, (req: AuthRequest, res) => {
  res.json({ user: req.dbUser });
});

// ---------------------------------------------------------------------------
// Staff & Admin Laboratory Operations
// ---------------------------------------------------------------------------
app.get('/api/staff/metrics', requireStaff, async (_req, res) => {
  try {
    const metrics = await getDashboardMetrics();
    res.json(metrics);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to load metrics.' });
  }
});

app.get('/api/staff/patients', requireStaff, async (req, res) => {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const rows = await listPatients(search);
    res.json({ patients: rows });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to list patients.' });
  }
});

app.post('/api/staff/patients', requireStaff, async (req, res) => {
  const parsed = patientSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid patient details.' });
  }
  try {
    const created = await createPatient({
      ...parsed.data,
      email: parsed.data.email || null,
    });
    res.status(201).json({ patient: created });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to register patient.' });
  }
});

app.put('/api/staff/patients/:id', requireStaff, async (req, res) => {
  const patientId = parseIdParam(req.params.id);
  if (!patientId) return res.status(400).json({ error: 'Invalid patient ID.' });

  const parsed = patientSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid patient details.' });
  }
  try {
    const updated = await updatePatient(patientId, {
      ...parsed.data,
      email: parsed.data.email || null,
    });
    if (!updated) return res.status(404).json({ error: 'Patient not found.' });
    res.json({ patient: updated });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to update patient.' });
  }
});

app.delete('/api/staff/patients/:id', requireStaff, async (req, res) => {
  const patientId = parseIdParam(req.params.id);
  if (!patientId) return res.status(400).json({ error: 'Invalid patient ID.' });
  try {
    const deleted = await deletePatient(patientId);
    if (!deleted) return res.status(404).json({ error: 'Patient not found.' });
    res.json({ deleted: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to delete patient.' });
  }
});

app.get('/api/staff/orders', requireStaff, async (req, res) => {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const patientId =
      typeof req.query.patientId === 'string' && req.query.patientId
        ? parseIdParam(req.query.patientId) ?? undefined
        : undefined;

    const orders = await listTestOrders({ search, status, patientId });
    res.json({ orders });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to load test orders.' });
  }
});

app.get('/api/staff/orders/:testCode', requireStaff, async (req, res) => {
  try {
    const order = await getTestOrderByCode(req.params.testCode, false);
    if (!order) return res.status(404).json({ error: 'Test order not found.' });
    res.json({ order });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to load test order.' });
  }
});

app.post('/api/staff/orders', requireStaff, async (req, res) => {
  const parsed = testOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid test order data.' });
  }
  try {
    const created = await createTestOrder(parsed.data);
    res.status(201).json({ order: created });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to create test order.' });
  }
});

app.patch('/api/staff/orders/:id/status', requireStaff, async (req, res) => {
  const orderId = parseIdParam(req.params.id);
  if (!orderId) return res.status(400).json({ error: 'Invalid order ID.' });

  const parsed = statusUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid test status value.' });
  }
  try {
    const updated = await updateTestOrderStatus(orderId, parsed.data.status);
    if (!updated) return res.status(404).json({ error: 'Test order not found.' });
    res.json({ order: updated });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to update status.' });
  }
});

app.put('/api/staff/orders/:id/results', requireStaff, async (req, res) => {
  const orderId = parseIdParam(req.params.id);
  if (!orderId) return res.status(400).json({ error: 'Invalid order ID.' });

  const parsed = structuredResultsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid results payload.' });
  }
  try {
    const updated = await saveStructuredResults(orderId, parsed.data);
    if (!updated) return res.status(404).json({ error: 'Test order not found.' });
    res.json({ order: updated });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to save structured results.' });
  }
});

app.post('/api/staff/orders/:id/upload-pdf', requireStaff, (req, res) => {
  const orderId = parseIdParam(req.params.id);
  if (!orderId) return res.status(400).json({ error: 'Invalid order ID.' });

  upload.single('file')(req, res, async (uploadErr: any) => {
    if (uploadErr) {
      return res.status(400).json({ error: uploadErr.message || 'Invalid PDF upload.' });
    }
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'Please select a PDF report file to upload.' });
    }
    if (!isPdfBuffer(file.buffer)) {
      return res.status(400).json({ error: 'Uploaded file is not a valid PDF document.' });
    }

    try {
      const safeFileName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
      const base64 = file.buffer.toString('base64');
      const markReady = req.body?.markReportReady !== 'false';
      const updated = await saveUploadedPdfReport(
        orderId,
        safeFileName,
        'application/pdf',
        base64,
        markReady
      );
      if (!updated) return res.status(404).json({ error: 'Test order not found.' });
      res.json({ order: updated });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to store PDF report.' });
    }
  });
});

app.delete('/api/staff/orders/:id/upload-pdf', requireStaff, async (req, res) => {
  const orderId = parseIdParam(req.params.id);
  if (!orderId) return res.status(400).json({ error: 'Invalid order ID.' });
  try {
    const updated = await removeUploadedPdfReport(orderId);
    if (!updated) return res.status(404).json({ error: 'Test order not found.' });
    res.json({ order: updated });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to remove PDF.' });
  }
});

app.delete('/api/staff/orders/:id', requireStaff, async (req, res) => {
  const orderId = parseIdParam(req.params.id);
  if (!orderId) return res.status(400).json({ error: 'Invalid order ID.' });
  try {
    const deleted = await deleteTestOrder(orderId);
    if (!deleted) return res.status(404).json({ error: 'Test order not found.' });
    res.json({ deleted: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to delete test order.' });
  }
});

// ---------------------------------------------------------------------------
// Admin Role Directory Management
// ---------------------------------------------------------------------------
app.get('/api/admin/users', requireAdmin, async (_req, res) => {
  try {
    const directory = await listAllUsers();
    res.json({ users: directory });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to load user directory.' });
  }
});

app.patch('/api/admin/users/:id/role', requireAdmin, async (req: AuthRequest, res) => {
  const targetId = parseIdParam(req.params.id);
  if (!targetId) return res.status(400).json({ error: 'Invalid user ID.' });

  const parsed = roleUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid role selection.' });
  }
  if (req.dbUser && req.dbUser.id === targetId && parsed.data.role !== 'admin') {
    return res.status(400).json({ error: 'You cannot remove your own administrator role.' });
  }

  try {
    const updated = await updateUserRole(targetId, parsed.data.role);
    if (!updated) return res.status(404).json({ error: 'User not found.' });
    res.json({ user: updated });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to update role.' });
  }
});

// ---------------------------------------------------------------------------
// Patient OTP Report Access & Portal Endpoints
// ---------------------------------------------------------------------------
app.post('/api/patient-access/request-otp', async (req, res) => {
  const parsed = otpRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Enter Report ID and phone number.' });
  }
  try {
    const result = await createPatientOtpChallenge(parsed.data.testCode, parsed.data.phone);
    if (!result.ok) {
      return res.status(404).json({ error: result.error });
    }
    res.json({
      challengeId: result.challengeId,
      maskedPhone: result.maskedPhone,
      expiresAt: result.expiresAt,
      previewOtp: result.previewOtp,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to issue verification code.' });
  }
});

app.post('/api/patient-access/verify-otp', async (req, res) => {
  const parsed = otpVerifySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid verification code.' });
  }
  try {
    const result = await verifyPatientOtpChallenge(parsed.data.challengeId, parsed.data.otp);
    if (!result.ok) {
      return res.status(401).json({ error: result.error });
    }
    const token = signPatientSessionToken(
      result.patientId,
      result.patientCode,
      result.testCode
    );
    res.json({
      token,
      patientCode: result.patientCode,
      testCode: result.testCode,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to verify code.' });
  }
});

app.get('/api/patient/portal', requireAnyAuthenticatedActor, async (req: AuthRequest, res) => {
  try {
    if (req.patientSession) {
      const data = await getPatientPortalDataByPatientId(req.patientSession.patientId);
      return res.json({
        accessMode: 'otp_session',
        highlightedTestCode: req.patientSession.testCode,
        ...data,
      });
    }

    if (req.dbUser) {
      const data = await getPatientPortalDataForUser(req.dbUser.id, req.dbUser.email);
      return res.json({
        accessMode: 'account',
        highlightedTestCode: null,
        ...data,
      });
    }

    return res.status(401).json({ error: 'Authentication required.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to load patient portal.' });
  }
});

app.post('/api/patient/link-record', requireFirebaseAuth, async (req: AuthRequest, res) => {
  const parsed = linkRecordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid patient details.' });
  }
  if (!req.dbUser) return res.status(401).json({ error: 'Authentication required.' });

  try {
    const result = await linkPatientToUserAccount(
      req.dbUser.id,
      parsed.data.patientCode,
      parsed.data.phone
    );
    if (!result.ok) {
      return res.status(404).json({ error: result.error });
    }
    res.json({ patient: result.patient });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to link patient record.' });
  }
});

// ---------------------------------------------------------------------------
// Secure Report Download & Clinical PDF Generation
// ---------------------------------------------------------------------------
app.get('/api/reports/:testCode/pdf', requireAnyAuthenticatedActor, async (req: AuthRequest, res) => {
  try {
    const order = await getTestOrderByCode(req.params.testCode, true);
    if (!order) {
      return res.status(404).json({ error: 'Diagnostic report not found.' });
    }

    // Strict server-side authorization check
    let authorized = false;
    if (req.dbUser) {
      if (req.dbUser.role === 'admin' || req.dbUser.role === 'staff') {
        authorized = true;
      } else if (
        order.patient.userId === req.dbUser.id ||
        (order.patient.email &&
          order.patient.email.toLowerCase() === req.dbUser.email.toLowerCase())
      ) {
        authorized = true;
      }
    } else if (req.patientSession) {
      if (order.patientId === req.patientSession.patientId) {
        authorized = true;
      }
    }

    if (!authorized) {
      return res.status(403).json({ error: 'You do not have permission to access this report.' });
    }

    // Patients can only download reports once ready (staff/admin can preview anytime)
    const isStaff = req.dbUser && (req.dbUser.role === 'admin' || req.dbUser.role === 'staff');
    if (!isStaff && order.status !== 'report_ready') {
      return res.status(409).json({
        error: 'This diagnostic report is still being processed and is not ready for download yet.',
      });
    }

    const safeCode = order.testCode.replace(/[^a-zA-Z0-9_-]/g, '');
    const source = typeof req.query.source === 'string' ? req.query.source : 'auto';
    const disposition = req.query.inline === '1' ? 'inline' : 'attachment';

    if (source !== 'generated' && order.reportFileBase64) {
      const pdfBuffer = Buffer.from(order.reportFileBase64, 'base64');
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader(
        'Content-Disposition',
        `${disposition}; filename="Meridian-${safeCode}-Uploaded.pdf"`
      );
      return res.send(pdfBuffer);
    }

    const generatedBuffer = await generateDiagnosticReportPdf({
      testCode: order.testCode,
      sampleCode: order.sampleCode,
      testName: order.testName,
      category: order.category,
      status: order.status,
      priority: order.priority,
      sampleType: order.sampleType,
      referringPhysician: order.referringPhysician,
      clinicalNotes: order.clinicalNotes,
      pathologistName: order.pathologistName,
      orderedAt: order.orderedAt,
      collectedAt: order.collectedAt,
      completedAt: order.completedAt,
      patient: order.patient,
      results: order.results,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader(
      'Content-Disposition',
      `${disposition}; filename="Meridian-Report-${safeCode}.pdf"`
    );
    return res.send(generatedBuffer);
  } catch (error: any) {
    console.error('PDF report generation error:', error);
    res.status(500).json({ error: 'Unable to prepare PDF report. Please try again.' });
  }
});

// ---------------------------------------------------------------------------
// Frontend Hosting (Vite Dev Middleware or Static Production Build)
// ---------------------------------------------------------------------------
async function startServer() {
  const distDir = path.resolve(__dirname, 'dist');
  const isProd = process.env.NODE_ENV === 'production' && fs.existsSync(distDir);

  if (isProd) {
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Meridian Diagnostics Portal listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
