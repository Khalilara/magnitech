export async function readJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    const status = `HTTP ${response.status}`;
    if (!text.trim()) {
      throw new Error(`The server returned no response (${status}). Check the Cloudflare Worker logs.`);
    }
    throw new Error(`The server returned an invalid response (${status}). Check the Cloudflare Worker logs.`);
  }
}
