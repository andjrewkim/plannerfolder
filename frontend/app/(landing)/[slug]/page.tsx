// app/(landing)/[slug]/page.tsx
import type { Metadata } from 'next';
import { landingPages } from '../../data/landingPages';
import LandingPageClient from './client';

// Required for static export
export function generateStaticParams() {
  return Object.keys(landingPages).map((slug) => ({ slug }));
}

// Generate metadata for SEO and favicon
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const page = landingPages[slug as keyof typeof landingPages];
  
  if (!page) {
    return { title: 'Page not found' };
  }
  
  return {
    title: page.title,
    description: page.description,
    openGraph: {
      title: page.title,
      description: page.description,
    },
  };
}

export default async function LandingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = landingPages[slug as keyof typeof landingPages];
  
  if (!page) {
    return <div>Page not found</div>;
  }

  return <LandingPageClient page={page} />;
}