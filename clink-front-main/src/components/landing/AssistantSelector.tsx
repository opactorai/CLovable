'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import { useState, useEffect, useRef, useMemo, useImperativeHandle, forwardRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ASSISTANT_OPTIONS, AssistantKey } from '@/lib/assistant-options';
import { useTheme } from '@/contexts/BuildThemeContext';

interface AssistantSelectorProps {
  selectedAssistant: AssistantKey;
  handleModelSelect: (assistantKey: AssistantKey) => void;
}

export interface AssistantSelectorRef {
  navigatePrevious: () => void;
  navigateNext: () => void;
}

const CLONE_COUNT = 10;
const ITEM_WIDTH = 110;
const GAP = 4;
const ITEM_TOTAL_WIDTH = ITEM_WIDTH + GAP;
const TRANSITION_DURATION = 300; // ms

const AssistantSelector = forwardRef<AssistantSelectorRef, AssistantSelectorProps>(({
  selectedAssistant,
  handleModelSelect,
}, ref) => {
  const { theme } = useTheme();
  const assistantEntries = useMemo(() => Object.entries(ASSISTANT_OPTIONS), []);
  const centerPosition = CLONE_COUNT * assistantEntries.length;

  const [isMobile, setIsMobile] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(centerPosition);
  const [isAnimating, setIsAnimating] = useState(false);
  const [transitionEnabled, setTransitionEnabled] = useState(false);
  const [isUserInteracting, setIsUserInteracting] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const slideRef = useRef<HTMLDivElement>(null);

  // Handle mobile detection
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Sync currentIndex with selectedAssistant changes (only when not user-triggered)
  useEffect(() => {
    if (isUserInteracting) return;

    const selectedIndex = assistantEntries.findIndex(([key]) => key === selectedAssistant);
    if (selectedIndex === -1) return;

    const currentRealIndex = ((currentIndex % assistantEntries.length) + assistantEntries.length) % assistantEntries.length;

    // Only update if different
    if (currentRealIndex !== selectedIndex) {
      const targetIndex = centerPosition + selectedIndex;
      setCurrentIndex(targetIndex);
    }

    // Mark as ready after initial positioning
    if (!isReady) {
      // Use requestAnimationFrame to ensure position is set before showing
      requestAnimationFrame(() => {
        setIsReady(true);
      });
    }
  }, [selectedAssistant, assistantEntries, centerPosition, currentIndex, isUserInteracting, isReady]);

  const handlePrevious = () => {
    if (isAnimating) return;
    setIsUserInteracting(true);
    setIsAnimating(true);
    setTransitionEnabled(true);
    setCurrentIndex(prev => prev - 1);
  };

  const handleNext = () => {
    if (isAnimating) return;
    setIsUserInteracting(true);
    setIsAnimating(true);
    setTransitionEnabled(true);
    setCurrentIndex(prev => prev + 1);
  };

  // Expose navigation functions to parent via ref
  useImperativeHandle(ref, () => ({
    navigatePrevious: handlePrevious,
    navigateNext: handleNext,
  }));

  // Handle animation completion and position reset
  useEffect(() => {
    if (!transitionEnabled) return;

    const timer = setTimeout(() => {
      setIsAnimating(false);
      setIsUserInteracting(false);

      const realIndex = ((currentIndex % assistantEntries.length) + assistantEntries.length) % assistantEntries.length;
      const centerKey = assistantEntries[realIndex][0] as AssistantKey;

      // Update selection
      handleModelSelect(centerKey);

      // Reset position if drifted too far from center
      const resetThreshold = 2 * assistantEntries.length;
      if (Math.abs(currentIndex - centerPosition) > resetThreshold) {
        setTransitionEnabled(false);
        requestAnimationFrame(() => {
          setCurrentIndex(centerPosition + realIndex);
        });
      }
    }, TRANSITION_DURATION);

    return () => clearTimeout(timer);
  }, [currentIndex, assistantEntries, transitionEnabled, handleModelSelect, centerPosition]);

  // Memoize infinite assistants array
  const infiniteAssistants = useMemo(() => {
    const totalRepeats = CLONE_COUNT * 2 + 1;
    const allAssistants: any[] = [];

    for (let repeat = 0; repeat < totalRepeats; repeat++) {
      assistantEntries.forEach(([key, option], idx) => {
        allAssistants.push({
          key,
          option,
          uniqueKey: `${repeat}-${idx}`,
          position: repeat * assistantEntries.length + idx
        });
      });
    }

    return allAssistants;
  }, [assistantEntries]);

  // Calculate transform for centering
  const calculateTransform = () => {
    const translateValue = currentIndex * ITEM_TOTAL_WIDTH;
    return `translateX(calc(-${translateValue}px + 50% - ${ITEM_WIDTH / 2}px))`;
  };

  const handleTabClick = (clickedKey: AssistantKey, position: number) => {
    if (isAnimating) return;

    const realIndex = ((currentIndex % assistantEntries.length) + assistantEntries.length) % assistantEntries.length;
    const clickedRealIndex = ((position % assistantEntries.length) + assistantEntries.length) % assistantEntries.length;

    if (clickedRealIndex === realIndex) return;

    setIsUserInteracting(true);
    setIsAnimating(true);
    setTransitionEnabled(true);
    setCurrentIndex(position);
  };

  return (
    <div
      className="flex justify-center px-2 relative mb-0"
      style={{ zIndex: 1 }}
    >
      <div
        className="relative flex items-center h-12 sm:h-14 text-xs sm:text-base px-2"
        style={{
          width: isMobile ? '290px' : '396px',
          backgroundColor: 'color-mix(in srgb, #bbbbbc 16%, transparent)',
          backdropFilter: 'blur(12px) saturate(150%)',
          WebkitBackdropFilter: 'blur(12px) saturate(150%)',
          borderRadius: '16px 16px 0 0',
          borderBottom: 'none',
          boxShadow: `
            inset 1.8px 3px 0px -2px color-mix(in srgb, #fff 95%, transparent),
            0px -2px 12px 0px color-mix(in srgb, #000 10%, transparent)
          `,
          opacity: isReady ? 1 : 0,
          transition:
            'background-color 400ms cubic-bezier(1, 0, 0.4, 1), box-shadow 400ms cubic-bezier(1, 0, 0.4, 1), opacity 200ms ease-out',
        }}
      >
        {/* Left Arrow */}
        <button
          onClick={handlePrevious}
          className="flex-shrink-0 p-1 text-white hover:text-white/70 transition-all duration-300 z-10"
          aria-label="Previous assistant"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* Carousel Container */}
        <div className="flex-1 overflow-hidden">
          <div
            ref={slideRef}
            className={`flex gap-1 ${transitionEnabled ? 'transition-transform' : ''}`}
            style={{
              transform: calculateTransform(),
              transitionDuration: transitionEnabled ? `${TRANSITION_DURATION}ms` : '0ms',
              transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)'
            }}
          >
            {infiniteAssistants.map((assistant) => {
              const distance = Math.abs(assistant.position - currentIndex);
              const isCenter = distance === 0;

              return (
                <motion.button
                  key={assistant.uniqueKey}
                  onClick={() => handleTabClick(assistant.key as AssistantKey, assistant.position)}
                  className={`relative flex items-center gap-1 sm:gap-2 transition-all flex-shrink-0 assistant-btn-${assistant.key} ${isCenter ? 'assistant-selected' : ''}`}
                  style={{
                    padding: '6px 0',
                    width: `${ITEM_WIDTH}px`,
                    minWidth: `${ITEM_WIDTH}px`,
                    maxWidth: `${ITEM_WIDTH}px`,
                    height: '100%',
                    borderRadius: '12px 12px 0 0',
                    color: '#ffffff',
                    cursor: isCenter ? 'auto' : 'pointer',
                    justifyContent: 'center',
                    alignItems: 'center',
                    zIndex: isCenter ? 2 : 0,
                  }}
                  initial={false}
                  animate={{
                    opacity: isCenter ? 1 : 0.4,
                    scale: isCenter ? 1.2 : 1,
                  }}
                  transition={{
                    duration: TRANSITION_DURATION / 1000,
                    ease: [0.4, 0, 0.2, 1],
                  }}
                  whileHover={
                    !isCenter
                      ? {
                          opacity: 1,
                          scale: 1.05,
                          transition: { duration: 0.2 },
                        }
                      : {}
                  }
                  whileTap={!isCenter ? { scale: 1.1 } : { scale: 1.2 }}
                  suppressHydrationWarning
                >
                  <div className="flex items-center justify-center gap-1 sm:gap-2 w-full h-full">
                    <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                      {assistant.key === 'glm' ? (
                        <Image
                          src={theme === 'dark' ? '/assets/agents/zai_light.png' : '/assets/agents/zai_dark.png'}
                          alt={assistant.option.label}
                          width={16}
                          height={16}
                          className="w-4 h-4 object-contain"
                          style={{
                            transition: 'scale 200ms cubic-bezier(0.5, 0, 0, 1)',
                          }}
                        />
                      ) : (
                        <Image
                          src={`/assets/provider/${assistant.key === 'codex' ? 'openai' : assistant.key}.png`}
                          alt={assistant.option.label}
                          width={20}
                          height={20}
                          className="w-5 h-5 object-contain"
                          style={{
                            transition: 'scale 200ms cubic-bezier(0.5, 0, 0, 1)',
                          }}
                        />
                      )}
                    </div>

                    <div className="text-center flex-shrink-0">
                      <div
                        className="text-sm font-semibold whitespace-nowrap tracking-wide font-secondary"
                        style={{
                          color: '#ffffff',
                          textShadow: '0 0.5px 1px rgba(255,255,255,0.6)',
                          letterSpacing: '0.02em',
                        }}
                      >
                        {assistant.option.label}
                      </div>
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Right Arrow */}
        <button
          onClick={handleNext}
          className="flex-shrink-0 p-1 text-white hover:text-white/70 transition-all duration-300 z-10"
          aria-label="Next assistant"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
});

AssistantSelector.displayName = 'AssistantSelector';

export default AssistantSelector;
