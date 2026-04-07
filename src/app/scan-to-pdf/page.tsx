import type { Metadata } from 'next';
import Scan from '@/components/tools/Scan';

export const metadata: Metadata = {
  title: 'Scan to PDF',
  description: 'Turn phone photos of paper pages into a clean, cropped PDF.',
};

export default function Page() {
  return <Scan />;
}
