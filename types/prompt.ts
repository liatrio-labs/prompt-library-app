export interface PromptHistory {
  content: string;
  savedAt: string;
  versionName: string;
}

export interface Prompt {
  id: string;
  name: string;
  tags: string[];
  category: string;
  content?: string; // Legacy support
  history: PromptHistory[];
  createdAt: string;
  updatedAt: string;
  trashed: boolean;
  trashedAt?: string;
}

export interface GlobalTemplates {
  [key: string]: string;
}

export type Theme = 'light' | 'dark' | 'system';
