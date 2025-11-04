export type ProjectSummary = {
  id: string;
  name: string;
  lastModified?: string | null;
  description?: string | null;
  cli?: string | null;
  model?: string | null;
};
