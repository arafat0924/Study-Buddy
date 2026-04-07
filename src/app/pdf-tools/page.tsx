import type { Metadata } from 'next';
import PdfTools from '@/components/tools/PdfTools';

export const metadata: Metadata = {
  title: 'PDF Tools',
  description: 'Merge, split, rotate and reorder PDF pages for free, right in your browser.',
};

export default function Page() {
  return <PdfTools />;
}
