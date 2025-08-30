import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ToolResultItemProps {
  action: 'Edited' | 'Created' | 'Read' | 'Deleted' | 'Generated' | 'Searched' | 'Executed';
  filePath: string;
  content?: string;
  timestamp?: string;
}

const ToolResultItem: React.FC<ToolResultItemProps> = ({ action, filePath, content }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const getIcon = () => {
    switch (action) {
      case 'Edited':
      case 'Created':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 -960 960 960" className="shrink-0 h-4 w-4 text-muted-foreground" fill="currentColor">
            <path d="M560-110v-81q0-5.57 2-10.78 2-5.22 7-10.22l211.61-210.77q9.11-9.12 20.25-13.18Q812-440 823-440q12 0 23 4.5t20 13.5l37 37q9 9 13 20t4 22-4.5 22.5-13.58 20.62L692-89q-5 5-10.22 7-5.21 2-10.78 2h-81q-12.75 0-21.37-8.63Q560-97.25 560-110m300-233-37-37zM620-140h38l121-122-37-37-122 121zM220-80q-24 0-42-18t-18-42v-680q0-24 18-42t42-18h315q12.44 0 23.72 5T578-862l204 204q8 8 13 19.28t5 23.72v71q0 12.75-8.68 21.37-8.67 8.63-21.5 8.63-12.82 0-21.32-8.63-8.5-8.62-8.5-21.37v-56H550q-12.75 0-21.37-8.63Q520-617.25 520-630v-190H220v680h250q12.75 0 21.38 8.68 8.62 8.67 8.62 21.5 0 12.82-8.62 21.32Q482.75-80 470-80zm0-60v-680zm541-141-19-18 37 37z"></path>
          </svg>
        );
      case 'Read':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 -960 960 960" className="shrink-0 h-4 w-4 text-muted-foreground" fill="currentColor">
            <path d="M320-240h320v-80H320v80zm0-160h320v-80H320v80zM240-80q-33 0-56.5-23.5T160-160v-640q0-33 23.5-56.5T240-880h320l240 240v480q0 33-23.5 56.5T720-80H240zm280-520v-200H240v640h480v-440H520zM240-800v200-200 640-640z"></path>
          </svg>
        );
      case 'Deleted':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 -960 960 960" className="shrink-0 h-4 w-4 text-muted-foreground" fill="currentColor">
            <path d="M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280zm400-600H280v520h400v-520zM360-280h80v-360h-80v360zm160 0h80v-360h-80v360zM280-720v520-520z"></path>
          </svg>
        );
      case 'Generated':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 -960 960 960" className="shrink-0 h-4 w-4 text-muted-foreground" fill="currentColor">
            <path d="m424-296 282-282-56-56-226 226-114-114-56 56 170 170Zm56 216q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80z"></path>
          </svg>
        );
      case 'Searched':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 -960 960 960" className="shrink-0 h-4 w-4 text-muted-foreground" fill="currentColor">
            <path d="M160-160q-33 0-56.5-23.5T80-240v-480q0-33 23.5-56.5T160-800h240l80 80h320q33 0 56.5 23.5T880-640v400q0 33-23.5 56.5T800-160H160zm0-80h640v-400H447l-80-80H160v480zm0 0v-480 480z"></path>
          </svg>
        );
      case 'Executed':
      default:
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 -960 960 960" className="shrink-0 h-4 w-4 text-muted-foreground" fill="currentColor">
            <path d="M160-160q-33 0-56.5-23.5T80-240v-480q0-33 23.5-56.5T160-800h640q33 0 56.5 23.5T880-720v480q0 33-23.5 56.5T800-160H160zm0-80h640v-400H160v400zm140-40-56-56 103-104-104-104 57-56 160 160-160 160zm180 0v-80h240v80H480z"></path>
          </svg>
        );
    }
  };

  const getFileName = (path: string) => {
    const parts = path.split('/');
    return parts[parts.length - 1] || path;
  };

  const getDirectoryPath = (path: string) => {
    const parts = path.split('/');
    parts.pop();
    return parts.join('/') || '/';
  };

  return (
    <div className="mb-2">
      <div 
        className="flex h-6 items-center gap-1.5 whitespace-nowrap text-base font-medium md:text-sm cursor-pointer group"
        onClick={() => content && setIsExpanded(!isExpanded)}
      >
        <div className="mb-px mr-1 flex shrink-0 items-center">
          {getIcon()}
        </div>
        <span className="flex-shrink-0 font-normal text-gray-600 dark:text-gray-400">
          {action}
        </span>
        <span 
          className="relative w-fit max-w-xs truncate rounded-md bg-gray-100 dark:bg-gray-800 px-2 py-0 text-start text-xs font-normal text-gray-600 dark:text-gray-400 transition-colors hover:bg-gray-200 dark:hover:bg-gray-700"
          title={filePath}
        >
          <span className="truncate">
            {filePath}
          </span>
        </span>
        {content && (
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            width="16" 
            height="16" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
            className={`ml-1 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
          >
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        )}
      </div>
      
      <AnimatePresence>
        {isExpanded && content && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: 'hidden' }}
          >
            <div className="mt-2 ml-6 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <pre className="text-xs text-gray-700 dark:text-gray-300 font-mono whitespace-pre-wrap break-words">
                {content}
              </pre>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ToolResultItem;