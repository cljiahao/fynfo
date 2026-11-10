import { isOcrDumpEnabled, OcrDump } from '@/features/import-review';
import { notFound } from 'next/navigation';

export default function OcrDumpPage() {
  if (!isOcrDumpEnabled(process.env.NODE_ENV)) notFound();
  return <OcrDump />;
}
