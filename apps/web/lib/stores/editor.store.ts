import { create } from 'zustand';
import { CodeFile, CodeProject, EditorSettings, FileLanguage } from '@/types/code-editor.types';

interface EditorState {
  // Current project
  currentProject: CodeProject | null;
  
  // Files
  files: CodeFile[];
  activeFileId: string | null;
  
  // Editor settings
  settings: EditorSettings;
  
  // UI state
  isFileExplorerOpen: boolean;
  isTerminalOpen: boolean;
  isSidebarCollapsed: boolean;
  
  // Loading states
  isLoading: boolean;
  isSaving: boolean;
  isSubmitting: boolean;
  
  // Actions
  setCurrentProject: (project: CodeProject | null) => void;
  setFiles: (files: CodeFile[]) => void;
  addFile: (file: CodeFile) => void;
  updateFile: (fileId: string, updates: Partial<CodeFile>) => void;
  deleteFile: (fileId: string) => void;
  setActiveFile: (fileId: string | null) => void;
  getActiveFile: () => CodeFile | null;
  markFileAsModified: (fileId: string, modified: boolean) => void;
  
  // Settings
  updateSettings: (settings: Partial<EditorSettings>) => void;
  
  // UI toggles
  toggleFileExplorer: () => void;
  toggleTerminal: () => void;
  toggleSidebar: () => void;
  
  // Loading states
  setLoading: (loading: boolean) => void;
  setSaving: (saving: boolean) => void;
  setSubmitting: (submitting: boolean) => void;
  
  // Utilities
  hasUnsavedChanges: () => boolean;
  reset: () => void;
}

const defaultSettings: EditorSettings = {
  fontSize: 14,
  tabSize: 2,
  wordWrap: 'on',
  minimap: true,
  lineNumbers: 'on',
  theme: 'vs-dark',
  autoSave: false,
  autoSaveDelay: 2000,
};

export const useEditorStore = create<EditorState>((set, get) => ({
  // Initial state
  currentProject: null,
  files: [],
  activeFileId: null,
  settings: defaultSettings,
  isFileExplorerOpen: true,
  isTerminalOpen: false,
  isSidebarCollapsed: false,
  isLoading: false,
  isSaving: false,
  isSubmitting: false,

  // Project actions
  setCurrentProject: (project) => set({ currentProject: project }),

  // File actions
  setFiles: (files) => set({ files }),
  
  addFile: (file) => set((state) => ({
    files: [...state.files, file],
  })),
  
  updateFile: (fileId, updates) => set((state) => ({
    files: state.files.map((file) =>
      file.id === fileId ? { ...file, ...updates } : file
    ),
  })),
  
  deleteFile: (fileId) => set((state) => ({
    files: state.files.filter((file) => file.id !== fileId),
    activeFileId: state.activeFileId === fileId ? null : state.activeFileId,
  })),
  
  setActiveFile: (fileId) => set({ activeFileId: fileId }),
  
  getActiveFile: () => {
    const state = get();
    return state.files.find((file) => file.id === state.activeFileId) || null;
  },
  
  markFileAsModified: (fileId, modified) => set((state) => ({
    files: state.files.map((file) =>
      file.id === fileId ? { ...file, isModified: modified } : file
    ),
  })),

  // Settings
  updateSettings: (newSettings) => set((state) => ({
    settings: { ...state.settings, ...newSettings },
  })),

  // UI toggles
  toggleFileExplorer: () => set((state) => ({
    isFileExplorerOpen: !state.isFileExplorerOpen,
  })),
  
  toggleTerminal: () => set((state) => ({
    isTerminalOpen: !state.isTerminalOpen,
  })),
  
  toggleSidebar: () => set((state) => ({
    isSidebarCollapsed: !state.isSidebarCollapsed,
  })),

  // Loading states
  setLoading: (loading) => set({ isLoading: loading }),
  setSaving: (saving) => set({ isSaving: saving }),
  setSubmitting: (submitting) => set({ isSubmitting: submitting }),

  // Utilities
  hasUnsavedChanges: () => {
    const state = get();
    return state.files.some((file) => file.isModified);
  },
  
  reset: () => set({
    currentProject: null,
    files: [],
    activeFileId: null,
    isFileExplorerOpen: true,
    isTerminalOpen: false,
    isSidebarCollapsed: false,
    isLoading: false,
    isSaving: false,
    isSubmitting: false,
  }),
}));
