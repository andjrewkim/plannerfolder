import { MetadataRoute } from 'next';
import { landingPages } from '../data/landingPages';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://fluxplanner.netlify.app';

  const landingPageEntries = Object.keys(landingPages).map((slug) => ({
    url: `${baseUrl}/${slug}`,
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }));

  return [
    {
      url: baseUrl,
      changeFrequency: 'daily' as const,
      priority: 1.0,
    },
    ...landingPageEntries,
  ];
}
