export const formatEditedTimestamp = (lastModified?: string | null): string => {
  if (!lastModified) {
    return 'Edited —';
  }

  // Ensure UTC parsing: if no timezone info, append 'Z'
  let dateString = lastModified;
  if (
    !dateString.endsWith('Z') &&
    !dateString.includes('+') &&
    !dateString.includes('-', 10) // Check for timezone offset (after "YYYY-MM-DD" position)
  ) {
    dateString = dateString + 'Z';
  }

  const timestamp = new Date(dateString).getTime();
  if (Number.isNaN(timestamp)) {
    return 'Edited —';
  }

  const now = Date.now();
  const diffMs = Math.max(now - timestamp, 0);
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays >= 1) {
    return `Edited ${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
  }

  if (diffHours >= 1) {
    return `Edited ${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  }

  if (diffMinutes >= 1) {
    return `Edited ${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;
  }

  const diffSeconds = Math.floor(diffMs / 1000);
  if (diffSeconds >= 10) {
    return `Edited ${diffSeconds} seconds ago`;
  }

  return 'Edited just now';
};

export const formatStarCount = (count: number): string => {
  if (count >= 1000) {
    const kCount = count / 1000;
    return `${kCount.toFixed(1)}k`.replace('.0k', 'k');
  }
  return count.toString();
};
