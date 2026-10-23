import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { adminImportSchema } from '@/lib/validation';
import { IMPORT_COLUMNS, runImport } from '@/lib/admin-import';
import { invalidateEngineCache } from '@/lib/rule-engine/catalog';
import { revalidatePublicContent } from '@/lib/revalidate';

/** Column reference and example CSV for each import kind. */
export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json(IMPORT_COLUMNS);
}

/** Validate (dryRun: true) or import a CSV. Nothing is written if any row is invalid. */
export async function POST(request: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = adminImportSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { kind, csv, dryRun } = parsed.data;

  try {
    const report = await runImport(kind, csv, dryRun);
    if (report.written) {
      invalidateEngineCache();
      // Color rules feed the /colors guide, which the 'garments' set covers
      // (same as the color-rules admin route).
      revalidatePublicContent(kind === 'compatibility' ? 'compatibility' : 'garments');
    }
    return NextResponse.json(report, { status: report.errors.length ? 422 : 200 });
  } catch (error) {
    console.error('Import failed:', error);
    return NextResponse.json({ error: 'Import failed; nothing was changed.' }, { status: 500 });
  }
}
