'use client';

import { useEffect, useRef, useState } from 'react';
import type * as Monaco from 'monaco-editor';

type CodeDiffEditorProps = {
  original: string;
  modified: string;
  language: string;
  filename: string;
};

const CodeDiffEditor = ({ original, modified, language, filename }: CodeDiffEditorProps) => {
  const diffEditorRef = useRef<Monaco.editor.IStandaloneDiffEditor | null>(null);
  const monacoRef = useRef<typeof Monaco | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Initialize Monaco Diff Editor
  useEffect(() => {
    if (!containerRef.current) return;

    let disposed = false;

    // Dynamically import monaco-editor
    import('monaco-editor').then((monaco) => {
      if (disposed || !containerRef.current) return;

      monacoRef.current = monaco;

      // Configure Monaco Environment for web workers
      (window as any).MonacoEnvironment = {
        getWorker(_: string, label: string) {
          if (label === 'json') {
            return new Worker(
              new URL('monaco-editor/esm/vs/language/json/json.worker', import.meta.url)
            );
          }
          if (label === 'css' || label === 'scss' || label === 'less') {
            return new Worker(
              new URL('monaco-editor/esm/vs/language/css/css.worker', import.meta.url)
            );
          }
          if (label === 'html' || label === 'handlebars' || label === 'razor') {
            return new Worker(
              new URL('monaco-editor/esm/vs/language/html/html.worker', import.meta.url)
            );
          }
          if (label === 'typescript' || label === 'javascript') {
            return new Worker(
              new URL('monaco-editor/esm/vs/language/typescript/ts.worker', import.meta.url)
            );
          }
          return new Worker(
            new URL('monaco-editor/esm/vs/editor/editor.worker', import.meta.url)
          );
        },
      };

      // Disable TypeScript/JavaScript diagnostics
      monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
        noSemanticValidation: true,
        noSyntaxValidation: true,
        noSuggestionDiagnostics: true,
      });
      monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
        noSemanticValidation: true,
        noSyntaxValidation: true,
        noSuggestionDiagnostics: true,
      });

      // Define custom light theme
      monaco.editor.defineTheme('customLightTheme', {
        base: 'vs',
        inherit: true,
        rules: [],
        colors: {
          'editorLineNumber.foreground': '#9ca3af',
          'editorLineNumber.activeForeground': '#000000',
          'editor.lineHighlightBorder': '#00000000',
          'editor.foldBackground': '#f3f4f6',
        },
      });

      // Define custom dark theme
      monaco.editor.defineTheme('customDarkTheme', {
        base: 'vs-dark',
        inherit: true,
        rules: [],
        colors: {
          'editor.background': '#0a0a0a',
          'editorLineNumber.foreground': '#6b7280',
          'editorLineNumber.activeForeground': '#f9fafb',
          'editor.lineHighlightBorder': '#00000000',
          'editor.foldBackground': '#1f2937',
        },
      });

      // Detect initial theme
      const initialIsDark = document.documentElement.classList.contains('dark');
      setIsDarkMode(initialIsDark);

      // Create models for original and modified content
      const monacoLanguage = getMonacoLanguage(language);
      const originalModel = monaco.editor.createModel(original, monacoLanguage);
      const modifiedModel = monaco.editor.createModel(modified, monacoLanguage);

      // Create the diff editor
      diffEditorRef.current = monaco.editor.createDiffEditor(containerRef.current, {
        theme: initialIsDark ? 'customDarkTheme' : 'customLightTheme',
        automaticLayout: true,
        readOnly: true,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        fontSize: 12,
        lineNumbers: 'on',
        lineNumbersMinChars: 3,
        renderLineHighlight: 'line',
        wordWrap: 'off',
        folding: true,
        glyphMargin: false,
        renderSideBySide: true,
        scrollbar: {
          vertical: 'visible',
          horizontal: 'visible',
          verticalScrollbarSize: 4,
          horizontalScrollbarSize: 4,
        },
      });

      // Set the models
      diffEditorRef.current.setModel({
        original: originalModel,
        modified: modifiedModel,
      });

      setIsLoading(false);
    });

    return () => {
      disposed = true;
      if (diffEditorRef.current) {
        const models = diffEditorRef.current.getModel();
        // First, clear the model from the diff editor
        diffEditorRef.current.setModel(null);
        // Then dispose the models
        models?.original?.dispose();
        models?.modified?.dispose();
        // Finally dispose the diff editor
        diffEditorRef.current.dispose();
      }
    };
  }, []);

  // Update content when original/modified props change
  useEffect(() => {
    if (diffEditorRef.current && monacoRef.current) {
      const models = diffEditorRef.current.getModel();
      if (models) {
        if (models.original.getValue() !== original) {
          models.original.setValue(original);
        }
        if (models.modified.getValue() !== modified) {
          models.modified.setValue(modified);
        }
      }
    }
  }, [original, modified]);

  // Update language when it changes
  useEffect(() => {
    if (diffEditorRef.current && monacoRef.current) {
      const models = diffEditorRef.current.getModel();
      if (models) {
        const monacoLanguage = getMonacoLanguage(language);
        monacoRef.current.editor.setModelLanguage(models.original, monacoLanguage);
        monacoRef.current.editor.setModelLanguage(models.modified, monacoLanguage);
      }
    }
  }, [language]);

  // Watch for theme changes
  useEffect(() => {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          const isDark = document.documentElement.classList.contains('dark');
          setIsDarkMode(isDark);
          if (diffEditorRef.current && monacoRef.current) {
            monacoRef.current.editor.setTheme(isDark ? 'customDarkTheme' : 'customLightTheme');
          }
        }
      });
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => observer.disconnect();
  }, []);

  return (
    <div className="h-full w-full" ref={containerRef}>
      <style jsx global>{`
        .monaco-editor .line-numbers {
          font-size: 12px !important;
        }
        .monaco-editor .scrollbar .slider {
          border-radius: 4px !important;
        }
      `}</style>
    </div>
  );
};

// Map our language names to Monaco language identifiers
function getMonacoLanguage(language: string): string {
  const languageMap: Record<string, string> = {
    'javascript': 'javascript',
    'typescript': 'typescript',
    'jsx': 'javascript',
    'tsx': 'typescript',
    'json': 'json',
    'css': 'css',
    'scss': 'scss',
    'less': 'less',
    'html': 'html',
    'markup': 'html',
    'markdown': 'markdown',
    'python': 'python',
    'go': 'go',
    'rust': 'rust',
    'java': 'java',
    'kotlin': 'kotlin',
    'swift': 'swift',
    'yaml': 'yaml',
    'sql': 'sql',
    'bash': 'shell',
    'toml': 'ini',
    'plain': 'plaintext',
  };

  return languageMap[language] || 'plaintext';
}

export default CodeDiffEditor;
