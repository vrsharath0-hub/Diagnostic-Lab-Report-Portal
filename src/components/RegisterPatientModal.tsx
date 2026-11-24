import React, { useState } from 'react';
import { X } from 'lucide-react';
import { PatientRecord } from '../types/portal.ts';
import { apiFetch } from '../lib/api.ts';

interface RegisterPatientModalProps {
  existingPatient?: PatientRecord | null;
  tokenProvider: () => Promise<string | null>;
  onSaved: (patient: PatientRecord) => void;
  onClose: () => void;
}

const BLOOD_GROUPS = ['', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export const RegisterPatientModal: React.FC<RegisterPatientModalProps> = ({
  existingPatient,
  tokenProvider,
  onSaved,
  onClose,
}) => {
  const [fullName, setFullName] = useState(existingPatient?.fullName ?? '');
  const [dateOfBirth, setDateOfBirth] = useState(existingPatient?.dateOfBirth ?? '1990-01-15');
  const [gender, setGender] = useState<'Female' | 'Male' | 'Other'>(
    (existingPatient?.gender as 'Female' | 'Male' | 'Other') ?? 'Female'
  );
  const [phone, setPhone] = useState(existingPatient?.phone ?? '');
  const [email, setEmail] = useState(existingPatient?.email ?? '');
  const [bloodGroup, setBloodGroup] = useState(existingPatient?.bloodGroup ?? '');
  const [address, setAddress] = useState(existingPatient?.address ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const token = await tokenProvider();
      const payload = {
        fullName,
        dateOfBirth,
        gender,
        phone,
        email: email.trim() || null,
        bloodGroup: bloodGroup || null,
        address: address.trim() || null,
      };
      const url = existingPatient
        ? `/api/staff/patients/${existingPatient.id}`
        : '/api/staff/patients';
      const method = existingPatient ? 'PUT' : 'POST';

      const res = await apiFetch<{ patient: PatientRecord }>(url, {
        method,
        token,
        body: payload,
      });
      onSaved(res.patient);
    } catch (err: any) {
      setError(err?.message || 'Unable to save patient record.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="patient-modal-title"
    >
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 id="patient-modal-title" className="text-base font-bold text-slate-900">
              {existingPatient ? 'Edit Patient Record' : 'Register New Patient'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {existingPatient
                ? `Updating profile for ${existingPatient.patientCode}`
                : 'A unique Patient ID will be assigned automatically upon registration.'}
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

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="px-3.5 py-2.5 text-xs font-medium text-red-800 bg-red-50 border border-red-200 rounded-lg">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="p-name" className="block text-xs font-semibold text-slate-700 mb-1">
              Full Legal Name
            </label>
            <input
              id="p-name"
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Jordan Patel"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="p-dob" className="block text-xs font-semibold text-slate-700 mb-1">
                Date of Birth
              </label>
              <input
                id="p-dob"
                type="date"
                required
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
              />
            </div>

            <div>
              <label htmlFor="p-gender" className="block text-xs font-semibold text-slate-700 mb-1">
                Gender
              </label>
              <select
                id="p-gender"
                value={gender}
                onChange={(e) => setGender(e.target.value as 'Female' | 'Male' | 'Other')}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
              >
                <option value="Female">Female</option>
                <option value="Male">Male</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label htmlFor="p-blood" className="block text-xs font-semibold text-slate-700 mb-1">
                Blood Group
              </label>
              <select
                id="p-blood"
                value={bloodGroup}
                onChange={(e) => setBloodGroup(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
              >
                <option value="">Unspecified</option>
                {BLOOD_GROUPS.filter(Boolean).map((bg) => (
                  <option key={bg} value={bg}>
                    {bg}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="p-phone" className="block text-xs font-semibold text-slate-700 mb-1">
                Phone Number (Used for OTP)
              </label>
              <input
                id="p-phone"
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. 555-234-0199"
                className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
              />
            </div>

            <div>
              <label htmlFor="p-email" className="block text-xs font-semibold text-slate-700 mb-1">
                Email Address (Optional)
              </label>
              <input
                id="p-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="patient@example.com"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
              />
            </div>
          </div>

          <div>
            <label htmlFor="p-address" className="block text-xs font-semibold text-slate-700 mb-1">
              Residential Address (Optional)
            </label>
            <input
              id="p-address"
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Street address, city"
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
              disabled={submitting}
              className="px-5 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-50 rounded-lg"
            >
              {submitting
                ? 'Saving...'
                : existingPatient
                  ? 'Save Changes'
                  : 'Register Patient'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
