'use client';

import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import { X, Loader2 } from 'lucide-react';
import { ProjectSummary } from '@/types/project';
import { ASSISTANT_OPTIONS } from '@/lib/assistant-options';
import ClientTimestamp from '@/components/ClientTimestamp';
import { useTheme } from '@/contexts/BuildThemeContext';

interface ProjectsSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  projects: ProjectSummary[];
  projectsLoading: boolean;
  projectsError: string | null;
}

export default function ProjectsSidebar({
  isOpen,
  onClose,
  projects,
  projectsLoading,
  projectsError,
}: ProjectsSidebarProps) {
  const { theme } = useTheme();

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            key="projects-overlay"
            className="fixed inset-0 bg-black/10 z-[59]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={onClose}
          />
          <motion.aside
            key="projects-sidebar"
            className="fixed left-0 top-0 bottom-0 z-[60] w-full max-w-sm flex flex-col border-r"
            initial={{ x: '-100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '-100%', opacity: 0 }}
            transition={{
              type: 'spring',
              stiffness: 300,
              damping: 30,
              mass: 0.8,
            }}
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
              borderColor: 'color-mix(in srgb, #fff 20%, transparent)',
            }}
          >
            <div
              className="px-6 pt-6 pb-4 border-b"
              style={{
                borderColor: 'color-mix(in srgb, #000 8%, transparent)',
              }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Projects</h2>
                  <p className="text-xs text-gray-700">
                    Quick access to your recent work
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-full p-2 text-gray-700 hover:text-gray-900 transition-all"
                  aria-label="Close projects sidebar"
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
                  }}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 liquid-glass-scrollbar">
              {projectsLoading ? (
                <div className="flex items-center gap-3 text-sm text-gray-800">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Loading your projects…</span>
                </div>
              ) : projectsError ? (
                <div
                  className="rounded-xl px-4 py-3 text-sm text-red-800 border"
                  style={{
                    backgroundColor:
                      'color-mix(in srgb, #fef2f2 30%, transparent)',
                    backdropFilter: 'blur(8px) saturate(150%)',
                    WebkitBackdropFilter: 'blur(8px) saturate(150%)',
                    boxShadow: `
                      inset 0 0 0 1px color-mix(in srgb, #fca5a5 20%, transparent),
                      inset 1.8px 3px 0px -2px color-mix(in srgb, #fff 90%, transparent),
                      inset -2px -2px 0px -2px color-mix(in srgb, #fff 80%, transparent),
                      0px 1px 5px 0px color-mix(in srgb, #000 10%, transparent)
                    `,
                    borderColor: 'color-mix(in srgb, #fca5a5 30%, transparent)',
                  }}
                >
                  Failed to load projects. {projectsError}
                </div>
              ) : projects.length === 0 ? (
                <div className="rounded-xl px-4 py-6 text-sm text-gray-700 dark:text-gray-400 border border-dashed border-gray-500 dark:border-gray-500">
                  You haven't created any projects yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {projects.map((project, index) => (
                    <motion.div
                      key={project.id}
                      initial={{ opacity: 0, x: -20, scale: 0.95 }}
                      animate={{ opacity: 1, x: 0, scale: 1 }}
                      transition={{
                        duration: 0.4,
                        delay: index * 0.05,
                        ease: [0.4, 0, 0.2, 1],
                      }}
                      whileTap={{
                        scale: 0.98,
                        transition: {
                          type: 'spring',
                          stiffness: 400,
                          damping: 20,
                        },
                      }}
                    >
                      <Link
                        href={`/build/${project.id}`}
                        onClick={onClose}
                        className="block liquid-card rounded-xl px-4 py-3 border group"
                      >
                        <p className="text-sm font-semibold text-gray-900 truncate transition-colors duration-400">
                          {project.name}
                        </p>
                        {(project.cli || project.model) && (
                          <div className="mt-1 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              {project.cli && (
                                <>
                                  <Image
                                    src={
                                      project.cli === 'glm'
                                        ? theme === 'dark'
                                          ? '/assets/agents/zai_light.png'
                                          : '/assets/agents/zai_dark.png'
                                        : `/assets/provider/${project.cli === 'codex' ? 'openai' : project.cli}.png`
                                    }
                                    alt={ASSISTANT_OPTIONS[project.cli as keyof typeof ASSISTANT_OPTIONS]?.label ?? project.cli}
                                    width={16}
                                    height={16}
                                    className="w-4 h-4 object-contain"
                                  />
                                  <p className="text-xs text-gray-700 font-medium">
                                    {project.cli === 'codex' ? 'ChatGPT' : project.cli === 'claude' ? 'Claude' : project.cli === 'gemini' ? 'Gemini' : project.cli === 'glm' ? 'Z.ai' : project.cli}
                                  </p>
                                </>
                              )}
                            </div>
                            {project.model && (
                              <p className="text-xs text-gray-700 truncate transition-colors duration-400">
                                {project.model}
                              </p>
                            )}
                          </div>
                        )}
                        <ClientTimestamp
                          lastModified={project.lastModified}
                          className="mt-2 text-xs font-medium text-gray-600 transition-colors duration-400"
                        />
                      </Link>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
