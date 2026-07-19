import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import Editor from '../components/Editor';
import UsersList from '../components/UsersList';
import FileTabs from '../components/FileTabs';
import {
  Copy,
  Link2,
  LogOut,
  Play,
  Terminal as ConsoleIcon,
  History,
  MessageSquare,
  Users,
  Sun,
  Moon,
  VolumeX,
  Send,
  AlertTriangle
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

function Room() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user, token, logout } = useAuth();
  const socketRef = useRef(null);

  // Theme state
  const [theme, setTheme] = useState(localStorage.getItem('room-theme') || 'dark');
  const [leftSidebarWidth, setLeftSidebarWidth] = useState(280);
  const [rightSidebarWidth, setRightSidebarWidth] = useState(360);
  const [draggingPanel, setDraggingPanel] = useState(null);

  // Room state
  const [files, setFiles] = useState([]);
  const [activeFile, setActiveFile] = useState('');
  const [users, setUsers] = useState([]);
  const [cursors, setCursors] = useState({});
  const [isConnected, setIsConnected] = useState(false);

  // Typing & Presence
  const [typingUsers, setTypingUsers] = useState({});
  const typingTimeoutRef = useRef(null);

  // Chat State
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [sidebarTab, setSidebarTab] = useState('users'); // 'users' or 'chat'
  const chatEndRef = useRef(null);

  // Execution Console State
  const [consoleTab, setConsoleTab] = useState('console'); // 'console' or 'history'
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [runHistory, setRunHistory] = useState([]);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState(null);

  // Apply body theme class
  useEffect(() => {
    document.body.className = `theme-${theme}`;
    localStorage.setItem('room-theme', theme);
  }, [theme]);

  const startResize = (panel, event) => {
    event.preventDefault();
    setDraggingPanel(panel);
  };

  useEffect(() => {
    if (!draggingPanel) return;

    const handleMouseMove = (event) => {
      const minWidth = 240;
      const maxWidth = Math.max(280, Math.floor(window.innerWidth * 0.42));

      if (draggingPanel === 'left') {
        const nextWidth = Math.min(Math.max(event.clientX, minWidth), maxWidth);
        setLeftSidebarWidth(nextWidth);
      } else if (draggingPanel === 'right') {
        const nextWidth = Math.min(Math.max(window.innerWidth - event.clientX, minWidth), maxWidth);
        setRightSidebarWidth(nextWidth);
      }
    };

    const handleMouseUp = () => {
      setDraggingPanel(null);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingPanel]);

  useEffect(() => {
    if (files.length === 0) {
      setActiveFile('');
      return;
    }

    if (!activeFile || !files.some(file => file.name === activeFile)) {
      setActiveFile(files[0].name);
    }
  }, [files, activeFile]);

  // Scroll chat to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sidebarTab]);

  // Setup sockets
  useEffect(() => {
    if (!token) return;

    socketRef.current = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling']
    });

    const socket = socketRef.current;

    socket.on('connect', () => {
      setIsConnected(true);
      socket.emit('join-room', { roomId });
    });

    socket.on('connect_error', (err) => {
      console.error('Socket connection error:', err.message);
      toast.error(`Access Denied: ${err.message}`);
      logout();
      navigate('/auth');
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    // Room state initialization
    socket.on('room-state', ({ files: initialFiles, users: roomUsers }) => {
      setFiles(initialFiles);
      setUsers(roomUsers);
      if (initialFiles.length > 0) {
        // Set the first file active by default
        setActiveFile(initialFiles[0].name);
      }
    });

    // Code changes sync
    socket.on('code-update', ({ fileName, code }) => {
      setFiles(prev =>
        prev.map(f => (f.name === fileName ? { ...f, code } : f))
      );
    });

    // Language sync
    socket.on('language-update', ({ fileName, language }) => {
      setFiles(prev =>
        prev.map(f => (f.name === fileName ? { ...f, language } : f))
      );
    });

    // File CRUD sync
    socket.on('file-created', ({ file }) => {
      setFiles(prev => [...prev, file]);
      toast.success(`File created: ${file.name}`);
    });

    socket.on('file-renamed', ({ oldName, newName }) => {
      setFiles(prev =>
        prev.map(f => (f.name === oldName ? { ...f, name: newName } : f))
      );
      if (activeFile === oldName) {
        setActiveFile(newName);
      }
      toast.success(`Renamed "${oldName}" to "${newName}"`);
    });

    socket.on('file-deleted', ({ name }) => {
      setFiles(prev => prev.filter(f => f.name !== name));
      
      // Select another active tab if the deleted tab was selected
      setFiles(currentFiles => {
        const remaining = currentFiles.filter(f => f.name !== name);
        if (activeFile === name && remaining.length > 0) {
          setActiveFile(remaining[0].name);
        }
        return remaining;
      });
      toast.success(`Deleted file: ${name}`);
    });

    // Presence updates
    socket.on('user-joined', ({ user: joinedUser, users: updatedUsers }) => {
      setUsers(updatedUsers);
      toast(`${joinedUser.username} joined the room!`, { icon: '👋' });
    });

    socket.on('user-left', ({ id, username, users: updatedUsers }) => {
      setUsers(updatedUsers);
      setCursors(prev => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
      setTypingUsers(prev => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
      toast(`${username} left the room`, { icon: '🚪' });
    });

    // Cursor position sync
    socket.on('cursor-update', ({ id, fileName, cursor }) => {
      setCursors(prev => ({ ...prev, [id]: { fileName, ...cursor } }));
    });

    // Active tab presence sync
    socket.on('active-file-update', ({ id, fileName }) => {
      setUsers(prev =>
        prev.map(u => (u.id === id ? { ...u, activeFile: fileName } : u))
      );
    });

    // Typing updates
    socket.on('typing-update', ({ id, isTyping }) => {
      setTypingUsers(prev => ({ ...prev, [id]: isTyping }));
    });

    // Chat updates
    socket.on('receive-message', (data) => {
      setMessages(prev => [...prev, data]);
    });

    socket.on('error-message', ({ message }) => {
      toast.error(message);
    });

    return () => {
      socket.disconnect();
    };
  }, [roomId, token, logout, navigate]);

  // Code editor updates
  const handleCodeChange = useCallback((newCode) => {
    if (!activeFile) return;

    const targetFile = files.find(f => f.name === activeFile);
    if (!targetFile) return;

    setFiles(prev =>
      prev.map(f => (f.name === activeFile ? { ...f, code: newCode } : f))
    );
    
    // Send socket edit
    socketRef.current?.emit('code-change', {
      roomId,
      fileName: activeFile,
      code: newCode
    });

    // Handle typing status emit
    socketRef.current?.emit('typing', { roomId, isTyping: true });
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    typingTimeoutRef.current = setTimeout(() => {
      socketRef.current?.emit('typing', { roomId, isTyping: false });
    }, 1000);
  }, [roomId, activeFile]);

  // Sync cursor position
  const handleCursorMove = useCallback((cursor) => {
    socketRef.current?.emit('cursor-move', {
      roomId,
      fileName: activeFile,
      cursor
    });
  }, [roomId, activeFile]);

  // Handle local tab active selection
  const handleTabSelect = (fileName) => {
    setActiveFile(fileName);
    socketRef.current?.emit('active-file-change', {
      roomId,
      fileName
    });
  };

  // CRUD file events (emitted from FileTabs)
  const handleFileCreate = (name, language) => {
    socketRef.current?.emit('file-create', {
      roomId,
      name,
      language
    });
  };

  const handleFileRename = (oldName, newName) => {
    socketRef.current?.emit('file-rename', {
      roomId,
      oldName,
      newName
    });
  };

  const handleFileDelete = (name) => {
    socketRef.current?.emit('file-delete', {
      roomId,
      name
    });
  };

  // Run Code
  const runCode = async () => {
    const activeFileObj = files.find(f => f.name === activeFile);
    if (!activeFileObj) {
      toast.error('No active file to run');
      return;
    }

    setIsRunning(true);
    setOutput('Running code...');
    setConsoleTab('console');

    const startTime = performance.now();

    try {
      const res = await axios.post(`${API_URL}/execute`, {
        files,
        activeFileName: activeFile,
        language: activeFileObj.language,
        input
      });

      const elapsed = Math.round(performance.now() - startTime);

      let logOutput = '';
      let isSuccess = true;

      if (res.data.error) {
        logOutput = res.data.error;
        isSuccess = false;
        setOutput(`❌ Error:\n${res.data.error}`);
      } else {
        logOutput = res.data.output || 'No output returned';
        setOutput(logOutput);
      }

      // Add to execution history
      const historyItem = {
        id: Date.now(),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        fileName: activeFile,
        code: activeFileObj.code,
        input,
        output: logOutput,
        success: isSuccess,
        duration: elapsed
      };

      setRunHistory(prev => [historyItem, ...prev]);

    } catch (err) {
      setOutput(`Execution failed: ${err.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  // Chat message send
  const sendChatMessage = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    socketRef.current?.emit('send-message', {
      roomId,
      message: chatInput
    });
    setChatInput('');
  };

  // Copy helpers
  const copyRoomId = () => {
    navigator.clipboard.writeText(roomId);
    toast.success('Room ID copied!');
  };

  const copyShareLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success('Shareable link copied!');
  };

  const leaveRoom = () => {
    socketRef.current?.emit('leave-room', { roomId });
    navigate('/');
  };

  // Helper values
  const activeFileObj = files.find(f => f.name === activeFile);
  const activeLanguage = activeFileObj ? activeFileObj.language : 'javascript';
  const activeCode = activeFileObj ? activeFileObj.code : '';

  return (
    <div className="room-container flex flex-col h-screen">
      {/* Header */}
      <header className="room-header flex items-center justify-between">
        <div className="header-left flex items-center">
          <div className="room-logo flex items-center gap-2">
            <ConsoleIcon className="logo-icon-accent" size={24} />
            <h1>CodeRoom</h1>
          </div>
          <span className={`connection-badge ${isConnected ? 'connected animate-pulse-slow' : 'disconnected'}`}>
            {isConnected ? '● Connected' : '○ Disconnected'}
          </span>
        </div>

        <div className="header-right flex items-center gap-3">
          {/* Theme Toggle */}
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="theme-toggle-btn"
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          {/* Room ID Copy */}
          <div className="room-id-wrapper flex items-center">
            <span>ID: <code>{roomId}</code></span>
            <button onClick={copyRoomId} className="copy-badge-btn" title="Copy Room ID">
              <Copy size={12} />
            </button>
          </div>

          <button onClick={copyShareLink} className="btn btn-secondary flex items-center gap-1">
            <Link2 size={16} />
            <span>Copy Link</span>
          </button>

          <button onClick={leaveRoom} className="btn btn-danger flex items-center gap-1">
            <LogOut size={16} />
            <span>Leave</span>
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      <div className="room-workspace flex flex-1 overflow-hidden">
        
        {/* Left Sidebar: Users and Chat */}
        <aside className="room-sidebar flex flex-col" style={{ width: `${leftSidebarWidth}px` }}>
          <div className="sidebar-tabs flex">
            <button
              onClick={() => setSidebarTab('users')}
              className={`sidebar-tab-btn flex-1 flex items-center justify-center gap-2 ${sidebarTab === 'users' ? 'active' : ''}`}
            >
              <Users size={16} />
              <span>Users</span>
            </button>
            <button
              onClick={() => setSidebarTab('chat')}
              className={`sidebar-tab-btn flex-1 flex items-center justify-center gap-2 ${sidebarTab === 'chat' ? 'active' : ''}`}
            >
              <MessageSquare size={16} />
              <span>Chat</span>
            </button>
          </div>

          <div className="sidebar-content flex-1 overflow-y-auto">
            {sidebarTab === 'users' ? (
              <UsersList
                users={users}
                currentUserId={socketRef.current?.id}
                typingUsers={typingUsers}
              />
            ) : (
              <div className="chat-panel flex flex-col h-full">
                <div className="chat-messages flex-1 overflow-y-auto p-4">
                  {messages.length === 0 ? (
                    <div className="empty-chat flex flex-col items-center justify-center text-center p-4">
                      <MessageSquare size={32} className="text-muted" />
                      <p>No messages yet. Send a message to start chatting!</p>
                    </div>
                  ) : (
                    messages.map((msg, idx) => {
                      const isMe = msg.username === user.username;
                      return (
                        <div key={idx} className={`chat-message-wrapper ${isMe ? 'me' : 'other'}`}>
                          <div className="chat-message">
                            {!isMe && <span className="msg-sender">{msg.username}</span>}
                            <p className="msg-body">{msg.message}</p>
                            <span className="msg-time">{msg.timestamp}</span>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={chatEndRef} />
                </div>
                <form onSubmit={sendChatMessage} className="chat-input-bar flex">
                  <input
                    type="text"
                    placeholder="Type a message..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                  />
                  <button type="submit" className="chat-send-btn">
                    <Send size={16} />
                  </button>
                </form>
              </div>
            )}
          </div>
        </aside>

        <div
          className={`resizer resizer-left ${draggingPanel === 'left' ? 'active' : ''}`}
          onMouseDown={(event) => startResize('left', event)}
        />

        {/* Center: Tabs + Code Editor */}
        <section className="room-editor-container flex-1 flex flex-col">
          <FileTabs
            files={files}
            activeFile={activeFile}
            onTabSelect={handleTabSelect}
            onFileCreate={handleFileCreate}
            onFileRename={handleFileRename}
            onFileDelete={handleFileDelete}
            users={users}
          />
          
          <div className="editor-inner-wrapper flex-1 relative">
            {files.length > 0 ? (
              <Editor
                code={activeCode}
                language={activeLanguage}
                onChange={handleCodeChange}
                onCursorMove={handleCursorMove}
                cursors={cursors}
                users={users}
                activeFile={activeFile}
                theme={theme}
              />
            ) : (
              <div className="empty-editor flex flex-col items-center justify-center">
                <AlertTriangle size={48} className="text-warning mb-2" />
                <h3>No Files Open</h3>
                <p>Create a file to start editing!</p>
              </div>
            )}
          </div>
        </section>

        <div
          className={`resizer resizer-right ${draggingPanel === 'right' ? 'active' : ''}`}
          onMouseDown={(event) => startResize('right', event)}
        />

        {/* Right Panel: Console Input/Output & History */}
        <aside className="room-console-panel flex flex-col" style={{ width: `${rightSidebarWidth}px` }}>
          <div className="console-tabs flex">
            <button
              onClick={() => setConsoleTab('console')}
              className={`console-tab-btn flex-1 flex items-center justify-center gap-2 ${consoleTab === 'console' ? 'active' : ''}`}
            >
              <ConsoleIcon size={16} />
              <span>Console</span>
            </button>
            <button
              onClick={() => setConsoleTab('history')}
              className={`console-tab-btn flex-1 flex items-center justify-center gap-2 ${consoleTab === 'history' ? 'active' : ''}`}
            >
              <History size={16} />
              <span>Run History</span>
            </button>
          </div>

          <div className="console-content flex-1 overflow-y-auto p-4">
            {consoleTab === 'console' ? (
              <div className="console-main-wrapper flex flex-col h-full gap-4">
                {/* Inputs block */}
                <div className="console-block">
                  <div className="console-block-header">
                    <span>Input (stdin)</span>
                  </div>
                  <textarea
                    placeholder="Provide standard inputs here (one per line)..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    className="console-textarea"
                  />
                </div>

                {/* Run Button */}
                <button
                  onClick={runCode}
                  disabled={isRunning || files.length === 0}
                  className="btn btn-success run-btn flex items-center justify-center gap-2"
                >
                  <Play size={16} />
                  <span>{isRunning ? 'Running...' : 'Run Code'}</span>
                </button>

                {/* Outputs block */}
                <div className="console-block flex-1 flex flex-col min-h-[150px]">
                  <div className="console-block-header">
                    <span>Output (stdout/stderr)</span>
                  </div>
                  <pre className="console-output flex-1 overflow-auto">
                    {output || 'Output of code execution will appear here...'}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="console-history-wrapper">
                <h3>📜 Execution Log</h3>
                {runHistory.length === 0 ? (
                  <p className="text-muted p-4 text-center">No runs logged yet in this session.</p>
                ) : (
                  <ul className="history-list">
                    {runHistory.map((item) => (
                      <li
                        key={item.id}
                        className={`history-item ${item.success ? 'success' : 'failed'}`}
                        onClick={() => setSelectedHistoryItem(item)}
                      >
                        <div className="history-meta flex justify-between">
                          <span className="history-file"><code>{item.fileName}</code></span>
                          <span className="history-duration">{item.duration}ms</span>
                        </div>
                        <div className="history-details flex justify-between items-center mt-1">
                          <span className="history-status">{item.success ? 'Success' : 'Error'}</span>
                          <span className="history-time">{item.timestamp}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* History Detail Modal */}
      {selectedHistoryItem && (
        <div className="modal-overlay" onClick={() => setSelectedHistoryItem(null)}>
          <div className="modal-card max-w-2xl" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Execution Run Details</h3>
              <p>Ran <code>{selectedHistoryItem.fileName}</code> at {selectedHistoryItem.timestamp} ({selectedHistoryItem.duration}ms)</p>
            </div>
            <div className="modal-body history-modal-body">
              <div className="modal-body-section">
                <h4>Code Executed</h4>
                <pre className="modal-pre code-pre">{selectedHistoryItem.code}</pre>
              </div>
              
              {selectedHistoryItem.input && (
                <div className="modal-body-section">
                  <h4>Stdin Input</h4>
                  <pre className="modal-pre">{selectedHistoryItem.input}</pre>
                </div>
              )}

              <div className="modal-body-section">
                <h4>Stdout Output</h4>
                <pre className={`modal-pre ${selectedHistoryItem.success ? 'success-text' : 'error-text'}`}>
                  {selectedHistoryItem.output}
                </pre>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  onClick={() => setSelectedHistoryItem(null)}
                  className="btn btn-secondary"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Room;