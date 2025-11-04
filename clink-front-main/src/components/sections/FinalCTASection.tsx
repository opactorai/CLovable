'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';

interface FinalCTASectionProps {
  detectedOS: string | null;
  downloadingPlatform: string | null;
  handleDownload: (platform: string) => void;
}

const FinalCTASection = ({
  detectedOS,
  downloadingPlatform,
  handleDownload,
}: FinalCTASectionProps) => {
  return (
    <motion.section
      initial={{ opacity: 0, y: 60 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.9, ease: 'easeOut', delay: 0.1 }}
      className="py-24 px-4 bg-black"
    >
      <div className="max-w-4xl mx-auto text-center">
        <h2 className="text-3xl md:text-6xl font-medium text-white mb-8 font-poppins leading-tight">
          No code. No keys. No costs.
        </h2>
        <p className="text-xl text-white mb-12 max-w-4xl mx-auto font-poppins">
          Start building with the best coding agents using your existing AI plan
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/login"
            className="inline-flex items-center gap-3 px-12 py-5 text-white text-xl font-medium font-poppins rounded-3xl transition-all transform hover:scale-105"
            style={{
              backgroundColor: 'color-mix(in srgb, #bbbbbc 12%, transparent)',
              backdropFilter: 'blur(8px) saturate(150%)',
              WebkitBackdropFilter: 'blur(8px) saturate(150%)',
              boxShadow: `
                    inset 0 0 0 1px color-mix(in srgb, #fff 10%, transparent),
                    inset 1.8px 3px 0px -2px color-mix(in srgb, #fff 90%, transparent),
                    inset -2px -2px 0px -2px color-mix(in srgb, #fff 80%, transparent),
                    inset -3px -8px 1px -6px color-mix(in srgb, #fff 60%, transparent),
                    inset -0.3px -1px 4px 0px color-mix(in srgb, #000 12%, transparent),
                    inset -1.5px 2.5px 0px -2px color-mix(in srgb, #000 20%, transparent),
                    inset 0px 3px 4px -2px color-mix(in srgb, #000 20%, transparent),
                    inset 2px -6.5px 1px -4px color-mix(in srgb, #000 10%, transparent),
                    0px 1px 5px 0px color-mix(in srgb, #000 10%, transparent),
                    0px 6px 16px 0px color-mix(in srgb, #000 8%, transparent)
                  `,
              transition:
                'background-color 400ms cubic-bezier(1, 0, 0.4, 1), box-shadow 400ms cubic-bezier(1, 0, 0.4, 1), transform 700ms cubic-bezier(0.25, 0.46, 0.45, 0.94)',
            }}
          >
            Get Started Free →
          </Link>

          <button
            onClick={() => detectedOS && handleDownload(detectedOS)}
            disabled={!detectedOS || downloadingPlatform === detectedOS}
            className="inline-flex items-center gap-3 px-12 py-5 text-white text-xl font-medium font-poppins rounded-3xl transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundColor: 'color-mix(in srgb, #bbbbbc 12%, transparent)',
              backdropFilter: 'blur(8px) saturate(150%)',
              WebkitBackdropFilter: 'blur(8px) saturate(150%)',
              boxShadow: `
                    inset 0 0 0 1px color-mix(in srgb, #fff 10%, transparent),
                    inset 1.8px 3px 0px -2px color-mix(in srgb, #fff 90%, transparent),
                    inset -2px -2px 0px -2px color-mix(in srgb, #fff 80%, transparent),
                    inset -3px -8px 1px -6px color-mix(in srgb, #fff 60%, transparent),
                    inset -0.3px -1px 4px 0px color-mix(in srgb, #000 12%, transparent),
                    inset -1.5px 2.5px 0px -2px color-mix(in srgb, #000 20%, transparent),
                    inset 0px 3px 4px -2px color-mix(in srgb, #000 20%, transparent),
                    inset 2px -6.5px 1px -4px color-mix(in srgb, #000 10%, transparent),
                    0px 1px 5px 0px color-mix(in srgb, #000 10%, transparent),
                    0px 6px 16px 0px color-mix(in srgb, #000 8%, transparent)
                  `,
              transition:
                'background-color 400ms cubic-bezier(1, 0, 0.4, 1), box-shadow 400ms cubic-bezier(1, 0, 0.4, 1), transform 700ms cubic-bezier(0.25, 0.46, 0.45, 0.94)',
            }}
          >
            {downloadingPlatform === detectedOS
              ? 'Downloading...'
              : 'Download Clink App'}
          </button>
        </div>
      </div>
    </motion.section>
  );
};

export default FinalCTASection;
