import type { Metadata } from 'next';
import Admission from '@/components/tools/Admission';

export const metadata: Metadata = {
  title: 'Admission Documents',
  description: 'Batch-convert up to 10 JPG, PNG and PDF files under any size limit, rename them and download as ZIP.',
};

export default function Page() {
  return <Admission />;
}
