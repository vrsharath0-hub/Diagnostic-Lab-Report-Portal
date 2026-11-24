import React, { useCallback, useEffect, useState } from 'react';
import {
  ClipboardList,
  Download,
  Eye,
  FilePenLine,
  LogOut,
  Menu,
  Plus,
  Search,
  Shield,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import {
  AccountUser,
  DashboardMetrics,
  OrderStatus,
  PatientRecord,
  TestOrderDetail,
  TestOrderListItem,
  UserRole,
} from '../types/portal.ts';
import { apiFetch, formatShortDate, triggerReportPdfDownload } from '../lib/api.ts';
import { STATUS_LABELS, STATUS_TEXT_CLASS } from '../data/panelTemplates.ts';
import { RegisterPatientModal } from './RegisterPatientModal.tsx';
import { NewTestOrderModal } from './NewTestOrderModal.tsx';
import { ResultEntryDrawer } from './ResultEntryDrawer.tsx';
import { ReportPreviewModal } from './ReportPreviewModal.tsx';

interface StaffDashboardProps {
  onSwitchToPatientPreview?: () => void;
}

type StaffTab = 'orders' | 'patients' | 'roles';

const STATUS_FILTERS: Array<{ key: string; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'registered', label: 'Registered' },
  { key: 'sample_collected', label: 'Collected' },
  { key: 'processing', label: 'Processing' },
  { key: 'report_ready', label: 'Report Ready' },
];

const NEXT_STATUS: Record<OrderStatus, OrderStatus | null> = {
  registered: 'sample_collected',
  sample_collected: 'processing',
  processing: 'report_ready',
  report_ready: null,
};

export const StaffDashboard: React.FC<StaffDashboardProps> = ({
  onSwitchToPatientPreview,
}) => {
  const { accountUser, getToken, logout } = useAuth();
  const isAdmin = accountUser?.role === 'admin';

  const [activeTab, setActiveTab] = useState<StaffTab>('orders');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Data states
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [orders, setOrders] = useState<TestOrderListItem[]>([]);
  const [patients, setPatients] = useState<PatientRecord[]>([]);
  const [directoryUsers, setDirectoryUsers] = useState<AccountUser[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [bannerError, setBannerError] = useState<string | null>(null);

  // Filters
  const [orderSearch, setOrderSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [patientFilterId, setPatientFilterId] = useState<number | null>(null);
  const [patientSearch, setPatientSearch] = useState('');

  // Modals & Drawers
  const [showRegisterPatient, setShowRegisterPatient] = useState(false);
  const [editingPatient, setEditingPatient] = useState<PatientRecord | null>(null);
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [preselectedPatientId, setPreselectedPatientId] = useState<number | null>(null);
  const [activeResultTestCode, setActiveResultTestCode] = useState<string | null>(null);
  const [previewOrder, setPreviewOrder] = useState<TestOrderDetail | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [confirmDeleteOrderId, setConfirmDeleteOrderId] = useState<number | null>(null);

  const loadMetrics = useCallback(async () => {
    const token = await getToken();
    const data = await apiFetch<DashboardMetrics>('/api/staff/metrics', { token });
    setMetrics(data);
  }, [getToken]);

  const loadOrders = useCallback(async () => {
    const token = await getToken();
    const params = new URLSearchParams();
    if (orderSearch.trim()) params.set('search', orderSearch.trim());
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (patientFilterId) params.set('patientId', String(patientFilterId));

    const data = await apiFetch<{ orders: TestOrderListItem[] }>(
      `/api/staff/orders?${params.toString()}`,
      { token }
    );
    setOrders(data.orders);
  }, [getToken, orderSearch, statusFilter, patientFilterId]);

  const loadPatients = useCallback(async () => {
    const token = await getToken();
    const params = new URLSearchParams();
    if (patientSearch.trim()) params.set('search', patientSearch.trim());
    const data = await apiFetch<{ patients: PatientRecord[] }>(
      `/api/staff/patients?${params.toString()}`,
      { token }
    );
    setPatients(data.patients);
  }, [getToken, patientSearch]);

  const loadUserDirectory = useCallback(async () => {
    if (!isAdmin) return;
    const token = await getToken();
    const data = await apiFetch<{ users: AccountUser[] }>('/api/admin/users', { token });
    setDirectoryUsers(data.users);
  }, [getToken, isAdmin]);

  const refreshAll = useCallback(async () => {
    setBannerError(null);
    try {
      await Promise.all([loadMetrics(), loadOrders(), loadPatients()]);
      if (isAdmin) {
        await loadUserDirectory();
      }
    } catch (err: any) {
      setBannerError(err?.message || 'Unable to refresh laboratory records.');
    } finally {
      setLoadingData(false);
    }
  }, [loadMetrics, loadOrders, loadPatients, loadUserDirectory, isAdmin]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  // Debounced search reloads
  useEffect(() => {
    const timer = setTimeout(() => {
      loadOrders().catch((err) => setBannerError(err?.message || 'Search failed.'));
    }, 220);
    return () => clearTimeout(timer);
  }, [orderSearch, statusFilter, patientFilterId, loadOrders]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadPatients().catch((err) => setBannerError(err?.message || 'Patient search failed.'));
    }, 220);
    return () => clearTimeout(timer);
  }, [patientSearch, loadPatients]);

  const handleQuickAdvanceStatus = async (order: TestOrderListItem) => {
    const next = NEXT_STATUS[order.status];
    if (!next) return;
    setBusyId(order.id);
    setBannerError(null);
    try {
      const token = await getToken();
      await apiFetch(`/api/staff/orders/${order.id}/status`, {
        method: 'PATCH',
        token,
        body: { status: next },
      });
      await Promise.all([loadOrders(), loadMetrics()]);
    } catch (err: any) {
      setBannerError(err?.message || 'Unable to advance specimen status.');
    } finally {
      setBusyId(null);
    }
  };

  const handleOpenPreview = async (testCode: string) => {
    setBannerError(null);
    try {
      const token = await getToken();
      const res = await apiFetch<{ order: TestOrderDetail }>(
        `/api/staff/orders/${encodeURIComponent(testCode)}`,
        { token }
      );
      setPreviewOrder(res.order);
    } catch (err: any) {
      setBannerError(err?.message || 'Unable to open diagnostic report.');
    }
  };

  const handleDirectDownloadPdf = async (testCode: string, orderId: number) => {
    setBusyId(orderId);
    setBannerError(null);
    try {
      const token = await getToken();
      if (token) {
        await triggerReportPdfDownload(testCode, token, 'auto');
      }
    } catch (err: any) {
      setBannerError(err?.message || 'Unable to download PDF.');
    } finally {
      setBusyId(null);
    }
  };

  const handleDeleteOrder = async (orderId: number) => {
    setBusyId(orderId);
    setBannerError(null);
    try {
      const token = await getToken();
      await apiFetch(`/api/staff/orders/${orderId}`, {
        method: 'DELETE',
        token,
      });
      setConfirmDeleteOrderId(null);
      await Promise.all([loadOrders(), loadMetrics(), loadPatients()]);
    } catch (err: any) {
      setBannerError(err?.message || 'Unable to delete test order.');
    } finally {
      setBusyId(null);
    }
  };

  const handleRoleUpdate = async (userId: number, role: UserRole) => {
    setBannerError(null);
    try {
      const token = await getToken();
      await apiFetch(`/api/admin/users/${userId}/role`, {
        method: 'PATCH',
        token,
        body: { role },
      });
      await loadUserDirectory();
    } catch (err: any) {
      setBannerError(err?.message || 'Unable to update user role.');
    }
  };

  const selectedPatientForFilter = patientFilterId
    ? patients.find((p) => p.id === patientFilterId)
    : null;

  const breadcrumbLabel =
    activeTab === 'orders'
      ? 'Test Orders & Queue'
      : activeTab === 'patients'
        ? 'Patient Registry'
        : 'Staff & Role Access';

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
          {accountUser?.fullName || 'Lab Staff'}
        </p>
        <p className="text-xs text-slate-500 truncate mt-0.5">
          {accountUser?.role === 'admin' ? 'Laboratory Administrator' : 'Laboratory Staff'} ·{' '}
          {accountUser?.email}
        </p>
      </div>

      <nav className="flex-1 p-3 space-y-1" aria-label="Laboratory console navigation">
        <button
          type="button"
          onClick={() => {
            setActiveTab('orders');
            setMobileMenuOpen(false);
          }}
          className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors text-left ${
            activeTab === 'orders'
              ? 'bg-teal-50 text-teal-800 font-semibold'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <ClipboardList className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span className="truncate">Test Orders &amp; Queue</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('patients');
            setMobileMenuOpen(false);
          }}
          className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors text-left ${
            activeTab === 'patients'
              ? 'bg-teal-50 text-teal-800 font-semibold'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Users className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span className="truncate">Patient Registry</span>
        </button>

        {isAdmin && (
          <button
            type="button"
            onClick={() => {
              setActiveTab('roles');
              setMobileMenuOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors text-left ${
              activeTab === 'roles'
                ? 'bg-teal-50 text-teal-800 font-semibold'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Shield className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span className="truncate">Staff &amp; Role Access</span>
          </button>
        )}
      </nav>

      <div className="p-3 border-t border-slate-200 space-y-1">
        {onSwitchToPatientPreview && (
          <button
            type="button"
            onClick={onSwitchToPatientPreview}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-teal-800 hover:bg-teal-50 rounded-lg transition-colors text-left"
          >
            <Eye className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span className="truncate">Open Patient Portal View</span>
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
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-white border-r border-slate-200 z-20">
        {sidebarContent}
      </aside>

      {/* Mobile Sidebar Drawer */}
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

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Contextual Workspace Top Bar */}
        <header className="sticky top-0 z-10 bg-white border-b border-slate-200 px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden p-2 -ml-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="text-slate-400 hidden sm:inline">Laboratory Console</span>
              <span className="text-slate-300 hidden sm:inline">/</span>
              <h1 className="font-semibold text-slate-900 truncate">{breadcrumbLabel}</h1>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                setEditingPatient(null);
                setShowRegisterPatient(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <UserPlus className="w-3.5 h-3.5" aria-hidden="true" />
              Register Patient
            </button>
            <button
              type="button"
              onClick={() => {
                setPreselectedPatientId(null);
                setShowNewOrder(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              New Test Order
            </button>
          </div>
        </header>

        <main className="flex-1 p-6 max-w-[1400px] w-full mx-auto space-y-6">
          {bannerError && (
            <div className="px-4 py-3 text-xs font-medium text-red-800 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between gap-4">
              <span>{bannerError}</span>
              <button
                type="button"
                onClick={() => setBannerError(null)}
                className="text-red-700 underline underline-offset-2 shrink-0"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* TAB 1: TEST ORDERS & QUEUE */}
          {activeTab === 'orders' && (
            <>
              {/* Flat 4-Column Metric Strip */}
              <div className="bg-white border border-slate-200 rounded-xl grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
                <div className="p-5">
                  <p className="text-xs font-medium text-slate-500">Registered Patients</p>
                  <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                    {metrics ? metrics.totalPatients : '—'}
                  </p>
                </div>
                <div className="p-5">
                  <p className="text-xs font-medium text-slate-500">Registered &amp; Collected</p>
                  <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                    {metrics ? metrics.registeredCount + metrics.collectedCount : '—'}
                  </p>
                </div>
                <div className="p-5">
                  <p className="text-xs font-medium text-slate-500">Processing on Analyzer</p>
                  <p className="text-2xl font-bold font-mono tabular-nums text-amber-700 mt-1">
                    {metrics ? metrics.processingCount : '—'}
                  </p>
                </div>
                <div className="p-5">
                  <p className="text-xs font-medium text-slate-500">Reports Released</p>
                  <p className="text-2xl font-bold font-mono tabular-nums text-emerald-700 mt-1">
                    {metrics ? metrics.reportReadyCount : '—'}
                  </p>
                </div>
              </div>

              {/* Search & Segmented Status Filter Bar */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div className="relative flex-1 max-w-md">
                  <Search
                    className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                    aria-hidden="true"
                  />
                  <input
                    type="search"
                    value={orderSearch}
                    onChange={(e) => setOrderSearch(e.target.value)}
                    placeholder="Search by Test ID, Sample ID, Patient ID, phone, or name..."
                    className="w-full pl-10 pr-4 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {selectedPatientForFilter && (
                    <button
                      type="button"
                      onClick={() => setPatientFilterId(null)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-teal-800 bg-teal-50 border border-teal-200 rounded-lg"
                    >
                      Patient: {selectedPatientForFilter.fullName}
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}

                  <div
                    className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg overflow-x-auto"
                    role="tablist"
                    aria-label="Filter tests by status"
                  >
                    {STATUS_FILTERS.map((f) => (
                      <button
                        key={f.key}
                        type="button"
                        role="tab"
                        aria-selected={statusFilter === f.key}
                        onClick={() => setStatusFilter(f.key)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                          statusFilter === f.key
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Orders Table */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                {loadingData ? (
                  <div className="p-6 space-y-3">
                    {[1, 2, 3, 4].map((n) => (
                      <div key={n} className="h-11 bg-slate-100 rounded animate-pulse" />
                    ))}
                  </div>
                ) : orders.length === 0 ? (
                  <div className="px-6 py-14 text-center">
                    <p className="text-sm font-semibold text-slate-900">
                      No diagnostic test orders match your current filter
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Adjust your search criteria or log a new diagnostic order.
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowNewOrder(true)}
                      className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg"
                    >
                      <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                      Log First Test Order
                    </button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-600">
                          <th className="py-3 px-4">Test &amp; Sample ID</th>
                          <th className="py-3 px-4">Patient</th>
                          <th className="py-3 px-4">Diagnostic Panel</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-4">Ordered</th>
                          <th className="py-3 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 text-sm">
                        {orders.map((order) => {
                          const nextStage = NEXT_STATUS[order.status];
                          return (
                            <tr
                              key={order.id}
                              className="hover:bg-slate-50/80 transition-colors"
                            >
                              <td className="py-3 px-4 align-top">
                                <p className="font-mono font-semibold text-slate-900 text-xs tabular-nums">
                                  {order.testCode}
                                </p>
                                <p className="font-mono text-[11px] text-slate-500 tabular-nums mt-0.5">
                                  {order.sampleCode}
                                  {order.priority !== 'routine' && (
                                    <span className="text-red-700 font-semibold uppercase">
                                      {' '}
                                      · {order.priority}
                                    </span>
                                  )}
                                </p>
                              </td>

                              <td className="py-3 px-4 align-top">
                                <p className="font-medium text-slate-900">{order.patientName}</p>
                                <p className="text-xs font-mono text-slate-500 tabular-nums mt-0.5">
                                  {order.patientCode} · {order.patientPhone}
                                </p>
                              </td>

                              <td className="py-3 px-4 align-top">
                                <p className="font-medium text-slate-900">{order.testName}</p>
                                <p className="text-xs text-slate-500 mt-0.5">
                                  {order.category} · {order.resultCount} values
                                  {order.abnormalCount > 0 && (
                                    <span className="text-amber-700 font-medium">
                                      {' '}
                                      · {order.abnormalCount} flagged
                                    </span>
                                  )}
                                  {order.hasUploadedPdf && ' · PDF attached'}
                                </p>
                              </td>

                              <td className="py-3 px-4 align-top">
                                <p
                                  className={`text-xs font-semibold ${
                                    STATUS_TEXT_CLASS[order.status] || 'text-slate-700'
                                  }`}
                                >
                                  {STATUS_LABELS[order.status] || order.status}
                                </p>
                                {nextStage && (
                                  <button
                                    type="button"
                                    disabled={busyId === order.id}
                                    onClick={() => handleQuickAdvanceStatus(order)}
                                    className="mt-1 text-[11px] font-medium text-teal-700 hover:text-teal-900 underline underline-offset-2 whitespace-nowrap"
                                  >
                                    Advance to {STATUS_LABELS[nextStage]}
                                  </button>
                                )}
                              </td>

                              <td className="py-3 px-4 align-top font-mono text-xs text-slate-600 tabular-nums whitespace-nowrap">
                                {formatShortDate(order.orderedAt)}
                              </td>

                              <td className="py-3 px-4 align-top text-right">
                                <div className="inline-flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => setActiveResultTestCode(order.testCode)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 rounded-md whitespace-nowrap"
                                  >
                                    <FilePenLine className="w-3.5 h-3.5" aria-hidden="true" />
                                    Results / PDF
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenPreview(order.testCode)}
                                    title="View digital report"
                                    aria-label={`View report ${order.testCode}`}
                                    className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md"
                                  >
                                    <Eye className="w-4 h-4" />
                                  </button>
                                  <button
                                    type="button"
                                    disabled={busyId === order.id}
                                    onClick={() => handleDirectDownloadPdf(order.testCode, order.id)}
                                    title="Download PDF"
                                    aria-label={`Download PDF ${order.testCode}`}
                                    className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md"
                                  >
                                    <Download className="w-4 h-4" />
                                  </button>
                                  {confirmDeleteOrderId === order.id ? (
                                    <button
                                      type="button"
                                      disabled={busyId === order.id}
                                      onClick={() => handleDeleteOrder(order.id)}
                                      className="px-2 py-1 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded"
                                    >
                                      Confirm
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => setConfirmDeleteOrderId(order.id)}
                                      title="Delete order"
                                      aria-label={`Delete order ${order.testCode}`}
                                      className="p-1.5 text-slate-400 hover:text-red-700 hover:bg-red-50 rounded-md"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}

          {/* TAB 2: PATIENT REGISTRY */}
          {activeTab === 'patients' && (
            <>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="relative flex-1 max-w-md">
                  <Search
                    className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                    aria-hidden="true"
                  />
                  <input
                    type="search"
                    value={patientSearch}
                    onChange={(e) => setPatientSearch(e.target.value)}
                    placeholder="Search patients by Patient ID, phone number, name, or email..."
                    className="w-full pl-10 pr-4 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                  />
                </div>

                <p className="text-xs font-mono tabular-nums text-slate-500">
                  {patients.length} registered {patients.length === 1 ? 'patient' : 'patients'}
                </p>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                {patients.length === 0 ? (
                  <div className="px-6 py-14 text-center">
                    <p className="text-sm font-semibold text-slate-900">No patient records found</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Register a patient to begin ordering diagnostic tests.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingPatient(null);
                        setShowRegisterPatient(true);
                      }}
                      className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg"
                    >
                      <UserPlus className="w-3.5 h-3.5" aria-hidden="true" />
                      Register Patient
                    </button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-600">
                          <th className="py-3 px-4">Patient ID</th>
                          <th className="py-3 px-4">Patient Name &amp; Demographics</th>
                          <th className="py-3 px-4">Contact</th>
                          <th className="py-3 px-4 text-right">Diagnostic History</th>
                          <th className="py-3 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 text-sm">
                        {patients.map((patient) => (
                          <tr key={patient.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3 px-4 font-mono text-xs font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                              {patient.patientCode}
                            </td>
                            <td className="py-3 px-4">
                              <p className="font-medium text-slate-900">{patient.fullName}</p>
                              <p className="text-xs text-slate-500 mt-0.5">
                                DOB{' '}
                                <span className="font-mono tabular-nums">
                                  {patient.dateOfBirth}
                                </span>{' '}
                                · {patient.gender}
                                {patient.bloodGroup ? ` · ${patient.bloodGroup}` : ''}
                              </p>
                            </td>
                            <td className="py-3 px-4">
                              <p className="font-mono text-xs text-slate-800 tabular-nums">
                                {patient.phone}
                              </p>
                              <p className="text-xs text-slate-500 mt-0.5">
                                {patient.email || 'No email on file'}
                              </p>
                            </td>
                            <td className="py-3 px-4 text-right font-mono text-xs tabular-nums text-slate-700 whitespace-nowrap">
                              {patient.totalTests ?? 0} total · {patient.readyTests ?? 0} ready
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="inline-flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPreselectedPatientId(patient.id);
                                    setShowNewOrder(true);
                                  }}
                                  className="px-2.5 py-1.5 text-xs font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 rounded-md whitespace-nowrap"
                                >
                                  Order Test
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPatientFilterId(patient.id);
                                    setActiveTab('orders');
                                  }}
                                  className="px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md whitespace-nowrap"
                                >
                                  Tests
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingPatient(patient);
                                    setShowRegisterPatient(true);
                                  }}
                                  className="px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900"
                                >
                                  Edit
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}

          {/* TAB 3: ADMIN STAFF & ROLE MANAGEMENT */}
          {activeTab === 'roles' && isAdmin && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200">
                <h2 className="text-sm font-bold text-slate-900">
                  Role-Based Access Directory
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Assign laboratory staff or administrator permissions to authenticated accounts.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-600">
                      <th className="py-3 px-4">Account Holder</th>
                      <th className="py-3 px-4">Email</th>
                      <th className="py-3 px-4">Assigned Role</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-sm">
                    {directoryUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-50/70">
                        <td className="py-3 px-4 font-medium text-slate-900">{u.fullName}</td>
                        <td className="py-3 px-4 font-mono text-xs text-slate-600">{u.email}</td>
                        <td className="py-3 px-4">
                          <select
                            aria-label={`Role for ${u.email}`}
                            value={u.role}
                            disabled={u.id === accountUser?.id}
                            onChange={(e) => handleRoleUpdate(u.id, e.target.value as UserRole)}
                            className="px-3 py-1.5 text-xs font-medium bg-white border border-slate-300 rounded-lg disabled:bg-slate-100 disabled:text-slate-500"
                          >
                            <option value="admin">Administrator</option>
                            <option value="staff">Laboratory Staff</option>
                            <option value="patient">Patient</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Modals & Drawers */}
      {showRegisterPatient && (
        <RegisterPatientModal
          existingPatient={editingPatient}
          tokenProvider={getToken}
          onSaved={() => {
            setShowRegisterPatient(false);
            setEditingPatient(null);
            refreshAll();
          }}
          onClose={() => {
            setShowRegisterPatient(false);
            setEditingPatient(null);
          }}
        />
      )}

      {showNewOrder && (
        <NewTestOrderModal
          patients={patients}
          preselectedPatientId={preselectedPatientId}
          tokenProvider={getToken}
          onCreated={() => {
            setShowNewOrder(false);
            setPreselectedPatientId(null);
            refreshAll();
          }}
          onClose={() => {
            setShowNewOrder(false);
            setPreselectedPatientId(null);
          }}
        />
      )}

      {activeResultTestCode && (
        <ResultEntryDrawer
          testCode={activeResultTestCode}
          tokenProvider={getToken}
          onUpdated={() => {
            loadOrders();
            loadMetrics();
            loadPatients();
          }}
          onClose={() => setActiveResultTestCode(null)}
        />
      )}

      {previewOrder && (
        <ReportPreviewModal
          order={previewOrder}
          tokenProvider={getToken}
          canDownloadBeforeReady
          onClose={() => setPreviewOrder(null)}
        />
      )}
    </div>
  );
};
