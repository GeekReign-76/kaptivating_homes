import { MetadataRoute } from 'next';

const SITE_URL = 'https://kaptivatinghomesbykarsten.com';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url:              SITE_URL,
      lastModified:     new Date(),
      changeFrequency:  'weekly',
      priority:         1,
    },
    {
      url:              `${SITE_URL}/relocate`,
      lastModified:     new Date(),
      changeFrequency:  'monthly',
      priority:         0.9,
    },
    {
      url:              `${SITE_URL}/listings`,
      lastModified:     new Date(),
      changeFrequency:  'daily',
      priority:         0.9,
    },
    {
      url:              `${SITE_URL}/properties`,
      lastModified:     new Date(),
      changeFrequency:  'daily',
      priority:         0.8,
    },
    {
      url:              `${SITE_URL}/blog`,
      lastModified:     new Date(),
      changeFrequency:  'weekly',
      priority:         0.7,
    },
  ];
}
