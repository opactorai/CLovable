import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import PrivacyContent from './PrivacyContent';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'Learn how Clink protects your data and privacy. Our privacy policy explains how we collect, use, and safeguard your information when using our AI-powered app builder.',
  alternates: {
    canonical: '/privacy',
  },
  openGraph: {
    title: 'Privacy Policy | Clink',
    description:
      'Learn how Clink protects your data and privacy. Our privacy policy explains how we collect, use, and safeguard your information.',
    url: 'https://clink.new/privacy',
  },
};

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-black/80 backdrop-blur-sm">
        <div className="mx-auto max-w-4xl px-4 py-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-4xl px-4 py-12">
        <PrivacyContent>
          {/* Title */}
          <h1 className="text-4xl font-bold mb-4">Privacy Policy</h1>
          <p className="text-white/60 mb-8">Last updated: {new Date().toLocaleDateString()}</p>

          {/* Content */}
          <div className="space-y-8 text-white/80">
            {/* Introduction */}
            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">Introduction</h2>
              <p className="leading-relaxed">
                Welcome to Clink ("we," "our," or "us"). We are committed to protecting your personal information and your right to privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our service.
              </p>
            </section>

            {/* Information We Collect */}
            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">Information We Collect</h2>

              <h3 className="text-xl font-medium text-white mb-3">Personal Information</h3>
              <p className="leading-relaxed mb-4">
                When you register for an account or use our service, we may collect:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Email address</li>
                <li>Name (if provided through OAuth providers)</li>
                <li>Profile picture (if provided through OAuth providers)</li>
                <li>Authentication credentials (OAuth tokens)</li>
              </ul>

              <h3 className="text-xl font-medium text-white mb-3 mt-6">OAuth Authentication</h3>
              <p className="leading-relaxed mb-4">
                We use OAuth authentication services including Google and GitHub. When you authenticate using these services, we receive:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Your email address</li>
                <li>Your public profile information</li>
                <li>Access tokens (stored securely and never shared)</li>
              </ul>

              <h3 className="text-xl font-medium text-white mb-3 mt-6">Usage Data</h3>
              <p className="leading-relaxed mb-4">
                We automatically collect certain information when you use our service:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>IP address</li>
                <li>Browser type and version</li>
                <li>Pages visited and time spent</li>
                <li>Device information</li>
                <li>Analytics data (via Amplitude and Sentry)</li>
              </ul>

              <h3 className="text-xl font-medium text-white mb-3 mt-6">Project Data</h3>
              <p className="leading-relaxed">
                When you create projects using our service, we store:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Project names and descriptions</li>
                <li>Code and files you create</li>
                <li>AI model preferences and settings</li>
                <li>Images and assets you upload</li>
              </ul>
            </section>

            {/* How We Use Your Information */}
            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">How We Use Your Information</h2>
              <p className="leading-relaxed mb-4">
                We use the information we collect to:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Provide, operate, and maintain our service</li>
                <li>Authenticate users and manage accounts</li>
                <li>Process and complete transactions</li>
                <li>Send administrative information and updates</li>
                <li>Improve and optimize our service</li>
                <li>Monitor and analyze usage patterns</li>
                <li>Detect and prevent fraud or abuse</li>
                <li>Comply with legal obligations</li>
              </ul>
            </section>

            {/* Data Storage and Security */}
            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">Data Storage and Security</h2>
              <p className="leading-relaxed mb-4">
                We implement appropriate technical and organizational security measures to protect your personal information:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Encrypted data transmission (HTTPS/TLS)</li>
                <li>Secure cloud storage with Google Cloud Storage</li>
                <li>Regular security audits and monitoring</li>
                <li>Access controls and authentication</li>
                <li>Error tracking and monitoring via Sentry</li>
              </ul>
              <p className="leading-relaxed mt-4">
                However, no method of transmission over the Internet is 100% secure. While we strive to protect your personal information, we cannot guarantee its absolute security.
              </p>
            </section>

            {/* AI Authentication Tokens */}
            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">Your AI Authentication Tokens</h2>
              <p className="leading-relaxed mb-4">
                We store your AI provider authentication tokens with industry-standard encryption. Clink is a sandbox execution service that runs your AI agents on your behalf. Here's how we handle your authentication tokens:
              </p>

              <h3 className="text-xl font-medium text-white mb-3 mt-6">Token Storage and Security</h3>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong>Encrypted storage:</strong> Your authentication tokens for OpenAI, Anthropic (Claude), and Google Gemini are encrypted using AES-256-GCM encryption before being stored in our database</li>
                <li><strong>Secure key management:</strong> Encryption keys are managed separately and securely, using environment-based secrets</li>
                <li><strong>No sharing or selling:</strong> We never share, sell, or use your tokens for any purpose other than executing your requested AI tasks</li>
                <li><strong>Limited access:</strong> Only our secure sandbox environment can decrypt and use your tokens, and only when you actively request AI operations</li>
              </ul>

              <h3 className="text-xl font-medium text-white mb-3 mt-6">How We Use Your Tokens</h3>
              <p className="leading-relaxed mb-4">
                Your tokens are used exclusively to run specific AI coding agents:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong>OpenAI Codex Agent:</strong> For ChatGPT-powered development tasks</li>
                <li><strong>Anthropic Claude Code Agent:</strong> For Claude-powered development tasks</li>
                <li><strong>Google Gemini Agent:</strong> For Gemini-powered development tasks</li>
              </ul>
              <p className="leading-relaxed mt-4 mb-4">
                These agents run only when you explicitly request AI operations, and:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Your tokens are decrypted only during active sessions in our secure sandbox environment</li>
                <li>We communicate directly with AI providers using your tokens on your behalf</li>
                <li>We do not log the content of your tokens or use them for analytics</li>
                <li>You are responsible for all costs incurred from your API usage with these providers</li>
                <li>You can revoke or update your tokens at any time through our interface</li>
              </ul>

              <h3 className="text-xl font-medium text-white mb-3 mt-6">What This Means</h3>
              <p className="leading-relaxed">
                We act as a secure proxy service, storing your encrypted authentication tokens so that we can execute AI-powered development tasks on your behalf. While we do store these tokens, they are:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4 mt-2">
                <li>Always encrypted at rest using AES-256-GCM encryption</li>
                <li>Only decrypted in secure, isolated execution environments</li>
                <li>Used exclusively for running the specific AI coding agents listed above</li>
                <li>Never shared with third parties</li>
                <li>Removable by you at any time</li>
              </ul>
            </section>

            {/* Third-Party Services */}
            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">Third-Party Services</h2>
              <p className="leading-relaxed mb-4">
                We use the following third-party services:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong>Google OAuth:</strong> For authentication</li>
                <li><strong>GitHub OAuth:</strong> For authentication and repository integration</li>
                <li><strong>Stripe:</strong> For payment processing</li>
                <li><strong>Amplitude:</strong> For analytics</li>
                <li><strong>Sentry:</strong> For error tracking and monitoring</li>
                <li><strong>Resend:</strong> For email delivery</li>
                <li><strong>Google Cloud Storage (GCS):</strong> For file and image storage</li>
                <li><strong>Supabase:</strong> For database and authentication</li>
                <li><strong>Redis:</strong> For caching and session management</li>
              </ul>
              <p className="leading-relaxed mt-4">
                These services have their own privacy policies. We encourage you to review them.
              </p>
            </section>

            {/* AI Provider Data Sharing */}
            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">AI Provider Data Sharing</h2>
              <p className="leading-relaxed">
                When you use AI features in our service, your prompts and project data are sent to the AI provider you select (OpenAI, Anthropic Claude, or Google Gemini). Each provider has their own data handling policies. We do not control how these providers process your data. Please review their respective privacy policies before using AI features.
              </p>
            </section>

            {/* Third-Party Account Risks */}
            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">Third-Party Account Risks</h2>
              <p className="leading-relaxed mb-4">
                You are responsible for ensuring your use of Clink complies with the terms of service of any connected AI providers (OpenAI, Anthropic, Google). We are not liable for any account suspensions, restrictions, or other actions taken by third-party providers as a result of your use of our service.
              </p>
              <p className="leading-relaxed">
                You use Clink to connect to third-party services at your own risk and are solely responsible for all associated costs and compliance with provider policies.
              </p>
            </section>

            {/* Your Rights (GDPR) */}
            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">Your Rights (GDPR & Privacy)</h2>
              <p className="leading-relaxed mb-4">
                If you are a resident of the European Economic Area (EEA) or UK, you have certain data protection rights:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong>Access:</strong> Request a copy of your personal data</li>
                <li><strong>Correction:</strong> Request correction of inaccurate data</li>
                <li><strong>Deletion:</strong> Request deletion of your data</li>
                <li><strong>Portability:</strong> Request transfer of your data</li>
                <li><strong>Object:</strong> Object to processing of your data</li>
                <li><strong>Withdraw Consent:</strong> Withdraw consent at any time</li>
              </ul>
              <p className="leading-relaxed mt-4">
                To exercise these rights, please contact us at hello@opactor.com
              </p>
            </section>

            {/* Cookies */}
            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">Cookies and Tracking</h2>
              <p className="leading-relaxed">
                We use cookies and similar tracking technologies to track activity on our service and store certain information. You can instruct your browser to refuse all cookies or to indicate when a cookie is being sent. However, if you do not accept cookies, you may not be able to use some portions of our service.
              </p>
            </section>

            {/* Data Retention */}
            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">Data Retention</h2>
              <p className="leading-relaxed">
                We retain your personal information only for as long as necessary to fulfill the purposes outlined in this Privacy Policy, unless a longer retention period is required or permitted by law. When you delete your account, we will delete or anonymize your personal data within 30 days, except where we are required to retain it for legal purposes.
              </p>
            </section>

            {/* Children's Privacy */}
            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">Children's Privacy</h2>
              <p className="leading-relaxed">
                Our service is not intended for children under 13 years of age. We do not knowingly collect personal information from children under 13. If you become aware that a child has provided us with personal information, please contact us, and we will take steps to delete such information.
              </p>
            </section>

            {/* Changes to This Policy */}
            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">Changes to This Privacy Policy</h2>
              <p className="leading-relaxed">
                We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last updated" date. You are advised to review this Privacy Policy periodically for any changes.
              </p>
            </section>

            {/* Contact Us */}
            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">Contact Us</h2>
              <p className="leading-relaxed mb-4">
                If you have any questions about this Privacy Policy, please contact us:
              </p>
              <ul className="space-y-2">
                <li>
                  <strong>Email:</strong>{' '}
                  <a href="mailto:hello@opactor.com" className="text-blue-400 hover:text-blue-300 transition-colors">
                    hello@opactor.com
                  </a>
                </li>
                <li>
                  <strong>GitHub:</strong>{' '}
                  <a
                    href="https://github.com/opactorai/Claudable"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    github.com/opactorai/Claudable
                  </a>
                </li>
              </ul>
            </section>
          </div>
        </PrivacyContent>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 mt-16">
        <div className="mx-auto max-w-4xl px-4 py-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-white/40">
            <p>© {new Date().getFullYear()} Opactor. All rights reserved.</p>
            <div className="flex gap-6">
              <Link href="/privacy" className="hover:text-white transition-colors">
                Privacy Policy
              </Link>
              <Link href="/terms" className="hover:text-white transition-colors">
                Terms of Service
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
