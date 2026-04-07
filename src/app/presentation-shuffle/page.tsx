import type { Metadata } from 'next';
import Shuffle from '@/components/tools/Shuffle';

export const metadata: Metadata = {
  title: 'Presentation Shuffle',
  description: 'Fair random presentation order for course groups, with grading and Excel export.',
};

export default function Page() {
  return <Shuffle />;
}
