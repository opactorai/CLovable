'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { Upload, X, ChevronDown, ChevronUp } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { trackBuildSettingToggled } from '@/lib/analytics';

interface ProjectSettingsTabProps {
  projectId: string;
  projectName?: string;
  createdAt?: string | Date | null;
  onProjectUpdate?: () => void;
}

interface Project {
  id: string;
  name: string;
  isPublic: boolean;
  websiteTitle?: string;
  websiteDescription?: string;
  faviconUrl?: string;
  previewImageUrl?: string;
}

export default function ProjectSettingsTab({
  projectId,
  projectName,
  createdAt,
  onProjectUpdate,
}: ProjectSettingsTabProps) {
  const [newProjectName, setNewProjectName] = useState(projectName || '');
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);
  const [renameSuccess, setRenameSuccess] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);
  const [project, setProject] = useState<Project | null>(null);
  const [privacySuccess, setPrivacySuccess] = useState(false);

  // Website settings state
  const [isWebsiteInfoOpen, setIsWebsiteInfoOpen] = useState(false);
  const [websiteTitle, setWebsiteTitle] = useState('');
  const [websiteDescription, setWebsiteDescription] = useState('');
  const [favicon, setFavicon] = useState<File | null>(null);
  const [faviconPreview, setFaviconPreview] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<File | null>(null);
  const [previewImagePreview, setPreviewImagePreview] = useState<string | null>(null);
  const [websiteSuccess, setWebsiteSuccess] = useState(false);
  const [websiteError, setWebsiteError] = useState<string | null>(null);
  const [isSavingWebsite, setIsSavingWebsite] = useState(false);

  const MAX_DESCRIPTION_LENGTH = 150;

  useEffect(() => {
    setNewProjectName(projectName || '');
  }, [projectName]);

  useEffect(() => {
    void loadProject();
  }, [projectId]);

  const loadProject = async () => {
    try {
      const data = await apiClient.getProject(projectId);
      setProject(data);
      // Set isPrivate based on isPublic (inverted logic)
      setIsPrivate(!data.isPublic);

      // Load website metadata with fallbacks to project defaults
      setWebsiteTitle(data.websiteTitle || data.name || '');
      setWebsiteDescription(data.websiteDescription || 'Bring your subscription - Build with World\'s Best AI Agents');

      // Use default images if user hasn't set custom ones
      setFaviconPreview(data.faviconUrl || '/assets/clink/clink_favicon.ico');
      setPreviewImagePreview(data.previewImageUrl || '/assets/clink/clink_preview.jpg');
    } catch (err) {
      console.error('Failed to load project:', err);
    }
  };

  const formattedCreatedAt = useMemo(() => {
    if (!createdAt) {
      return 'Loading…';
    }
    const date = new Date(createdAt);
    if (Number.isNaN(date.getTime())) {
      return 'Unknown';
    }
    return date.toLocaleString();
  }, [createdAt]);

  const trimmedName = newProjectName.trim();
  const originalName = projectName?.trim() ?? '';
  const canSaveName =
    trimmedName.length > 0 && trimmedName !== originalName && !isRenaming;

  const handleSaveRename = async () => {
    if (!canSaveName) {
      return;
    }

    setIsRenaming(true);
    setRenameError(null);
    setRenameSuccess(false);

    try {
      await apiClient.request(`/api/projects/${projectId}`, {
        method: 'PATCH',
        body: { name: trimmedName },
      });
      onProjectUpdate?.();
      setRenameSuccess(true);
      // Hide success message after 3 seconds
      setTimeout(() => setRenameSuccess(false), 3000);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message.replace(/^API Error:\s*/i, '')
          : 'Failed to rename project';
      setRenameError(message);
    } finally {
      setIsRenaming(false);
    }
  };

  const handleResetRename = () => {
    setNewProjectName(projectName || '');
    setRenameError(null);
    setRenameSuccess(false);
  };

  const handleTogglePrivate = async () => {
    const newIsPrivateState = !isPrivate;
    setIsPrivate(newIsPrivateState);
    setPrivacySuccess(false);

    // Track setting toggle
    trackBuildSettingToggled('is_private', newIsPrivateState, false);

    // Update backend: isPrivate ON means isPublic = false
    const isPublic = !newIsPrivateState;

    try {
      await apiClient.updateProject(projectId, { isPublic });
      setPrivacySuccess(true);
      // Hide success message after 3 seconds
      setTimeout(() => setPrivacySuccess(false), 3000);
    } catch (err) {
      // Revert on error
      setIsPrivate(!newIsPrivateState);
      console.error('Failed to update privacy setting:', err);
    }
  };

  const handleFaviconChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setFavicon(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setFaviconPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePreviewImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setPreviewImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeFavicon = () => {
    setFavicon(null);
    setFaviconPreview('/assets/clink/clink_favicon.ico');
  };

  const removePreviewImage = () => {
    setPreviewImage(null);
    setPreviewImagePreview('/assets/clink/clink_preview.jpg');
  };

  const handleSaveWebsiteSettings = async () => {
    setIsSavingWebsite(true);
    setWebsiteError(null);
    setWebsiteSuccess(false);

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

      // Don't save default image paths to DB - keep them as null
      const faviconToSave = faviconUrl === '/assets/clink/clink_favicon.ico' ? null : faviconUrl;
      const previewToSave = previewImageUrl === '/assets/clink/clink_preview.jpg' ? null : previewImageUrl;

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

      setWebsiteSuccess(true);
      setTimeout(() => setWebsiteSuccess(false), 3000);

      // Reload project data to get updated metadata
      await loadProject();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message.replace(/^API Error:\s*/i, '')
          : 'Failed to save website settings';
      setWebsiteError(message);
    } finally {
      setIsSavingWebsite(false);
    }
  };

  return (
    <div className="space-y-8 max-w-2xl">
      {/* Project Name */}
      <div className="space-y-3">
        <div>
          <label
            className="block mb-2 font-poppins text-primary"
            style={{
              fontSize: '14px',
              fontWeight: '500',
            }}
          >
            Project name
          </label>
          <input
            type="text"
            value={newProjectName}
            onChange={(event) => setNewProjectName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                void handleSaveRename();
              }
            }}
            placeholder="Enter project name"
            className="w-full bg-secondary rounded-lg border border-primary px-3 py-2 text-sm outline-none transition-all font-poppins text-primary"
            disabled={isRenaming}
          />
        </div>
        {renameSuccess && (
          <p className="text-xs font-poppins" style={{ color: '#10b981' }}>
            ✓ Project name updated successfully
          </p>
        )}
        {renameError && (
          <p className="text-xs font-poppins" style={{ color: '#ef4444' }}>
            ✗ {renameError}
          </p>
        )}
        <p
          className="text-xs font-poppins text-tertiary"
        >
          This name appears across your workspace and on published surfaces.
        </p>
      </div>

      {/* Owner */}
      <div className="space-y-2">
        <label
          className="block font-poppins text-primary"
          style={{
            fontSize: '14px',
            fontWeight: '500',
          }}
        >
          Owner
        </label>
        <p
          className="font-poppins text-secondary"
          style={{
            fontSize: '14px',
          }}
        >
          {/* TODO: Add owner info */}
          You
        </p>
      </div>

      {/* Created at */}
      <div className="space-y-2">
        <label
          className="block font-poppins text-primary"
          style={{
            fontSize: '14px',
            fontWeight: '500',
          }}
        >
          Created at
        </label>
        <p
          className="font-poppins text-secondary"
          style={{
            fontSize: '14px',
          }}
        >
          {formattedCreatedAt}
        </p>
      </div>

      {/* Private Project Section */}
      <div className="pt-4 border-t border-primary">
        <div className="flex items-center justify-between">
          <div>
            <h4
              className="font-poppins mb-1 text-primary"
              style={{
                fontSize: '14px',
                fontWeight: '500',
              }}
            >
              Private Project
            </h4>
            <p
              className="text-xs font-poppins text-tertiary"
            >
              Make your project private and prevent others from remixing it
            </p>
          </div>
          <button
            onClick={handleTogglePrivate}
            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
              isPrivate ? 'bg-interactive-primary' : 'bg-gray-300 dark:bg-elevated'
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full shadow-sm transition-transform ${
                isPrivate ? 'translate-x-6 bg-white dark:bg-secondary' : 'translate-x-1 bg-white dark:bg-gray-300'
              }`}
            />
          </button>
        </div>
        {privacySuccess && (
          <p className="text-xs font-poppins mt-2" style={{ color: '#10b981' }}>
            ✓ Privacy setting updated successfully
          </p>
        )}
      </div>

      {/* Rename Button Section */}
      <div className="pt-4 border-t border-primary">
        <div className="flex items-center justify-between">
          <div>
            <h4
              className="font-poppins mb-1 text-primary"
              style={{
                fontSize: '14px',
                fontWeight: '500',
              }}
            >
              Rename Project
            </h4>
            <p
              className="text-xs font-poppins text-tertiary"
            >
              Change your project name
            </p>
          </div>
          <button
            onClick={() => void handleSaveRename()}
            disabled={!canSaveName}
            className="px-4 py-2 rounded-lg disabled:cursor-not-allowed disabled:opacity-30 transition-all font-poppins bg-interactive-primary text-white dark:text-gray-200"
            style={{
              fontSize: '14px',
              fontWeight: '500',
            }}
          >
            {isRenaming ? 'Saving…' : 'Rename'}
          </button>
        </div>
      </div>

      {/* Website Info Section */}
      <div className="pt-4 border-t border-primary">
        <button
          onClick={() => setIsWebsiteInfoOpen(!isWebsiteInfoOpen)}
          className="w-full flex items-center justify-between py-2 group"
        >
          <h4
            className="font-poppins text-primary"
            style={{
              fontSize: '14px',
              fontWeight: '500',
            }}
          >
            Website Info
          </h4>
          {isWebsiteInfoOpen ? (
            <ChevronUp className="w-4 h-4 text-secondary" />
          ) : (
            <ChevronDown className="w-4 h-4 text-secondary" />
          )}
        </button>

        {isWebsiteInfoOpen && (
          <div className="mt-4 space-y-4">
            {/* Icon & title */}
            <div className="space-y-2">
              <label
                className="block font-poppins text-primary text-sm"
              >
                Icon & title
              </label>
              <div className="flex items-center gap-3">
                {/* Favicon */}
                {faviconPreview ? (
                  <div className="relative">
                    <div className="w-10 h-10 rounded-md border border-primary bg-secondary flex items-center justify-center overflow-hidden">
                      <Image
                        src={faviconPreview}
                        alt="Favicon"
                        width={40}
                        height={40}
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <button
                      onClick={removeFavicon}
                      className="absolute -top-1.5 -right-1.5 p-0.5 rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <label className="w-10 h-10 rounded-md border border-primary bg-elevated hover:bg-interactive-hover cursor-pointer flex items-center justify-center transition-colors">
                    <Upload className="w-4 h-4 text-tertiary" />
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFaviconChange}
                      className="hidden"
                    />
                  </label>
                )}

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
              <label
                className="block font-poppins text-primary text-sm"
              >
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
              <label
                className="block font-poppins text-primary text-sm"
              >
                Share image
              </label>
              {previewImagePreview ? (
                <div className="relative w-full">
                  <div className="w-full aspect-video rounded-lg border border-primary bg-secondary flex items-center justify-center overflow-hidden">
                    <Image
                      src={previewImagePreview}
                      alt="Share image"
                      width={400}
                      height={225}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <button
                    onClick={removePreviewImage}
                    className="absolute top-2 right-2 p-1.5 rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <label className="w-full aspect-video rounded-lg border-2 border-dashed border-primary bg-elevated hover:bg-interactive-hover cursor-pointer flex items-center justify-center transition-colors">
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="w-8 h-8 text-tertiary" />
                    <span className="text-xs text-tertiary font-poppins">Click to upload</span>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePreviewImageChange}
                    className="hidden"
                  />
                </label>
              )}
            </div>

            {/* Success/Error Messages */}
            {websiteSuccess && (
              <p className="text-xs font-poppins" style={{ color: '#10b981' }}>
                ✓ Website settings updated successfully
              </p>
            )}
            {websiteError && (
              <p className="text-xs font-poppins" style={{ color: '#ef4444' }}>
                ✗ {websiteError}
              </p>
            )}

            {/* Save Button */}
            <div className="flex justify-end pt-2">
              <button
                onClick={() => void handleSaveWebsiteSettings()}
                disabled={isSavingWebsite}
                className="px-4 py-2 rounded-lg disabled:cursor-not-allowed disabled:opacity-30 transition-all font-poppins bg-interactive-primary text-white dark:text-gray-200"
                style={{
                  fontSize: '14px',
                  fontWeight: '500',
                }}
              >
                {isSavingWebsite ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
