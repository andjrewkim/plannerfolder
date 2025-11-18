// app/(landing)/layout.tsx
import type { Metadata } from 'next';
import { landingPages } from '../../data/landingPages';

export const metadata: Metadata = {
  icons: {
    icon: '/favicon.ico',  // or '/planner-icon.png'
  },
  title: 'Homework Tracker for Students',
  description: 'Never forget homework again with our simple tracking solution.',
};

// This is required for static export with dynamic routes
export function generateStaticParams() {
  return Object.keys(landingPages).map((slug) => ({ slug }));
}

export default function LandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}