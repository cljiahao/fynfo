import { requireAdmin } from '@/features/admin';
import { OcrDump } from '@/features/import-review';

// Per-request admin gate; never statically cached.
export const dynamic = 'force-dynamic';

export default async function OcrDumpPage() {
  // No database access and no server action: the PDF is read and OCRed in the
  // browser, so only the admin gate applies (CONSTITUTION 2.3 admin carve-out).
  await requireAdmin();
  return <OcrDump />;
}
