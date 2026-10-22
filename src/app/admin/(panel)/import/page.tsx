'use client';

import { useState } from 'react';
import { FileUp, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type Kind = 'garments' | 'compatibility' | 'colorRules';

interface Report {
  kind: Kind;
  rows: number;
  created: number;
  updated: number;
  errors: { line: number; message: string }[];
  written: boolean;
}

const KINDS: { value: Kind; label: string; help: string; example: string }[] = [
  {
    value: 'garments',
    label: 'Garments',
    help: 'Columns: name, type, formality (1-5), colors (slugs, ; separated, main first). Optional: slug, fit, material, pattern, season (light|heavy|all), description. Existing slugs are updated.',
    example:
      'name,type,formality,colors,fit,material,pattern,season,description\nNavy Linen Shirt,shirt,3,navy-blue,regular-fit,linen,solid,light,"Breathable summer shirt"',
  },
  {
    value: 'compatibility',
    label: 'Garment pair rules',
    help: 'Columns: a, b (garment slugs), rating (1-5). Optional: reason. The label (excellent/good/…) is set from the rating.',
    example: 'a,b,rating,reason\nnavy-chinos,white-oxford-shirt,5,"A crisp classic"',
  },
  {
    value: 'colorRules',
    label: 'Color rules',
    help: 'Columns: a, b (color slugs), score (0-10), harmony (label). Optional: reason. Below 6 counts as a clash.',
    example: 'a,b,score,harmony,reason\nnavy-blue,camel,9.6,Classic Pairing,"Warm camel softens navy"',
  },
];

/**
 * Bulk CSV import. "Check file" validates every row without writing;
 * "Import" writes only if the whole file is valid, all in one transaction.
 */
export default function AdminImportPage() {
  const [kind, setKind] = useState<Kind>('garments');
  const [csv, setCsv] = useState('');
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const meta = KINDS.find((k) => k.value === kind)!;

  const run = async (dryRun: boolean) => {
    if (!dryRun && !confirm(`Import ${report?.rows ?? ''} rows into ${meta.label.toLowerCase()}?`)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, csv, dryRun }),
      });
      const data = await res.json();
      if (res.status === 400 || res.status >= 500) setError(data.error || 'Import failed.');
      else setReport(data);
    } catch {
      setError('Import failed — check your connection.');
    }
    setBusy(false);
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 500_000) {
      setError('That file is larger than 500 KB — split it into smaller files.');
      return;
    }
    setCsv(await file.text());
    setReport(null);
  };

  const validated = report && !report.written && report.errors.length === 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white flex items-center gap-2">
          <FileUp className="w-8 h-8 text-amber-500" /> Bulk Import
        </h1>
        <p className="text-zinc-400 text-sm mt-1">Add or update many catalog items or rules from a CSV file.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">1. What are you importing?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Import type">
            {KINDS.map((k) => (
              <button
                key={k.value}
                role="radio"
                aria-checked={kind === k.value}
                onClick={() => { setKind(k.value); setReport(null); }}
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold border ${kind === k.value ? 'bg-amber-600 border-amber-600 text-white' : 'border-zinc-700 text-zinc-300 hover:border-zinc-500'}`}
              >
                {k.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-zinc-400">{meta.help}</p>
          <pre className="text-xs bg-zinc-900 border border-zinc-800 rounded-lg p-3 overflow-x-auto text-zinc-300">{meta.example}</pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">2. Upload or paste the CSV</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <input type="file" accept=".csv,text/csv" onChange={(e) => onFile(e.target.files?.[0])} className="text-sm text-zinc-300" aria-label="CSV file" />
          <textarea
            value={csv}
            onChange={(e) => { setCsv(e.target.value); setReport(null); }}
            rows={10}
            placeholder={meta.example}
            aria-label="CSV contents"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-xs font-mono text-zinc-100"
          />
          <div className="flex gap-3">
            <Button onClick={() => run(true)} disabled={busy || !csv.trim()} variant="outline">
              {busy ? 'Working...' : 'Check file'}
            </Button>
            <Button onClick={() => run(false)} disabled={busy || !validated}>
              Import
            </Button>
          </div>
          {!validated && csv.trim() && <p className="text-xs text-zinc-500">Check the file first — Import unlocks once every row is valid.</p>}
        </CardContent>
      </Card>

      {error && <p role="alert" className="text-sm text-red-400 bg-red-500/10 px-3 py-2 rounded-lg">{error}</p>}

      {report && (
        <Card className={report.errors.length ? 'border-red-900/60' : 'border-emerald-900/60'}>
          <CardContent className="p-5 space-y-3">
            {report.errors.length ? (
              <>
                <p className="text-sm font-semibold text-red-300 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" /> {report.errors.length} problem{report.errors.length === 1 ? '' : 's'} — nothing was imported.
                </p>
                <ul className="text-xs text-red-200 space-y-1 max-h-72 overflow-y-auto">
                  {report.errors.map((e, i) => (
                    <li key={i}>
                      {e.line > 0 && <strong>Line {e.line}: </strong>}
                      {e.message}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="text-sm font-semibold text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                {report.written
                  ? `Imported: ${report.created} created, ${report.updated} updated.`
                  : `All ${report.rows} rows are valid: ${report.created} will be created, ${report.updated} updated.`}
              </p>
            )}
            {report.written && (
              <p className="text-xs text-zinc-400">Remember to run <code>npm run db:export</code> and commit prisma/data so the changes reach other environments.</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
