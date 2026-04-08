export const API_BASE = window.API_BASE || 'http://localhost:3000';

async function parseJson(res) {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return { error: text };
  }
}

export async function apiGet(path) {
  const res = await fetch(`${API_BASE}${path}`);
  const data = await parseJson(res);
  if (!res.ok) throw new Error(data?.error || `GET ${path} failed`);
  return data;
}

export async function apiPost(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
  const data = await parseJson(res);
  if (!res.ok) throw new Error(data?.error || `POST ${path} failed`);
  return data;
}