"use client";
import { useState } from 'react';
import ProjectSettings from '@/components/ProjectSettings';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { useTheme } from '@/components/ThemeProvider';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8080';

export default function Header() {
  const [globalSettingsOpen, setGlobalSettingsOpen] = useState(false);
  const pathname = usePathname();
  
  // Extract project ID from pathname if we're in a project page
  const projectId = pathname.match(/^\/([^\/]+)\/(chat|page)?$/)?.[1];
  
  // Hide header on chat pages and main page (main page has its own header)
  const isChatPage = pathname.includes('/chat');
  const isMainPage = pathname === '/';
  const theme = useTheme();
  
  if (isChatPage || isMainPage) {
    return null;
  }

  return (
    <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-40 transition-colors duration-200">
      <div className="max-w-7xl mx-auto py-4 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* 뒤로가기 버튼 - 프로젝트 페이지에서만 표시 */}
            {projectId && (
              <button
                onClick={() => window.location.href = '/'}
                className="flex items-center justify-center w-8 h-8 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                title="Back to projects"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M19 12H5M12 19l-7-7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            )}
            <div className="h-8">
              <Image 
                src="/Claudable_logo.svg"
                alt="Claudable"
                width={120}
                height={32}
                className="h-8 w-auto"
                priority
              />
            </div>
            <nav className="flex items-center gap-3" />
          </div>
          <div className="flex items-center gap-3">
            {/* 글로벌 설정 */}
            <button 
              className="flex items-center justify-center w-10 h-10 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all duration-200"
              onClick={() => setGlobalSettingsOpen(true)}
              title="Global Settings"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
      
      {/* Global Settings Modal */}
      <ProjectSettings
        isOpen={globalSettingsOpen}
        onClose={() => setGlobalSettingsOpen(false)}
        projectId="global-settings"
        projectName="Global Settings"
        initialTab="ai-assistant"
      />
    </header>
  );
}
