import React, { useEffect, useRef, useState } from 'react';
import { Download, FileUp, Plus, Trash2, X } from 'lucide-react';
import { OrderStatus, ResultFlag, TestOrderDetail, TestResultValue } from '../types/portal.ts';
import { DIAGNOSTIC_PANEL_TEMPLATES, STATUS_LABELS } from '../data/panelTemplates.ts';
import { apiFetch, triggerReportPdfDownload } from '../lib/api.ts';
import { StatusProgressBar } from './StatusProgressBar.tsx';

interface ResultEntryDrawerProps {
  testCode: string;
  tokenProvider: () => Promise<string | null>;
  onUpdated: () => void;
  onClose: () => void;
}

const STATUS_OPTIONS: OrderStatus[] = [
  'registered',
  'sample_collected',
  'processing',
  'report_ready',
];

export const ResultEntryDrawer: React.FC<ResultEntryDrawerProps> = ({
  testCode,
  tokenProvider,
  onUpdated,
  onClose,
}) => {
  const [order, setOrder] = useState<TestOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [values, setValues] = useState<TestResultValue[]>([]);
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [pathologistName, setPathologistName] = useState('Dr. Evelyn Reed, MD, PhD');
  const [saving, setSaving] = useState(false);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadOrder = async () => {
    setLoading(true);
    try {
      const token = await tokenProvider();
      const res = await apiFetch<{ order: TestOrderDetail }>(
        `/api/staff/orders/${encodeURIComponent(testCode)}`,
        { token }
      );
      setOrder(res.order);
      setValues(
        res.order.results.length > 0
          ? res.order.results
          : [
              {
                parameterName: '',
                measuredValue: '',
                unit: '',
                referenceRange: '',
                flag: 'normal',
              },
            ]
      );
      setClinicalNotes(res.order.clinicalNotes ?? '');
      setPathologistName(res.order.pathologistName || 'Dr. Evelyn Reed, MD, PhD');
    } catch (err: any) {
      setFeedback({ type: 'error', text: err?.message || 'Unable to load test order.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrder();
  }, [testCode]);

  const handleStatusChange = async (newStatus: OrderStatus) => {
    if (!order) return;
    setFeedback(null);
    try {
      const token = await tokenProvider();
      await apiFetch(`/api/staff/orders/${order.id}/status`, {
        method: 'PATCH',
        token,
        body: { status: newStatus },
      });
      await loadOrder();
      onUpdated();
      setFeedback({
        type: 'success',
        text: `Specimen status updated to ${STATUS_LABELS[newStatus]}.`,
      });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err?.message || 'Unable to update status.' });
    }
  };

  const handleLoadTemplate = (templateId: string) => {
    const tpl = DIAGNOSTIC_PANEL_TEMPLATES.find((t) => t.id === templateId);
    if (!tpl) return;
    setValues(tpl.parameters.map((p) => ({ ...p })));
  };

  const updateRow = (idx: number, field: keyof TestResultValue, val: string) => {
    setValues((prev) =>
      prev.map((row, i) => (i === idx ? { ...row, [field]: val } : row))
    );
  };

  const addRow = () => {
    setValues((prev) => [
      ...prev,
      { parameterName: '', measuredValue: '', unit: '', referenceRange: '', flag: 'normal' },
    ]);
  };

  const removeRow = (idx: number) => {
    setValues((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSaveResults = async (markReportReady: boolean) => {
    if (!order) return;
    setFeedback(null);
    const cleaned = values.filter(
      (v) => v.parameterName.trim().length > 0 && v.measuredValue.trim().length > 0
    );

    setSaving(true);
    try {
      const token = await tokenProvider();
      await apiFetch(`/api/staff/orders/${order.id}/results`, {
        method: 'PUT',
        token,
        body: {
          clinicalNotes,
          pathologistName,
          markReportReady,
          values: cleaned.map((v) => ({
            parameterName: v.parameterName,
            measuredValue: v.measuredValue,
            unit: v.unit,
            referenceRange: v.referenceRange,
            flag: v.flag as ResultFlag,
          })),
        },
      });
      await loadOrder();
      onUpdated();
      setFeedback({
        type: 'success',
        text: markReportReady
          ? 'Results verified and report released to patient portal.'
          : 'Structured values saved as draft.',
      });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err?.message || 'Unable to save results.' });
    } finally {
      setSaving(false);
    }
  };

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!order || !e.target.files?.[0]) return;
    const file = e.target.files[0];
    setFeedback(null);
    setUploadingPdf(true);

    try {
      const token = await tokenProvider();
      const formData = new FormData();
      formData.append('file', file);
      formData.append('markReportReady', 'true');

      await apiFetch(`/api/staff/orders/${order.id}/upload-pdf`, {
        method: 'POST',
        token,
        body: formData,
        isFormData: true,
      });
      await loadOrder();
      onUpdated();
      setFeedback({
        type: 'success',
        text: `Uploaded ${file.name} and marked report ready for patient download.`,
      });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err?.message || 'PDF upload failed.' });
    } finally {
      setUploadingPdf(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemovePdf = async () => {
    if (!order) return;
    setFeedback(null);
    try {
      const token = await tokenProvider();
      await apiFetch(`/api/staff/orders/${order.id}/upload-pdf`, {
        method: 'DELETE',
        token,
      });
      await loadOrder();
      onUpdated();
      setFeedback({ type: 'success', text: 'Uploaded PDF attachment removed.' });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err?.message || 'Unable to remove PDF attachment.' });
    }
  };

  const handleDownloadPreview = async () => {
    if (!order) return;
    setDownloadingPdf(true);
    try {
      const token = await tokenProvider();
      if (token) {
        await triggerReportPdfDownload(order.testCode, token, 'auto');
      }
    } catch (err: any) {
      setFeedback({ type: 'error', text: err?.message || 'Unable to generate PDF preview.' });
    } finally {
      setDownloadingPdf(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-900/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="result-drawer-title"
    >
      <div className="bg-white w-full max-w-4xl h-full flex flex-col border-l border-slate-200 overflow-hidden">
        {/* Drawer Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-mono tabular-nums text-slate-500">
              {testCode}
              {order ? ` · Sample ${order.sampleCode} · ${order.patient?.fullName ?? ''}` : ''}
            </p>
            <h2 id="result-drawer-title" className="text-lg font-bold text-slate-900 truncate">
              {order ? order.testName : 'Loading Diagnostic Order...'}
            </h2>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {order && (
              <button
                type="button"
                onClick={handleDownloadPreview}
                disabled={downloadingPdf}
                className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" aria-hidden="true" />
                {downloadingPdf ? 'Generating...' : 'Preview PDF'}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close result workbench"
              className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {feedback && (
            <div
              className={`px-4 py-3 text-xs font-medium rounded-lg border ${
                feedback.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-red-50 text-red-800 border-red-200'
              }`}
            >
              {feedback.text}
            </div>
          )}

          {loading || !order ? (
            <div className="space-y-3">
              <div className="h-16 bg-slate-100 rounded-lg animate-pulse" />
              <div className="h-48 bg-slate-100 rounded-lg animate-pulse" />
            </div>
          ) : (
            <>
              {/* Stage 1: Live Specimen Status Controls */}
              <section className="pb-6 border-b border-slate-200 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">Live Specimen Status</h3>
                    <p className="text-xs text-slate-500">
                      Status changes synchronize immediately to the patient tracking portal.
                    </p>
                  </div>
                  <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                    {STATUS_OPTIONS.map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => handleStatusChange(st)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                          order.status === st
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {STATUS_LABELS[st]}
                      </button>
                    ))}
                  </div>
                </div>

                <StatusProgressBar
                  status={order.status}
                  orderedAt={order.orderedAt}
                  collectedAt={order.collectedAt}
                  processingAt={order.processingAt}
                  completedAt={order.completedAt}
                />
              </section>

              {/* Stage 2: Direct PDF Report Upload */}
              <section className="pb-6 border-b border-slate-200">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">
                      Upload Official Lab PDF (Optional)
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Attach a signed analyzer/pathology PDF (max 5MB), or leave empty to auto-generate a clinical PDF from structured values below.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="application/pdf,.pdf"
                      onChange={handlePdfUpload}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingPdf}
                      className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-50 rounded-lg whitespace-nowrap"
                    >
                      <FileUp className="w-3.5 h-3.5" aria-hidden="true" />
                      {uploadingPdf
                        ? 'Uploading PDF...'
                        : order.hasUploadedPdf
                          ? 'Replace PDF File'
                          : 'Upload PDF Report'}
                    </button>
                    {order.hasUploadedPdf && (
                      <button
                        type="button"
                        onClick={handleRemovePdf}
                        className="px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 rounded-lg"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>

                {order.hasUploadedPdf && (
                  <div className="mt-3 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-xs">
                    <span className="font-mono text-slate-800 truncate">
                      Attached: {order.reportFileName}
                    </span>
                    <span className="text-emerald-700 font-semibold shrink-0">Verified PDF</span>
                  </div>
                )}
              </section>

              {/* Stage 3: Structured Test Values Editor */}
              <section className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">
                      Structured Analytical Values
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Recorded values populate both the interactive patient viewer and auto-generated PDF report.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      aria-label="Load standard panel analytes"
                      defaultValue=""
                      onChange={(e) => {
                        if (e.target.value) handleLoadTemplate(e.target.value);
                        e.target.value = '';
                      }}
                      className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg"
                    >
                      <option value="">Load panel template...</option>
                      {DIAGNOSTIC_PANEL_TEMPLATES.map((tpl) => (
                        <option key={tpl.id} value={tpl.id}>
                          {tpl.testName}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={addRow}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 rounded-lg whitespace-nowrap"
                    >
                      <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                      Add Parameter
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-600">
                        <th className="py-2 px-3">Parameter</th>
                        <th className="py-2 px-3 w-28">Result</th>
                        <th className="py-2 px-3 w-24">Unit</th>
                        <th className="py-2 px-3 w-36">Reference Range</th>
                        <th className="py-2 px-3 w-28">Flag</th>
                        <th className="py-2 px-2 w-10" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {values.map((row, idx) => (
                        <tr key={idx} className="bg-white">
                          <td className="p-2">
                            <input
                              type="text"
                              value={row.parameterName}
                              onChange={(e) => updateRow(idx, 'parameterName', e.target.value)}
                              placeholder="e.g. Hemoglobin"
                              className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded focus:outline-none focus:border-teal-700"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={row.measuredValue}
                              onChange={(e) => updateRow(idx, 'measuredValue', e.target.value)}
                              placeholder="13.8"
                              className="w-full px-2.5 py-1.5 text-xs font-mono tabular-nums border border-slate-200 rounded focus:outline-none focus:border-teal-700"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={row.unit}
                              onChange={(e) => updateRow(idx, 'unit', e.target.value)}
                              placeholder="g/dL"
                              className="w-full px-2.5 py-1.5 text-xs font-mono border border-slate-200 rounded focus:outline-none focus:border-teal-700"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={row.referenceRange}
                              onChange={(e) => updateRow(idx, 'referenceRange', e.target.value)}
                              placeholder="12.0 – 15.5"
                              className="w-full px-2.5 py-1.5 text-xs font-mono tabular-nums border border-slate-200 rounded focus:outline-none focus:border-teal-700"
                            />
                          </td>
                          <td className="p-2">
                            <select
                              value={row.flag}
                              onChange={(e) => updateRow(idx, 'flag', e.target.value)}
                              className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded bg-white focus:outline-none focus:border-teal-700"
                            >
                              <option value="normal">Normal</option>
                              <option value="low">Low</option>
                              <option value="high">High</option>
                              <option value="critical">Critical</option>
                            </select>
                          </td>
                          <td className="p-2 text-center">
                            <button
                              type="button"
                              onClick={() => removeRow(idx)}
                              aria-label="Remove parameter row"
                              className="p-1.5 text-slate-400 hover:text-red-700 rounded"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 pt-2">
                  <div className="md:col-span-8">
                    <label
                      htmlFor="res-clinical-notes"
                      className="block text-xs font-semibold text-slate-700 mb-1"
                    >
                      Pathologist Clinical Remarks
                    </label>
                    <textarea
                      id="res-clinical-notes"
                      rows={3}
                      value={clinicalNotes}
                      onChange={(e) => setClinicalNotes(e.target.value)}
                      placeholder="Summarize diagnostic interpretation, morphology findings, or follow-up recommendations..."
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                    />
                  </div>
                  <div className="md:col-span-4">
                    <label
                      htmlFor="res-pathologist"
                      className="block text-xs font-semibold text-slate-700 mb-1"
                    >
                      Verifying Pathologist
                    </label>
                    <input
                      id="res-pathologist"
                      type="text"
                      value={pathologistName}
                      onChange={(e) => setPathologistName(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                    />
                  </div>
                </div>
              </section>
            </>
          )}
        </div>

        {/* Sticky Action Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-500">
            Releasing sets status to <strong className="text-slate-900">Report Ready</strong> for patient download.
          </p>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              disabled={saving || loading}
              onClick={() => handleSaveResults(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-50 rounded-lg whitespace-nowrap"
            >
              Save Draft
            </button>
            <button
              type="button"
              disabled={saving || loading}
              onClick={() => handleSaveResults(true)}
              className="px-5 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-50 rounded-lg whitespace-nowrap"
            >
              {saving ? 'Publishing...' : 'Save & Release Report'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
