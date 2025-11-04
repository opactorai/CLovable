import {
  FileText,
  Edit3,
  Terminal,
  Search,
  Globe,
  CheckCircle,
  File,
  Save as SaveIcon,
  BookCheck,
  CodeXml,
} from 'lucide-react';

interface ToolIconProps {
  toolName: string;
  className?: string;
}

export const ToolIcon: React.FC<ToolIconProps> = ({ toolName, className = "shrink-0 h-3.5 w-3.5 text-gray-500" }) => {
  switch (toolName) {
    case 'Read':
      return <BookCheck className={className} strokeWidth={1.5} />;

    case 'Write':
    case 'Edit':
    case 'MultiEdit':
      return <CodeXml className={className} strokeWidth={1.5} />;

    case 'Bash':
    case 'Run':
    case 'Task':
      return <Terminal className={className} strokeWidth={1.5} />;

    case 'Search':
    case 'SearchText':
    case 'Glob':
    case 'Grep':
    case 'WebSearch':
      return <Search className={className} strokeWidth={1.5} />;

    case 'WebFetch':
      return <Globe className={className} strokeWidth={1.5} />;

    case 'TodoWrite':
      return <CheckCircle className={className} strokeWidth={1.5} />;

    case 'Save':
      return <SaveIcon className={className} strokeWidth={1.5} />;

    default:
      return <File className={className} strokeWidth={1.5} />;
  }
};
