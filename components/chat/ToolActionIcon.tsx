import { BookOpen, Edit3, FilePlus, FileText, Search, Sparkles, Terminal, Trash2 } from 'lucide-react';
import type { ToolAction } from './toolActions';

interface ToolActionIconProps {
  action: ToolAction;
  className?: string;
}

const ICON_MAP: Record<ToolAction, typeof FileText> = {
  Edited: Edit3,
  Created: FilePlus,
  Read: BookOpen,
  Deleted: Trash2,
  Generated: Sparkles,
  Searched: Search,
  Executed: Terminal,
};

export const ToolActionIcon: React.FC<ToolActionIconProps> = ({
  action,
  className = 'h-3 w-3 text-tertiary',
}) => {
  const IconComponent = ICON_MAP[action] ?? FileText;
  return <IconComponent className={className} strokeWidth={1.5} />;
};

