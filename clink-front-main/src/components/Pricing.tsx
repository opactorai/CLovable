'use client';

import { motion } from 'framer-motion';
import { Check, X } from 'lucide-react';

const plans = [
  {
    name: 'Free',
    price: '$0',
    description: 'Perfect for trying out Lovable',
    features: [
      { text: 'Up to 3 projects', included: true },
      { text: 'Basic AI assistance', included: true },
      { text: 'Community support', included: true },
      { text: 'Public projects only', included: true },
      { text: 'Custom domains', included: false },
      { text: 'Priority support', included: false },
      { text: 'Advanced AI features', included: false },
      { text: 'Team collaboration', included: false },
    ],
    cta: 'Get Started',
    popular: false,
  },
  {
    name: 'Pro',
    price: '$20',
    period: '/month',
    description: 'For professional developers',
    features: [
      { text: 'Unlimited projects', included: true },
      { text: 'Advanced AI assistance', included: true },
      { text: 'Priority support', included: true },
      { text: 'Private projects', included: true },
      { text: 'Custom domains', included: true },
      { text: 'GitHub integration', included: true },
      { text: 'Advanced analytics', included: true },
      { text: 'Team collaboration', included: false },
    ],
    cta: 'Start Free Trial',
    popular: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    description: 'For teams and organizations',
    features: [
      { text: 'Everything in Pro', included: true },
      { text: 'Unlimited team members', included: true },
      { text: 'SSO authentication', included: true },
      { text: 'Dedicated support', included: true },
      { text: 'Custom AI training', included: true },
      { text: 'SLA guarantee', included: true },
      { text: 'On-premise deployment', included: true },
      { text: 'Custom integrations', included: true },
    ],
    cta: 'Contact Sales',
    popular: false,
  },
];

export default function Pricing() {
  return (
    <section id="pricing" className="py-24 bg-white dark:bg-secondary">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-4xl font-bold text-gray-900 dark:text-white sm:text-5xl"
          >
            Simple, transparent pricing
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mt-4 text-lg text-gray-600 dark:text-gray-400"
          >
            Choose the perfect plan for your needs
          </motion.p>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className={`relative rounded-2xl border ${
                plan.popular
                  ? 'border-pink-500 shadow-xl scale-105'
                  : 'border-gray-200 dark:border-gray-800'
              } bg-white p-8 dark:bg-gray-950`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-pink-500 to-cyan-500 px-4 py-1 text-sm font-medium text-white">
                  Most Popular
                </div>
              )}

              <div className="mb-8">
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {plan.name}
                </h3>
                <div className="mt-4 flex items-baseline">
                  <span className="text-5xl font-bold text-gray-900 dark:text-white">
                    {plan.price}
                  </span>
                  {plan.period && (
                    <span className="ml-2 text-gray-600 dark:text-gray-400">
                      {plan.period}
                    </span>
                  )}
                </div>
                <p className="mt-4 text-gray-600 dark:text-gray-400">
                  {plan.description}
                </p>
              </div>

              <ul className="mb-8 space-y-4">
                {plan.features.map((feature) => (
                  <li key={feature.text} className="flex items-start">
                    {feature.included ? (
                      <Check className="mr-3 h-5 w-5 flex-shrink-0 text-green-500" />
                    ) : (
                      <X className="mr-3 h-5 w-5 flex-shrink-0 text-gray-400" />
                    )}
                    <span
                      className={
                        feature.included
                          ? 'text-gray-900 dark:text-white'
                          : 'text-gray-400 dark:text-gray-600'
                      }
                    >
                      {feature.text}
                    </span>
                  </li>
                ))}
              </ul>

              <button
                className={`w-full rounded-lg px-6 py-3 font-medium transition-colors ${
                  plan.popular
                    ? 'bg-gradient-to-r from-pink-500 to-cyan-500 text-white hover:opacity-90'
                    : 'bg-gray-900 text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200'
                }`}
              >
                {plan.cta}
              </button>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mt-16 text-center"
        >
          <p className="text-gray-600 dark:text-gray-400">
            All plans include a 14-day free trial. No credit card required.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
