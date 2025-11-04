'use client';

import { useEffect, useRef, useState } from 'react';
import type * as Monaco from 'monaco-editor';

type CodeEditorProps = {
  value: string;
  language: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  highlightRequest?: { line: number; timestamp: number } | null;
};

const CodeEditor = ({ value, language, onChange, readOnly = false, highlightRequest }: CodeEditorProps) => {
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof Monaco | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const decorationsRef = useRef<string[]>([]);
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Initialize Monaco Editor
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

      // Disable TypeScript/JavaScript diagnostics to remove error underlines
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
          'editorLineNumber.foreground': '#9ca3af', // Gray-400
          'editorLineNumber.activeForeground': '#000000', // Black
          'editor.lineHighlightBorder': '#00000000', // Transparent (removes border)
          'editor.foldBackground': '#f3f4f6', // Gray-100 (lighter, less blue)
        },
      });

      // Define custom dark theme
      monaco.editor.defineTheme('customDarkTheme', {
        base: 'vs-dark',
        inherit: true,
        rules: [],
        colors: {
          'editor.background': '#0a0a0a', // gray-950
          'editorLineNumber.foreground': '#6b7280', // Gray-500
          'editorLineNumber.activeForeground': '#f9fafb', // Gray-50
          'editor.lineHighlightBorder': '#00000000', // Transparent
          'editor.foldBackground': '#1f2937', // Gray-800
        },
      });

      // Detect initial theme
      const initialIsDark = document.documentElement.classList.contains('dark');
      setIsDarkMode(initialIsDark);

      // Create the editor
      editorRef.current = monaco.editor.create(containerRef.current, {
        value,
        language: getMonacoLanguage(language),
        theme: initialIsDark ? 'customDarkTheme' : 'customLightTheme',
        readOnly,
        automaticLayout: true,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        fontSize: 12,
        lineNumbers: 'on',
        lineNumbersMinChars: 3,
        renderLineHighlight: 'line',
        cursorStyle: 'line',
        wordWrap: 'off',
        folding: true,
        glyphMargin: false,
        occurrencesHighlight: 'off',
        scrollbar: {
          vertical: 'visible',
          horizontal: 'visible',
          verticalScrollbarSize: 4,
          horizontalScrollbarSize: 4,
        },
      });

      // Listen for content changes
      editorRef.current.onDidChangeModelContent(() => {
        const newValue = editorRef.current?.getValue() ?? '';
        if (newValue !== value) {
          onChange(newValue);
        }
      });

      setIsLoading(false);
    });

    return () => {
      disposed = true;
      editorRef.current?.dispose();
    };
  }, []);

  // Update editor value when prop changes
  useEffect(() => {
    if (editorRef.current && editorRef.current.getValue() !== value) {
      const model = editorRef.current.getModel();
      if (model) {
        editorRef.current.setValue(value);
      }
    }
  }, [value]);

  // Update language when it changes
  useEffect(() => {
    if (editorRef.current && monacoRef.current) {
      const model = editorRef.current.getModel();
      if (model) {
        monacoRef.current.editor.setModelLanguage(model, getMonacoLanguage(language));
      }
    }
  }, [language]);

  // Update readonly state
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.updateOptions({ readOnly });
    }
  }, [readOnly]);

  // Watch for theme changes
  useEffect(() => {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          const isDark = document.documentElement.classList.contains('dark');
          setIsDarkMode(isDark);
          if (editorRef.current && monacoRef.current) {
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

  // Highlight and scroll to line when highlightRequest changes
  useEffect(() => {
    if (!editorRef.current || !monacoRef.current || !highlightRequest) return;

    const editor = editorRef.current;
    const lineNumber = highlightRequest.line;

    // Wait a bit for the content to be fully rendered
    const timer = setTimeout(() => {
      if (!editorRef.current || !monacoRef.current) return;

      // Scroll to the line
      editor.revealLineInCenter(lineNumber);

      // Highlight the line with a background color
      const newDecorations = editor.deltaDecorations(decorationsRef.current, [
        {
          range: new (monacoRef.current.Range)(lineNumber, 1, lineNumber, 1),
          options: {
            isWholeLine: true,
            className: 'highlight-line',
            linesDecorationsClassName: 'highlight-line-gutter',
          },
        },
      ]);

      decorationsRef.current = newDecorations;

      // Remove highlight after 2 seconds
      const clearTimer = setTimeout(() => {
        if (editorRef.current) {
          decorationsRef.current = editorRef.current.deltaDecorations(decorationsRef.current, []);
        }
      }, 2000);

      return () => clearTimeout(clearTimer);
    }, 150);

    return () => clearTimeout(timer);
  }, [highlightRequest]);

  return (
    <div className="h-full w-full" ref={containerRef}>
      <style jsx global>{`
        .monaco-editor .line-numbers {
          font-size: 12px !important;
        }
        .monaco-editor .scrollbar .slider {
          border-radius: 4px !important;
        }
        .monaco-editor .highlight-line {
          background-color: rgba(59, 130, 246, 0.15) !important;
          animation: highlight-fade 2s ease-out;
        }
        .monaco-editor .highlight-line-gutter {
          background-color: rgba(59, 130, 246, 0.3) !important;
        }
        @keyframes highlight-fade {
          0% {
            background-color: rgba(59, 130, 246, 0.3);
          }
          100% {
            background-color: rgba(59, 130, 246, 0.15);
          }
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

export default CodeEditor;
