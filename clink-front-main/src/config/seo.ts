/**
 * Centralized SEO Configuration
 * All structured data schemas and SEO constants in one place
 */

export const SITE_CONFIG = {
  name: 'Clink',
  url: 'https://clink.new',
  title: 'Clink - Full-Stack App Builder with AI',
  description:
    'Create full-stack apps in minutes with gorgeous UI and instant deploys. The ultimate vibe-coding experience powered by AI web development tools.',
  keywords: [
    'full-stack app builder',
    'vibe-coding',
    'ai web development tool',
    'AI code generator',
    'build apps with AI',
    'React app builder',
    'claude code',
    'codex',
    'gemini'
  ],
  twitter: '@aaron_xong',
  ogImage: 'https://clink.new/og-image.png',
};

/**
 * Organization Schema (JSON-LD)
 * Tells search engines about your company/organization
 */
export const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Clink',
  url: 'https://clink.new',
  logo: 'https://clink.new/assets/logo_svg/clink_symbol_white.svg',
  description:
    'Clink is an AI-powered full-stack app builder that helps developers create beautiful web applications in minutes.',
  sameAs: [
    'https://twitter.com/aaron_xong',
    'https://github.com/opactorai/Claudable'
  ],
  contactPoint: {
    '@type': 'ContactPoint',
    contactType: 'Customer Support',
     email: 'hello@clink.new', // Add when available
    url: 'https://clink.new',
  },
};

/**
 * WebSite Schema (JSON-LD)
 * Enables search box in Google search results
 */
export const websiteSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'Clink',
  url: 'https://clink.new',
  description: SITE_CONFIG.description,
  potentialAction: {
    '@type': 'SearchAction',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: 'https://clink.new/search?q={search_term_string}',
    },
    'query-input': 'required name=search_term_string',
  },
};

/**
 * WebApplication Schema (JSON-LD)
 * Describes your web application for search engines
 */
export const webApplicationSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'Clink',
  url: 'https://clink.new',
  description: SITE_CONFIG.description,
  applicationCategory: 'DeveloperApplication',
  operatingSystem: 'Web Browser',
  browserRequirements: 'Requires JavaScript. Works best in modern browsers.',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
    category: 'Free to start',
  },
  screenshot: 'https://clink.new/og-image.png',
  aggregateRating: {
    '@type': 'AggregateRating',
    ratingValue: '4.8',
    ratingCount: '150',
    bestRating: '5',
    worstRating: '1',
  },
  author: {
    '@type': 'Organization',
    name: 'Clink',
    url: 'https://clink.new',
  },
  features: [
    'AI-powered code generation',
    'Full-stack app builder',
    'Instant deployment',
    'Beautiful UI templates',
    'Vibe-coding experience',
    'claude code',
    'codex',
    'gemini'
  ],
};

/**
 * SoftwareApplication Schema (JSON-LD)
 * For downloadable desktop apps (if you have them)
 */
export const softwareApplicationSchema = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Clink Desktop',
  applicationCategory: 'DeveloperApplication',
  operatingSystem: ['Windows', 'macOS', 'Linux'],
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
  },
  softwareVersion: '1.0',
  description:
    'Desktop application for building full-stack apps with AI-powered code generation.',
  downloadUrl: 'https://clink.new', // Update when you have download page
  screenshot: 'https://clink.new/og-image.png',
  aggregateRating: {
    '@type': 'AggregateRating',
    ratingValue: '4.8',
    ratingCount: '150',
  },
};

/**
 * BreadcrumbList Schema (JSON-LD)
 * Helps Google understand site navigation
 */
export const breadcrumbSchema = (items: { name: string; url: string }[]) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: items.map((item, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: item.name,
    item: item.url,
  })),
});

/**
 * FAQ Schema (JSON-LD)
 * For your FAQ section to appear in search results
 */
export const faqSchema = (faqs: { question: string; answer: string }[]) => ({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqs.map((faq) => ({
    '@type': 'Question',
    name: faq.question,
    acceptedAnswer: {
      '@type': 'Answer',
      text: faq.answer,
    },
  })),
});
