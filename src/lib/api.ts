export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function apiFetch<T>(
  url: string,
  options: {
    method?: string;
    token?: string | null;
    body?: unknown;
    isFormData?: boolean;
  } = {}
): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.token) {
    headers['Authorization'] = `Bearer ${options.token}`;
  }
  if (options.body !== undefined && !options.isFormData) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(url, {
    method: options.method ?? 'GET',
    headers,
    body:
      options.body === undefined
        ? undefined
        : options.isFormData
          ? (options.body as FormData)
          : JSON.stringify(options.body),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(data?.error || 'Request failed. Please try again.', response.status);
  }
  return data as T;
}

export async function fetchReportPdfBlob(
  testCode: string,
  token: string,
  source: 'auto' | 'generated' = 'auto'
): Promise<{ blobUrl: string; filename: string }> {
  const query = new URLSearchParams({ source });
  const response = await fetch(`/api/reports/${encodeURIComponent(testCode)}/pdf?${query.toString()}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new ApiError(errData?.error || 'Unable to download report PDF.', response.status);
  }

  const blob = await response.blob();
  const blobUrl = URL.createObjectURL(blob);
  const disposition = response.headers.get('content-disposition') || '';
  const match = disposition.match(/filename="([^"]+)"/);
  const filename = match?.[1] || `Meridian-Report-${testCode}.pdf`;
  return { blobUrl, filename };
}

export async function triggerReportPdfDownload(
  testCode: string,
  token: string,
  source: 'auto' | 'generated' = 'auto'
): Promise<void> {
  const { blobUrl, filename } = await fetchReportPdfBlob(testCode, token, source);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(blobUrl), 15000);
}

export function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return 'Pending';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
