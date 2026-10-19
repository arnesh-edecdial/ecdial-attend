import { useEffect, useRef } from 'react';

/**
 * Lightweight performance probe. Set to false (or delete the <PerfPanel/> line) once you have your numbers.
 * It wraps fetch() once, so it measures EVERY API call without touching services/api.ts.
 */
export const PERF_ENABLED = true;

export interface PerfEntry {
  at: number;
  method: string; // GET / POST ... or SCREEN (time from opening a screen until its data is on screen)
  path: string;
  status: number; // 0 = network failure
  ms: number; // client-measured time until the response headers arrived (network + server)
  serverMs?: number; // time the server spent in your code (from the Server-Timing header)
  cold?: boolean; // true = the serverless function had just started (a "cold start")
  kb?: number;
  note?: string; // for 401/403: the server's message, so you can see WHY you were rejected
}

const MAX = 300;
const entries: PerfEntry[] = [];
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

export const subscribePerf = (f: () => void) => {
  subs.add(f);
  return () => {
    subs.delete(f);
  };
};
export const getPerfEntries = () => entries;
export const clearPerf = () => {
  entries.length = 0;
  emit();
};
const push = (e: PerfEntry) => {
  entries.push(e);
  if (entries.length > MAX) entries.shift();
  if (__DEV__) console.log(`[PERF] ${e.method} ${e.path} ${e.status} ${e.ms}ms${e.serverMs != null ? ` (server ${e.serverMs}ms)` : ''}${e.cold ? ' COLD-START' : ''}${e.note ? ' ' + e.note : ''}`);
  emit();
};

const clean = (url: string) =>
  url
    .replace(/^https?:\/\/[^/]+/, '')
    .replace(/([?&](token|access_token|signature|sig|X-Amz-[^=]+)=)[^&]+/gi, '$1…')
    .slice(0, 90);

const parseTiming = (h?: string | null) => {
  if (!h) return {};
  const app = /app;dur=([\d.]+)/.exec(h);
  const cold = /cold;desc="?(true|false)/.exec(h);
  return { serverMs: app ? Math.round(+app[1]) : undefined, cold: cold ? cold[1] === 'true' : undefined };
};

let installed = false;
export function installPerf() {
  if (installed || !PERF_ENABLED) return;
  installed = true;
  const orig = globalThis.fetch.bind(globalThis);
  globalThis.fetch = (async (input: any, init?: any) => {
    const t0 = Date.now();
    const url = typeof input === 'string' ? input : input?.url || String(input);
    const e: PerfEntry = { at: t0, method: String(init?.method || input?.method || 'GET').toUpperCase(), path: clean(url), status: 0, ms: 0 };
    try {
      const res = await orig(input, init);
      e.ms = Date.now() - t0;
      e.status = res.status;
      Object.assign(e, parseTiming(res.headers.get('server-timing')));
      const len = res.headers.get('content-length');
      if (len) e.kb = Math.round((+len / 1024) * 10) / 10;
      if (res.status === 401 || res.status === 403) {
        res.clone().text().then((t) => { e.note = t.slice(0, 140); emit(); }).catch(() => {});
      }
      push(e);
      return res;
    } catch (err: any) {
      e.ms = Date.now() - t0;
      e.note = String(err?.message || err).slice(0, 100);
      push(e);
      throw err;
    }
  }) as typeof fetch;
}

/** Call in a screen:  usePerfMark('ServiceIntakeList', !isLoading)  -> logs "time until the list is visible". */
export function usePerfMark(label: string, ready: boolean) {
  const t0 = useRef(Date.now());
  const done = useRef(false);
  useEffect(() => {
    if (!PERF_ENABLED || !ready || done.current) return;
    done.current = true;
    push({ at: Date.now(), method: 'SCREEN', path: label, status: 200, ms: Date.now() - t0.current });
  }, [ready, label]);
}

/** Text report you can paste to me: per endpoint count / average / worst, with the server-vs-network split. */
export function perfSummary(): string {
  const g = new Map<string, PerfEntry[]>();
  for (const e of entries) {
    const k = `${e.method} ${e.path.split('?')[0].replace(/[0-9a-f]{8}-[0-9a-f-]{27,}|\b\d{3,}\b/gi, ':id')}`;
    (g.get(k) || g.set(k, []).get(k)!).push(e);
  }
  const rows = [...g.entries()]
    .map(([k, list]) => {
      const avg = Math.round(list.reduce((a, e) => a + e.ms, 0) / list.length);
      const max = Math.max(...list.map((e) => e.ms));
      const sv = list.filter((e) => e.serverMs != null);
      const avgSv = sv.length ? Math.round(sv.reduce((a, e) => a + (e.serverMs as number), 0) / sv.length) : null;
      const cold = list.filter((e) => e.cold).length;
      const bad = list.filter((e) => e.status >= 400 || e.status === 0).length;
      return { k, n: list.length, avg, max, avgSv, cold, bad, total: avg * list.length };
    })
    .sort((a, b) => b.total - a.total);
  const lines = rows.map(
    (r) => `${r.k}\n   x${r.n}  avg ${r.avg}ms  worst ${r.max}ms${r.avgSv != null ? `  server ${r.avgSv}ms  network+start ${Math.max(0, r.avg - r.avgSv)}ms` : ''}${r.cold ? `  cold-starts ${r.cold}` : ''}${r.bad ? `  ERRORS ${r.bad}` : ''}`
  );
  const auth = entries.filter((e) => e.status === 401 || e.status === 403);
  const authLines = auth.slice(-8).map((e) => `${e.status} ${e.method} ${e.path} :: ${e.note || ''}`);
  return `PERF REPORT (${entries.length} calls)\n\n${lines.join('\n')}${authLines.length ? `\n\nAUTH REJECTIONS\n${authLines.join('\n')}` : ''}`;
}
