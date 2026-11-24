import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowLeft,
  Download,
  Eye,
  FileArchive,
  Link2,
  LogOut,
  Menu,
  Search,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { PatientPortalResponse, TestOrderDetail } from '../types/portal.ts';
import { apiFetch, formatShortDate, triggerReportPdfDownload } from '../lib/api.ts';
import { STATUS_LABELS, STATUS_TEXT_CLASS } from '../data/panelTemplates.ts';
import { StatusProgressBar } from './StatusProgressBar.tsx';
import { ReportPreviewModal } from './ReportPreviewModal.tsx';

interface PatientDashboardProps {
  onReturnToStaffConsole?: () => void;
}

type PatientTab = 'overview' | 'archive';

export const PatientDashboard: React.FC<PatientDashboardProps> = ({
  onReturnToStaffConsole,
}) => {
  const { accountUser, patientSession, getToken, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<PatientTab>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [portalData, setPortalData] = useState<PatientPortalResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Archive filters
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Preview & download states
  const [selectedOrder, setSelectedOrder] = useState<TestOrderDetail | null>(null);
  const [downloadingCode, setDownloadingCode] = useState<string | null>(null);

  // Account linking state (for Google-signed-in patients without a linked record yet)
  const [linkPatientCode, setLinkPatientCode] = useState('');
  const [linkPhone, setLinkPhone] = useState('');
  const [linking, setLinking] = useState(false);
  const [linkFeedback, setLinkFeedback] = useState<string | null>(null);

  const loadPortal = useCallback(async () => {
    setErrorMsg(null);
    setLoading(true);
    try {
      const token = await getToken();
      const data = await apiFetch<PatientPortalResponse>('/api/patient/portal', { token });
      setPortalData(data);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Unable to load your diagnostic reports.');
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    loadPortal();
  }, [loadPortal]);

  const handleDownloadPdf = async (order: TestOrderDetail) => {
    setDownloadingCode(order.testCode);
    setErrorMsg(null);
    try {
      const token = await getToken();
      if (!token) {
        setErrorMsg('Session expired. Please verify or sign in again.');
        return;
      }
      await triggerReportPdfDownload(order.testCode, token, 'auto');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Unable to download PDF report.');
    } finally {
      setDownloadingCode(null);
    }
  };

  const handleLinkRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    setLinkFeedback(null);
    setLinking(true);
    try {
      const token = await getToken();
      await apiFetch('/api/patient/link-record', {
        method: 'POST',
        token,
        body: {
          patientCode: linkPatientCode.trim(),
          phone: linkPhone.trim(),
        },
      });
      setLinkPatientCode('');
      setLinkPhone('');
      await loadPortal();
    } catch (err: any) {
      setLinkFeedback(err?.message || 'Unable to verify Patient ID and phone number.');
    } finally {
      setLinking(false);
    }
  };

  const orders = portalData?.orders ?? [];
  const patient = portalData?.patient ?? null;

  const activeOrders = useMemo(
    () => orders.filter((o) => o.status !== 'report_ready'),
    [orders]
  );

  const readyOrders = useMemo(
    () => orders.filter((o) => o.status === 'report_ready'),
    [orders]
  );

  const categories = useMemo(() => {
    const set = new Set<string>();
    orders.forEach((o) => set.add(o.category));
    return ['all', ...Array.from(set)];
  }, [orders]);

  const filteredArchive = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return orders.filter((o) => {
      if (categoryFilter !== 'all' && o.category !== categoryFilter) return false;
      if (!q) return true;
      return (
        o.testCode.toLowerCase().includes(q) ||
        o.sampleCode.toLowerCase().includes(q) ||
        o.testName.toLowerCase().includes(q) ||
        (o.referringPhysician && o.referringPhysician.toLowerCase().includes(q))
      );
    });
  }, [orders, searchQuery, categoryFilter]);

  const openReportModal = (order: TestOrderDetail) => {
    setSelectedOrder({
      ...order,
      patient: patient ?? undefined,
    });
  };

  const sidebarContent = (
    <div className="flex flex-col h-full">
      <div className="px-5 h-16 flex items-center border-b border-slate-200">
        <span
          className="text-base font-bold tracking-tight text-slate-900 whitespace-nowrap"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Meridian Diagnostics
        </span>
      </div>

      <div className="px-4 py-4 border-b border-slate-200">
        <p className="text-sm font-semibold text-slate-900 truncate">
          {patient?.fullName || accountUser?.fullName || 'Patient Portal'}
        </p>
        <p className="text-xs font-mono tabular-nums text-slate-500 mt-0.5 truncate">
          {patient
            ? `${patient.patientCode}${patient.bloodGroup ? ` · ${patient.bloodGroup}` : ''}`
            : patientSession
              ? patientSession.patientCode
              : accountUser?.email}
        </p>
        {patient && (
          <p className="text-xs text-slate-500 mt-0.5">
            DOB <span className="font-mono tabular-nums">{patient.dateOfBirth}</span> · {patient.gender}
          </p>
        )}
      </div>

      <nav className="flex-1 p-3 space-y-1" aria-label="Patient portal navigation">
        <button
          type="button"
          onClick={() => {
            setActiveTab('overview');
            setMobileMenuOpen(false);
          }}
          className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors text-left ${
            activeTab === 'overview'
              ? 'bg-teal-50 text-teal-800 font-semibold'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Activity className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span className="truncate">Live Tracking &amp; Ready</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('archive');
            setMobileMenuOpen(false);
          }}
          className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors text-left ${
            activeTab === 'archive'
              ? 'bg-teal-50 text-teal-800 font-semibold'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <FileArchive className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span className="truncate">Report History Archive</span>
        </button>
      </nav>

      <div className="p-3 border-t border-slate-200 space-y-1">
        {onReturnToStaffConsole && (
          <button
            type="button"
            onClick={onReturnToStaffConsole}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-teal-800 hover:bg-teal-50 rounded-lg transition-colors text-left"
          >
            <ArrowLeft className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span className="truncate">Return to Staff Console</span>
          </button>
        )}
        <button
          type="button"
          onClick={logout}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 rounded-lg transition-colors text-left"
        >
          <LogOut className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-white border-r border-slate-200 z-20">
        {sidebarContent}
      </aside>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/50"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative w-64 max-w-[80vw] bg-white h-full z-10 border-r border-slate-200">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              aria-label="Close navigation menu"
              className="absolute top-4 right-3 p-1.5 text-slate-500 hover:text-slate-900"
            >
              <X className="w-4 h-4" />
            </button>
            {sidebarContent}
          </aside>
        </div>
      )}

      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        <header className="sticky top-0 z-10 bg-white border-b border-slate-200 px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open menu"
              className="lg:hidden p-2 -ml-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="text-slate-400 hidden sm:inline">Patient Portal</span>
              <span className="text-slate-300 hidden sm:inline">/</span>
              <h1 className="font-semibold text-slate-900 truncate">
                {activeTab === 'overview'
                  ? 'Live Test Tracking & Ready Reports'
                  : 'Complete Diagnostic Report Archive'}
              </h1>
            </div>
          </div>

          <div className="text-xs text-slate-500 hidden sm:block whitespace-nowrap">
            {portalData?.accessMode === 'otp_session'
              ? 'Verified via Report ID & OTP'
              : 'Verified Patient Account'}
          </div>
        </header>

        <main className="flex-1 p-6 max-w-[1280px] w-full mx-auto space-y-6">
          {errorMsg && (
            <div className="px-4 py-3 text-xs font-medium text-red-800 bg-red-50 border border-red-200 rounded-lg">
              {errorMsg}
            </div>
          )}

          {loading ? (
            <div className="space-y-4">
              <div className="h-24 bg-white border border-slate-200 rounded-xl animate-pulse" />
              <div className="h-56 bg-white border border-slate-200 rounded-xl animate-pulse" />
            </div>
          ) : !patient ? (
            /* Unlinked Google Patient Account Helper */
            <div className="bg-white border border-slate-200 rounded-xl p-8 max-w-xl">
              <h2 className="text-lg font-bold text-slate-900">
                Link Your Laboratory Patient Record
              </h2>
              <p className="text-sm text-slate-600 mt-1.5">
                We did not find a diagnostic profile automatically matched to{' '}
                <span className="font-mono text-slate-900">{accountUser?.email}</span>. Enter the
                Patient ID and phone number printed on your laboratory receipt to connect your
                reports.
              </p>

              {linkFeedback && (
                <div className="mt-4 px-3.5 py-2.5 text-xs font-medium text-red-800 bg-red-50 border border-red-200 rounded-lg">
                  {linkFeedback}
                </div>
              )}

              <form onSubmit={handleLinkRecord} className="mt-5 space-y-4">
                <div>
                  <label
                    htmlFor="link-pat-code"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Patient ID
                  </label>
                  <input
                    id="link-pat-code"
                    type="text"
                    required
                    value={linkPatientCode}
                    onChange={(e) => setLinkPatientCode(e.target.value)}
                    placeholder="e.g. PAT-2026-1042"
                    className="w-full px-3.5 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                  />
                </div>
                <div>
                  <label
                    htmlFor="link-pat-phone"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Registered Phone Number
                  </label>
                  <input
                    id="link-pat-phone"
                    type="tel"
                    required
                    value={linkPhone}
                    onChange={(e) => setLinkPhone(e.target.value)}
                    placeholder="e.g. 555-234-0142"
                    className="w-full px-3.5 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                  />
                </div>
                <button
                  type="submit"
                  disabled={linking}
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-50 rounded-lg"
                >
                  <Link2 className="w-4 h-4" aria-hidden="true" />
                  {linking ? 'Verifying Record...' : 'Connect Patient Profile'}
                </button>
              </form>
            </div>
          ) : activeTab === 'overview' ? (
            <>
              {/* Patient Summary Strip */}
              <div className="bg-white border border-slate-200 rounded-xl grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
                <div className="p-5">
                  <p className="text-xs font-medium text-slate-500">Total Diagnostic Orders</p>
                  <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                    {orders.length}
                  </p>
                </div>
                <div className="p-5">
                  <p className="text-xs font-medium text-slate-500">Tests In Progress</p>
                  <p className="text-2xl font-bold font-mono tabular-nums text-amber-700 mt-1">
                    {activeOrders.length}
                  </p>
                </div>
                <div className="p-5">
                  <p className="text-xs font-medium text-slate-500">Downloadable Reports Ready</p>
                  <p className="text-2xl font-bold font-mono tabular-nums text-emerald-700 mt-1">
                    {readyOrders.length}
                  </p>
                </div>
              </div>

              {/* Active / In-Progress Specimen Tracking */}
              {activeOrders.length > 0 && (
                <section className="space-y-3">
                  <h2 className="text-sm font-bold text-slate-900">
                    Active Specimen Tracking
                  </h2>
                  <div className="space-y-4">
                    {activeOrders.map((order) => (
                      <div
                        key={order.id}
                        className="bg-white border border-slate-200 rounded-xl p-6 space-y-5"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div>
                            <p className="text-xs font-mono tabular-nums text-slate-500">
                              {order.testCode} · Sample {order.sampleCode} · {order.category}
                            </p>
                            <h3 className="text-base font-bold text-slate-900 mt-0.5">
                              {order.testName}
                            </h3>
                            <p className="text-xs text-slate-500 mt-1">
                              {order.sampleType}
                              {order.referringPhysician
                                ? ` · Ordered by ${order.referringPhysician}`
                                : ''}
                            </p>
                          </div>
                          <span
                            className={`text-xs font-semibold ${
                              STATUS_TEXT_CLASS[order.status] || 'text-slate-700'
                            }`}
                          >
                            {STATUS_LABELS[order.status] || order.status}
                          </span>
                        </div>

                        <StatusProgressBar
                          status={order.status}
                          orderedAt={order.orderedAt}
                          collectedAt={order.collectedAt}
                          processingAt={order.processingAt}
                          completedAt={order.completedAt}
                        />
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Ready Digital Reports */}
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-slate-900">
                    Verified Reports Ready for Download
                  </h2>
                  {orders.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setActiveTab('archive')}
                      className="text-xs font-semibold text-teal-700 hover:text-teal-900 underline underline-offset-4"
                    >
                      View complete archive ({orders.length})
                    </button>
                  )}
                </div>

                {readyOrders.length === 0 ? (
                  <div className="bg-white border border-slate-200 rounded-xl px-6 py-10 text-center">
                    <p className="text-sm font-semibold text-slate-900">
                      No finalized reports available yet
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Once your active diagnostic panels finish pathologist verification, downloadable PDF reports will appear here.
                    </p>
                  </div>
                ) : (
                  <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-200">
                    {readyOrders.map((order) => {
                      const abnormalCount = order.results.filter(
                        (r) => r.flag !== 'normal'
                      ).length;
                      const isHighlighted =
                        portalData?.highlightedTestCode?.toUpperCase() ===
                        order.testCode.toUpperCase();

                      return (
                        <div
                          key={order.id}
                          className={`p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                            isHighlighted ? 'bg-teal-50/40' : 'bg-white'
                          }`}
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-mono tabular-nums text-slate-500">
                              {order.testCode} · {order.category} · Reported{' '}
                              {formatShortDate(order.completedAt)}
                            </p>
                            <h3 className="text-base font-semibold text-slate-900 mt-0.5">
                              {order.testName}
                            </h3>
                            <p className="text-xs text-slate-600 mt-1">
                              Verified by {order.pathologistName}
                              {order.results.length > 0 && (
                                <>
                                  {' · '}
                                  <span className="font-mono tabular-nums">
                                    {order.results.length} analytes
                                  </span>
                                </>
                              )}
                              {abnormalCount > 0 ? (
                                <span className="text-amber-800 font-semibold">
                                  {' '}
                                  · {abnormalCount} outside reference range
                                </span>
                              ) : (
                                <span className="text-emerald-700 font-medium">
                                  {' '}
                                  · Within reference range
                                </span>
                              )}
                            </p>
                          </div>

                          <div className="flex items-center gap-2.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => openReportModal(order)}
                              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap"
                            >
                              <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                              Inspect Results
                            </button>
                            <button
                              type="button"
                              disabled={downloadingCode === order.testCode}
                              onClick={() => handleDownloadPdf(order)}
                              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap"
                            >
                              <Download className="w-3.5 h-3.5" aria-hidden="true" />
                              {downloadingCode === order.testCode
                                ? 'Downloading...'
                                : 'Download PDF'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </>
          ) : (
            /* TAB 2: COMPLETE REPORT ARCHIVE */
            <section className="space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="relative flex-1 max-w-md">
                  <Search
                    className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                    aria-hidden="true"
                  />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Filter archive by Report ID, test name, or physician..."
                    className="w-full pl-10 pr-4 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                  />
                </div>

                <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg overflow-x-auto">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategoryFilter(cat)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                        categoryFilter === cat
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {cat === 'all' ? 'All Departments' : cat}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                {filteredArchive.length === 0 ? (
                  <div className="px-6 py-12 text-center text-sm text-slate-500">
                    No historical reports match your search filter.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-600">
                          <th className="py-3 px-4">Report ID</th>
                          <th className="py-3 px-4">Diagnostic Panel</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-4">Date Ordered</th>
                          <th className="py-3 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 text-sm">
                        {filteredArchive.map((order) => (
                          <tr key={order.id} className="hover:bg-slate-50/70">
                            <td className="py-3 px-4 font-mono text-xs font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                              {order.testCode}
                            </td>
                            <td className="py-3 px-4">
                              <p className="font-medium text-slate-900">{order.testName}</p>
                              <p className="text-xs text-slate-500 mt-0.5">
                                {order.category} · {order.referringPhysician || 'Clinic Order'}
                              </p>
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={`text-xs font-semibold ${
                                  STATUS_TEXT_CLASS[order.status] || 'text-slate-600'
                                }`}
                              >
                                {STATUS_LABELS[order.status] || order.status}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-mono text-xs text-slate-600 tabular-nums whitespace-nowrap">
                              {formatShortDate(order.orderedAt)}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="inline-flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => openReportModal(order)}
                                  className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md whitespace-nowrap"
                                >
                                  View
                                </button>
                                {order.status === 'report_ready' && (
                                  <button
                                    type="button"
                                    disabled={downloadingCode === order.testCode}
                                    onClick={() => handleDownloadPdf(order)}
                                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-50 rounded-md whitespace-nowrap"
                                  >
                                    <Download className="w-3.5 h-3.5" aria-hidden="true" />
                                    PDF
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>
          )}
        </main>
      </div>

      {selectedOrder && (
        <ReportPreviewModal
          order={selectedOrder}
          tokenProvider={getToken}
          canDownloadBeforeReady={false}
          onClose={() => setSelectedOrder(null)}
        />
      )}
    </div>
  );
};
