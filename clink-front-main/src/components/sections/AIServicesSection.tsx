'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Minus, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';

interface AIConnection {
  openai: boolean;
  claude: boolean;
  gemini: boolean;
  zai: boolean;
}

interface AIServicesSectionProps {
  isAuthenticated: boolean;
  aiConnections: AIConnection;
  detectedOS: string | null;
  downloadingPlatform: string | null;
  handleDownload: (platform: string) => void;
  onManualSetup?: () => void;
}

const AI_SERVICES = [
  {
    id: 'claude',
    name: 'Claude',
    logo: '/assets/provider/claude.png',
    description: 'Anthropic Claude plan',
    brandColor: '217, 119, 87',
  },
  {
    id: 'openai',
    name: 'ChatGPT',
    logo: '/assets/provider/openai.png',
    description: 'OpenAI GPT plan',
    brandColor: '26, 26, 26',
  },
  {
    id: 'gemini',
    name: 'Gemini',
    logo: '/assets/provider/gemini.png',
    description: 'Google Gemini plan',
    brandColor: '66, 133, 244',
  },
  {
    id: 'zai',
    name: 'GLM',
    logo: '/assets/agents/zai_light.png',
    description: 'Z.ai GLM plan',
    brandColor: '235, 235, 240',
  },
];

const AIServicesSection = ({
  isAuthenticated,
  aiConnections,
  detectedOS,
  downloadingPlatform,
  handleDownload,
  onManualSetup,
}: AIServicesSectionProps) => {
  const [showOtherPlatforms, setShowOtherPlatforms] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [transitionEnabled, setTransitionEnabled] = useState(true);
  const slideRef = useRef<HTMLDivElement>(null);

  const ITEMS_TO_SHOW = 3;
  const CLONE_COUNT = 10;
  const itemWidth = 300; // Width of each card
  const gap = 24; // gap-6 = 1.5rem = 24px
  const itemTotalWidth = itemWidth + gap;

  // Auto-rotation effect
  useEffect(() => {
    const interval = setInterval(() => {
      setIsAnimating(true);
      setTransitionEnabled(true);
      setCurrentIndex(prev => prev + 1);
    }, 3000); // Rotate every 3 seconds

    return () => clearInterval(interval);
  }, []);

  const handlePrevious = () => {
    if (isAnimating) return;
    setIsAnimating(true);
    setTransitionEnabled(true);
    setCurrentIndex(prev => prev - 1);
  };

  const handleNext = () => {
    if (isAnimating) return;
    setIsAnimating(true);
    setTransitionEnabled(true);
    setCurrentIndex(prev => prev + 1);
  };

  useEffect(() => {
    if (!transitionEnabled) return;

    const timer = setTimeout(() => {
      setIsAnimating(false);

      const realIndex = ((currentIndex % AI_SERVICES.length) + AI_SERVICES.length) % AI_SERVICES.length;

      if (currentIndex >= CLONE_COUNT * AI_SERVICES.length) {
        setTransitionEnabled(false);
        setCurrentIndex(CLONE_COUNT * AI_SERVICES.length + realIndex);
      } else if (currentIndex < CLONE_COUNT * AI_SERVICES.length) {
        setTransitionEnabled(false);
        setCurrentIndex(CLONE_COUNT * AI_SERVICES.length + realIndex);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [currentIndex, transitionEnabled]);

  const getInfiniteServices = () => {
    const totalRepeats = CLONE_COUNT * 2 + 1;
    const allServices: any[] = [];

    for (let repeat = 0; repeat < totalRepeats; repeat++) {
      AI_SERVICES.forEach((service, idx) => {
        allServices.push({
          ...service,
          key: `${repeat}-${idx}`,
          position: repeat * AI_SERVICES.length + idx
        });
      });
    }

    return allServices;
  };

  const calculateTransform = () => {
    const translateValue = currentIndex * itemTotalWidth;
    return `translateX(calc(-${translateValue}px + 50% - ${itemTotalWidth * 1.5 - gap / 2}px))`;
  };

  const infiniteServices = getInfiniteServices();

  return (
    <div className="hidden md:block pt-48 pb-12 px-4 bg-black">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <motion.h2
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="text-2xl md:text-5xl leading-tight text-white mb-12 whitespace-nowrap text-center w-max mx-auto font-medium font-poppins"
          >
            Connect Your AI Services
          </motion.h2>
        </div>

        {/* AI Service Cards Section */}
        <div className="mb-16 relative flex items-center">
          {/* Navigation Arrows */}
          <button
            onClick={handlePrevious}
            disabled={isAnimating}
            className="p-3 text-white hover:text-white/70 transition-all duration-300 disabled:opacity-50 z-30"
            aria-label="Previous service"
          >
            <ChevronLeft className="w-8 h-8" />
          </button>

          <div className="overflow-hidden mx-4 w-full max-w-[980px] relative">
            <div
              ref={slideRef}
              className={`flex gap-6 ${transitionEnabled ? 'transition-transform duration-500 ease-in-out' : ''}`}
              style={{
                transform: calculateTransform()
              }}
            >
              {infiniteServices.map((service) => {
                const isConnected =
                  isAuthenticated &&
                  aiConnections[service.id as keyof typeof aiConnections];

                return (
                  <div
                    key={service.key}
                    className="group relative min-h-[260px] w-[300px] flex-shrink-0 p-8 rounded-3xl transition-all duration-700 ease-out"
                  >
                    {/* Brand color background gradient */}
                    <div
                      className="absolute inset-0 rounded-3xl opacity-20 pointer-events-none"
                      style={{
                        background: `radial-gradient(circle at center, rgba(${service.brandColor}, 0.3) 0%, rgba(${service.brandColor}, 0.1) 50%, transparent 100%)`,
                      }}
                    />

                    {/* Glass effect card */}
                    <div
                      className="absolute inset-0 rounded-3xl"
                      style={{
                        backgroundColor:
                          'color-mix(in srgb, #bbbbbc 12%, transparent)',
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
                          'background-color 600ms cubic-bezier(0.25, 0.46, 0.45, 0.94), box-shadow 600ms cubic-bezier(0.25, 0.46, 0.45, 0.94), transform 700ms cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                      }}
                    />
                    {/* Connection Status Badge - Top Right */}
                    {isAuthenticated && isConnected && (
                      <div className="absolute top-4 right-4 z-20">
                        <div
                          className="w-4 h-4 rounded-full bg-green-500 shadow-lg animate-pulse"
                          style={{
                            boxShadow:
                              '0 0 20px rgba(34, 197, 94, 0.6), 0 0 40px rgba(34, 197, 94, 0.3)',
                          }}
                          title="Connected"
                        />
                      </div>
                    )}

                    {/* Content */}
                    <div className="relative z-10 flex flex-col items-center text-center">
                      <img
                        src={service.logo}
                        alt={service.name}
                        className="w-16 h-16 object-contain mb-4 transition-transform duration-300 group-hover:scale-110"
                      />

                      <h3 className="text-lg font-semibold text-white mb-2">
                        {service.name}
                      </h3>
                      <p className="text-white mb-6 text-sm">
                        {service.description}
                      </p>

                      {/* Status text for all users */}
                      <div className="w-full text-center">
                        {isAuthenticated && isConnected ? (
                          <span className="text-green-600 font-medium text-sm">
                            Connected
                          </span>
                        ) : (
                          <span className="text-gray-400 font-medium text-sm">
                            Not connected
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <button
            onClick={handleNext}
            disabled={isAnimating}
            className="p-3 text-white hover:text-white/70 transition-all duration-300 disabled:opacity-50 z-30"
            aria-label="Next service"
          >
            <ChevronRight className="w-8 h-8" />
          </button>
        </div>

        {/* Download Section */}
        <div className="text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.6, delay: 0.5, ease: 'easeOut' }}
            className="mb-10"
          >
            <div className="flex items-center justify-center gap-2 mb-6">
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.5, delay: 0.6, ease: 'easeOut' }}
                className="flex items-center gap-2"
              >
                <p className="text-md text-white font-normal font-poppins">
                  Download Clink App to link your AI accounts or
                </p>
                <button
                  onClick={onManualSetup}
                  className="text-md text-white font-normal font-poppins underline underline-offset-4 transition-all"
                >
                  setup manually
                </button>
              </motion.div>
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.4, delay: 0.7, ease: 'easeOut' }}
                onClick={() => setShowOtherPlatforms(!showOtherPlatforms)}
                className="p-1 rounded-full hover:bg-gray-100 transition-colors"
                title="Other platforms"
              >
                <AnimatePresence mode="wait">
                  {showOtherPlatforms ? (
                    <motion.div
                      key="minus"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Minus className="w-4 h-4 text-gray-500 hover:text-gray-700" />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="plus"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Plus className="w-4 h-4 text-gray-100 hover:text-black" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.button>
            </div>
          </motion.div>

          <div className="flex flex-col items-center">
            {/* Primary Download Button - Always visible */}
            <motion.button
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.6, delay: 0.5, ease: 'easeOut' }}
              onClick={() => detectedOS && handleDownload(detectedOS)}
              disabled={!detectedOS || downloadingPlatform === detectedOS}
              className="relative flex items-center gap-3 px-6 py-3 liquid hover:opacity-80
              rounded-full transition-all duration-200 hover-scale-101
              disabled:opacity-50 disabled:cursor-not-allowed w-[260px] h-12"
            >
              {/* OS Icon */}
              <div className="flex-shrink-0 flex items-center justify-center">
                {detectedOS === 'darwin' && (
                  <img
                    src="/assets/download/apple.png"
                    alt="macOS"
                    className="h-5 w-5 object-contain"
                  />
                )}
                {detectedOS === 'win32' && (
                  <img
                    src="/assets/download/window.png"
                    alt="Windows"
                    className="h-5 w-5 object-contain"
                  />
                )}
              </div>

              {/* Text Content */}
              <div className="flex-1 text-center">
                <span className="text-white font-normal text-base">
                  {downloadingPlatform === detectedOS
                    ? 'Downloading...'
                    : `Download for ${detectedOS === 'darwin' ? 'macOS' : 'Windows'}`}
                </span>
              </div>
            </motion.button>

            {/* Alternative OS Downloads */}
            <AnimatePresence>
              {showOtherPlatforms && (
                <motion.div
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.4, ease: 'easeOut' }}
                  className="w-full flex flex-col items-center"
                  style={{ marginTop: '24px' }}
                >
                  {[
                    { platform: 'darwin', name: 'macOS' },
                    { platform: 'win32', name: 'Windows' },
                  ]
                    .filter((item) => item.platform !== detectedOS)
                    .map((item, index) => (
                      <motion.button
                        key={item.platform}
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                          duration: 0.4,
                          delay: 0.1 + index * 0.15,
                          ease: 'easeOut',
                        }}
                        onClick={() => handleDownload(item.platform)}
                        disabled={downloadingPlatform === item.platform}
                        className="relative liquid flex items-center gap-3 px-6 py-3
                        rounded-full transition-all duration-200
                        disabled:opacity-50 disabled:cursor-not-allowed w-[260px] h-12"
                        style={{ marginTop: index === 0 ? '0px' : '24px' }}
                      >
                        <div className="flex-shrink-0 flex items-center justify-center">
                          {item.platform === 'darwin' && (
                            <img
                              src="/assets/download/apple.png"
                              alt="macOS"
                              className="h-5 w-5 object-contain"
                            />
                          )}
                          {item.platform === 'win32' && (
                            <img
                              src="/assets/download/window.png"
                              alt="Windows"
                              className="h-5 w-5 object-contain"
                            />
                          )}
                        </div>
                        <div className="flex-1 text-center">
                          <span className="text-white font-normal text-base">
                            {downloadingPlatform === item.platform
                              ? 'Downloading...'
                              : `Download for ${item.name}`}
                          </span>
                        </div>
                      </motion.button>
                    ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIServicesSection;
