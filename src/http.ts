// Precaution: Mindbody sits behind Cloudflare, which can challenge non-browser user agents
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

// Narrower than RequestInit: headers merge as a plain object, and the timeout owns the signal
type RequestOptions = { method?: string; headers?: Record<string, string>; body?: string };

export async function request(url: string, init: RequestOptions = {}): Promise<Response> {
  const res = await fetch(url, {
    ...init,
    headers: { "User-Agent": USER_AGENT, ...init.headers },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`${init.method ?? "GET"} ${url} -> HTTP ${res.status}`);
  return res;
}

export async function getJson(url: string, headers: Record<string, string> = {}): Promise<unknown> {
  return (await request(url, { headers })).json();
}

export async function postJson(url: string, body: unknown, headers: Record<string, string> = {}): Promise<unknown> {
  const res = await request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  return res.json();
}
