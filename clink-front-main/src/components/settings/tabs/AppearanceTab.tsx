'use client';

import { Monitor, Moon } from 'lucide-react';
import { useTheme } from '@/contexts/BuildThemeContext';

export default function AppearanceTab() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="space-y-8 max-w-2xl">
      {/* Theme Selection */}
      <div className="space-y-4">
        <div>
          <label
            className="block mb-2 font-poppins text-primary"
            style={{
              fontSize: '14px',
              fontWeight: '500',
            }}
          >
            Theme
          </label>
          <p
            className="text-xs font-poppins mb-4 text-tertiary"
          >
            Choose your preferred color scheme for the build page
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Light Mode */}
          <button
            onClick={() => setTheme('light')}
            className={`relative rounded-xl border-2 p-4 transition-all ${
              theme === 'light'
                ? 'border-primary shadow-lg'
                : 'border-primary hover:border-hover'
            }`}
          >
            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-interactive-secondary flex items-center justify-center">
                <Monitor className="w-6 h-6 text-secondary" />
              </div>
              <div className="text-center">
                <p
                  className="font-poppins font-medium text-primary"
                  style={{
                    fontSize: '14px',
                  }}
                >
                  Light
                </p>
                <p
                  className="text-xs font-poppins text-tertiary"
                >
                  Classic bright theme
                </p>
              </div>
            </div>
            {theme === 'light' && (
              <div className="absolute top-3 right-3">
                <div className="w-5 h-5 rounded-full bg-interactive-primary flex items-center justify-center">
                  <svg
                    className="w-3 h-3 text-white dark:text-gray-900"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={3}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
              </div>
            )}
          </button>

          {/* Dark Mode */}
          <button
            onClick={() => setTheme('dark')}
            className={`relative rounded-xl border-2 p-4 transition-all ${
              theme === 'dark'
                ? 'border-primary shadow-lg'
                : 'border-primary hover:border-hover'
            }`}
          >
            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-foreground dark:bg-interactive-primary flex items-center justify-center">
                <Moon className="w-6 h-6 text-white" />
              </div>
              <div className="text-center">
                <p
                  className="font-poppins font-medium text-primary"
                  style={{
                    fontSize: '14px',
                  }}
                >
                  Dark
                </p>
                <p
                  className="text-xs font-poppins text-tertiary"
                >
                  Easy on the eyes
                </p>
              </div>
            </div>
            {theme === 'dark' && (
              <div className="absolute top-3 right-3">
                <div className="w-5 h-5 rounded-full bg-interactive-primary flex items-center justify-center">
                  <svg
                    className="w-3 h-3 text-white dark:text-gray-100"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={3}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
              </div>
            )}
          </button>
        </div>
      </div>

      {/* Additional Info */}
      <div className="pt-4 border-t border-primary">
        <p
          className="text-xs font-poppins text-tertiary"
        >
          Your theme preference is saved locally and will persist across sessions.
        </p>
      </div>
    </div>
  );
}
