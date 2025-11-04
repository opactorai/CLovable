'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus } from 'lucide-react';
import { JsonLd } from '@/components/seo/JsonLd';
import { faqSchema } from '@/config/seo';

const FAQ_ITEMS = [
  {
    question: 'Do I need to pay extra?',
    answer:
      'No. Clink is completely free to use with your existing AI plan. No additional fees, no subscription costs.',
  },
  {
    question: 'How easy is setup?',
    answer:
      'Install the Clink App and connect your ChatGPT, Claude, or Google plan with just one click. Setup takes less than 2 minutes.',
  },
  {
    question: 'What coding agents do I get access to?',
    answer:
      'Access top-tier coding agents like Claude Code, Codex GPT, and Gemini CLI using your existing subscription. No new accounts needed.',
  },
  {
    question: 'What can I build with these agents?',
    answer:
      'You can create, modify, and deploy complete websites and applications using just prompts. Build everything from simple landing pages to complex web applications with database integration, API connections, and modern UI frameworks.',
  },
  {
    question: 'Can I disconnect at any time?',
    answer:
      'Yes. You can disconnect your AI plans from Clink at any time with one click. Your original subscriptions remain unchanged.',
  },
];

const FAQSection = () => {
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  // Prepare FAQ data for schema
  const faqData = FAQ_ITEMS.map(item => ({
    question: item.question,
    answer: item.answer
  }));

  return (
    <>
      {/* FAQ Structured Data for Search Engines */}
      <JsonLd data={faqSchema(faqData)} />

      <motion.section
      initial={{ opacity: 0, y: 60 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.9, ease: 'easeOut', delay: 0.2 }}
      className="py-24 px-4 bg-black"
    >
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-2xl md:text-4xl font-medium text-white mb-4 font-poppins">
            FAQ
          </h2>
          <p className="text-lg text-white font-poppins">
            Everything you need to know about getting started
          </p>
        </div>

        <div className="space-y-4">
          {FAQ_ITEMS.map((faq, index) => {
            const isOpen = openFaqIndex === index;

            return (
              <div
                key={index}
                className="bg-transparent rounded-2xl border border-white overflow-hidden"
              >
                <button
                  onClick={() => setOpenFaqIndex(isOpen ? null : index)}
                  className="w-full p-6 text-left flex items-center justify-between transition-all duration-200"
                >
                  <h3 className="text-xl font-bold text-white">
                    {faq.question}
                  </h3>
                  <div
                    className={`transform transition-transform duration-200 ${isOpen ? 'rotate-45' : ''}`}
                  >
                    <Plus className="w-6 h-6 text-white" />
                  </div>
                </button>
                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="px-6 pb-6">
                        <p className="text-white text-lg leading-relaxed">
                          {faq.answer}
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </motion.section>
    </>
  );
};

export default FAQSection;
