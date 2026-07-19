import { useRef, useEffect } from 'react';
import MonacoEditor from '@monaco-editor/react';

function Editor({
  code,
  language,
  onChange,
  onCursorMove,
  cursors,
  users,
  activeFile,
  theme = 'vs-dark'
}) {
  const editorRef = useRef(null);
  const decorationsRef = useRef([]);
  const monacoRef = useRef(null);

  // Handle editor mount
  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Track cursor position changes
    editor.onDidChangeCursorPosition((e) => {
      const position = e.position;
      onCursorMove({
        fileName: activeFile,
        lineNumber: position.lineNumber,
        column: position.column
      });
    });

    // Define custom premium dark theme for Monaco
    monaco.editor.defineTheme('coderoom-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '6272a4', fontStyle: 'italic' },
        { token: 'keyword', foreground: 'ff79c6' },
        { token: 'string', foreground: 'f1fa8c' },
        { token: 'number', foreground: 'bd93f9' },
        { token: 'regexp', foreground: 'ffb86c' },
        { token: 'type', foreground: '8be9fd' },
        { token: 'class', foreground: '50fa7b' },
        { token: 'function', foreground: '50fa7b' }
      ],
      colors: {
        'editor.background': '#0a0b10', // Match deep dark layout
        'editor.foreground': '#f8f8f2',
        'editor.lineHighlightBackground': '#1a1b26',
        'editorCursor.foreground': '#a855f7',
        'editor.selectionBackground': '#44475a50',
        'editorLineNumber.foreground': '#4b5563',
        'editorLineNumber.activeForeground': '#a855f7'
      }
    });

    // Define custom premium light theme
    monaco.editor.defineTheme('coderoom-light', {
      base: 'vs',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': '#ffffff',
        'editor.lineHighlightBackground': '#f3f4f6',
        'editorCursor.foreground': '#6366f1',
        'editor.selectionBackground': '#e0e7ff',
        'editorLineNumber.foreground': '#9ca3af',
        'editorLineNumber.activeForeground': '#6366f1'
      }
    });

    // Set theme according to current global theme
    monaco.editor.setTheme(theme === 'dark' ? 'coderoom-dark' : 'coderoom-light');
  };

  // Switch Monaco themes when global theme toggled
  useEffect(() => {
    if (monacoRef.current) {
      monacoRef.current.editor.setTheme(
        theme === 'dark' ? 'coderoom-dark' : 'coderoom-light'
      );
    }
  }, [theme]);

  // Keep Monaco content aligned with the current file state
  useEffect(() => {
    if (!editorRef.current) return;

    const currentValue = editorRef.current.getValue();
    const nextValue = code ?? '';

    if (currentValue !== nextValue) {
      editorRef.current.getModel()?.setValue(nextValue);
    }

    if (activeFile) {
      editorRef.current.focus();
    }
  }, [code, activeFile]);

  // Update remote cursors
  useEffect(() => {
    if (!editorRef.current || !monacoRef.current) return;

    const editor = editorRef.current;
    const monaco = monacoRef.current;

    // Clear old decorations
    decorationsRef.current = editor.deltaDecorations(
      decorationsRef.current,
      []
    );

    // Create new decorations for each cursor
    const newDecorations = [];

    Object.entries(cursors).forEach(([id, cursor]) => {
      // Validate cursor and make sure it is in the active file
      if (!cursor || cursor.fileName !== activeFile) return;
      
      const user = users.find(u => u.id === id);
      if (!user) return;

      // Add decorations: remote cursor style
      newDecorations.push({
        range: new monaco.Range(
          cursor.lineNumber,
          cursor.column,
          cursor.lineNumber,
          cursor.column + 1
        ),
        options: {
          className: 'remote-cursor',
          beforeContentClassName: 'cursor-label',
          stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges
        }
      });
    });

    decorationsRef.current = editor.deltaDecorations(
      decorationsRef.current,
      newDecorations
    );
  }, [cursors, users, activeFile]);

  // Handle code changes from editor
  const handleEditorChange = (value) => {
    onChange(value || '');
  };

  return (
    <div className="editor-wrapper">
      {/* Remote cursor floating name tags */}
      <div className="cursor-labels">
        {Object.entries(cursors).map(([id, cursor]) => {
          if (!cursor || cursor.fileName !== activeFile) return null;
          const user = users.find(u => u.id === id);
          if (!user) return null;

          return (
            <div
              key={id}
              className="cursor-label-float"
              style={{
                backgroundColor: user.color,
                top: `${(cursor.lineNumber - 1) * 19}px` // 19px line height is standard in Monaco with 14px font
              }}
            >
              {user.username}
            </div>
          );
        })}
      </div>

      <MonacoEditor
        key={activeFile || 'default-file'}
        height="100%"
        language={language || 'javascript'}
        value={code ?? ''}
        onChange={handleEditorChange}
        onMount={handleEditorDidMount}
        theme={theme === 'dark' ? 'vs-dark' : 'vs'}
        options={{
          fontSize: 14,
          fontFamily: 'JetBrains Mono, Fira Code, monospace',
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 2,
          wordWrap: 'on',
          lineNumbers: 'on',
          renderWhitespace: 'selection',
          cursorBlinking: 'smooth',
          cursorSmoothCaretAnimation: true,
          padding: { top: 12, bottom: 12 },
          readOnly: false
        }}
      />
    </div>
  );
}

export default Editor;
