import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Personal and machine-only routes have nothing to index.
      disallow: ['/admin/', '/api/', '/wardrobe'],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
