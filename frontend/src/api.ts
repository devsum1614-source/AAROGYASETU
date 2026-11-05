import {
  Consultation,
  MessageItem,
  ReportItem,
  UserAccount,
  UserRole,
} from './types';

const API_BASE =
  (import.meta as unknown as { env?: Record<string, string> }).env
    ?.VITE_API_BASE_URL || '';

function getAuthHeaders(token: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

async function handleJsonResponse<T>(res: Response): Promise<T> {
  let body: any = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  if (!res.ok) {
    const detail =
      body?.detail ||
      body?.message ||
      `Request failed with status ${res.status}`;
    throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail));
  }
  return body as T;
}

export async function loginApi(
  identifier: string,
  password: string,
  role: UserRole
): Promise<{ access_token: string; user: UserAccount }> {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, password, role }),
  });
  return handleJsonResponse(res);
}

export async function logoutApi(token: string): Promise<void> {
  try {
    await fetch(`${API_BASE}/api/auth/logout`, {
      method: 'POST',
      headers: getAuthHeaders(token),
    });
  } catch {
    // Proceed with client session cleanup even if offline
  }
}

export async function registerPatientApi(payload: {
  full_name: string;
  phone: string;
  email?: string;
  password: string;
  age?: number | null;
  date_of_birth?: string;
  gender?: string;
  village_or_address: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
}): Promise<{ access_token: string; user: UserAccount }> {
  const res = await fetch(`${API_BASE}/api/auth/register/patient`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleJsonResponse(res);
}

export async function registerDoctorApi(payload: {
  full_name: string;
  phone: string;
  email: string;
  password: string;
  specialty: string;
  clinic_name: string;
  clinic_location: string;
  languages_spoken: string;
  bio?: string;
}): Promise<{ status: string; approval_status: string; message: string; user: UserAccount }> {
  const res = await fetch(`${API_BASE}/api/auth/register/doctor`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleJsonResponse(res);
}

export async function fetchMyProfileApi(token: string): Promise<UserAccount> {
  const res = await fetch(`${API_BASE}/api/profile/me`, {
    headers: getAuthHeaders(token),
  });
  return handleJsonResponse(res);
}

export async function updatePatientProfileApi(
  token: string,
  payload: {
    full_name: string;
    phone: string;
    email?: string | null;
    age?: number | null;
    date_of_birth?: string;
    gender?: string;
    village_or_address: string;
    emergency_contact_name: string;
    emergency_contact_phone: string;
  }
): Promise<UserAccount> {
  const res = await fetch(`${API_BASE}/api/profile/patient`, {
    method: 'PUT',
    headers: getAuthHeaders(token),
    body: JSON.stringify(payload),
  });
  return handleJsonResponse(res);
}

export async function updateDoctorProfileApi(
  token: string,
  payload: {
    full_name: string;
    phone: string;
    email: string;
    specialty: string;
    clinic_name: string;
    clinic_location: string;
    languages_spoken: string;
    bio?: string;
  }
): Promise<UserAccount> {
  const res = await fetch(`${API_BASE}/api/profile/doctor`, {
    method: 'PUT',
    headers: getAuthHeaders(token),
    body: JSON.stringify(payload),
  });
  return handleJsonResponse(res);
}

export async function fetchPatientConsultationsApi(
  token: string
): Promise<Consultation[]> {
  const res = await fetch(`${API_BASE}/api/consultations/patient`, {
    headers: getAuthHeaders(token),
  });
  return handleJsonResponse(res);
}

export async function fetchDoctorConsultationsApi(
  token: string
): Promise<Consultation[]> {
  const res = await fetch(`${API_BASE}/api/consultations/doctor`, {
    headers: getAuthHeaders(token),
  });
  return handleJsonResponse(res);
}

export async function fetchConsultationMessagesApi(
  token: string,
  consultationId: number,
  afterId: number = 0
): Promise<MessageItem[]> {
  const res = await fetch(
    `${API_BASE}/api/consultations/${consultationId}/messages?after_id=${afterId}`,
    {
      headers: getAuthHeaders(token),
    }
  );
  return handleJsonResponse(res);
}

export async function sendConsultationMessageApi(
  token: string,
  consultationId: number,
  content: string,
  clientMessageId: string
): Promise<MessageItem> {
  const res = await fetch(
    `${API_BASE}/api/consultations/${consultationId}/messages`,
    {
      method: 'POST',
      headers: getAuthHeaders(token),
      body: JSON.stringify({
        content,
        client_message_id: clientMessageId,
      }),
    }
  );
  return handleJsonResponse(res);
}

export async function fetchConsultationReportsApi(
  token: string,
  consultationId: number
): Promise<ReportItem[]> {
  const res = await fetch(
    `${API_BASE}/api/consultations/${consultationId}/reports`,
    {
      headers: getAuthHeaders(token),
    }
  );
  return handleJsonResponse(res);
}

export async function fetchMyPatientReportsApi(
  token: string
): Promise<ReportItem[]> {
  const res = await fetch(`${API_BASE}/api/reports/my`, {
    headers: getAuthHeaders(token),
  });
  return handleJsonResponse(res);
}

/**
 * Uploads a medical report with real-time progress reporting via XMLHttpRequest.
 */
export function uploadConsultationReportWithProgress(
  token: string,
  consultationId: number,
  params: {
    title: string;
    file: File;
    originalSizeBytes: number;
    wasCompressed: boolean;
  },
  onProgress?: (percent: number) => void
): Promise<ReportItem> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE}/api/consultations/${consultationId}/reports`);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        const pct = Math.min(100, Math.round((event.loaded / event.total) * 100));
        onProgress(pct);
      }
    };

    xhr.onload = () => {
      try {
        const body = JSON.parse(xhr.responseText || '{}');
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(body as ReportItem);
        } else {
          reject(
            new Error(body.detail || `Upload failed with status ${xhr.status}`)
          );
        }
      } catch {
        reject(new Error(`Upload failed with status ${xhr.status}`));
      }
    };

    xhr.onerror = () => {
      reject(
        new Error('Network error while uploading report. Please check your connection and retry.')
      );
    };

    const formData = new FormData();
    formData.append('title', params.title);
    formData.append('original_size_bytes', String(params.originalSizeBytes));
    formData.append('was_compressed', params.wasCompressed ? 'true' : 'false');
    formData.append('file', params.file);

    xhr.send(formData);
  });
}

/**
 * Securely fetches a private report file using the Authorization Bearer header
 * and returns a temporary local Object URL for viewing or downloading.
 */
export async function fetchAuthorizedReportBlobUrl(
  token: string,
  reportId: number
): Promise<{ url: string; mimeType: string }> {
  const res = await fetch(`${API_BASE}/api/reports/${reportId}/file`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    let detail = `Access denied or file unavailable (HTTP ${res.status})`;
    try {
      const errJson = await res.json();
      if (errJson?.detail) detail = errJson.detail;
    } catch {
      // ignore
    }
    throw new Error(detail);
  }
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  return { url: objectUrl, mimeType: blob.type || 'image/jpeg' };
}
