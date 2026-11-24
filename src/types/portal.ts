export type UserRole = 'admin' | 'staff' | 'patient';
export type OrderStatus = 'registered' | 'sample_collected' | 'processing' | 'report_ready';
export type OrderPriority = 'routine' | 'urgent' | 'stat';
export type ResultFlag = 'normal' | 'low' | 'high' | 'critical';

export interface AccountUser {
  id: number;
  uid: string;
  email: string;
  fullName: string;
  role: UserRole;
  phone: string | null;
  createdAt?: string;
}

export interface PatientRecord {
  id: number;
  patientCode: string;
  userId: number | null;
  fullName: string;
  dateOfBirth: string;
  gender: 'Female' | 'Male' | 'Other' | string;
  phone: string;
  email: string | null;
  address: string | null;
  bloodGroup: string | null;
  createdAt: string;
  totalTests?: number;
  readyTests?: number;
}

export interface TestResultValue {
  id?: number;
  testOrderId?: number;
  parameterName: string;
  measuredValue: string;
  unit: string;
  referenceRange: string;
  flag: ResultFlag;
  sortOrder?: number;
}

export interface TestOrderListItem {
  id: number;
  testCode: string;
  sampleCode: string;
  patientId: number;
  testName: string;
  category: string;
  status: OrderStatus;
  priority: OrderPriority;
  referringPhysician: string | null;
  sampleType: string;
  clinicalNotes: string | null;
  pathologistName: string;
  reportFileName: string | null;
  hasUploadedPdf: boolean;
  orderedAt: string;
  collectedAt: string | null;
  processingAt: string | null;
  completedAt: string | null;
  updatedAt: string;
  patientCode: string;
  patientName: string;
  patientPhone: string;
  patientEmail: string | null;
  patientDob: string;
  patientGender: string;
  resultCount: number;
  abnormalCount: number;
}

export interface TestOrderDetail {
  id: number;
  testCode: string;
  sampleCode: string;
  patientId: number;
  testName: string;
  category: string;
  status: OrderStatus;
  priority: OrderPriority;
  referringPhysician: string | null;
  sampleType: string;
  clinicalNotes: string | null;
  pathologistName: string;
  reportFileName: string | null;
  hasUploadedPdf: boolean;
  orderedAt: string;
  collectedAt: string | null;
  processingAt: string | null;
  completedAt: string | null;
  updatedAt?: string;
  patient?: PatientRecord;
  results: TestResultValue[];
}

export interface DashboardMetrics {
  totalPatients: number;
  totalOrders: number;
  registeredCount: number;
  collectedCount: number;
  processingCount: number;
  reportReadyCount: number;
}

export interface PatientPortalResponse {
  accessMode: 'account' | 'otp_session';
  highlightedTestCode: string | null;
  patient: PatientRecord | null;
  orders: TestOrderDetail[];
}
