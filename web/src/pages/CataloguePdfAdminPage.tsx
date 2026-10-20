import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../services/api';

interface PdfRow {
  id: string;
  displayName: string;
  fileName: string;
  fileSize?: number | null;
  storagePath?: string | null;
  createdAt: string;
}

const fmtSize = (b?: number | null) =>
  !b ? '—' : b < 1048576 ? `${Math.round(b / 1024)} KB` : `${(b / 1048576).toFixed(1)} MB`;

/** PUT the file straight to Supabase Storage (signed URL) with progress. Never touches our server. */
const putToSupabase = (url: string, file: File, onProgress: (pct: number) => void) =>
  new Promise<void>((resolve, reject) => {
    const form = new FormData();
    form.append('cacheControl', '3600');
    form.append('', file);
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve();
      let msg = `Upload failed (${xhr.status})`;
      try { msg = JSON.parse(xhr.responseText)?.message || msg; } catch { /* keep default */ }
      reject(new Error(msg));
    };
    xhr.onerror = () => reject(new Error('Network error while uploading.'));
    xhr.send(form);
  });

export const CataloguePdfAdminPage: React.FC = () => {
  const [rows, setRows] = useState<PdfRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [progress, setProgress] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.listCataloguePdfs();
      setRows(Array.isArray(res?.data) ? res.data : []);
    } catch (e: any) {
      setError(e?.message || 'Could not load PDFs.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? rows.filter((r) => `${r.displayName} ${r.fileName}`.toLowerCase().includes(q)) : rows;
  }, [rows, search]);

  const pick = (f: File | null) => {
    setError('');
    if (f && !/\.pdf$/i.test(f.name)) {
      setError('Only PDF files are allowed.');
      return;
    }
    setFile(f);
    if (f && !name.trim()) setName(f.name.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ').trim());
  };

  const upload = async () => {
    if (!file || busy) return;
    if (!name.trim()) return setError('Enter a display name.');
    setBusy(true);
    setError('');
    setProgress(0);
    try {
      const prep = await api.createCatalogueUploadUrl(file.name, file.size);
      if (!prep?.success) throw new Error(prep?.message || 'Could not prepare the upload.');
      await putToSupabase(prep.data.uploadUrl, file, setProgress);
      const reg = await api.registerCataloguePdf({ displayName: name.trim(), storagePath: prep.data.storagePath, category: 'CATALOGUE' });
      if (!reg?.success || !reg.data) throw new Error(reg?.message || 'Uploaded, but the record was not saved.');
      setRows((cur) => [reg.data, ...cur.filter((r) => r.id !== reg.data.id)]); // no refetch needed
      setFile(null);
      setName('');
      if (inputRef.current) inputRef.current.value = '';
    } catch (e: any) {
      setError(e?.message || 'Upload failed.');
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const rename = async (r: PdfRow) => {
    const next = window.prompt('New name', r.displayName)?.trim();
    if (!next || next === r.displayName) return;
    try {
      await api.renameCataloguePdf(r.id, next);
      setRows((cur) => cur.map((x) => (x.id === r.id ? { ...x, displayName: next } : x)));
    } catch (e: any) {
      setError(e?.message || 'Rename failed.');
    }
  };

  const remove = async (r: PdfRow) => {
    if (!window.confirm(`Delete "${r.displayName}"? Products using it fall back to the generated PDF.`)) return;
    try {
      await api.deleteCataloguePdf(r.id);
      setRows((cur) => cur.filter((x) => x.id !== r.id));
    } catch (e: any) {
      setError(e?.message || 'Delete failed.');
    }
  };

  const box: React.CSSProperties = { background: 'var(--bg-card, #fff)', border: '1px solid var(--border-color)', borderRadius: 12, padding: 16 };
  const field: React.CSSProperties = { padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'transparent', color: 'inherit', minWidth: 0 };

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', display: 'grid', gap: 16 }}>
      <h2 style={{ margin: 0 }}>Catalogue PDFs</h2>

      <div style={{ ...box, display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <input ref={inputRef} type="file" accept="application/pdf,.pdf" disabled={busy} onChange={(e) => pick(e.target.files?.[0] || null)} />
          <input style={{ ...field, flex: '1 1 220px' }} placeholder="Display name" value={name} disabled={busy} onChange={(e) => setName(e.target.value)} />
          <button className="btn btn-primary" disabled={!file || busy} onClick={upload}>
            {busy ? `Uploading… ${progress ?? 0}%` : 'Upload PDF'}
          </button>
        </div>
        {file && !busy && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{file.name} · {fmtSize(file.size)}</div>}
        {error && <div style={{ color: 'var(--danger, #d33)', fontSize: 13 }}>{error}</div>}
      </div>

      <div style={{ ...box, display: 'grid', gap: 12 }}>
        <input style={field} placeholder="Search PDFs" value={search} onChange={(e) => setSearch(e.target.value)} />
        {loading ? (
          <div style={{ color: 'var(--text-muted)' }}>Loading…</div>
        ) : visible.length === 0 ? (
          <div style={{ color: 'var(--text-muted)' }}>{search ? 'No PDFs match your search.' : 'No PDFs uploaded yet.'}</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ textAlign: 'left', color: 'var(--text-muted)' }}>
                  <th style={{ padding: 8 }}>Name</th><th style={{ padding: 8 }}>File</th><th style={{ padding: 8 }}>Size</th><th style={{ padding: 8 }}>Uploaded</th><th />
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => (
                  <tr key={r.id} style={{ borderTop: '1px solid var(--border-color)' }}>
                    <td style={{ padding: 8 }}>{r.displayName}</td>
                    <td style={{ padding: 8, color: 'var(--text-muted)' }}>{r.storagePath || r.fileName}</td>
                    <td style={{ padding: 8 }}>{fmtSize(r.fileSize)}</td>
                    <td style={{ padding: 8 }}>{new Date(r.createdAt).toLocaleDateString()}</td>
                    <td style={{ padding: 8, whiteSpace: 'nowrap' }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => rename(r)}>Rename</button>{' '}
                      <button className="btn btn-danger btn-sm" onClick={() => remove(r)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
