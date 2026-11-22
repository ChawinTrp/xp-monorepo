// REST calls next to GraphQL (the gcal endpoints). Same key as the Apollo link.
export const API_BASE = (import.meta.env.VITE_API_URL ?? 'http://localhost:3000').replace(/\/+$/, '');

export const authHeaders = (): Record<string, string> => {
  const k = localStorage.getItem('xp_api_key');
  return k ? { authorization: `Bearer ${k}` } : {};
};
