import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import TermsContent from './TermsContent';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description:
    'Read Clink\'s Terms of Service to understand your rights and responsibilities when using our AI-powered full-stack app builder and development platform.',
  alternates: {
    canonical: '/terms',
  },
  openGraph: {
    title: 'Terms of Service | Clink',
    description:
      'Read Clink\'s Terms of Service to understand your rights and responsibilities when using our platform.',
    url: 'https://clink.new/terms',
  },
};

export default function TermsOfService() {
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
        <TermsContent>
          {/* Title */}
          <h1 className="text-4xl font-bold mb-4">Terms of Service</h1>
          <p className="text-white/60 mb-8">Last updated: {new Date().toLocaleDateString()}</p>

          {/* Content */}
          <div className="space-y-8 text-white/80">
            {/* Introduction */}
            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">Agreement to Terms</h2>
              <p className="leading-relaxed">
                Welcome to Clink. By accessing or using our service, you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, please do not use our service.
              </p>
            </section>

            {/* Description of Service */}
            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">Description of Service</h2>
              <p className="leading-relaxed mb-4">
                Clink is an AI-powered development platform that helps users build applications using various AI models including OpenAI, Anthropic Claude, and Google Gemini. Our service includes:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Web-based development environment</li>
                <li>AI-assisted code generation</li>
                <li>Project management and collaboration tools</li>
                <li>Integration with third-party services (GitHub, Supabase, etc.)</li>
                <li>Cloud storage for projects and assets</li>
              </ul>
            </section>

            {/* User Accounts */}
            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">User Accounts</h2>

              <h3 className="text-xl font-medium text-white mb-3">Account Creation</h3>
              <p className="leading-relaxed mb-4">
                To use our service, you must create an account. You may register using:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Email address (magic link authentication)</li>
                <li>Google OAuth</li>
                <li>GitHub OAuth</li>
              </ul>

              <h3 className="text-xl font-medium text-white mb-3 mt-6">Account Responsibilities</h3>
              <p className="leading-relaxed mb-4">
                You are responsible for:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Maintaining the security of your account</li>
                <li>All activities that occur under your account</li>
                <li>Providing accurate and complete information</li>
                <li>Notifying us immediately of any unauthorized access</li>
              </ul>

              <h3 className="text-xl font-medium text-white mb-3 mt-6">Account Termination</h3>
              <p className="leading-relaxed">
                We reserve the right to suspend or terminate your account if you violate these Terms or engage in fraudulent, abusive, or illegal activities.
              </p>
            </section>

            {/* AI API Keys and Credentials */}
            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">AI API Keys and Credentials</h2>
              <p className="leading-relaxed mb-4">
                To use AI features, you must provide your own API keys for AI providers (OpenAI, Anthropic, Google). You are responsible for:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Obtaining and managing your own API keys</li>
                <li>All costs associated with AI API usage</li>
                <li>Complying with each AI provider's terms of service</li>
                <li>Keeping your API keys secure</li>
              </ul>
              <p className="leading-relaxed mt-4">
                We are not responsible for any charges incurred from your use of third-party AI services.
              </p>
            </section>

            {/* Acceptable Use */}
            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">Acceptable Use Policy</h2>
              <p className="leading-relaxed mb-4">
                You agree not to use our service to:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Violate any laws or regulations</li>
                <li>Infringe on intellectual property rights</li>
                <li>Transmit malware, viruses, or harmful code</li>
                <li>Harass, abuse, or harm others</li>
                <li>Engage in fraudulent activities</li>
                <li>Attempt to gain unauthorized access to our systems</li>
                <li>Interfere with or disrupt our service</li>
                <li>Create content that is illegal, harmful, or offensive</li>
                <li>Use our service for cryptocurrency mining or similar resource-intensive activities</li>
              </ul>
            </section>

            {/* Intellectual Property */}
            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">Intellectual Property</h2>

              <h3 className="text-xl font-medium text-white mb-3">Your Content</h3>
              <p className="leading-relaxed mb-4">
                You retain all rights to the code, projects, and content you create using our service. By using our service, you grant us a limited license to:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Store and process your content</li>
                <li>Display your content back to you</li>
                <li>Make backups for service continuity</li>
              </ul>

              <h3 className="text-xl font-medium text-white mb-3 mt-6">Our Content</h3>
              <p className="leading-relaxed">
                All rights, title, and interest in our service, including our website, software, logos, and documentation, are owned by us or our licensors. You may not copy, modify, distribute, or create derivative works without our permission.
              </p>
            </section>

            {/* Payment and Billing */}
            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">Payment and Billing</h2>
              <p className="leading-relaxed mb-4">
                Some features of our service require payment. By subscribing to a paid plan:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>You agree to pay all fees associated with your subscription</li>
                <li>Payments are processed through Stripe</li>
                <li>Subscriptions automatically renew unless cancelled</li>
                <li>Refunds are handled on a case-by-case basis</li>
                <li>We reserve the right to change pricing with 30 days notice</li>
              </ul>
            </section>

            {/* Third-Party Services */}
            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">Third-Party Services</h2>
              <p className="leading-relaxed mb-4">
                Our service integrates with third-party services including:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>GitHub (code repositories)</li>
                <li>Supabase (database)</li>
                <li>OpenAI, Anthropic, Google (AI models)</li>
                <li>Stripe (payments)</li>
                <li>Google Cloud Storage (file storage)</li>
              </ul>
              <p className="leading-relaxed mt-4">
                Your use of these third-party services is subject to their respective terms of service. We are not responsible for the actions or policies of third-party services.
              </p>
            </section>

            {/* Third-Party Account Liability */}
            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">Third-Party Account Liability</h2>
              <p className="leading-relaxed mb-4">
                You are solely responsible for compliance with the terms of service of any third-party AI providers (OpenAI, Anthropic, Google) you connect to our service. We are not liable for any account suspensions, terminations, rate limiting, billing disputes, or other actions taken by third-party providers as a result of your use of our service.
              </p>
              <p className="leading-relaxed">
                You assume all risks associated with connecting your accounts to Clink and must ensure your use complies with each provider's policies.
              </p>
            </section>

            {/* Disclaimers */}
            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">Disclaimers</h2>
              <p className="leading-relaxed mb-4 uppercase">
                OUR SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Warranties of merchantability</li>
                <li>Fitness for a particular purpose</li>
                <li>Non-infringement</li>
                <li>Accuracy or reliability of AI-generated content</li>
              </ul>
              <p className="leading-relaxed mt-4">
                We do not guarantee that our service will be uninterrupted, secure, or error-free. AI-generated code may contain errors or bugs. You are responsible for reviewing and testing all code before deployment.
              </p>
            </section>

            {/* Limitation of Liability */}
            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">Limitation of Liability</h2>
              <p className="leading-relaxed mb-4 uppercase">
                TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR REVENUES, WHETHER INCURRED DIRECTLY OR INDIRECTLY, OR ANY LOSS OF DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES.
              </p>
              <p className="leading-relaxed">
                Our total liability shall not exceed the amount you paid us in the 12 months preceding the claim, or $100, whichever is greater.
              </p>
            </section>

            {/* Indemnification */}
            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">Indemnification</h2>
              <p className="leading-relaxed">
                You agree to indemnify and hold us harmless from any claims, damages, losses, liabilities, and expenses (including legal fees) arising from:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4 mt-4">
                <li>Your use of our service</li>
                <li>Your violation of these Terms</li>
                <li>Your violation of any third-party rights</li>
                <li>Your content or projects</li>
              </ul>
            </section>

            {/* Data and Privacy */}
            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">Data and Privacy</h2>
              <p className="leading-relaxed">
                Your use of our service is also governed by our Privacy Policy. By using our service, you consent to our collection and use of your data as described in the Privacy Policy. We comply with GDPR and other applicable data protection laws.
              </p>
            </section>

            {/* Changes to Terms */}
            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">Changes to Terms</h2>
              <p className="leading-relaxed">
                We reserve the right to modify these Terms at any time. We will notify you of material changes by posting the updated Terms on our website and updating the "Last updated" date. Your continued use of our service after such changes constitutes acceptance of the new Terms.
              </p>
            </section>

            {/* Governing Law */}
            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">Governing Law and Dispute Resolution</h2>
              <p className="leading-relaxed mb-4">
                These Terms shall be governed by and construed in accordance with the laws of the jurisdiction in which our company is registered, without regard to its conflict of law provisions.
              </p>
              <p className="leading-relaxed">
                Any disputes arising from these Terms or your use of our service shall be resolved through binding arbitration, except that either party may seek injunctive relief in court for intellectual property infringement.
              </p>
            </section>

            {/* Severability */}
            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">Severability</h2>
              <p className="leading-relaxed">
                If any provision of these Terms is found to be unenforceable or invalid, that provision shall be limited or eliminated to the minimum extent necessary, and the remaining provisions shall remain in full force and effect.
              </p>
            </section>

            {/* Contact Information */}
            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">Contact Us</h2>
              <p className="leading-relaxed mb-4">
                If you have any questions about these Terms of Service, please contact us:
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

            {/* Acknowledgment */}
            <section className="border-t border-white/10 pt-8">
              <p className="leading-relaxed text-center">
                By using Clink, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service.
              </p>
            </section>
          </div>
        </TermsContent>
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
