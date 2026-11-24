import React, { useState } from 'react';
import { Download, FileText, X } from 'lucide-react';
import { TestOrderDetail } from '../types/portal.ts';
import { formatDateTime, triggerReportPdfDownload } from '../lib/api.ts';
import { FLAG_LABELS, FLAG_TEXT_CLASS, STATUS_LABELS, STATUS_TEXT_CLASS } from '../data/panelTemplates.ts';
import { StatusProgressBar } from './StatusProgressBar.tsx';

interface ReportPreviewModalProps {
  order: TestOrderDetail;
  tokenProvider: () => Promise<string | null>;
  canDownloadBeforeReady?: boolean;
  onClose: () => void;
}

const PATHOLOGIST_AVATAR = '/src/assets/images/avatar_pathologist_1795517281840.jpg';

export const ReportPreviewModal: React.FC<ReportPreviewModalProps> = ({
  order,
  tokenProvider,
  canDownloadBeforeReady = false,
  onClose,
}) => {
  const [downloading, setDownloading] = useState<'auto' | 'generated' | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [avatarFailed, setAvatarFailed] = useState(false);

  const isDownloadAllowed = canDownloadBeforeReady || order.status === 'report_ready';

  const handleDownload = async (source: 'auto' | 'generated') => {
    setDownloadError(null);
    setDownloading(source);
    try {
      const token = await tokenProvider();
      if (!token) {
        setDownloadError('Your session expired. Please sign in again.');
        return;
      }
      await triggerReportPdfDownload(order.testCode, token, source);
    } catch (err: any) {
      setDownloadError(err?.message || 'Unable to download PDF report.');
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-modal-title"
    >
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-slate-200 bg-slate-50/70">
          <div className="min-w-0">
            <p className="text-xs font-mono tabular-nums text-slate-500">
              {order.testCode} · Sample {order.sampleCode} · {order.category}
            </p>
            <h2
              id="report-modal-title"
              className="text-lg font-semibold text-slate-900 truncate mt-0.5"
            >
              {order.testName}
            </h2>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isDownloadAllowed && (
              <button
                type="button"
                onClick={() => handleDownload('auto')}
                disabled={downloading !== null}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <Download className="w-3.5 h-3.5" aria-hidden="true" />
                {downloading === 'auto'
                  ? 'Preparing PDF...'
                  : order.hasUploadedPdf
                    ? 'Download Lab PDF'
                    : 'Download Official PDF'}
              </button>
            )}
            {isDownloadAllowed && order.hasUploadedPdf && order.results.length > 0 && (
              <button
                type="button"
                onClick={() => handleDownload('generated')}
                disabled={downloading !== null}
                className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <FileText className="w-3.5 h-3.5" aria-hidden="true" />
                {downloading === 'generated' ? 'Generating...' : 'Structured Summary PDF'}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close report preview"
              className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Clinical Sheet */}
        <div className="p-6 overflow-y-auto space-y-6">
          {downloadError && (
            <div className="px-4 py-3 text-sm text-red-800 bg-red-50 border border-red-200 rounded-lg">
              {downloadError}
            </div>
          )}

          {/* Live Specimen Progress */}
          <div className="pb-5 border-b border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-slate-700">Specimen Lifecycle</h3>
              <span className={`text-xs font-semibold ${STATUS_TEXT_CLASS[order.status] || 'text-slate-700'}`}>
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

          {/* Patient & Order Metadata */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-5 border-b border-slate-200">
            {order.patient && (
              <div>
                <h3 className="text-xs font-semibold text-slate-500 mb-2">Patient Details</h3>
                <p className="text-base font-semibold text-slate-900">{order.patient.fullName}</p>
                <div className="mt-1.5 space-y-1 text-xs text-slate-600">
                  <p className="font-mono tabular-nums">
                    ID: {order.patient.patientCode}
                    {order.patient.bloodGroup ? ` · Blood Group ${order.patient.bloodGroup}` : ''}
                  </p>
                  <p>
                    DOB: <span className="font-mono tabular-nums">{order.patient.dateOfBirth}</span> · {order.patient.gender}
                  </p>
                  <p className="font-mono tabular-nums">
                    {order.patient.phone}
                    {order.patient.email ? ` · ${order.patient.email}` : ''}
                  </p>
                </div>
              </div>
            )}

            <div>
              <h3 className="text-xs font-semibold text-slate-500 mb-2">Order & Specimen Information</h3>
              <dl className="grid grid-cols-2 gap-y-1.5 gap-x-4 text-xs">
                <dt className="text-slate-500">Sample Type</dt>
                <dd className="text-slate-900 font-medium">{order.sampleType}</dd>
                <dt className="text-slate-500">Referring Physician</dt>
                <dd className="text-slate-900 font-medium">{order.referringPhysician || 'Self / Walk-in'}</dd>
                <dt className="text-slate-500">Priority</dt>
                <dd className="text-slate-900 font-medium capitalize">{order.priority}</dd>
                <dt className="text-slate-500">Reported On</dt>
                <dd className="text-slate-900 font-mono tabular-nums">
                  {order.completedAt ? formatDateTime(order.completedAt) : 'In Progress'}
                </dd>
              </dl>
            </div>
          </div>

          {/* Uploaded PDF Attachment Notice */}
          {order.hasUploadedPdf && (
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg">
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="w-4 h-4 text-teal-700 shrink-0" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-900 truncate">
                    Attached Laboratory Report File: {order.reportFileName || 'Diagnostic-Report.pdf'}
                  </p>
                  <p className="text-xs text-slate-500">
                    Uploaded directly by laboratory staff for secure digital release.
                  </p>
                </div>
              </div>
              {isDownloadAllowed && (
                <button
                  type="button"
                  onClick={() => handleDownload('auto')}
                  className="text-xs font-semibold text-teal-700 hover:text-teal-900 underline underline-offset-4 whitespace-nowrap shrink-0"
                >
                  Download PDF File
                </button>
              )}
            </div>
          )}

          {/* Structured Assay Results Table */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-900">Diagnostic Assay Values</h3>
              <span className="text-xs text-slate-500 font-mono tabular-nums">
                {order.results.length} {order.results.length === 1 ? 'parameter' : 'parameters'}
              </span>
            </div>

            {order.results.length === 0 ? (
              <div className="px-4 py-8 text-center border border-slate-200 rounded-lg bg-slate-50/50">
                <p className="text-sm text-slate-600">
                  {order.hasUploadedPdf
                    ? 'Detailed values are contained in the uploaded PDF laboratory report above.'
                    : 'Analytical measurements are pending laboratory entry and verification.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-600">
                      <th className="py-2.5 px-4">Parameter / Analyte</th>
                      <th className="py-2.5 px-4 text-right">Measured Value</th>
                      <th className="py-2.5 px-4">Unit</th>
                      <th className="py-2.5 px-4">Reference Interval</th>
                      <th className="py-2.5 px-4 text-right">Interpretation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-sm">
                    {order.results.map((row, idx) => {
                      const isAbnormal = row.flag !== 'normal';
                      return (
                        <tr
                          key={row.id ?? `${row.parameterName}-${idx}`}
                          className={isAbnormal ? 'bg-amber-50/40' : 'bg-white'}
                        >
                          <td className="py-2.5 px-4 font-medium text-slate-900">
                            {row.parameterName}
                          </td>
                          <td
                            className={`py-2.5 px-4 text-right font-mono tabular-nums ${
                              row.flag === 'critical'
                                ? 'text-red-700 font-semibold'
                                : isAbnormal
                                  ? 'text-amber-800 font-semibold'
                                  : 'text-slate-900'
                            }`}
                          >
                            {row.measuredValue}
                          </td>
                          <td className="py-2.5 px-4 text-slate-600 font-mono text-xs">
                            {row.unit}
                          </td>
                          <td className="py-2.5 px-4 text-slate-600 font-mono tabular-nums text-xs">
                            {row.referenceRange}
                          </td>
                          <td
                            className={`py-2.5 px-4 text-right text-xs font-semibold ${
                              FLAG_TEXT_CLASS[row.flag] || 'text-slate-600'
                            }`}
                          >
                            {FLAG_LABELS[row.flag] || row.flag}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Clinical Remarks & Pathologist Sign-Off */}
          <div className="pt-4 border-t border-slate-200 grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
            <div className="md:col-span-7">
              <h3 className="text-xs font-semibold text-slate-500 mb-1.5">
                Pathologist Remarks & Clinical Interpretation
              </h3>
              <p className="text-sm text-slate-700 leading-relaxed">
                {order.clinicalNotes ||
                  'Analytical results have been reviewed against laboratory quality controls. Please consult your referring physician for clinical correlation.'}
              </p>
            </div>
            <div className="md:col-span-5 flex items-center gap-3 md:justify-end">
              {avatarFailed ? (
                <div className="w-11 h-11 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-xs font-semibold text-slate-700 shrink-0">
                  ER
                </div>
              ) : (
                <img
                  src={PATHOLOGIST_AVATAR}
                  alt={order.pathologistName}
                  referrerPolicy="no-referrer"
                  onError={() => setAvatarFailed(true)}
                  className="w-11 h-11 rounded-full object-cover border border-slate-200 shrink-0"
                />
              )}
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">
                  {order.pathologistName}
                </p>
                <p className="text-xs text-slate-500">
                  Senior Clinical Pathologist · Electronically Verified
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
