import Script from 'next/script';

interface JsonLdProps {
  data: Record<string, any>;
}

/**
 * JSON-LD Component for Structured Data
 * Helps search engines understand your content and enables rich search results
 */
export function JsonLd({ data }: JsonLdProps) {
  return (
    <Script
      id={`jsonld-${data['@type']?.toLowerCase() || 'default'}`}
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
      strategy="beforeInteractive"
    />
  );
}
