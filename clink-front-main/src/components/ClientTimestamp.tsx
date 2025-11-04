'use client';

import { useState, useEffect } from 'react';
import { formatEditedTimestamp } from '@/utils/formatting';

interface ClientTimestampProps {
  lastModified?: string | null;
  className?: string;
}

export default function ClientTimestamp({ lastModified, className }: ClientTimestampProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    // Render a placeholder on server/initial client render to avoid hydration mismatch
    return <span className={className}>Edited —</span>;
  }

  // Only render actual timestamp after hydration
  return <span className={className}>{formatEditedTimestamp(lastModified)}</span>;
}
