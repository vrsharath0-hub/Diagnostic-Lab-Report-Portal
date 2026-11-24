import React, { useState } from 'react';
import { ArrowRight, KeyRound, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { apiFetch } from '../lib/api.ts';

const LAB_HERO_IMAGE = '/src/assets/images/lab_facility_hero_1795517287572.jpg';

export const PortalLanding: React.FC = () => {
  const { signInWithGoogle, startPatientOtpSession, authError } = useAuth();
  const [authTab, setAuthTab] = useState<'patient_otp' | 'account_signin'>('patient_otp');
  const [heroImgFailed, setHeroImgFailed] = useState(false);

  // Patient Report ID + Phone -> OTP verification state
  const [testCode, setTestCode] = useState('');
  const [phone, setPhone] = useState('');
  const [otpStep, setOtpStep] = useState<'lookup' | 'verify'>('lookup');
  const [challengeId, setChallengeId] = useState<number | null>(null);
  const [maskedPhone, setMaskedPhone] = useState('');
  const [previewOtp, setPreviewOtp] = useState<string | null>(null);
  const [otpInput, setOtpInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);
    try {
      const res = await apiFetch<{
        challengeId: number;
        maskedPhone: string;
        expiresAt: string;
        previewOtp?: string;
      }>('/api/patient-access/request-otp', {
        method: 'POST',
        body: { testCode: testCode.trim(), phone: phone.trim() },
      });
      setChallengeId(res.challengeId);
      setMaskedPhone(res.maskedPhone);
      setPreviewOtp(res.previewOtp ?? null);
      setOtpInput('');
      setOtpStep('verify');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Unable to locate report. Please check your Report ID and phone number.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!challengeId) return;
    setErrorMsg(null);
    setSubmitting(true);
    try {
      const res = await apiFetch<{
        token: string;
        patientCode: string;
        testCode: string;
      }>('/api/patient-access/verify-otp', {
        method: 'POST',
        body: { challengeId, otp: otpInput.trim() },
      });
      startPatientOtpSession({
        token: res.token,
        patientCode: res.patientCode,
        testCode: res.testCode,
      });
    } catch (err: any) {
      setErrorMsg(err?.message || 'Invalid verification code. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const fillSampleReceipt = () => {
    setTestCode('LAB-2026-1042');
    setPhone('555-234-0142');
    setErrorMsg(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-[1360px] mx-auto px-6 h-16 flex items-center justify-between gap-8">
          <a
            href="#top"
            className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Meridian Diagnostics
          </a>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600">
            <a
              href="#access"
              onClick={() => setAuthTab('patient_otp')}
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              Patient Reports
            </a>
            <a
              href="#access"
              onClick={() => setAuthTab('account_signin')}
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              Staff Console
            </a>
            <a
              href="#workflow"
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              Digital Workflow
            </a>
            <a
              href="#standards"
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              Accreditation
            </a>
          </nav>

          <div className="shrink-0">
            <button
              type="button"
              onClick={() => {
                setAuthTab('account_signin');
                signInWithGoogle();
              }}
              className="px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              Staff Sign In
            </button>
          </div>
        </div>
      </header>

      {/* Main 2-Column Balanced Split Hero */}
      <main id="access" className="flex-1 max-w-[1360px] w-full mx-auto px-6 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          {/* Left Visual Editorial Column */}
          <div className="lg:col-span-7 relative rounded-xl overflow-hidden border border-slate-200 bg-slate-900 min-h-[420px] lg:min-h-[560px] flex flex-col justify-end">
            {!heroImgFailed ? (
              <img
                src={LAB_HERO_IMAGE}
                alt="Meridian Clinical Diagnostics modern pathology laboratory"
                referrerPolicy="no-referrer"
                onError={() => setHeroImgFailed(true)}
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-slate-800 via-teal-950 to-slate-900" />
            )}

            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/45 to-slate-950/15" />

            <div className="relative z-10 p-8 lg:p-10 max-w-2xl">
              <p className="text-xs font-medium text-teal-200 tracking-normal mb-3">
                Meridian Clinical Diagnostics · CLIA &amp; CAP Accredited Laboratory
              </p>
              <h1 className="text-3xl lg:text-4xl font-bold text-white tracking-tight leading-tight [text-wrap:balance]">
                Verified diagnostic lab reports, delivered securely without paper delays.
              </h1>
              <p className="mt-4 text-sm lg:text-base text-slate-200 leading-relaxed max-w-xl">
                Track sample progress in real time, review structured clinical reference values,
                and download pathologist-verified PDF reports from any device.
              </p>

              <div className="mt-6 pt-5 border-t border-white/15 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-300">
                <span>Role-Based Staff &amp; Patient Access</span>
                <span aria-hidden="true">·</span>
                <span>Live 4-Stage Sample Tracking</span>
                <span aria-hidden="true">·</span>
                <span>Verified PDF Downloads</span>
              </div>
            </div>
          </div>

          {/* Right Focused Authentication Panel */}
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-8 flex flex-col justify-between">
            <div>
              <div className="mb-6">
                <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                  Access Your Diagnostic Portal
                </h2>
                <p className="text-sm text-slate-600 mt-1">
                  Retrieve patient reports using your Report ID or sign in to the staff workbench.
                </p>
              </div>

              {/* Functional Segmented Control */}
              <div
                className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg mb-6"
                role="tablist"
                aria-label="Portal access methods"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={authTab === 'patient_otp'}
                  onClick={() => {
                    setAuthTab('patient_otp');
                    setErrorMsg(null);
                  }}
                  className={`py-2 px-3 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                    authTab === 'patient_otp'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Patient Report ID
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={authTab === 'account_signin'}
                  onClick={() => {
                    setAuthTab('account_signin');
                    setErrorMsg(null);
                  }}
                  className={`py-2 px-3 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                    authTab === 'account_signin'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Lab Staff &amp; Account
                </button>
              </div>

              {(errorMsg || authError) && (
                <div className="mb-5 px-4 py-3 text-xs font-medium text-red-800 bg-red-50 border border-red-200 rounded-lg">
                  {errorMsg || authError}
                </div>
              )}

              {authTab === 'patient_otp' ? (
                otpStep === 'lookup' ? (
                  <form onSubmit={handleRequestOtp} className="space-y-4">
                    <div>
                      <label
                        htmlFor="lookup-test-code"
                        className="block text-xs font-semibold text-slate-700 mb-1.5"
                      >
                        Test / Report ID
                      </label>
                      <input
                        id="lookup-test-code"
                        type="text"
                        required
                        value={testCode}
                        onChange={(e) => setTestCode(e.target.value)}
                        placeholder="e.g. LAB-2026-1042"
                        className="w-full px-3.5 py-2.5 text-sm font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="lookup-phone"
                        className="block text-xs font-semibold text-slate-700 mb-1.5"
                      >
                        Registered Phone Number
                      </label>
                      <input
                        id="lookup-phone"
                        type="tel"
                        required
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="e.g. 555-234-0142"
                        className="w-full px-3.5 py-2.5 text-sm font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-50 rounded-lg transition-colors"
                    >
                      {submitting ? 'Verifying Receipt...' : 'Send One-Time Verification Code'}
                      <ArrowRight className="w-4 h-4" aria-hidden="true" />
                    </button>

                    <div className="pt-2 flex items-center justify-between text-xs text-slate-500">
                      <span>Testing patient lookup?</span>
                      <button
                        type="button"
                        onClick={fillSampleReceipt}
                        className="font-semibold text-teal-700 hover:text-teal-900 underline underline-offset-4"
                      >
                        Fill sample receipt (LAB-2026-1042)
                      </button>
                    </div>
                  </form>
                ) : (
                  <form onSubmit={handleVerifyOtp} className="space-y-4">
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                      <p className="text-xs font-semibold text-slate-900">
                        Verification code issued for {testCode.toUpperCase()}
                      </p>
                      <p className="text-xs text-slate-600 mt-1">
                        Enter the 6-digit security code dispatched to phone ending in{' '}
                        <span className="font-mono font-semibold text-slate-900">{maskedPhone}</span>.
                      </p>
                      {previewOtp && (
                        <div className="mt-3 pt-2.5 border-t border-slate-200 flex items-center justify-between text-xs">
                          <span className="text-slate-500">Preview verification code:</span>
                          <span className="font-mono font-bold text-teal-800 tracking-widest text-sm tabular-nums">
                            {previewOtp}
                          </span>
                        </div>
                      )}
                    </div>

                    <div>
                      <label
                        htmlFor="otp-code"
                        className="block text-xs font-semibold text-slate-700 mb-1.5"
                      >
                        6-Digit Verification Code
                      </label>
                      <input
                        id="otp-code"
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        required
                        value={otpInput}
                        onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ''))}
                        placeholder="000000"
                        className="w-full px-3.5 py-2.5 text-base font-mono tracking-[0.35em] text-center bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700 tabular-nums"
                      />
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setOtpStep('lookup');
                          setErrorMsg(null);
                        }}
                        className="px-4 py-2.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors"
                      >
                        Back
                      </button>
                      <button
                        type="submit"
                        disabled={submitting || otpInput.length !== 6}
                        className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-50 rounded-lg transition-colors"
                      >
                        <KeyRound className="w-4 h-4" aria-hidden="true" />
                        {submitting ? 'Verifying...' : 'Verify & Open Reports'}
                      </button>
                    </div>
                  </form>
                )
              ) : (
                <div className="space-y-5">
                  <div className="space-y-2 text-sm text-slate-600">
                    <p>
                      Sign in with your verified Google account for role-based access:
                    </p>
                    <ul className="space-y-1.5 text-xs text-slate-600 pl-4 list-disc">
                      <li>
                        <strong className="text-slate-900">Laboratory Staff &amp; Administrators:</strong>{' '}
                        Register patients, log test orders, update live specimen status, enter
                        structured assay values, and upload signed PDF reports.
                      </li>
                      <li>
                        <strong className="text-slate-900">Registered Patients:</strong>{' '}
                        View your linked longitudinal test archive and download verified PDFs anytime.
                      </li>
                    </ul>
                  </div>

                  <button
                    type="button"
                    onClick={signInWithGoogle}
                    className="w-full inline-flex items-center justify-center gap-3 px-4 py-3 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors"
                  >
                    <ShieldCheck className="w-4 h-4" aria-hidden="true" />
                    Continue with Google Account
                  </button>
                </div>
              )}
            </div>

            <div className="mt-8 pt-5 border-t border-slate-200 text-xs text-slate-500 flex items-center justify-between gap-4">
              <span>Encrypted TLS · Signed Session Tokens</span>
              <span className="font-mono tabular-nums">CLIA 05D2198441</span>
            </div>
          </div>
        </div>

        {/* Full-Width Clinical Capabilities Strip Below Hero Split */}
        <section id="workflow" className="mt-12 pt-10 border-t border-slate-200">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div>
              <p className="text-xs font-mono text-teal-700 font-semibold">01. Registration</p>
              <h3 className="text-sm font-semibold text-slate-900 mt-1.5">
                Unique Patient &amp; Specimen IDs
              </h3>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Every patient and diagnostic order receives an auditable identifier for end-to-end chain of custody.
              </p>
            </div>
            <div>
              <p className="text-xs font-mono text-teal-700 font-semibold">02. Live Tracking</p>
              <h3 className="text-sm font-semibold text-slate-900 mt-1.5">
                4-Stage Status Visibility
              </h3>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Follow samples from Registration through Phlebotomy Collection, Analyzer Processing, and Final Release.
              </p>
            </div>
            <div>
              <p className="text-xs font-mono text-teal-700 font-semibold">03. Reporting</p>
              <h3 className="text-sm font-semibold text-slate-900 mt-1.5">
                Structured Values &amp; PDF Upload
              </h3>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Enter reference-flagged clinical analytes to auto-generate PDF reports or attach signed lab documents.
              </p>
            </div>
            <div id="standards">
              <p className="text-xs font-mono text-teal-700 font-semibold">04. Patient Archive</p>
              <h3 className="text-sm font-semibold text-slate-900 mt-1.5">
                Verified Longitudinal History
              </h3>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Patients verify via Report ID + OTP or account login to access their complete historical lab record.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white mt-8">
        <div className="max-w-[1360px] mx-auto px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <span>© {new Date().getFullYear()} Meridian Clinical Diagnostics</span>
          <span>400 Clinical Parkway, Suite 200 · Digital Laboratory Reporting Portal</span>
        </div>
      </footer>
    </div>
  );
};
