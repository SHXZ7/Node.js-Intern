import { Suspense } from 'react';
import ComparePageClient from './ComparePageClient';

export default function ComparePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <ComparePageClient />
    </Suspense>
  );
}
