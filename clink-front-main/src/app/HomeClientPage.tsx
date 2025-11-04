'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Plus, X, Loader2, MoreVertical, Pencil, Trash2, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiClient } from '@/lib/api-client';
import { normalizeCli, resolveApiModel, ASSISTANT_OPTIONS } from '@/lib/assistant-options';
import ClientTimestamp from '@/components/ClientTimestamp';
import MandatoryAIConnectionModal from '@/components/MandatoryAIConnectionModal';
import ProviderConnectionModal from '@/components/ProviderConnectionModal';
import ManualSetupModal from '@/components/ManualSetupModal';
import AIServicesSection from '@/components/sections/AIServicesSection';
import HowItWorksSection from '@/components/sections/HowItWorksSection';
import ThreeStepProcessSection from '@/components/sections/ThreeStepProcessSection';
import FAQSection from '@/components/sections/FAQSection';
import FinalCTASection from '@/components/sections/FinalCTASection';
import LandingHeader from '@/components/landing/LandingHeader';
import HeroSection from '@/components/landing/HeroSection';
import Footer from '@/components/Footer';
import { JsonLd } from '@/components/seo/JsonLd';
import { webApplicationSchema } from '@/config/seo';
import { useAuth } from './hooks/useAuth';
import { useProviderSelection } from './hooks/useProviderSelection';
import { useProjects } from './hooks/useProjects';
import { useDownload } from './hooks/useDownload';
import { useModals } from './hooks/useModals';
import { useAppMetadata } from './hooks/useAppMetadata';
import { trackProjectCreated, trackReferrer } from '@/lib/analytics';
import { perfEnd, perfMeasure, perfStart } from '@/lib/perf-logger';
import * as Sentry from '@sentry/nextjs';
import { useTheme } from '@/contexts/BuildThemeContext';

interface ImageMetadata {
  url: string;
  filename: string;
  originalName: string;
  size: number;
  mimeType: string;
  uploadedAt: string;
}

interface UploadedImage {
  file: File;
  metadata?: ImageMetadata;
  uploading?: boolean;
  error?: string;
}

interface HomeClientPageProps {
  initialMode?: 'base' | 'dev';
}

export default function HomeClientPage({ initialMode }: HomeClientPageProps = {}) {
  const router = useRouter();
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [projectsSidebarOpen, setProjectsSidebarOpen] = useState(false);
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  // Initialize with initialMode prop or 'base' to avoid hydration mismatch
  const [mode, setMode] = useState<'base' | 'dev'>(initialMode || 'base');

  // Restore mode from localStorage after hydration (only if no initialMode prop)
  useEffect(() => {
    if (!initialMode && typeof window !== 'undefined') {
      const savedMode = localStorage.getItem('promptMode');
      if (savedMode === 'dev' || savedMode === 'base') {
        setMode(savedMode);
      }
    }
  }, [initialMode]);
  const [selectedRepository, setSelectedRepository] = useState<{
    name: string;
    fullName: string;
    url: string;
    branch: string;
    description?: string;
    githubInstallationId?: number;
  } | null>(null);
  const [projectMenuOpen, setProjectMenuOpen] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingProjectName, setEditingProjectName] = useState('');
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);
  const [deleteConfirmProjectId, setDeleteConfirmProjectId] = useState<string | null>(null);
  const [showManualSetupModal, setShowManualSetupModal] = useState(false);
  const [manualSetupInitialProvider, setManualSetupInitialProvider] = useState<'claude' | 'codex' | 'gemini' | 'zai' | undefined>(undefined);

  // Custom hooks
  const {
    isAuthenticated,
    user,
    aiConnections,
    fetchAiConnections,
    handleLogout,
  } = useAuth();
  const {
    selectedProvider,
    selectedModel,
    selectedAssistant,
    providerDropdownOpen,
    modelDropdownOpen,
    setSelectedModel,
    setProviderDropdownOpen,
    setModelDropdownOpen,
    handleModelSelect,
  } = useProviderSelection();
  const { projects, projectsLoading, projectsError, refetch: refetchProjects } = useProjects(
    isAuthenticated,
  );
  const { downloadingPlatform, handleDownload } = useDownload();
  const {
    showMandatoryConnectionModal,
    showProviderConnectionModal,
    setShowProviderConnectionModal,
    openMandatoryConnectionModal,
    closeMandatoryConnectionModal,
  } = useModals();
  const { starCount, detectedOS } = useAppMetadata();
  const { theme } = useTheme();

  // Track referrer on page load
  useEffect(() => {
    trackReferrer();
  }, []);

  // Restore selected repository from localStorage on mount
  useEffect(() => {
    const savedRepository = localStorage.getItem('selectedRepository');
    if (savedRepository) {
      try {
        const parsed = JSON.parse(savedRepository);
        setSelectedRepository(parsed);
        setMode('dev');
      } catch (err) {
        console.error('Failed to parse saved repository:', err);
        localStorage.removeItem('selectedRepository');
      }
    }
  }, []);

  // Save selected repository to localStorage whenever it changes
  useEffect(() => {
    if (selectedRepository) {
      localStorage.setItem('selectedRepository', JSON.stringify(selectedRepository));
    } else {
      localStorage.removeItem('selectedRepository');
    }
  }, [selectedRepository]);

  // Save mode to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('promptMode', mode);
  }, [mode]);

  // Restore pending prompt and actions after login
  useEffect(() => {
    if (isAuthenticated && user?.id) {
      const pendingPrompt = sessionStorage.getItem('pendingPrompt');
      const pendingProvider = sessionStorage.getItem('pendingProvider') as 'openai' | 'claude' | 'gemini' | null;
      const pendingModel = sessionStorage.getItem('pendingModel');
      const pendingDownload = sessionStorage.getItem('pendingDownload');

      if (pendingPrompt) {
        setPrompt(pendingPrompt);
      }

      // Restore selected provider (AI plan) if available
      if (pendingProvider && pendingProvider !== selectedProvider) {
        const assistantKey = normalizeCli(pendingProvider);
        handleModelSelect(assistantKey);
      }

      // Restore selected model if available (after provider is set)
      if (pendingModel && pendingModel !== selectedModel) {
        setSelectedModel(pendingModel);
      }

      // If there was a pending download, trigger it
      if (pendingDownload) {
        handleDownload(pendingDownload, user.id);
      }

      // Clear all saved data
      sessionStorage.removeItem('pendingPrompt');
      sessionStorage.removeItem('pendingProvider');
      sessionStorage.removeItem('pendingModel');
      sessionStorage.removeItem('pendingDownload');
    }
  }, [isAuthenticated, user?.id]);

  // Close projects sidebar on Escape key
  useEffect(() => {
    if (!projectsSidebarOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setProjectsSidebarOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [projectsSidebarOpen]);

  // Close dropdowns on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.provider-dropdown')) {
        setProviderDropdownOpen(false);
      }
      if (!target.closest('.model-dropdown')) {
        setModelDropdownOpen(false);
      }
      if (!target.closest('.profile-dropdown')) {
        setProfileDropdownOpen(false);
      }
      if (!target.closest('.project-menu') && projectMenuOpen) {
        setProjectMenuOpen(null);
      }
    };

    if (
      providerDropdownOpen ||
      modelDropdownOpen ||
      profileDropdownOpen ||
      projectMenuOpen
    ) {
      document.addEventListener('click', handleClickOutside);
    }

    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [
    providerDropdownOpen,
    modelDropdownOpen,
    profileDropdownOpen,
    projectMenuOpen,
    setProviderDropdownOpen,
    setModelDropdownOpen,
  ]);

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    // Check current image count and limit to 5
    const remainingSlots = 5 - uploadedImages.length;
    if (remainingSlots <= 0) {
      alert('Maximum 5 images allowed');
      event.target.value = '';
      return;
    }

    // Only take as many files as we have slots for
    const filesToUpload = Array.from(files).slice(0, remainingSlots);

    const newImages: UploadedImage[] = filesToUpload.map((file) => ({
      file,
      uploading: true,
    }));

    setUploadedImages((prev) => [...prev, ...newImages]);

    // Upload each image immediately
    for (let i = 0; i < newImages.length; i++) {
      const image = newImages[i];
      const imageIndex = uploadedImages.length + i;

      await Sentry.startSpan(
        {
          op: 'http.client',
          name: 'POST /api/images/upload',
          attributes: {
            'http.method': 'POST',
            'http.url': '/api/images/upload',
            fileSize: image.file.size,
            fileType: image.file.type,
          },
        },
        async () => {
          try {
            const result = await apiClient.uploadImage(image.file);

            setUploadedImages((prev) =>
              prev.map((img, idx) =>
                idx === imageIndex
                  ? { ...img, metadata: result, uploading: false }
                  : img
              )
            );
          } catch (error) {
            console.error('Failed to upload image:', error);
            Sentry.captureException(error, {
              contexts: {
                image_upload: {
                  fileSize: image.file.size,
                  fileType: image.file.type,
                  fileName: image.file.name,
                },
              },
            });
            setUploadedImages((prev) =>
              prev.map((img, idx) =>
                idx === imageIndex
                  ? { ...img, uploading: false, error: 'Upload failed' }
                  : img
              )
            );
          }
        },
      );
    }

    // Reset input
    event.target.value = '';
  };

  const handleImagePaste = async (files: File[]) => {
    if (!files || files.length === 0) return;

    // Check current image count and limit to 5
    const remainingSlots = 5 - uploadedImages.length;
    if (remainingSlots <= 0) {
      alert('Maximum 5 images allowed');
      return;
    }

    // Only take as many files as we have slots for
    const filesToUpload = files.slice(0, remainingSlots);

    const newImages: UploadedImage[] = filesToUpload.map((file) => ({
      file,
      uploading: true,
    }));

    setUploadedImages((prev) => [...prev, ...newImages]);

    // Upload each image immediately
    for (let i = 0; i < newImages.length; i++) {
      const image = newImages[i];
      const imageIndex = uploadedImages.length + i;

      await Sentry.startSpan(
        {
          op: 'http.client',
          name: 'POST /api/images/upload',
          attributes: {
            'http.method': 'POST',
            'http.url': '/api/images/upload',
            fileSize: image.file.size,
            fileType: image.file.type,
            uploadMethod: 'paste',
          },
        },
        async () => {
          try {
            const result = await apiClient.uploadImage(image.file);

            setUploadedImages((prev) =>
              prev.map((img, idx) =>
                idx === imageIndex
                  ? { ...img, metadata: result, uploading: false }
                  : img
              )
            );
          } catch (error) {
            console.error('Failed to upload image:', error);
            Sentry.captureException(error, {
              contexts: {
                image_upload: {
                  fileSize: image.file.size,
                  fileType: image.file.type,
                  fileName: image.file.name,
                  uploadMethod: 'paste',
                },
              },
            });
            setUploadedImages((prev) =>
              prev.map((img, idx) =>
                idx === imageIndex
                  ? { ...img, uploading: false, error: 'Upload failed' }
                  : img
              )
            );
          }
        },
      );
    }
  };

  const handleRemoveImage = (index: number) => {
    setUploadedImages((prev) => prev.filter((_, i) => i !== index));
  };

  const hasPendingUploads = uploadedImages.some((img) => img.uploading);
  const isBusy = isLoading || hasPendingUploads;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!prompt.trim()) {
      return;
    }

    // Prevent duplicate submissions
    if (isLoading) {
      return;
    }

    if (hasPendingUploads) {
      return;
    }

    if (!isAuthenticated) {
      // Save prompt and selected options before redirecting to login
      sessionStorage.setItem('pendingPrompt', prompt);
      sessionStorage.setItem('pendingProvider', selectedProvider);
      sessionStorage.setItem('pendingModel', selectedModel);
      router.push('/login');
      return;
    }

    // Use already fetched AI connections state instead of fetching again
    const hasActiveProvider =
      aiConnections.openai ||
      aiConnections.claude ||
      aiConnections.gemini;

    if (!hasActiveProvider) {
      openMandatoryConnectionModal();
      return;
    }

    // Check if the selected provider is connected
    const currentProviderConnected = aiConnections[selectedProvider];

    if (!currentProviderConnected) {
      setShowProviderConnectionModal(true);
      return;
    }

    // Set loading state immediately and close dropdowns
    setIsLoading(true);
    setProviderDropdownOpen(false);
    setModelDropdownOpen(false);

    perfStart('home.handleSubmit.total');
    let submitSuccess = false;

    await Sentry.startSpan(
      {
        op: 'ui.action.project_create',
        name: 'Create Project',
        attributes: {
          provider: selectedProvider,
          model: selectedModel,
          promptLength: prompt.length,
          imageCount: uploadedImages.filter((img) => img.metadata).length,
        },
      },
      async () => {
        try {
          const assistantKey = normalizeCli(selectedProvider);
          const resolvedModel = resolveApiModel(assistantKey, selectedModel);

          const images = uploadedImages
            .filter((img) => img.metadata)
            .map((img) => img.metadata!);

          let project;
          const isDevMode = mode === 'dev';
          const repository = selectedRepository;
          const projectName = (repository?.name || prompt || 'New Project').slice(0, 50);
          const description = repository?.description || prompt;

          const basePayload = {
            name: projectName,
            description,
            initialPrompt: prompt,
            preset: 'react',
            cli: assistantKey,
            model: resolvedModel,
            projectType: 'base' as const,
            images: images.length > 0 ? images : undefined,
          };

          const devPayload = {
            name: projectName,
            description,
            initialPrompt: prompt,
            preset: 'react',
            cli: assistantKey,
            model: resolvedModel,
            projectType: 'dev' as const,
            githubRepoUrl: repository?.url,
            branch: repository?.branch,
            githubInstallationId: repository?.githubInstallationId,
            images: images.length > 0 ? images : undefined,
          };

          const payload = isDevMode ? devPayload : basePayload;

          project = await Sentry.startSpan(
            {
              op: 'http.client',
              name: 'POST /api/projects',
              attributes: {
                'http.method': 'POST',
                'http.url': '/api/projects',
                cli: assistantKey,
                projectType: payload.projectType,
              },
            },
            async () => {
              return await perfMeasure(
                isDevMode ? 'home.api.createProject.dev' : 'home.api.createProject.base',
                () => apiClient.createProject(payload),
                {
                  cli: assistantKey,
                  projectType: payload.projectType,
                },
              );
            },
          );

          if (isDevMode && repository) {
            setSelectedRepository(null);
          }

          refetchProjects?.().catch((err) =>
            console.error('Failed to refresh projects:', err)
          );

          setUploadedImages([]);

          submitSuccess = true;
          perfEnd('home.handleSubmit.total', { success: submitSuccess });

          trackProjectCreated(assistantKey);

          const query = new URLSearchParams();
          query.set('prompt', prompt);
          query.set('cli', assistantKey);
          if (resolvedModel) {
            query.set('model', resolvedModel);
          }
          router.push(`/build/${project.id}?${query.toString()}`);
        } catch (error) {
          console.error('Error creating project:', error);
          Sentry.captureException(error, {
            contexts: {
              project_creation: {
                provider: selectedProvider,
                model: selectedModel,
                promptLength: prompt.length,
                imageCount: uploadedImages.filter((img) => img.metadata).length,
              },
            },
          });
          setIsLoading(false);
          perfEnd('home.handleSubmit.total', { success: submitSuccess });
        }
      },
    );
  };

  const handleOpenProjects = () => {
    if (!isAuthenticated) {
      // Save current state before redirecting
      if (prompt.trim()) {
        sessionStorage.setItem('pendingPrompt', prompt);
        sessionStorage.setItem('pendingProvider', selectedProvider);
        sessionStorage.setItem('pendingModel', selectedModel);
      }
      router.push('/login');
      return;
    }
    setProjectsSidebarOpen((prev) => !prev);
  };

  const closeProjectsSidebar = () => {
    setProjectsSidebarOpen(false);
  };

  const handleTokenModalSuccess = () => {
    if (user?.id) {
      fetchAiConnections(user.id);
    }
  };

  const handleDownloadWrapper = async (platform: string) => {
    if (!isAuthenticated) {
      // Save current state before redirecting
      if (prompt.trim()) {
        sessionStorage.setItem('pendingPrompt', prompt);
        sessionStorage.setItem('pendingProvider', selectedProvider);
        sessionStorage.setItem('pendingModel', selectedModel);
      }
      // Also save the intended download platform
      sessionStorage.setItem('pendingDownload', platform);
      router.push('/login');
      return;
    }
    await handleDownload(platform, user?.id);
  };

  const handleRenameProject = (projectId: string, currentName: string) => {
    setEditingProjectId(projectId);
    setEditingProjectName(currentName);
    setProjectMenuOpen(null);
  };

  const handleSaveRename = async (projectId: string) => {
    if (!editingProjectName.trim()) {
      return;
    }

    try {
      await apiClient.updateProject(projectId, { name: editingProjectName.trim() });
      await refetchProjects?.();
      setEditingProjectId(null);
      setEditingProjectName('');
    } catch (error) {
      console.error('Failed to rename project:', error);
      alert('Failed to rename project. Please try again.');
    }
  };

  const handleCancelEdit = () => {
    setEditingProjectId(null);
    setEditingProjectName('');
  };

  const handleDeleteProject = (projectId: string) => {
    setDeleteConfirmProjectId(projectId);
    setProjectMenuOpen(null);
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmProjectId) return;

    setDeletingProjectId(deleteConfirmProjectId);
    try {
      await apiClient.deleteProject(deleteConfirmProjectId);
      await refetchProjects?.();
      setDeleteConfirmProjectId(null);
    } catch (error) {
      console.error('Failed to delete project:', error);
      alert('Failed to delete project. Please try again.');
    } finally {
      setDeletingProjectId(null);
    }
  };

  const handleCancelDelete = () => {
    setDeleteConfirmProjectId(null);
  };

  const handleManualSetup = () => {
    setShowManualSetupModal(true);
  };

  const handleManualSetupSuccess = () => {
    if (user?.id) {
      fetchAiConnections(user.id);
    }
  };

  return (
    <div className="min-h-screen relative overscroll-none bg-black">
      {/* Structured Data for Web Application */}
      <JsonLd data={webApplicationSchema} />

      <AnimatePresence>
        {projectsSidebarOpen && (
          <>
            <motion.div
              key="projects-overlay"
              className="fixed inset-0 bg-black/10 z-[59]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              onClick={closeProjectsSidebar}
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
                    <h2 className="text-lg font-bold text-white">
                      Projects
                    </h2>
                    <p className="text-xs text-white">
                      Quick access to your recent work
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={closeProjectsSidebar}
                    className="rounded-full p-2 text-white transition-all"
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
                  <div className="flex items-center gap-3 text-sm text-white">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Loading your projects…</span>
                  </div>
                ) : projectsError ? (
                  <div
                    className="rounded-xl px-4 py-3 text-sm text-red-200 border"
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
                      borderColor:
                        'color-mix(in srgb, #fca5a5 30%, transparent)',
                    }}
                  >
                    Failed to load projects. {projectsError}
                  </div>
                ) : projects.length === 0 ? (
                  <div className="rounded-xl px-4 py-6 text-sm text-white border border-dashed border-white">
                    You haven't created any projects yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {projects.map((project, index) => {
                      const isEditing = editingProjectId === project.id;
                      const isDeleting = deletingProjectId === project.id;
                      const menuOpen = projectMenuOpen === project.id;

                      return (
                        <motion.div
                          key={project.id}
                          initial={{ opacity: 0, x: -20, scale: 0.95 }}
                          animate={{ opacity: 1, x: 0, scale: 1 }}
                          transition={{
                            duration: 0.4,
                            delay: index * 0.05,
                            ease: [0.4, 0, 0.2, 1],
                          }}
                          whileTap={!isEditing ? {
                            scale: 0.98,
                            transition: {
                              type: 'spring',
                              stiffness: 400,
                              damping: 20,
                            },
                          } : undefined}
                          className={`relative ${menuOpen ? 'z-[100]' : ''}`}
                        >
                          <div className="block liquid-card rounded-xl px-4 py-3 border group">
                            {/* More menu button */}
                            <div className="absolute top-2 right-2 z-10 project-menu">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  if (menuOpen) {
                                    setProjectMenuOpen(null);
                                    setMenuPosition(null);
                                  } else {
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    setProjectMenuOpen(project.id);
                                    setMenuPosition({
                                      top: rect.top,
                                      left: rect.right + 4,
                                    });
                                  }
                                }}
                                className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                                disabled={isDeleting}
                              >
                                <MoreVertical className="w-4 h-4" />
                              </button>
                            </div>

                            {/* Project content */}
                            {isEditing ? (
                              <div
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                }}
                              >
                                <div className="flex items-center gap-2 pr-8">
                                  <input
                                    type="text"
                                    value={editingProjectName}
                                    onChange={(e) => setEditingProjectName(e.target.value)}
                                    onClick={(e) => e.stopPropagation()}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        handleSaveRename(project.id);
                                      } else if (e.key === 'Escape') {
                                        handleCancelEdit();
                                      }
                                    }}
                                    className="flex-1 px-2 py-1 text-sm font-semibold bg-white/10 border border-white/20 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    autoFocus
                                  />
                                </div>
                                <div className="mt-2 flex items-center gap-2">
                                  <button
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      handleSaveRename(project.id);
                                    }}
                                    className="px-2 py-1 text-xs bg-white/20 hover:bg-white/30 text-white rounded flex items-center gap-1 transition-colors"
                                  >
                                    <Check className="w-3 h-3" />
                                    Save
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      handleCancelEdit();
                                    }}
                                    className="px-2 py-1 text-xs bg-white/10 hover:bg-white/20 text-white rounded flex items-center gap-1 transition-colors"
                                  >
                                    <X className="w-3 h-3" />
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <Link
                                href={`/build/${project.id}`}
                                onClick={(e) => {
                                  if (menuOpen || isDeleting) {
                                    e.preventDefault();
                                    return;
                                  }
                                  closeProjectsSidebar();
                                }}
                                className="block"
                              >
                                <p className="text-sm font-semibold text-white truncate transition-colors duration-400 pr-8">
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
                                          <p className="text-xs text-white font-medium">
                                            {project.cli === 'codex' ? 'ChatGPT' : project.cli === 'claude' ? 'Claude' : project.cli === 'gemini' ? 'Gemini' : project.cli === 'glm' ? 'Z.ai' : project.cli}
                                          </p>
                                        </>
                                      )}
                                    </div>
                                    {project.model && project.cli && (
                                      <p className="text-xs text-white truncate transition-colors duration-400">
                                        {ASSISTANT_OPTIONS[project.cli as keyof typeof ASSISTANT_OPTIONS]?.models.find((m) => m.value === project.model || m.apiValue === project.model)?.label || project.model}
                                      </p>
                                    )}
                                  </div>
                                )}
                                <ClientTimestamp
                                  lastModified={project.lastModified}
                                  className="mt-2 text-xs font-medium text-white transition-colors duration-400"
                                />
                              </Link>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Project Dropdown Menu */}
      {projectMenuOpen && menuPosition && (
        <div
          className="project-menu fixed rounded-md shadow-lg border py-0.5 min-w-[100px] z-[9999]"
          style={{
            top: `${menuPosition.top}px`,
            left: `${menuPosition.left}px`,
            backgroundColor: 'color-mix(in srgb, #1a1a1a 70%, transparent)',
            backdropFilter: 'blur(8px) saturate(150%)',
            WebkitBackdropFilter: 'blur(8px) saturate(150%)',
            borderColor: 'color-mix(in srgb, #fff 10%, transparent)',
          }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const project = projects.find(p => p.id === projectMenuOpen);
              if (project) {
                handleRenameProject(project.id, project.name);
              }
            }}
            className="w-full px-2.5 py-1.5 text-left text-xs text-white hover:bg-white/10 transition-colors flex items-center gap-1.5"
          >
            <Pencil className="w-3 h-3" />
            Rename
          </button>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleDeleteProject(projectMenuOpen);
            }}
            className="w-full px-2.5 py-1.5 text-left text-xs text-red-400 hover:bg-white/10 transition-colors flex items-center gap-1.5"
            disabled={deletingProjectId === projectMenuOpen}
          >
            <Trash2 className="w-3 h-3" />
            {deletingProjectId === projectMenuOpen ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      )}

      {/* Header */}
      <LandingHeader
        isAuthenticated={isAuthenticated}
        user={user}
        starCount={starCount}
        profileDropdownOpen={profileDropdownOpen}
        setProfileDropdownOpen={setProfileDropdownOpen}
        handleLogout={handleLogout}
        handleOpenProjects={handleOpenProjects}
      />

      {/* Main Content */}
      <main className="relative z-10">
        {/* Hero Section */}
        <HeroSection
          prompt={prompt}
          setPrompt={setPrompt}
          isLoading={isBusy}
          selectedAssistant={selectedAssistant}
          selectedModel={selectedModel}
          setSelectedModel={setSelectedModel}
          modelDropdownOpen={modelDropdownOpen}
          setModelDropdownOpen={setModelDropdownOpen}
          setProviderDropdownOpen={setProviderDropdownOpen}
          handleModelSelect={handleModelSelect}
          handleSubmit={handleSubmit}
          uploadedImages={uploadedImages}
          onImageUpload={handleImageUpload}
          onRemoveImage={handleRemoveImage}
          onImagePaste={handleImagePaste}
          selectedRepository={selectedRepository}
          setSelectedRepository={setSelectedRepository}
          mode={mode}
          setMode={setMode}
        />

        {/* AI Connections & Download Section */}
        <AIServicesSection
          isAuthenticated={isAuthenticated}
          aiConnections={aiConnections}
          detectedOS={detectedOS}
          downloadingPlatform={downloadingPlatform}
          handleDownload={handleDownloadWrapper}
          onManualSetup={handleManualSetup}
        />

        {/* How It Works Section */}
        <HowItWorksSection />

        {/* 3-Step Process Section */}
        <ThreeStepProcessSection />

        {/* FAQ Section */}
        <FAQSection />

        {/* Final CTA Section */}
        <FinalCTASection
          detectedOS={detectedOS}
          downloadingPlatform={downloadingPlatform}
          handleDownload={handleDownloadWrapper}
        />
      </main>

      {/* Footer */}
      <Footer />

      {/* Mandatory AI Connection Modal */}
      <MandatoryAIConnectionModal
        isOpen={showMandatoryConnectionModal}
        onClose={closeMandatoryConnectionModal}
        onManualTokenAdd={() => {
          closeMandatoryConnectionModal();
          setShowManualSetupModal(true);
        }}
      />

      {/* Provider Connection Modal */}
      <ProviderConnectionModal
        isOpen={showProviderConnectionModal}
        onClose={() => setShowProviderConnectionModal(false)}
        selectedProvider={selectedProvider}
        onSetupManually={(provider) => {
          // Map 'openai' to 'codex' for ManualSetupModal
          const mappedProvider = provider === 'openai' ? 'codex' : provider;
          setManualSetupInitialProvider(mappedProvider);
          setShowManualSetupModal(true);
        }}
      />

      {/* Manual Setup Modal */}
      <ManualSetupModal
        isOpen={showManualSetupModal}
        onClose={() => setShowManualSetupModal(false)}
        onSuccess={handleManualSetupSuccess}
        initialProvider={manualSetupInitialProvider}
      />

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirmProjectId && (
          <>
            <motion.div
              key="delete-overlay"
              className="fixed inset-0 bg-black/50 z-[100]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleCancelDelete}
            />
            <motion.div
              key="delete-modal-wrapper"
              className="fixed inset-0 z-[101] flex items-center justify-center p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleCancelDelete}
            >
              <motion.div
                className="w-full max-w-md"
                initial={{ scale: 0.95 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.95 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div
                  className="rounded-xl p-6 border"
                  style={{
                    backgroundColor: 'color-mix(in srgb, #bbbbbc 15%, transparent)',
                    backdropFilter: 'blur(16px) saturate(150%)',
                    WebkitBackdropFilter: 'blur(16px) saturate(150%)',
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
                  <h2 className="text-xl font-bold text-white mb-2">
                    Delete Project
                  </h2>
                  <p className="text-sm text-white/80 mb-6">
                    Are you sure you want to delete this project? This action cannot be undone.
                  </p>
                  <div className="flex items-center gap-3 justify-end">
                    <button
                      onClick={handleCancelDelete}
                      className="px-4 py-2 text-sm text-white rounded-lg hover:bg-white/10 transition-colors"
                      disabled={deletingProjectId === deleteConfirmProjectId}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleConfirmDelete}
                      className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={deletingProjectId === deleteConfirmProjectId}
                    >
                      {deletingProjectId === deleteConfirmProjectId ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
