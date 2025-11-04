'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { X, Upload } from 'lucide-react';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import { apiClient } from '@/lib/api-client';

interface WebsiteInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectName?: string;
}

const MAX_DESCRIPTION_LENGTH = 150;

export function WebsiteInfoModal({
  isOpen,
  onClose,
  projectId,
  projectName = '',
}: WebsiteInfoModalProps) {
  const [websiteTitle, setWebsiteTitle] = useState('');
  const [websiteDescription, setWebsiteDescription] = useState('');
  const [favicon, setFavicon] = useState<File | null>(null);
  const [faviconPreview, setFaviconPreview] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<File | null>(null);
  const [previewImagePreview, setPreviewImagePreview] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !projectId) return;

    const loadProjectData = async () => {
      try {
        const project = await apiClient.getProject(projectId);

        // Set with defaults
        setWebsiteTitle(project.websiteTitle || project.name || '');
        setWebsiteDescription(project.websiteDescription || 'Bring your subscription - Build with World\'s Best AI Agents');

        // Handle favicon:
        // - null or undefined: use default image
        // - "none": no image (show upload UI)
        // - URL: use custom image
        if (!project.faviconUrl) {
          setFaviconPreview('/assets/clink/clink_favicon.ico');
        } else if (project.faviconUrl === 'none') {
          setFaviconPreview(null);
        } else {
          setFaviconPreview(project.faviconUrl);
        }

        // Handle preview image:
        // - null or undefined: use default image
        // - "none": no image (show upload UI)
        // - URL: use custom image
        if (!project.previewImageUrl) {
          setPreviewImagePreview('/assets/clink/clink_preview.jpg');
        } else if (project.previewImageUrl === 'none') {
          setPreviewImagePreview(null);
        } else {
          setPreviewImagePreview(project.previewImageUrl);
        }
      } catch (err) {
        console.error('Failed to load project data:', err);
      }
    };

    void loadProjectData();
  }, [isOpen, projectId, projectName]);

  const handleFaviconChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check if file is .ico
    if (!file.name.toLowerCase().endsWith('.ico')) {
      setError('Favicon must be a .ico file');
      event.target.value = ''; // Reset input
      return;
    }

    setError(null);
    setFavicon(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setFaviconPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handlePreviewImageChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const maxSize = 5 * 1024 * 1024; // 5MB
    const targetSize = 1 * 1024 * 1024; // 1MB

    // Check if file is over 5MB
    if (file.size > maxSize) {
      setError('Image size must be less than 5MB');
      event.target.value = ''; // Reset input
      return;
    }

    setError(null);

    // If file is under 1MB, use it as is
    if (file.size <= targetSize) {
      setPreviewImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      return;
    }

    // File is between 1MB and 5MB, resize it
    try {
      const resizedFile = await resizeImage(file, targetSize);
      setPreviewImage(resizedFile);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewImagePreview(reader.result as string);
      };
      reader.readAsDataURL(resizedFile);
    } catch (err) {
      setError('Failed to resize image');
      event.target.value = ''; // Reset input
    }
  };

  const resizeImage = (file: File, targetSizeBytes: number): Promise<File> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new window.Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // Calculate new dimensions (maintain aspect ratio)
          // Start with 80% quality and adjust if needed
          let quality = 0.8;

          // Resize to max 1920x1080 if larger
          const maxWidth = 1920;
          const maxHeight = 1080;

          if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width = Math.floor(width * ratio);
            height = Math.floor(height * ratio);
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Failed to get canvas context'));
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);

          // Try to get under target size
          const tryCompress = (q: number) => {
            canvas.toBlob(
              (blob) => {
                if (!blob) {
                  reject(new Error('Failed to create blob'));
                  return;
                }

                // If still over target and quality can be reduced, try again
                if (blob.size > targetSizeBytes && q > 0.3) {
                  tryCompress(q - 0.1);
                } else {
                  const resizedFile = new File([blob], file.name, {
                    type: 'image/jpeg',
                    lastModified: Date.now(),
                  });
                  resolve(resizedFile);
                }
              },
              'image/jpeg',
              q
            );
          };

          tryCompress(quality);
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  };

  const removeFavicon = () => {
    setFavicon(null);
    setFaviconPreview(null);
  };

  const removePreviewImage = () => {
    setPreviewImage(null);
    setPreviewImagePreview(null);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    setSuccess(false);

    try {
      let faviconUrl = faviconPreview;
      let previewImageUrl = previewImagePreview;

      // Upload favicon to GCS if a new file was selected
      if (favicon) {
        const uploadedFavicon = await apiClient.uploadImage(favicon);
        faviconUrl = uploadedFavicon.url;
        setFaviconPreview(faviconUrl);
      }

      // Upload preview image to GCS if a new file was selected
      if (previewImage) {
        const uploadedPreview = await apiClient.uploadImage(previewImage);
        previewImageUrl = uploadedPreview.url;
        setPreviewImagePreview(previewImageUrl);
      }

      // Determine what to save:
      // - null: if it's the default path (use default image)
      // - "none": if user explicitly removed it (no image at all)
      // - URL: if user uploaded custom image
      let faviconToSave: string | null;
      if (!faviconUrl) {
        // User clicked X button to remove
        faviconToSave = 'none';
      } else if (faviconUrl === '/assets/clink/clink_favicon.ico') {
        // Default image, save as null
        faviconToSave = null;
      } else {
        // Custom image URL
        faviconToSave = faviconUrl;
      }

      let previewToSave: string | null;
      if (!previewImageUrl) {
        // User clicked X button to remove
        previewToSave = 'none';
      } else if (previewImageUrl === '/assets/clink/clink_preview.jpg') {
        // Default image, save as null
        previewToSave = null;
      } else {
        // Custom image URL
        previewToSave = previewImageUrl;
      }

      // Save website settings with the uploaded URLs
      await apiClient.request(`/api/projects/${projectId}/website-settings`, {
        method: 'PATCH',
        body: {
          websiteTitle,
          websiteDescription,
          faviconUrl: faviconToSave,
          previewImageUrl: previewToSave,
        },
      });

      // Clear the file objects since they're now uploaded
      setFavicon(null);
      setPreviewImage(null);

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message.replace(/^API Error:\s*/i, '')
          : 'Failed to save website settings';
      setError(message);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-primary rounded-3xl w-full max-w-md border border-primary shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-primary">
            <h2 className="text-lg font-semibold text-primary font-poppins">
              Website Info
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-interactive-hover rounded-lg transition-colors text-secondary"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="px-6 py-4 space-y-4 max-h-[70vh] overflow-y-auto scrollbar-hide">
            {/* Icon & title */}
            <div className="space-y-2">
              <label className="block font-poppins text-primary text-sm font-medium">
                Icon & title
              </label>
              <div className="flex items-center gap-3">
                {/* Favicon */}
                <div className="relative">
                  <input
                    id="favicon-input"
                    type="file"
                    accept=".ico"
                    onChange={handleFaviconChange}
                    className="hidden"
                  />
                  {faviconPreview ? (
                    <>
                      <label
                        htmlFor="favicon-input"
                        className="block w-10 h-10 rounded-md border border-primary bg-secondary flex items-center justify-center overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
                      >
                        <Image
                          src={faviconPreview}
                          alt="Favicon"
                          width={40}
                          height={40}
                          className="w-full h-full object-contain"
                          unoptimized
                        />
                      </label>
                      <button
                        onClick={removeFavicon}
                        className="absolute -top-1.5 -right-1.5 p-0.5 rounded-full bg-elevated border border-primary text-secondary hover:bg-interactive-hover transition-all shadow-sm"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </>
                  ) : (
                    <label
                      htmlFor="favicon-input"
                      className="w-10 h-10 rounded-md border border-primary bg-elevated hover:bg-interactive-hover cursor-pointer flex items-center justify-center transition-colors"
                    >
                      <Upload className="w-4 h-4 text-tertiary" />
                    </label>
                  )}
                </div>

                {/* Title Input */}
                <input
                  type="text"
                  value={websiteTitle}
                  onChange={(e) => setWebsiteTitle(e.target.value)}
                  placeholder="My First App"
                  className="flex-1 bg-elevated rounded-md border border-primary px-3 py-2 text-sm outline-none transition-all font-poppins text-primary"
                />
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <label className="block font-poppins text-primary text-sm font-medium">
                Description
              </label>
              <div className="relative">
                <textarea
                  value={websiteDescription}
                  onChange={(e) => {
                    if (e.target.value.length <= MAX_DESCRIPTION_LENGTH) {
                      setWebsiteDescription(e.target.value);
                    }
                  }}
                  placeholder="our first app"
                  rows={2}
                  maxLength={MAX_DESCRIPTION_LENGTH}
                  className="w-full bg-elevated rounded-md border border-primary px-3 py-2 text-sm outline-none transition-all font-poppins text-primary resize-none"
                />
                <div className="absolute bottom-2 right-3 text-xs text-tertiary">
                  {websiteDescription.length} / {MAX_DESCRIPTION_LENGTH}
                </div>
              </div>
            </div>

            {/* Share image */}
            <div className="space-y-2">
              <label className="block font-poppins text-primary text-sm font-medium">
                Share image
              </label>
              <input
                id="preview-image-input"
                type="file"
                accept="image/*"
                onChange={handlePreviewImageChange}
                className="hidden"
              />
              {previewImagePreview ? (
                <div className="relative w-full">
                  <label
                    htmlFor="preview-image-input"
                    className="block w-full aspect-video rounded-lg border border-primary bg-secondary flex items-center justify-center overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
                  >
                    <Image
                      src={previewImagePreview}
                      alt="Share image"
                      width={400}
                      height={225}
                      className="w-full h-full object-cover"
                      unoptimized
                    />
                  </label>
                  <button
                    onClick={removePreviewImage}
                    className="absolute top-2 right-2 p-1.5 rounded-full bg-elevated border border-primary text-secondary hover:bg-interactive-hover transition-all shadow-md backdrop-blur-sm"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <label
                  htmlFor="preview-image-input"
                  className="w-full aspect-video rounded-lg border-2 border-dashed border-primary bg-elevated hover:bg-interactive-hover cursor-pointer flex items-center justify-center transition-colors"
                >
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="w-8 h-8 text-tertiary" />
                    <span className="text-xs text-tertiary font-poppins">Click to upload</span>
                  </div>
                </label>
              )}
            </div>

            {/* Info message */}
            <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 px-3 py-2">
              <p className="text-xs text-blue-700 dark:text-blue-400 font-poppins">
                Changes will be reflected from the next publish onwards.
              </p>
            </div>

            {/* Success/Error Messages */}
            {success && (
              <p className="text-xs font-poppins" style={{ color: '#10b981' }}>
                ✓ Website settings saved successfully
              </p>
            )}
            {error && (
              <p className="text-xs font-poppins" style={{ color: '#ef4444' }}>
                ✗ {error}
              </p>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-primary">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium text-secondary hover:bg-interactive-hover transition-colors font-poppins"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-interactive-primary hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed font-poppins"
            >
              {isSaving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
