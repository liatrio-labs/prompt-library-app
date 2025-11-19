'use client';

import { useEffect, useState, useCallback } from 'react';
import { Prompt, GlobalTemplates, Theme } from '@/types/prompt';
import { createSupabaseBrowserClient } from '@/utils/supabase/client';

type View = 'home' | 'composer' | 'settings' | 'trash';

type Props = {
  userEmail?: string | null;
};

export default function PromptLibrary({ userEmail }: Props) {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<View>('home');
  const [currentPromptId, setCurrentPromptId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Form state
  const [promptName, setPromptName] = useState('');
  const [promptTags, setPromptTags] = useState('');
  const [promptCategory, setPromptCategory] = useState('');
  const [promptContent, setPromptContent] = useState('');

  // Preview state
  const [variableInputs, setVariableInputs] = useState<Record<string, string>>({});
  const [prefilledStates, setPrefilledStates] = useState<Record<number, boolean>>({});
  const [globalTemplateStates, setGlobalTemplateStates] = useState<Record<number, boolean>>({});

  // Global templates
  const [globalTemplates, setGlobalTemplates] = useState<GlobalTemplates>({});
  const [newTemplateKey, setNewTemplateKey] = useState('');
  const [newTemplateValue, setNewTemplateValue] = useState('');
  const [shareWithTeam, setShareWithTeam] = useState(false);

  // Theme
  const [theme, setTheme] = useState<Theme>('system');

  // Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const supabase = createSupabaseBrowserClient();

  const mapPrompts = (data: any[]): Prompt[] =>
    data.map((p: any) => ({
      id: p.id,
      name: p.name,
      tags: p.tags || [],
      category: p.category,
      history: (p.prompt_history || []).map((h: any) => ({
        content: h.content,
        savedAt: h.saved_at,
        versionName: h.version_name || ''
      })),
      createdAt: p.created_at,
      updatedAt: p.updated_at,
      trashed: p.trashed || false,
      trashedAt: p.trashed_at || undefined,
      isPublic: p.is_public,
      userId: p.user_id
    })) as Prompt[];

  // Load data from Supabase on mount
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        setLoading(false);
        return;
      }
      setUserId(userData.user.id);

       // Ensure user row exists for FK constraints
      await supabase.from('users').upsert({
        id: userData.user.id,
        email: userData.user.email || '',
        name: (userData.user.user_metadata as any)?.full_name || null,
        avatar_url: (userData.user.user_metadata as any)?.avatar_url || null
      }, { onConflict: 'id' });

      const { data: promptData } = await supabase
        .from('prompts')
        .select('id,name,tags,category,is_public,trashed,trashed_at,created_at,updated_at,user_id,prompt_history(content,saved_at,version_name)')
        .order('updated_at', { ascending: false });

      if (promptData) {
        setPrompts(mapPrompts(promptData));
      }

      const { data: tmplData } = await supabase
        .from('global_templates')
        .select('key,value')
        .order('key');

      if (tmplData) {
        const map: GlobalTemplates = {};
        tmplData.forEach((t: any) => {
          map[t.key] = t.value;
        });
        setGlobalTemplates(map);
      }

      const storedTheme = localStorage.getItem('theme') as Theme;
      if (storedTheme) setTheme(storedTheme);
      setLoading(false);
    };
    load();
  }, [supabase]);

  // Apply theme
  useEffect(() => {
    const applyTheme = () => {
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else if (theme === 'light') {
        document.documentElement.classList.remove('dark');
      } else {
        if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      }
    };
    applyTheme();
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Purge old trash items (30 days) client-side view only
  useEffect(() => {
    const now = new Date().getTime();
    const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
    const filtered = prompts.filter(prompt => {
      if (prompt.trashed && prompt.trashedAt) {
        const trashedTime = new Date(prompt.trashedAt).getTime();
        return now - trashedTime < THIRTY_DAYS;
      }
      return true;
    });
    if (filtered.length !== prompts.length) setPrompts(filtered);
  }, [prompts]);

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const reloadPrompts = useCallback(async () => {
    const { data } = await supabase
      .from('prompts')
      .select('id,name,tags,category,is_public,trashed,trashed_at,created_at,updated_at,user_id,prompt_history(content,saved_at,version_name)')
      .order('updated_at', { ascending: false });
    if (data) setPrompts(mapPrompts(data));
  }, [supabase]);

  const resetForm = useCallback(() => {
    setCurrentPromptId(null);
    setIsEditing(false);
    setPromptName('');
    setPromptTags('');
    setPromptCategory('');
    setPromptContent('');
    setVariableInputs({});
    setPrefilledStates({});
    setGlobalTemplateStates({});
    setShareWithTeam(false);
  }, []);

  const loadPromptForEditing = useCallback((id: string) => {
    const prompt = prompts.find(p => p.id === id);
    if (!prompt || prompt.trashed) return;

    setCurrentPromptId(id);
    setIsEditing(true);
    setPromptName(prompt.name);
    setPromptTags(prompt.tags.join(', '));
    setPromptCategory(prompt.category || '');
    setPromptContent(prompt.history && prompt.history.length > 0 ? prompt.history[0].content : '');
    setShareWithTeam(prompt.isPublic !== false);
    setCurrentView('composer');
  }, [prompts]);

  const savePrompt = useCallback(() => {
    if (saving) return;
    if (!promptName.trim() || !promptContent.trim()) {
      showToast('Please provide both a name and content for the prompt', 'error');
      return;
    }
    if (!promptCategory.trim()) {
      showToast('Please provide a category for the prompt', 'error');
      return;
    }
    if (!userId) {
      showToast('User not loaded', 'error');
      return;
    }
    const tags = promptTags.split(',').map(tag => tag.trim()).filter(tag => tag);
    const persist = async () => {
      setSaving(true);
      try {
        if (isEditing && currentPromptId) {
          const { error } = await supabase.from('prompts').update({
            name: promptName,
            tags,
            category: promptCategory,
            is_public: shareWithTeam,
            trashed: false
          }).eq('id', currentPromptId);
          if (error) {
            showToast(error.message, 'error');
            return;
          }
          const { error: histErr } = await supabase.from('prompt_history').insert({
            prompt_id: currentPromptId,
            content: promptContent,
            version_name: ''
          });
          if (histErr) {
            showToast(histErr.message, 'error');
            return;
          }
        } else {
          const { data: inserted, error } = await supabase.from('prompts').insert({
            name: promptName,
            tags,
            category: promptCategory,
            is_public: shareWithTeam,
            user_id: userId
          }).select('id').single();
          if (error) {
            showToast(error.message, 'error');
            return;
          }
          if (inserted?.id) {
            const { error: histErr } = await supabase.from('prompt_history').insert({
              prompt_id: inserted.id,
              content: promptContent,
              version_name: ''
            });
            if (histErr) {
              showToast(histErr.message, 'error');
              return;
            }
            setCurrentPromptId(inserted.id);
            setIsEditing(true);
          }
        }
        await reloadPrompts();
        showToast(`Prompt "${promptName}" ${isEditing ? 'updated' : 'created'} successfully`);
      } finally {
        setSaving(false);
      }
    };
    persist();
  }, [promptName, promptContent, promptCategory, promptTags, isEditing, currentPromptId, shareWithTeam, supabase, reloadPrompts, showToast, userId, saving]);

  const duplicatePrompt = useCallback((id: string) => {
    const original = prompts.find(p => p.id === id);
    if (!original) {
      showToast('Prompt not found', 'error');
      return;
    }
    if (!userId) {
      showToast('User not loaded', 'error');
      return;
    }

    let baseName = original.name;
    let newName = baseName + " copy";
    let counter = 2;
    while (prompts.some(p => !p.trashed && p.name === newName)) {
      newName = baseName + " copy " + counter;
      counter++;
    }

    const newHistory = original.history ? JSON.parse(JSON.stringify(original.history)) :
      [{ content: original.content || '', savedAt: new Date().toISOString(), versionName: '' }];

    const latestContent = newHistory[0]?.content || '';
    const run = async () => {
      const { data: inserted, error } = await supabase.from('prompts').insert({
        name: newName,
        tags: original.tags,
        category: original.category,
        is_public: original.isPublic !== false,
        user_id: userId
      }).select('id').single();
      if (!error && inserted?.id) {
        await supabase.from('prompt_history').insert({
          prompt_id: inserted.id,
          content: latestContent,
          version_name: ''
        });
        await reloadPrompts();
        showToast(`Prompt duplicated as "${newName}"`);
      }
    };
    run();
  }, [prompts, supabase, reloadPrompts, showToast, userId]);

  const trashPrompt = useCallback((id: string) => {
    const run = async () => {
      await supabase.from('prompts').update({
        trashed: true,
        trashed_at: new Date().toISOString()
      }).eq('id', id);
      await reloadPrompts();
      resetForm();
      showToast('Prompt moved to trash');
    };
    run();
  }, [supabase, reloadPrompts, resetForm, showToast]);

  const recoverPrompt = useCallback((id: string) => {
    const run = async () => {
      await supabase.from('prompts').update({
        trashed: false,
        trashed_at: null
      }).eq('id', id);
      await reloadPrompts();
      showToast('Prompt recovered');
    };
    run();
  }, [supabase, reloadPrompts, showToast]);

  const permanentlyDeletePrompt = useCallback((id: string) => {
    const run = async () => {
      await supabase.from('prompts').delete().eq('id', id);
      await reloadPrompts();
      showToast('Prompt permanently deleted');
    };
    run();
  }, [supabase, reloadPrompts, showToast]);

  const addGlobalTemplate = useCallback(() => {
    if (!newTemplateKey.trim() || !newTemplateValue.trim()) {
      showToast('Please provide both template keyword and value', 'error');
      return;
    }
    if (globalTemplates[newTemplateKey]) {
      showToast('Template keyword already exists', 'error');
      return;
    }
    if (!userId) {
      showToast('User not loaded', 'error');
      return;
    }
    const run = async () => {
      await supabase.from('global_templates').insert({
        key: newTemplateKey,
        value: newTemplateValue,
        is_public: shareWithTeam,
        user_id: userId
      });
      const newTemplates = { ...globalTemplates, [newTemplateKey]: newTemplateValue };
      setGlobalTemplates(newTemplates);
      setNewTemplateKey('');
      setNewTemplateValue('');
      showToast('Global template added successfully');
    };
    run();
  }, [newTemplateKey, newTemplateValue, globalTemplates, showToast, supabase, userId, shareWithTeam]);

  const deleteGlobalTemplate = useCallback((key: string) => {
    const run = async () => {
      await supabase.from('global_templates').delete().eq('key', key);
      const { [key]: _, ...rest } = globalTemplates;
      setGlobalTemplates(rest);
      showToast('Global template deleted');
    };
    run();
  }, [globalTemplates, showToast, supabase]);

  const exportLibrary = useCallback(() => {
    const activePrompts = prompts.filter(p => !p.trashed);
    const exportData = { prompts: activePrompts, globalTemplates };
    const data = JSON.stringify(exportData, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `prompt-library-${new Date().toISOString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [prompts, globalTemplates]);

  const importLibrary = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const importedData = JSON.parse(event.target?.result as string);
        if (importedData.prompts && Array.isArray(importedData.prompts)) {
          setPrompts(importedData.prompts);
          localStorage.setItem('prompts', JSON.stringify(importedData.prompts));
        }
        if (importedData.globalTemplates) {
          setGlobalTemplates(importedData.globalTemplates);
          localStorage.setItem('globalTemplates', JSON.stringify(importedData.globalTemplates));
        }
        showToast('Library imported successfully');
      } catch (err) {
        showToast('Error reading file', 'error');
      }
    };
    reader.readAsText(file);
  }, [showToast]);

  const copyToClipboard = useCallback((text: string, message: string) => {
    navigator.clipboard.writeText(text).then(() => {
      showToast(message);
    }).catch(() => {
      showToast('Failed to copy to clipboard', 'error');
    });
  }, [showToast]);

  // Extract variables from content
  const extractVariables = useCallback((content: string): string[] => {
    const variableRegex = /\$\{(.*?)\}/g;
    const variables = new Set<string>();
    let match;
    while ((match = variableRegex.exec(content)) !== null) {
      variables.add(match[1]);
    }
    return Array.from(variables);
  }, []);

  // Extract prefilled parts
  const extractPrefilledParts = useCallback((content: string): string[] => {
    const prefilledRegex = /\{\{([\s\S]*?)\}\}/g;
    const parts: string[] = [];
    let match;
    while ((match = prefilledRegex.exec(content)) !== null) {
      parts.push(match[1]);
    }
    return parts;
  }, []);

  // Extract global template keys
  const extractGlobalKeys = useCallback((content: string): string[] => {
    const globalRegex = /<<\s*(.*?)\s*>>/g;
    const keys: string[] = [];
    let match;
    while ((match = globalRegex.exec(content)) !== null) {
      keys.push(match[1]);
    }
    return keys;
  }, []);

  // Generate prompt preview HTML
  const generatePreview = useCallback(() => {
    let content = promptContent;

    // Replace variables
    content = content.replace(/\$\{(.*?)\}/g, (match, variable) => {
      const value = variableInputs[variable];
      return `<span class="bg-blue-100 border border-blue-300 rounded px-1 mx-0.5 dark:bg-blue-900 dark:border-blue-700">${value || variable}</span>`;
    });

    // Replace template parts
    content = content.replace(/\[(.*?)\]/g, (match, templatePart) => {
      return `<span class="bg-green-100 border border-green-300 rounded px-1 mx-0.5 dark:bg-green-900 dark:border-green-700">${templatePart}</span>`;
    });

    // Replace prefilled parts
    const prefilledParts = extractPrefilledParts(promptContent);
    let prefilledCounter = 0;
    content = content.replace(/\{\{([\s\S]*?)\}\}/g, (match, prefilledContent) => {
      const isChecked = prefilledStates[prefilledCounter] !== false;
      const result = isChecked ? `<span class="bg-yellow-100 border border-yellow-300 rounded px-1 mx-0.5 dark:bg-yellow-900 dark:border-yellow-700">${prefilledContent}</span>` : '';
      prefilledCounter++;
      return result;
    });

    // Replace global templates
    const globalKeys = extractGlobalKeys(promptContent);
    let globalCounter = 0;
    content = content.replace(/<<\s*(.*?)\s*>>/g, (match, key) => {
      const isChecked = globalTemplateStates[globalCounter] !== false;
      const replacement = globalTemplates[key.trim()];
      let result;
      if (replacement) {
        result = isChecked ? `<span class="bg-cyan-100 border border-cyan-300 rounded px-1 mx-0.5 dark:bg-cyan-900 dark:border-cyan-700">${replacement}</span>` : '';
      } else {
        result = `<span class="bg-red-100 border border-red-300 rounded px-1 mx-0.5 dark:bg-red-900 dark:border-red-700">Error: Global template "${key.trim()}" is not defined</span>`;
      }
      globalCounter++;
      return result;
    });

    return content;
  }, [promptContent, variableInputs, prefilledStates, globalTemplateStates, globalTemplates, extractPrefilledParts, extractGlobalKeys]);

  const copyPrompt = useCallback(() => {
    let text = promptContent;

    // Replace variables
    const variables = extractVariables(promptContent);
    variables.forEach(variable => {
      const value = variableInputs[variable] || variable;
      text = text.replace(new RegExp(`\\$\\{${variable}\\}`, 'g'), value);
    });

    // Remove template markers
    text = text.replace(/\[(.*?)\]/g, '$1');

    // Handle prefilled parts
    const prefilledParts = extractPrefilledParts(promptContent);
    prefilledParts.forEach((part, index) => {
      const isChecked = prefilledStates[index] !== false;
      text = text.replace(`{{${part}}}`, isChecked ? part : '');
    });

    // Handle global templates
    const globalKeys = extractGlobalKeys(promptContent);
    globalKeys.forEach((key, index) => {
      const isChecked = globalTemplateStates[index] !== false;
      const replacement = globalTemplates[key.trim()];
      text = text.replace(`<<${key}>>`, isChecked && replacement ? replacement : '');
    });

    copyToClipboard(text, 'Prompt copied to clipboard!');
  }, [promptContent, variableInputs, prefilledStates, globalTemplateStates, globalTemplates, extractVariables, extractPrefilledParts, extractGlobalKeys, copyToClipboard]);

  const filteredPrompts = prompts.filter(prompt => {
    const inTrash = !!prompt.trashed;
    if (currentView === 'trash' && !inTrash) return false;
    if (currentView !== 'trash' && inTrash) return false;
    return prompt.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (prompt.tags && prompt.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase())));
  });

  const groupedPrompts = prompts
    .filter(p => !p.trashed)
    .reduce((acc, prompt) => {
      const category = prompt.category || 'Uncategorized';
      if (!acc[category]) acc[category] = [];
      acc[category].push(prompt);
      return acc;
    }, {} as Record<string, Prompt[]>);

  const variables = extractVariables(promptContent);
  const prefilledParts = extractPrefilledParts(promptContent);
  const globalKeys = extractGlobalKeys(promptContent);
  const handleLogout = useCallback(async () => {
    await fetch('/logout', { method: 'POST' });
    window.location.href = '/login';
  }, []);

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      {/* Desktop Sidebar */}
      <div className="w-64 bg-white border-r border-gray-200 dark:bg-gray-800 dark:border-gray-700 hidden md:block overflow-y-auto">
        <div className="p-4">
          <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-6">Prompt Library v1.0</h1>

          <button
            onClick={() => {
              resetForm();
              setCurrentView('composer');
            }}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg flex items-center justify-center mb-4"
          >
            <i className="fas fa-plus mr-2"></i> New Prompt
          </button>

          <div className="relative mb-4">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search prompts..."
              className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <i className="fas fa-search absolute right-3 top-2.5 text-gray-400"></i>
          </div>

          <button
            onClick={() => setCurrentView('home')}
            className={`w-full py-2 px-4 rounded-lg mb-2 ${currentView === 'home' ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300'}`}
          >
            Home
          </button>

          <button
            onClick={() => setCurrentView('composer')}
            className={`w-full py-2 px-4 rounded-lg mb-2 ${currentView === 'composer' ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300'}`}
          >
            Prompt Composer
          </button>

          <button
            onClick={() => setCurrentView('trash')}
            className={`w-full py-2 px-4 rounded-lg mb-2 ${currentView === 'trash' ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300'}`}
          >
            Trash
          </button>

          <button
            onClick={() => setCurrentView('settings')}
            className={`w-full py-2 px-4 rounded-lg ${currentView === 'settings' ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300'}`}
          >
            Settings
          </button>
        </div>

        <div className="p-4 space-y-2">
          {filteredPrompts.length === 0 ? (
            <div className="text-center text-gray-500 py-4">
              {searchTerm ? 'No matching prompts found' : (currentView === 'trash' ? 'Trash is empty' : 'No prompts yet')}
            </div>
          ) : (
            filteredPrompts.map(prompt => (
              <div
                key={prompt.id}
                className={`bg-white dark:bg-gray-700 rounded-lg shadow p-3 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900 transition-colors border ${currentPromptId === prompt.id ? 'border-blue-400' : 'border-transparent'}`}
                onClick={() => loadPromptForEditing(prompt.id)}
              >
                <h3 className="font-medium text-gray-800 dark:text-gray-100 truncate">{prompt.name}</h3>
                <div className="flex items-center text-xs text-gray-500 dark:text-gray-300 gap-2 mt-1">
                  <span className={`px-2 py-0.5 rounded-full ${prompt.isPublic === false ? 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-200' : 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200'}`}>
                    {prompt.isPublic === false ? 'Private' : 'Shared'}
                  </span>
                </div>
                {prompt.tags && prompt.tags.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {prompt.tags.map((tag, i) => (
                      <span key={i} className="text-xs bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 px-2 py-0.5 rounded-full">{tag}</span>
                    ))}
                  </div>
                )}
                <div className="mt-2 flex space-x-2">
                  {currentView !== 'trash' ? (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          duplicatePrompt(prompt.id);
                        }}
                        className="text-blue-600 hover:text-blue-800 text-xs"
                      >
                        <i className="fas fa-copy"></i> Duplicate
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          trashPrompt(prompt.id);
                        }}
                        className="text-red-600 hover:text-red-800 text-xs"
                      >
                        <i className="fas fa-trash"></i> Delete
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          recoverPrompt(prompt.id);
                        }}
                        className="text-green-600 hover:text-green-800 text-xs"
                      >
                        <i className="fas fa-undo"></i> Recover
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm('Are you sure you want to permanently delete this prompt?')) {
                            permanentlyDeletePrompt(prompt.id);
                          }
                        }}
                        className="text-red-600 hover:text-red-800 text-xs"
                      >
                        <i className="fas fa-times"></i> Delete Permanently
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Mobile sidebar toggle */}
      <div className="md:hidden fixed top-4 left-4 z-50">
        <button
          onClick={() => setMobileSidebarOpen(true)}
          className="bg-white dark:bg-gray-800 p-2 rounded-lg shadow-lg"
        >
          <i className="fas fa-bars text-gray-700 dark:text-gray-300"></i>
        </button>
      </div>

      {/* Mobile sidebar overlay */}
      {mobileSidebarOpen && (
        <>
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
            onClick={() => setMobileSidebarOpen(false)}
          ></div>
          <div className="fixed inset-y-0 left-0 w-64 bg-white dark:bg-gray-800 z-50 md:hidden overflow-y-auto">
            <div className="p-4">
              <div className="flex justify-between items-center mb-6">
                <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100">Prompt Library</h1>
                <button onClick={() => setMobileSidebarOpen(false)} className="text-gray-500 hover:text-gray-700">
                  <i className="fas fa-times"></i>
                </button>
              </div>

              {/* Same content as desktop sidebar */}
              <button
                onClick={() => {
                  resetForm();
                  setCurrentView('composer');
                  setMobileSidebarOpen(false);
                }}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg flex items-center justify-center mb-4"
              >
                <i className="fas fa-plus mr-2"></i> New Prompt
              </button>

              <div className="space-y-2">
                <button
                  onClick={() => {
                    setCurrentView('home');
                    setMobileSidebarOpen(false);
                  }}
                  className={`w-full py-2 px-4 rounded-lg ${currentView === 'home' ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}`}
                >
                  Home
                </button>
                <button
                  onClick={() => {
                    setCurrentView('settings');
                    setMobileSidebarOpen(false);
                  }}
                  className={`w-full py-2 px-4 rounded-lg ${currentView === 'settings' ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}`}
                >
                  Settings
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading && (
          <div className="text-gray-600 dark:text-gray-300 mb-4">Loading prompts…</div>
        )}
        <div className="flex items-center justify-end gap-3 mb-4">
          {userEmail && (
            <div className="text-sm text-gray-600 dark:text-gray-300">
              Signed in as <span className="font-semibold">{userEmail}</span>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-200 underline"
          >
            Sign out
          </button>
        </div>
        {/* Home View */}
        {currentView === 'home' && (
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-4">Home</h2>
            <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))' }}>
              {Object.keys(groupedPrompts).sort().map(category => (
                <div key={category} className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
                  <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-2">{category}</h3>
                  {groupedPrompts[category].sort((a, b) => a.name.localeCompare(b.name)).map(prompt => (
                    <div
                      key={prompt.id}
                      className="cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900 p-2 rounded text-gray-700 dark:text-gray-300"
                      onClick={() => {
                        loadPromptForEditing(prompt.id);
                        setCurrentView('composer');
                      }}
                    >
                      {prompt.name}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Composer View */}
        {currentView === 'composer' && (
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6">Prompt Composer</h2>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Prompt Name</label>
                  <input
                    type="text"
                    value={promptName}
                    onChange={(e) => setPromptName(e.target.value)}
                    className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tags (comma separated)</label>
                  <input
                    type="text"
                    value={promptTags}
                    onChange={(e) => setPromptTags(e.target.value)}
                    placeholder="marketing, copywriting, social"
                    className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
                <input
                  type="text"
                  value={promptCategory}
                  onChange={(e) => setPromptCategory(e.target.value)}
                  className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Share with Liatrio</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Default is shared; turn off to keep private.</p>
                </div>
                <button
                  type="button"
                  aria-pressed={shareWithTeam}
                  onClick={() => setShareWithTeam((v) => !v)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${shareWithTeam ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-600'}`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${shareWithTeam ? 'translate-x-5' : 'translate-x-1'}`}
                  />
                </button>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Prompt Content</label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  Use <code className="bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded">{'${variable}'}</code> for input fields<br />
                  Use <code className="bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded">[brackets]</code> to indicate placeholders<br />
                  Use <code className="bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded">{'{{double braces}}'}</code> for optional parts<br />
                  Use <code className="bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded">{'<<double chevrons>>'}</code> for global templates
                </p>
                <textarea
                  value={promptContent}
                  onChange={(e) => setPromptContent(e.target.value)}
                  className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[450px]"
                />
              </div>

              <div className="flex justify-between items-center">
                <div className="flex space-x-2">
                  {/* Add future buttons here */}
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={savePrompt}
                    className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg"
                  >
                    Save Prompt
                  </button>
                  <button
                    onClick={() => {
                      if (currentPromptId) {
                        loadPromptForEditing(currentPromptId);
                      } else {
                        resetForm();
                      }
                    }}
                    className="bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 py-2 px-4 rounded-lg"
                  >
                    Reset
                  </button>
                  {currentPromptId && (
                    <>
                      <button
                        onClick={() => duplicatePrompt(currentPromptId)}
                        className="bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg"
                      >
                        Duplicate
                      </button>
                      <button
                        onClick={() => trashPrompt(currentPromptId)}
                        className="bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-lg"
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Preview */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Preview & Inputs</h3>
                <button
                  onClick={copyPrompt}
                  className="bg-green-600 hover:bg-green-700 text-white py-1 px-3 rounded-lg text-sm flex items-center"
                >
                  <i className="fas fa-copy mr-1"></i> Copy Prompt
                </button>
              </div>

              {/* Variables */}
              {variables.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Fill in the variables:</h4>
                  {variables.map(variable => (
                    <div key={variable} className="mb-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{variable}</label>
                      <input
                        type="text"
                        value={variableInputs[variable] || ''}
                        onChange={(e) => setVariableInputs({ ...variableInputs, [variable]: e.target.value })}
                        placeholder={`Enter ${variable}`}
                        className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Prefilled parts */}
              {prefilledParts.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Toggle prefilled parts:</h4>
                  {prefilledParts.map((part, index) => (
                    <div key={index} className="mb-2 flex items-center">
                      <input
                        type="checkbox"
                        id={`prefilled_${index}`}
                        checked={prefilledStates[index] !== false}
                        onChange={(e) => setPrefilledStates({ ...prefilledStates, [index]: e.target.checked })}
                        className="mr-2"
                      />
                      <label htmlFor={`prefilled_${index}`} className="text-sm text-gray-700 dark:text-gray-300">{part}</label>
                    </div>
                  ))}
                </div>
              )}

              {/* Global templates */}
              {globalKeys.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Toggle global templates:</h4>
                  {globalKeys.map((key, index) => (
                    <div key={index} className="mb-2 flex items-center">
                      <input
                        type="checkbox"
                        id={`global_${index}`}
                        checked={globalTemplateStates[index] !== false}
                        onChange={(e) => setGlobalTemplateStates({ ...globalTemplateStates, [index]: e.target.checked })}
                        className="mr-2"
                      />
                      <label htmlFor={`global_${index}`} className="text-sm text-gray-700 dark:text-gray-300">{key}</label>
                    </div>
                  ))}
                </div>
              )}

              <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
                <div
                  className="whitespace-pre-wrap text-gray-800 dark:text-gray-200"
                  dangerouslySetInnerHTML={{ __html: generatePreview() }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Settings View */}
        {currentView === 'settings' && (
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-4">Settings</h2>

            {/* Export/Import */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">Library Export / Import</h3>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={exportLibrary}
                  className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg"
                >
                  Export Library
                </button>
                <label className="bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg cursor-pointer">
                  Import Library
                  <input
                    type="file"
                    accept="application/json"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file && confirm('This will replace all prompts and global templates. Are you sure?')) {
                        importLibrary(file);
                      }
                    }}
                  />
                </label>
              </div>
            </div>

            {/* Global Templates */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">Global Templates</h3>
              <div className="mb-4 flex flex-col md:flex-row gap-2">
                <input
                  type="text"
                  value={newTemplateKey}
                  onChange={(e) => setNewTemplateKey(e.target.value)}
                  placeholder="Template Keyword"
                  className="border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg py-2 px-3 w-full md:w-1/3"
                />
                <textarea
                  value={newTemplateValue}
                  onChange={(e) => setNewTemplateValue(e.target.value)}
                  placeholder="Template Full Text"
                  className="border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg py-2 px-3 w-full md:w-1/3"
                  rows={3}
                />
                <button
                  onClick={addGlobalTemplate}
                  className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg"
                >
                  Add Global Template
                </button>
              </div>
              <div className="space-y-2">
                {Object.keys(globalTemplates).map(key => (
                  <div key={key} className="flex items-center justify-between border border-gray-300 dark:border-gray-600 p-2 rounded bg-white dark:bg-gray-800">
                    <span className="text-gray-700 dark:text-gray-300">{key}: {globalTemplates[key]}</span>
                    <button
                      onClick={() => deleteGlobalTemplate(key)}
                      className="bg-red-600 hover:bg-red-700 text-white py-1 px-2 rounded text-xs"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Theme */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">Appearance</h3>
              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value as Theme)}
                className="border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg py-2 px-3"
              >
                <option value="system">Same as system</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </div>
          </div>
        )}

        {/* Trash View */}
        {currentView === 'trash' && (
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-4">Trash</h2>
            {filteredPrompts.length === 0 ? (
              <div className="text-center text-gray-500 py-4">Trash is empty</div>
            ) : (
              <div className="space-y-2">
                {filteredPrompts.map(prompt => (
                  <div key={prompt.id} className="bg-white dark:bg-gray-800 rounded-lg shadow p-3">
                    <h3 className="font-medium text-gray-800 dark:text-gray-100">{prompt.name}</h3>
                    <div className="mt-2 flex space-x-2">
                      <button
                        onClick={() => recoverPrompt(prompt.id)}
                        className="text-green-600 hover:text-green-800 text-xs"
                      >
                        <i className="fas fa-undo"></i> Recover
                      </button>
                      <button
                        onClick={() => {
                          if (confirm('Are you sure you want to permanently delete this prompt?')) {
                            permanentlyDeletePrompt(prompt.id);
                          }
                        }}
                        className="text-red-600 hover:text-red-800 text-xs"
                      >
                        <i className="fas fa-times"></i> Delete Permanently
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-4 right-4 bg-gray-800 text-white px-6 py-3 rounded-lg shadow-lg animate-fade-in">
          <div className="flex items-center">
            <i className={`fas ${toast.type === 'error' ? 'fa-exclamation-circle text-red-400' : 'fa-check-circle text-green-400'} mr-2`}></i>
            <span>{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}
