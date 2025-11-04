'use client';

import { useState, useEffect } from 'react';
import { PiUser } from 'react-icons/pi';
import type { UserProfile } from '@/types/user';
import {
  normalizeUserProfile,
  parseStoredUserProfile,
} from '../../../utils/user-profile';
import apiClient from '@/lib/api-client';
import { useRouter } from 'next/navigation';

export default function ProfileTab() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [showFinalModal, setShowFinalModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
  });

  useEffect(() => {
    fetchUserProfile();
  }, []);

  const fetchUserProfile = async () => {
    try {
      // Get from localStorage
      const parsedUser = parseStoredUserProfile(localStorage.getItem('user'));
      if (parsedUser) {
        setUser(parsedUser);
        setFormData({
          name: parsedUser?.name || '',
        });
      }
    } catch (error) {
      console.error('Failed to load user profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async () => {
    setSaving(true);
    try {
      // Update the user object with new data
      if (!user) {
        return;
      }

      const updatedUser = normalizeUserProfile({
        ...user,
        name: formData.name,
      });

      // Update localStorage
      localStorage.setItem('user', JSON.stringify(updatedUser));

      // Update state
      setUser(updatedUser);
      setEditing(false);

      // Dispatch custom event to update other components
      window.dispatchEvent(new CustomEvent('userProfileUpdated', {
        detail: updatedUser
      }));

      // TODO: When backend endpoint is ready, call API here
      // await apiClient.request('/api/auth/me', {
      //   method: 'PATCH',
      //   body: formData,
      // });
    } catch (error) {
      console.error('Failed to update profile:', error);
      alert('Failed to update profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditing(false);
    setFormData({
      name: user?.name || '',
    });
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') {
      return;
    }

    setShowFinalModal(true);
  };

  const confirmFinalDelete = async () => {
    setDeleting(true);
    try {
      await apiClient.request('/api/users/me/delete-account', {
        method: 'POST',
      });

      // Clear local storage
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('refreshToken');

      // Redirect to login
      router.push('/login?message=Account deleted successfully');
    } catch (error) {
      console.error('Failed to delete account:', error);
      alert('Failed to delete account. Please try again.');
      setDeleting(false);
      setShowFinalModal(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      {/* Profile Header - Cleaner */}
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="relative group">
            {user?.avatar ? (
              <img
                src={user.avatar}
                alt={user.name || 'User avatar'}
                className="w-16 h-16 rounded-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  const fallback = e.currentTarget.nextElementSibling;
                  if (fallback) {
                    (fallback as HTMLElement).style.display = 'flex';
                  }
                }}
              />
            ) : null}
            <div
              className="w-16 h-16 rounded-full bg-gradient-to-br from-gray-700 to-gray-900 dark:from-gray-600 dark:to-gray-800 flex items-center justify-center text-white text-xl font-semibold"
              style={{ display: user?.avatar ? 'none' : 'flex' }}
            >
              {(user?.name || user?.email || 'U')[0].toUpperCase()}
            </div>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-primary font-poppins">
              {user?.name || user?.email?.split('@')[0] || 'User'}
            </h2>
            <p className="text-sm text-secondary mt-0.5 font-poppins">{user?.email}</p>
          </div>
        </div>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="px-4 py-2 text-sm text-secondary hover:text-primary border border-primary rounded-lg hover:bg-interactive-hover transition-colors font-poppins font-medium"
          >
            Edit
          </button>
        )}
      </div>

      {/* Profile Information - Grid Layout */}
      <div className="space-y-6 bg-secondary/30 rounded-xl p-6 border border-primary/50">
        {/* Name */}
        <div>
          <label className="text-xs font-medium text-tertiary uppercase tracking-wider mb-2 block font-poppins">
            Name
          </label>
          {editing ? (
            <input
              type="text"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              className="w-full px-4 py-2.5 border border-primary rounded-lg focus:outline-none focus:border-primary bg-primary text-primary font-poppins"
              placeholder="Enter your name"
              autoFocus
            />
          ) : (
            <p className="text-primary font-poppins font-medium">
              {user?.name || 'Not set'}
            </p>
          )}
        </div>

        {/* Email */}
        <div>
          <label className="text-xs font-medium text-tertiary uppercase tracking-wider mb-2 block font-poppins">
            Email
          </label>
          <p className="text-primary font-poppins font-medium">
            {user?.email || 'Not set'}
          </p>
        </div>

        {/* Actions - Show only when editing */}
        {editing && (
          <div className="flex gap-3 pt-4 border-t border-primary/50">
            <button
              onClick={handleUpdateProfile}
              disabled={saving}
              className="px-5 py-2 text-sm text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed bg-interactive-primary hover:opacity-90 font-poppins"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={handleCancel}
              disabled={saving}
              className="px-5 py-2 text-sm text-secondary rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-interactive-hover font-poppins"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Delete Account - Subtle */}
      <div className="mt-16 pt-6 border-t border-primary/50">
        {!showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="text-xs text-tertiary hover:text-red-600 dark:hover:text-red-400 transition-colors font-poppins underline"
          >
            Delete account
          </button>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-secondary font-poppins">
              Type <span className="font-semibold text-primary">DELETE</span> to confirm account deletion
            </p>
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="DELETE"
                className="w-40 px-3 py-1.5 text-sm border border-primary rounded-md focus:outline-none focus:border-red-500 bg-primary text-primary font-poppins"
              />
              <button
                onClick={handleDeleteAccount}
                disabled={deleting || deleteConfirmText !== 'DELETE'}
                className="px-4 py-1.5 text-sm bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-poppins"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteConfirmText('');
                }}
                disabled={deleting}
                className="px-4 py-1.5 text-sm text-secondary hover:text-primary transition-colors disabled:opacity-50 font-poppins"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Final Delete Confirmation Modal */}
      {showFinalModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-primary border border-primary rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-primary font-poppins mb-3">
              Delete Account Permanently?
            </h3>
            <p className="text-sm text-secondary font-poppins mb-6">
              This action will permanently delete your account and all associated data.
              This cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowFinalModal(false);
                  setDeleting(false);
                }}
                disabled={deleting}
                className="px-4 py-2 text-sm text-secondary hover:text-primary border border-primary rounded-lg hover:bg-interactive-hover transition-colors font-poppins font-medium disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmFinalDelete}
                disabled={deleting}
                className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-poppins font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleting ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
