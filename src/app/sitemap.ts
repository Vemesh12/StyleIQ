import { MetadataRoute } from 'next';
import { prisma } from '@/lib/prisma';

// Rebuilt hourly so new garments and guides appear without a redeploy
// (it was prerendered once at build time and never refreshed).
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  const garments = await prisma.garment.findMany({ where: { ownerId: null }, select: { slug: true, updatedAt: true } });
  const guides = await prisma.guide.findMany({
    where: { published: true },
    select: { slug: true, updatedAt: true },
  });

  const garmentUrls = garments.map((g) => ({
    url: `${baseUrl}/encyclopedia/${g.slug}`,
    lastModified: g.updatedAt,
  }));

  const guideUrls = guides.map((g) => ({
    url: `${baseUrl}/guides/${g.slug}`,
    lastModified: g.updatedAt,
  }));

  return [
    { url: `${baseUrl}`, lastModified: new Date() },
    { url: `${baseUrl}/quick-pick`, lastModified: new Date() },
    { url: `${baseUrl}/style-advisor`, lastModified: new Date() },
    { url: `${baseUrl}/encyclopedia`, lastModified: new Date() },
    { url: `${baseUrl}/outfit-builder`, lastModified: new Date() },
    { url: `${baseUrl}/guides`, lastModified: new Date() },
    { url: `${baseUrl}/colors`, lastModified: new Date() },
    { url: `${baseUrl}/style-mistakes`, lastModified: new Date() },
    ...garmentUrls,
    ...guideUrls,
  ];
}
