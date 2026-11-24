import React, { useState } from 'react';
import { X } from 'lucide-react';
import { PatientRecord } from '../types/portal.ts';
import { DIAGNOSTIC_PANEL_TEMPLATES } from '../data/panelTemplates.ts';
import { apiFetch } from '../lib/api.ts';

interface NewTestOrderModalProps {
  patients: PatientRecord[];
  preselectedPatientId?: number | null;
  tokenProvider: () => Promise<string | null>;
  onCreated: () => void;
  onClose: () => void;
}

const CATEGORIES = [
  'Hematology',
  'Biochemistry',
  'Endocrinology',
  'Microbiology',
  'Immunology',
  'Pathology',
] as const;

export const NewTestOrderModal: React.FC<NewTestOrderModalProps> = ({
  patients,
  preselectedPatientId,
  tokenProvider,
  onCreated,
  onClose,
}) => {
  const [patientId, setPatientId] = useState<string>(
    preselectedPatientId ? String(preselectedPatientId) : patients[0] ? String(patients[0].id) : ''
  );
  const [testName, setTestName] = useState(DIAGNOSTIC_PANEL_TEMPLATES[0].testName);
  const [category, setCategory] = useState<string>(DIAGNOSTIC_PANEL_TEMPLATES[0].category);
  const [sampleType, setSampleType] = useState(DIAGNOSTIC_PANEL_TEMPLATES[0].sampleType);
  const [priority, setPriority] = useState<'routine' | 'urgent' | 'stat'>('routine');
  const [referringPhysician, setReferringPhysician] = useState('');
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applyTemplate = (templateId: string) => {
    const found = DIAGNOSTIC_PANEL_TEMPLATES.find((t) => t.id === templateId);
    if (!found) return;
    setTestName(found.testName);
    setCategory(found.category);
    setSampleType(found.sampleType);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientId) {
      setError('Please select a patient first.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const token = await tokenProvider();
      await apiFetch('/api/staff/orders', {
        method: 'POST',
        token,
        body: {
          patientId: Number(patientId),
          testName,
          category,
          sampleType,
          priority,
          referringPhysician: referringPhysician.trim() || null,
          clinicalNotes: clinicalNotes.trim() || null,
        },
      });
      onCreated();
    } catch (err: any) {
      setError(err?.message || 'Unable to log diagnostic test order.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="order-modal-title"
    >
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 id="order-modal-title" className="text-base font-bold text-slate-900">
              Log Diagnostic Test Order
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Generates a unique Test Report ID and Specimen Barcode ID automatically.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="px-3.5 py-2.5 text-xs font-medium text-red-800 bg-red-50 border border-red-200 rounded-lg">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="order-patient" className="block text-xs font-semibold text-slate-700 mb-1">
              Registered Patient
            </label>
            <select
              id="order-patient"
              required
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
            >
              {patients.length === 0 && <option value="">No registered patients</option>}
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.fullName} — {p.patientCode} ({p.phone})
                </option>
              ))}
            </select>
          </div>

          {/* Standard Panel Quick Fill Buttons */}
          <div>
            <p className="text-xs font-semibold text-slate-700 mb-2">Quick Panel Presets</p>
            <div className="flex flex-wrap gap-1.5">
              {DIAGNOSTIC_PANEL_TEMPLATES.map((tpl) => {
                const isSelected = testName === tpl.testName;
                return (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => applyTemplate(tpl.id)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap ${
                      isSelected
                        ? 'bg-teal-700 text-white border-teal-700'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {tpl.testName.split('(')[0].trim()}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="order-test-name" className="block text-xs font-semibold text-slate-700 mb-1">
                Diagnostic Test / Panel Name
              </label>
              <input
                id="order-test-name"
                type="text"
                required
                value={testName}
                onChange={(e) => setTestName(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
              />
            </div>

            <div>
              <label htmlFor="order-category" className="block text-xs font-semibold text-slate-700 mb-1">
                Department / Category
              </label>
              <select
                id="order-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label htmlFor="order-sample" className="block text-xs font-semibold text-slate-700 mb-1">
                Specimen / Sample Type
              </label>
              <input
                id="order-sample"
                type="text"
                required
                value={sampleType}
                onChange={(e) => setSampleType(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
              />
            </div>

            <div>
              <label htmlFor="order-priority" className="block text-xs font-semibold text-slate-700 mb-1">
                Priority
              </label>
              <select
                id="order-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as 'routine' | 'urgent' | 'stat')}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
              >
                <option value="routine">Routine</option>
                <option value="urgent">Urgent</option>
                <option value="stat">STAT</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="order-physician" className="block text-xs font-semibold text-slate-700 mb-1">
              Referring Physician (Optional)
            </label>
            <input
              id="order-physician"
              type="text"
              value={referringPhysician}
              onChange={(e) => setReferringPhysician(e.target.value)}
              placeholder="e.g. Dr. Clara Hendricks"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
            />
          </div>

          <div>
            <label htmlFor="order-notes" className="block text-xs font-semibold text-slate-700 mb-1">
              Pre-Analytical / Order Notes (Optional)
            </label>
            <textarea
              id="order-notes"
              rows={2}
              value={clinicalNotes}
              onChange={(e) => setClinicalNotes(e.target.value)}
              placeholder="e.g. Patient fasted 12 hours prior to draw."
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
            />
          </div>

          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || patients.length === 0}
              className="px-5 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-50 rounded-lg"
            >
              {submitting ? 'Creating Order...' : 'Register Test Order'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
