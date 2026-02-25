'use client';

import React, { useRef, useCallback, useEffect } from 'react';
import Editor, { OnMount, OnChange } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import { FileLanguage } from '@/types/code-editor.types';
import { useEditorStore } from '@/lib/stores/editor.store';
import { Loader2 } from 'lucide-react';

interface MonacoEditorProps {
  value: string;
  language: FileLanguage;
  onChange?: (value: string | undefined) => void;
  readOnly?: boolean;
  height?: string;
  className?: string;
  onSave?: () => void;
}

export function MonacoCodeEditor({
  value,
  language,
  onChange,
  readOnly = false,
  height = '100%',
  className = '',
  onSave,
}: MonacoEditorProps) {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const { settings } = useEditorStore();

  const handleEditorDidMount: OnMount = useCallback((editor, monaco) => {
    editorRef.current = editor;

    // Configure editor options
    editor.updateOptions({
      fontSize: settings.fontSize,
      tabSize: settings.tabSize,
      wordWrap: settings.wordWrap,
      minimap: { enabled: settings.minimap },
      lineNumbers: settings.lineNumbers,
      readOnly,
      automaticLayout: true,
      scrollBeyondLastLine: false,
      scrollbar: {
        vertical: 'auto',
        horizontal: 'auto',
        useShadows: false,
      },
      padding: { top: 16, bottom: 16 },
      bracketPairColorization: { enabled: true },
      cursorBlinking: 'smooth',
      smoothScrolling: true,
      contextmenu: true,
      folding: true,
      renderWhitespace: 'selection',
    });

    // Add custom keyboard shortcuts
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      // Trigger save
      if (onSave) {
        onSave();
      }
    });

    // Focus editor
    editor.focus();
  }, [settings, readOnly, onSave]);

  const handleEditorChange: OnChange = useCallback(
    (value) => {
      onChange?.(value);
    },
    [onChange]
  );

  // Update editor options when settings change
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.updateOptions({
        fontSize: settings.fontSize,
        tabSize: settings.tabSize,
        wordWrap: settings.wordWrap,
        minimap: { enabled: settings.minimap },
        lineNumbers: settings.lineNumbers,
      });
    }
  }, [settings]);

  return (
    <div className={`relative h-full w-full ${className}`}>
      <Editor
        height={height}
        language={language}
        value={value}
        onChange={handleEditorChange}
        onMount={handleEditorDidMount}
        theme={settings.theme}
        loading={
          <div className="flex h-full items-center justify-center bg-background">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        }
        options={{
          fontSize: settings.fontSize,
          tabSize: settings.tabSize,
          wordWrap: settings.wordWrap,
          minimap: { enabled: settings.minimap },
          lineNumbers: settings.lineNumbers,
          readOnly,
          automaticLayout: true,
          scrollBeyondLastLine: false,
        }}
      />
    </div>
  );
}

export function useMonacoEditor() {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);

  const getEditor = useCallback(() => editorRef.current, []);
  
  const setEditor = useCallback((editor: monaco.editor.IStandaloneCodeEditor | null) => {
    editorRef.current = editor;
  }, []);

  const formatDocument = useCallback(() => {
    if (editorRef.current) {
      editorRef.current.getAction('editor.action.formatDocument')?.run();
    }
  }, []);

  const undo = useCallback(() => {
    if (editorRef.current) {
      editorRef.current.trigger('keyboard', 'undo', null);
    }
  }, []);

  const redo = useCallback(() => {
    if (editorRef.current) {
      editorRef.current.trigger('keyboard', 'redo', null);
    }
  }, []);

  const find = useCallback(() => {
    if (editorRef.current) {
      editorRef.current.getAction('actions.find')?.run();
    }
  }, []);

  const replace = useCallback(() => {
    if (editorRef.current) {
      editorRef.current.getAction('editor.action.startFindReplaceAction')?.run();
    }
  }, []);

  return {
    getEditor,
    setEditor,
    formatDocument,
    undo,
    redo,
    find,
    replace,
  };
}
