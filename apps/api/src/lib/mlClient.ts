const ML_SERVICE_URL = process.env.ML_SERVICE_URL ?? 'http://localhost:8000';

async function request<T>(path: string, options?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(`${ML_SERVICE_URL}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options?.headers },
    });
    if (!res.ok) return null;
    return res.json() as Promise<T>;
  } catch {
    return null;
  }
}

export const mlClient = {
  getRecommendations: (userId: string, limit = 20) =>
    request<{ tracks: { trackId: string; score: number }[]; modelVersion: string }>(
      `/recommendations/${userId}?limit=${limit}`
    ),

  triggerRetrain: () =>
    request<{ jobId: string }>('/retrain', { method: 'POST' }),

  getHealth: () =>
    request<{ status: string; modelVersion: string | null; lastTrainedAt: string | null }>('/health'),

  getRetrainStatus: () =>
    request<{ status: string; lastRun: string | null; modelVersion: string | null }>('/retrain/status'),
};
