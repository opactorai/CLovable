'use client';

import { motion } from 'framer-motion';
import { Download } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useDownload } from '@/app/hooks/useDownload';

const STEPS = [
  {
    number: 1,
    title: 'Install Clink App',
    description: 'Download and install the Clink App desktop app',
    visual: {
      type: 'video',
      src: '/assets/steps/clink_step_1.mp4',
      alt: 'Installation demo video',
    },
  },
  {
    number: 2,
    title: 'Link your AI Plan',
    description: 'Link your AI service through the desktop app',
    visual: {
      type: 'video',
      src: '/assets/steps/clink_step_2.mp4',
      alt: 'Connection demo video',
    },
  },
  {
    number: 3,
    title: 'Prompt, Build, and Deploy - No Cost',
    description: 'Describe your idea, watch it build in real-time, and deploy instantly',
    visual: {
      type: 'video',
      src: '/assets/steps/clink_demo_claude.mp4',
      alt: 'Chat demo video',
    },
  },
];

const ThreeStepProcessSection = () => {
  const { handleDownload, downloadingPlatform } = useDownload();
  const [detectedOS, setDetectedOS] = useState<string | null>(null);

  useEffect(() => {
    const userAgent = window.navigator.userAgent.toLowerCase();
    if (userAgent.includes('mac')) {
      setDetectedOS('darwin');
    } else if (userAgent.includes('win')) {
      setDetectedOS('win32');
    }
  }, []);

  return (
    <section className="py-24 px-4 bg-black">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-20">
          <motion.h2
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.8 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="text-2xl md:text-5xl leading-tight text-white mb-6 font-medium font-poppins"
          >
            Get started in 3 simple steps.
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.8 }}
            transition={{ duration: 0.6, delay: 0.2, ease: 'easeOut' }}
            className="text-lg text-white font-poppins max-w-2xl mx-auto"
          >
            From installation to your first app in minutes
          </motion.p>
        </div>

        <div className="flex flex-col gap-20">
          {STEPS.map((step, index) => (
            <motion.div
              key={step.number}
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{
                duration: 0.6,
                delay: 0.1 + index * 0.1,
                ease: 'easeOut',
              }}
              className={`grid grid-cols-1 md:grid-cols-2 gap-8 items-center w-full ${
                index % 2 === 1 ? 'md:flex-row-reverse' : ''
              }`}
            >
              {/* Text Content */}
              <div
                className={`flex items-center gap-3 sm:gap-4 relative ${index % 2 === 1 ? 'md:order-2' : 'md:order-1'}`}
              >
                {/* Gray Gradient Circle - Left Background */}
                <div className="absolute inset-0 flex items-center justify-start pointer-events-none overflow-visible">
                  <div
                    className="rounded-full"
                    style={{
                      width: '500px',
                      height: '500px',
                      background: 'radial-gradient(circle, rgba(200, 200, 200, 0.15) 0%, rgba(150, 150, 150, 0.08) 30%, transparent 60%)',
                    }}
                  />
                </div>
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{
                    duration: 0.5,
                    delay: 0.2 + index * 0.1,
                    ease: 'easeOut',
                  }}
                  className="w-12 h-12 sm:w-14 sm:h-14 text-white rounded-full flex items-center justify-center text-2xl sm:text-3xl font-normal liquid flex-shrink-0 relative z-10"
                >
                  {step.number}
                </motion.div>
                <div className="relative z-10">
                  <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.2 }}
                    transition={{
                      duration: 0.5,
                      delay: 0.3 + index * 0.1,
                      ease: 'easeOut',
                    }}
                    className="flex items-center gap-2 mb-2"
                  >
                    {step.number === 1 ? (
                      <button
                        onClick={() => detectedOS && handleDownload(detectedOS)}
                        disabled={!detectedOS || downloadingPlatform === detectedOS}
                        className="text-lg sm:text-xl font-normal text-white font-poppins hover:underline underline-offset-4 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        title={detectedOS ? `Download for ${detectedOS === 'darwin' ? 'macOS' : 'Windows'}` : 'Detecting OS...'}
                      >
                        {step.title}
                      </button>
                    ) : (
                      <h3 className="text-lg sm:text-xl font-normal text-white font-poppins">
                        {step.title}
                      </h3>
                    )}
                    {step.number === 1 && detectedOS && (
                      <button
                        onClick={() => handleDownload(detectedOS)}
                        disabled={downloadingPlatform === detectedOS}
                        className="p-1 rounded-full hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title={`Download for ${detectedOS === 'darwin' ? 'macOS' : 'Windows'}`}
                      >
                        <Download className="w-5 h-5 text-white" />
                      </button>
                    )}
                  </motion.div>
                  <motion.p
                    initial={{ opacity: 0, y: 15 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.2 }}
                    transition={{
                      duration: 0.5,
                      delay: 0.4 + index * 0.1,
                      ease: 'easeOut',
                    }}
                    className="text-sm sm:text-base text-white font-poppins"
                  >
                    {step.description}
                  </motion.p>
                </div>
              </div>

              {/* Visual Content */}
              <motion.div
                initial={{ opacity: 0, x: index % 2 === 1 ? -30 : 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{
                  duration: 0.6,
                  delay: 0.5 + index * 0.1,
                  ease: 'easeOut',
                }}
                className={`flex justify-center ${index % 2 === 1 ? 'md:order-1' : 'md:order-2'}`}
              >
                {step.visual.type === 'image' ? (
                  <div className="flex items-center justify-center">
                    <button
                      onClick={() => detectedOS && handleDownload(detectedOS)}
                      disabled={!detectedOS || downloadingPlatform === detectedOS}
                      className="relative cursor-pointer hover:scale-110 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
                      title={detectedOS ? `Download for ${detectedOS === 'darwin' ? 'macOS' : 'Windows'}` : 'Detecting OS...'}
                    >
                      {/* Gradient Background Glow */}
                      <div
                        className="absolute inset-0 -m-8 rounded-full blur-3xl opacity-60"
                        style={{
                          background: 'radial-gradient(circle, rgba(255, 255, 255, 0.3) 0%, rgba(200, 200, 200, 0.2) 30%, rgba(150, 150, 150, 0.1) 60%, transparent 80%)',
                        }}
                      />
                      <img
                        src="/assets/logo_svg/clink_app_icon_white.svg"
                        alt={step.visual.alt}
                        className="w-24 h-24 object-contain relative z-10"
                      />
                    </button>
                  </div>
                ) : (
                  <div className="rounded-2xl flex items-center justify-center">
                    <video
                      src={step.visual.src}
                      autoPlay
                      loop
                      muted
                      playsInline
                      preload="auto"
                      className={step.number === 1 ? "w-[350px] h-[auto] rounded-xl" : "w-[700px] h-[auto] rounded-xl"}
                    />
                  </div>
                )}
              </motion.div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ThreeStepProcessSection;
