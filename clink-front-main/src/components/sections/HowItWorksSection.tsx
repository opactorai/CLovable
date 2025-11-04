'use client';

import { motion } from 'framer-motion';

const AGENT_ICONS = [
  {
    agentImage: '/assets/agents/claude_code.png',
    providerIcon: '/assets/provider/claude.png',
    alt: 'Claude Code Agent',
    provider: 'Claude',
    description: 'Claude Code powered by Claude plan',
  },
  {
    agentImage: '/assets/agents/codex_cli_light.png',
    providerIcon: '/assets/provider/openai.png',
    alt: 'Codex CLI Agent',
    provider: 'OpenAI',
    description: 'Codex powered by ChatGPT plan',
  },
  {
    agentImage: '/assets/agents/gemini_cli.png',
    providerIcon: '/assets/provider/gemini.png',
    alt: 'Gemini CLI Agent',
    provider: 'Gemini',
    description: 'Gemini CLI powered by Google Gemini plan',
  },
];

const HowItWorksSection = () => {
  return (
    <section className="pt-32 pb-4 px-4 bg-black">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16 relative">
          {/* Gray Gradient Circle - Center Background */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-visible">
            <div
              className="rounded-full"
              style={{
                width: '800px',
                height: '800px',
                background: 'radial-gradient(circle, rgba(200, 200, 200, 0.2) 0%, rgba(150, 150, 150, 0.1) 30%, transparent 60%)',
              }}
            />
          </div>

          <motion.h2
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="text-2xl md:text-5xl leading-tight text-white mb-20 font-medium font-poppins relative z-10"
          >
            Use your plan, not ours.
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.6, delay: 0.2, ease: 'easeOut' }}
            className="text-base sm:text-lg text-white max-w-full sm:max-w-4xl mx-auto font-poppins leading-relaxed mb-12 sm:mb-20 px-4 sm:px-0 relative z-10"
          >
            <span className="font-bold text-white">One click connect</span> to
            your existing ChatGPT, Claude, or Google subscription.
            <br />
            Under the hood, official coding agents run locally and usage is
            counted to your plan.
            <br />
            No new billing or API keys to paste.
            <br />
            <span className="font-bold text-white">Free to use.</span>
          </motion.p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6, delay: 0.4, ease: 'easeOut' }}
          className="mb-16"
        >
          {/* Best CLI Coding Agents */}
          <div className="text-center">
            <div className="flex flex-col md:flex-row justify-center gap-6 md:gap-10 mb-10">
              {AGENT_ICONS.map((agent, index) => (
                <motion.div
                  key={agent.alt}
                  initial={{ opacity: 0, scale: 0.8 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true, amount: 0.3 }}
                  transition={{
                    duration: 0.5,
                    delay: 0.5 + index * 0.1,
                    ease: 'easeOut',
                  }}
                  className="flex flex-col items-center"
                >
                  {/* Image container with badge */}
                  <div className="relative flex items-center justify-center mb-4">
                    {/* Main image: Agent image if available, otherwise provider icon */}
                    <img
                      src={agent.agentImage || agent.providerIcon}
                      alt={agent.alt}
                      className="h-48 md:h-80 object-contain rounded-2xl"
                    />

                    {/* Provider icon badge - positioned at the edge (only when agent image exists) */}
                    {agent.agentImage && (
                      <div className="absolute -top-3 -left-3">
                        <div
                          className="relative w-6 h-6 rounded-full flex items-center justify-center"
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
                              'background-color 400ms cubic-bezier(1, 0, 0.4, 1), box-shadow 400ms cubic-bezier(1, 0, 0.4, 1)',
                          }}
                        >
                          <img
                            src={agent.providerIcon}
                            alt={`${agent.provider} provider`}
                            className="w-4 h-4 object-contain"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Agent description directly below each image */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.3 }}
                    transition={{
                      duration: 0.4,
                      delay: 0.6 + index * 0.1,
                      ease: 'easeOut',
                    }}
                    className="text-center"
                  >
                    <p className="text-xs text-gray-400 font-normal whitespace-normal md:whitespace-nowrap">
                      {agent.description}
                    </p>
                  </motion.div>
                </motion.div>
              ))}
            </div>

            <motion.h3
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.5, delay: 0.8, ease: 'easeOut' }}
              className="font-semibold text-white mb-2 text-lg"
            >
              Best CLI Coding Agents
            </motion.h3>
            <motion.p
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.5, delay: 0.9, ease: 'easeOut' }}
              className="text-white"
            >
              Use top-tier agents in your existing plan
            </motion.p>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default HowItWorksSection;
