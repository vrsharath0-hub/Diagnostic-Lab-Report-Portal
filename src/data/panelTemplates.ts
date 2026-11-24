import { TestResultValue } from '../types/portal.ts';

export interface DiagnosticPanelTemplate {
  id: string;
  testName: string;
  category: 'Hematology' | 'Biochemistry' | 'Endocrinology' | 'Microbiology' | 'Immunology' | 'Pathology';
  sampleType: string;
  parameters: Array<Omit<TestResultValue, 'id' | 'testOrderId' | 'sortOrder'>>;
}

export const DIAGNOSTIC_PANEL_TEMPLATES: DiagnosticPanelTemplate[] = [
  {
    id: 'cbc',
    testName: 'Complete Blood Count (CBC)',
    category: 'Hematology',
    sampleType: 'Venous Blood (EDTA)',
    parameters: [
      { parameterName: 'Hemoglobin', measuredValue: '', unit: 'g/dL', referenceRange: '12.0 – 16.0', flag: 'normal' },
      { parameterName: 'White Blood Cell (WBC)', measuredValue: '', unit: '10^3/uL', referenceRange: '4.5 – 11.0', flag: 'normal' },
      { parameterName: 'Red Blood Cell (RBC)', measuredValue: '', unit: '10^6/uL', referenceRange: '4.10 – 5.50', flag: 'normal' },
      { parameterName: 'Hematocrit', measuredValue: '', unit: '%', referenceRange: '36.0 – 48.0', flag: 'normal' },
      { parameterName: 'Platelet Count', measuredValue: '', unit: '10^3/uL', referenceRange: '150 – 400', flag: 'normal' },
      { parameterName: 'MCV', measuredValue: '', unit: 'fL', referenceRange: '80.0 – 100.0', flag: 'normal' },
    ],
  },
  {
    id: 'lipid',
    testName: 'Fasting Lipid Profile',
    category: 'Biochemistry',
    sampleType: 'Serum (Fasting 12h)',
    parameters: [
      { parameterName: 'Total Cholesterol', measuredValue: '', unit: 'mg/dL', referenceRange: '< 200', flag: 'normal' },
      { parameterName: 'LDL Cholesterol (Direct)', measuredValue: '', unit: 'mg/dL', referenceRange: '< 100', flag: 'normal' },
      { parameterName: 'HDL Cholesterol', measuredValue: '', unit: 'mg/dL', referenceRange: '> 40', flag: 'normal' },
      { parameterName: 'Triglycerides', measuredValue: '', unit: 'mg/dL', referenceRange: '< 150', flag: 'normal' },
      { parameterName: 'Non-HDL Cholesterol', measuredValue: '', unit: 'mg/dL', referenceRange: '< 130', flag: 'normal' },
    ],
  },
  {
    id: 'thyroid',
    testName: 'Thyroid Function Panel (TSH, Free T4, Free T3)',
    category: 'Endocrinology',
    sampleType: 'Serum (SST Gold Top)',
    parameters: [
      { parameterName: 'TSH (Ultrasensitive)', measuredValue: '', unit: 'mIU/L', referenceRange: '0.45 – 4.50', flag: 'normal' },
      { parameterName: 'Free T4 (Thyroxine)', measuredValue: '', unit: 'ng/dL', referenceRange: '0.82 – 1.77', flag: 'normal' },
      { parameterName: 'Free T3 (Triiodothyronine)', measuredValue: '', unit: 'pg/mL', referenceRange: '2.00 – 4.40', flag: 'normal' },
    ],
  },
  {
    id: 'cmp',
    testName: 'Comprehensive Metabolic Panel (CMP-14)',
    category: 'Biochemistry',
    sampleType: 'Heparinized Plasma (PST)',
    parameters: [
      { parameterName: 'Fasting Glucose', measuredValue: '', unit: 'mg/dL', referenceRange: '70 – 99', flag: 'normal' },
      { parameterName: 'Blood Urea Nitrogen (BUN)', measuredValue: '', unit: 'mg/dL', referenceRange: '7 – 20', flag: 'normal' },
      { parameterName: 'Serum Creatinine', measuredValue: '', unit: 'mg/dL', referenceRange: '0.70 – 1.30', flag: 'normal' },
      { parameterName: 'Sodium', measuredValue: '', unit: 'mmol/L', referenceRange: '136 – 145', flag: 'normal' },
      { parameterName: 'Potassium', measuredValue: '', unit: 'mmol/L', referenceRange: '3.5 – 5.1', flag: 'normal' },
      { parameterName: 'ALT (SGPT)', measuredValue: '', unit: 'U/L', referenceRange: '7 – 55', flag: 'normal' },
      { parameterName: 'AST (SGOT)', measuredValue: '', unit: 'U/L', referenceRange: '8 – 48', flag: 'normal' },
    ],
  },
  {
    id: 'hba1c',
    testName: 'HbA1c & Fasting Plasma Glucose',
    category: 'Biochemistry',
    sampleType: 'Whole Blood (EDTA) + Fluoride Plasma',
    parameters: [
      { parameterName: 'Hemoglobin A1c (HbA1c)', measuredValue: '', unit: '%', referenceRange: '4.0 – 5.6', flag: 'normal' },
      { parameterName: 'Estimated Average Glucose (eAG)', measuredValue: '', unit: 'mg/dL', referenceRange: '< 117', flag: 'normal' },
      { parameterName: 'Fasting Plasma Glucose', measuredValue: '', unit: 'mg/dL', referenceRange: '70 – 99', flag: 'normal' },
    ],
  },
  {
    id: 'iron_b12',
    testName: 'Iron Studies & Vitamin B12 Assay',
    category: 'Hematology',
    sampleType: 'Serum (Fasting)',
    parameters: [
      { parameterName: 'Serum Iron', measuredValue: '', unit: 'ug/dL', referenceRange: '60 – 170', flag: 'normal' },
      { parameterName: 'Serum Ferritin', measuredValue: '', unit: 'ng/mL', referenceRange: '20 – 250', flag: 'normal' },
      { parameterName: 'TIBC', measuredValue: '', unit: 'ug/dL', referenceRange: '240 – 450', flag: 'normal' },
      { parameterName: 'Vitamin B12', measuredValue: '', unit: 'pg/mL', referenceRange: '232 – 1245', flag: 'normal' },
    ],
  },
];

export const STATUS_LABELS: Record<string, string> = {
  registered: 'Registered',
  sample_collected: 'Sample Collected',
  processing: 'Processing',
  report_ready: 'Report Ready',
};

export const STATUS_TEXT_CLASS: Record<string, string> = {
  registered: 'text-slate-600',
  sample_collected: 'text-sky-700',
  processing: 'text-amber-700',
  report_ready: 'text-emerald-700',
};

export const FLAG_TEXT_CLASS: Record<string, string> = {
  normal: 'text-emerald-700',
  low: 'text-amber-700',
  high: 'text-amber-700',
  critical: 'text-red-700',
};

export const FLAG_LABELS: Record<string, string> = {
  normal: 'Normal',
  low: 'Low',
  high: 'High',
  critical: 'Critical',
};
