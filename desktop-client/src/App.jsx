import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageSquare, BookOpen, CheckSquare, BrainCircuit, 
  Smartphone, ShieldCheck, History, Settings, LogOut, 
  Mic, MicOff, Send, Volume2, VolumeX, Moon, Sun, 
  AlertTriangle, Check, X, ShieldAlert, Cpu, Search, Trash2, Edit3, Plus
} from 'lucide-react';

const DEFAULT_API_BASE = import.meta.env.VITE_API_URL || 'https://vesper-ai-oei3.onrender.com/api';

export default function App() {
  const [apiBaseUrl, setApiBaseUrl] = useState(localStorage.getItem('apiBaseUrl') || DEFAULT_API_BASE);
  const API_BASE = apiBaseUrl;
  // Theme & App states
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [activeTab, setActiveTab] = useState('chat');
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [username, setUsername] = useState(localStorage.getItem('username') || '');
  const [deviceId, setDeviceId] = useState(localStorage.getItem('deviceId') || '');

  // Auth Forms
  const [isRegister, setIsRegister] = useState(false);
  const [authUsername, setAuthUsername] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authError, setAuthError] = useState('');

  // Data lists
  const [conversations, setConversations] = useState([]);
  const [activeConvId, setActiveConvId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [notes, setNotes] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [memories, setMemories] = useState([]);
  const [devices, setDevices] = useState([]);
  const [devicePermissions, setDevicePermissions] = useState([]);
  const [toolPermissions, setToolPermissions] = useState([]);
  const [actionLogs, setActionLogs] = useState([]);

  // Voice Assistant states
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [assistantState, setAssistantState] = useState('IDLE'); // IDLE, LISTENING, THINKING, EXECUTING, SPEAKING, ERROR
  const [voiceText, setVoiceText] = useState('');
  
  // Dialogs & Security overlays
  const [pendingPermission, setPendingPermission] = useState(null); // { permissionName, explanation, toolName, parameters }
  const [pendingConfirmation, setPendingConfirmation] = useState(null); // { actionLogId, toolName, parameters }
  
  // Note form state
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [editingNoteId, setEditingNoteId] = useState(null);

  // Task form state
  const [taskTitle, setTaskTitle] = useState('');
  const [taskPriority, setTaskPriority] = useState('MEDIUM');

  // Memory form state
  const [memoryContent, setMemoryContent] = useState('');

  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);
  const isSendingRef = useRef(false);

  const [localIP, setLocalIP] = useState('127.0.0.1');

  // Auto-generate device ID on mount if not exists
  useEffect(() => {
    if (!localStorage.getItem('deviceId')) {
      const newId = 'LAPTOP_' + Math.random().toString(36).substring(2, 11).toUpperCase();
      localStorage.setItem('deviceId', newId);
      setDeviceId(newId);
    }
  }, []);

  // Fetch local IP address
  useEffect(() => {
    if (window.desktopAPI && window.desktopAPI.getLocalIP) {
      window.desktopAPI.getLocalIP().then(ip => setLocalIP(ip));
    }
  }, []);

  // Web Speech API Initialization
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = 'en-US';

      rec.onstart = () => {
        setAssistantState('LISTENING');
      };

      rec.onresult = (event) => {
        const text = event.results[0][0].transcript;
        setChatInput(text);
        setVoiceText(text);
        setAssistantState('THINKING');
        sendChatMessage(text);
      };

      rec.onerror = (err) => {
        console.error('Speech recognition error:', err);
        setAssistantState('ERROR');
        setTimeout(() => setAssistantState('IDLE'), 2000);
      };

      rec.onend = () => {
        if (assistantState === 'LISTENING') {
          setAssistantState('IDLE');
        }
      };

      recognitionRef.current = rec;
    }
  }, [token, activeConvId]);

  // Fetch data when token or active tab changes
  useEffect(() => {
    if (!token) return;
    if (activeTab === 'chat') {
      fetchConversations();
    } else if (activeTab === 'notes') {
      fetchNotes();
    } else if (activeTab === 'tasks') {
      fetchTasks();
    } else if (activeTab === 'memory') {
      fetchMemories();
    } else if (activeTab === 'devices') {
      fetchDevices();
    } else if (activeTab === 'permissions') {
      fetchToolPermissions();
      if (devices.length > 0) {
        fetchDevicePermissions(devices[0].id);
      } else {
        fetchDevices().then(devs => {
          if (devs && devs.length > 0) fetchDevicePermissions(devs[0].id);
        });
      }
    } else if (activeTab === 'logs') {
      fetchActionLogs();
    }
  }, [activeTab, token]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Speech Output (Text-to-Speech)
  const speakText = (text) => {
    if (!voiceEnabled) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onstart = () => setAssistantState('SPEAKING');
    utterance.onend = () => setAssistantState('IDLE');
    utterance.onerror = () => setAssistantState('IDLE');
    window.speechSynthesis.speak(utterance);
  };

  // Toggle Voice listening
  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert('Speech recognition is not supported in this browser.');
      return;
    }
    if (assistantState === 'LISTENING') {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
    }
  };

  // API Call helper
  const apiCall = async (url, options = {}) => {
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
    const response = await fetch(url, { ...options, headers });
    if (!response.ok) {
      if (response.status === 403 || response.status === 401) {
        // Token expired, log out
        handleLogout();
      }
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `HTTP error ${response.status}`);
    }
    return response.json();
  };

  // Authentication Actions
  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError('');
    try {
      if (isRegister) {
        await apiCall(`${API_BASE}/auth/register`, {
          method: 'POST',
          body: JSON.stringify({ username: authUsername, password: authPassword, email: authEmail })
        });
        setIsRegister(false);
        alert('Registration successful! Please login.');
      } else {
        const res = await apiCall(`${API_BASE}/auth/login`, {
          method: 'POST',
          body: JSON.stringify({
            username: authUsername,
            password: authPassword,
            deviceId: deviceId,
            deviceName: 'My Laptop Client',
            platform: 'DESKTOP',
            capabilities: '["MICROPHONE", "CAMERA", "SCREEN_CAPTURE", "FILE_ACCESS"]'
          })
        });
        setToken(res.token);
        setUsername(res.username);
        localStorage.setItem('token', res.token);
        localStorage.setItem('username', res.username);
        setActiveTab('chat');
      }
    } catch (err) {
      setAuthError(err.message);
    }
  };

  const handleLogout = () => {
    if (token) {
      fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      }).catch(() => {});
    }
    setToken('');
    setUsername('');
    localStorage.removeItem('token');
    localStorage.removeItem('username');
  };

  // Chat/AI Interactions
  const fetchConversations = async () => {
    try {
      const data = await apiCall(`${API_BASE}/conversations`);
      setConversations(data);
      if (data.length > 0 && !activeConvId) {
        handleSelectConversation(data[0].id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSelectConversation = async (convId) => {
    setActiveConvId(convId);
    try {
      const msgs = await apiCall(`${API_BASE}/conversations/${convId}`);
      setMessages(msgs);
    } catch (err) {
      console.error(err);
    }
  };

  const startNewConversation = () => {
    setActiveConvId(null);
    setMessages([]);
  };

  const sendChatMessage = async (msgText) => {
    const textToSend = msgText || chatInput;
    if (!textToSend.trim()) return;
    if (isSendingRef.current || assistantState === 'THINKING') return;
    isSendingRef.current = true;
    setChatInput('');
    setAssistantState('THINKING');

    // Add user message optimistically
    setMessages(prev => [...prev, { sender: 'USER', content: textToSend, createdAt: new Date().toISOString() }]);

    try {
      const res = await apiCall(`${API_BASE}/chat`, {
        method: 'POST',
        body: JSON.stringify({
          conversationId: activeConvId,
          message: textToSend,
          deviceId: deviceId
        })
      });

      if (res.conversationId && !activeConvId) {
        setActiveConvId(res.conversationId);
        fetchConversations();
      }

      // Check return status states
      if (res.status === 'PERMISSION_REQUIRED') {
        setPendingPermission({
          permissionName: res.permissionName,
          explanation: res.explanation,
          toolName: res.toolName,
          parameters: res.parameters
        });
        setAssistantState('IDLE');
      } else if (res.status === 'CONFIRMATION_REQUIRED') {
        setPendingConfirmation({
          actionLogId: res.actionLogId,
          toolName: res.toolName,
          parameters: res.parameters
        });
        setAssistantState('IDLE');
      } else if (res.status === 'EXECUTE_ON_CLIENT') {
        setAssistantState('EXECUTING');
        executeLocalDesktopTool(res.toolName, res.parameters);
      } else {
        // COMPLETED
        setMessages(prev => [...prev, { sender: 'ASSISTANT', content: res.reply, createdAt: new Date().toISOString() }]);
        setAssistantState('SPEAKING');
        speakText(res.reply);
      }
    } catch (err) {
      console.error(err);
      setAssistantState('ERROR');
      setTimeout(() => setAssistantState('IDLE'), 2000);
    } finally {
      isSendingRef.current = false;
    }
  };

  // Local desktop tool executor (via electron bridge)
  const executeLocalDesktopTool = async (toolName, parameters) => {
    if (!window.desktopAPI) {
      const errMsg = `Cannot execute local desktop tool '${toolName}' outside Electron environment.`;
      reportLocalToolResult(toolName, 'FAILED', errMsg);
      return;
    }

    try {
      let outputText = '';
      if (toolName === 'OPEN_APP') {
        outputText = await window.desktopAPI.openApp(parameters.name);
      } else if (toolName === 'OPEN_FILE') {
        outputText = await window.desktopAPI.openFile(parameters.path);
      } else if (toolName === 'SEARCH_FILE') {
        const files = await window.desktopAPI.searchFile(parameters.query);
        outputText = files.length > 0 
          ? `Found files:\n${files.map(f => `- ${f.name} (at ${f.path})`).join('\n')}`
          : `No matching files found for '${parameters.query}'.`;
      } else if (toolName === 'TAKE_SCREENSHOT') {
        const dataUrl = await window.desktopAPI.takeScreenshot();
        outputText = 'Captured primary screen screenshot successfully.';
        // Custom show of screenshot in chat
        setMessages(prev => [...prev, { sender: 'ASSISTANT', content: `[Screenshot]`, image: dataUrl, createdAt: new Date().toISOString() }]);
      } else if (toolName === 'CLIPBOARD_READ') {
        const clip = await window.desktopAPI.readClipboard();
        outputText = `Clipboard content: "${clip}"`;
      } else if (toolName === 'CLIPBOARD_WRITE') {
        outputText = await window.desktopAPI.writeClipboard(parameters.text);
      } else {
        outputText = `Tool '${toolName}' execution simulated.`;
      }

      reportLocalToolResult(toolName, 'EXECUTED', outputText);
    } catch (err) {
      console.error(err);
      reportLocalToolResult(toolName, 'FAILED', err.message);
    }
  };

  const reportLocalToolResult = async (toolName, status, resultText) => {
    try {
      await apiCall(`${API_BASE}/tools/execute`, {
        method: 'POST',
        body: JSON.stringify({
          toolName,
          status,
          result: resultText,
          conversationId: activeConvId
        })
      });
      // Fetch latest messages to sync tool response message
      if (activeConvId) {
        handleSelectConversation(activeConvId);
      }
      setAssistantState('IDLE');
    } catch (err) {
      console.error(err);
    }
  };

  // Permission dialogues approval
  const handleApprovePermission = async () => {
    if (!pendingPermission) return;
    try {
      // 1. Save permission to backend
      const devs = await apiCall(`${API_BASE}/devices`);
      const currentDev = devs.find(d => d.deviceId === deviceId);
      if (currentDev) {
        await apiCall(`${API_BASE}/permissions/request`, {
          method: 'POST',
          body: JSON.stringify({
            deviceId: currentDev.id,
            permissionName: pendingPermission.permissionName,
            status: 'GRANTED'
          })
        });
      }
      setPendingPermission(null);
      // Re-trigger the message intent so it runs now
      sendChatMessage(`Request: Execute tool ${pendingPermission.toolName} with parameters.`);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDenyPermission = () => {
    setPendingPermission(null);
    setMessages(prev => [...prev, { sender: 'ASSISTANT', content: 'Permission request denied. Action aborted.', createdAt: new Date().toISOString() }]);
  };

  // Confirmation Dialogue actions
  const handleConfirmAction = async (approve) => {
    if (!pendingConfirmation) return;
    try {
      const res = await apiCall(`${API_BASE}/tools/confirm`, {
        method: 'POST',
        body: JSON.stringify({
          actionLogId: pendingConfirmation.actionLogId,
          approve: approve,
          conversationId: activeConvId
        })
      });
      setPendingConfirmation(null);
      
      if (res.status === 'EXECUTE_ON_CLIENT') {
        executeLocalDesktopTool(res.toolName, res.parameters);
      } else if (activeConvId) {
        handleSelectConversation(activeConvId);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Notes CRUD
  const fetchNotes = async () => {
    const data = await apiCall(`${API_BASE}/notes`);
    setNotes(data);
  };

  const handleSaveNote = async (e) => {
    e.preventDefault();
    if (!noteTitle.trim()) return;
    try {
      if (editingNoteId) {
        await apiCall(`${API_BASE}/notes/${editingNoteId}`, {
          method: 'PUT',
          body: JSON.stringify({ title: noteTitle, content: noteContent })
        });
      } else {
        await apiCall(`${API_BASE}/notes`, {
          method: 'POST',
          body: JSON.stringify({ title: noteTitle, content: noteContent })
        });
      }
      setNoteTitle('');
      setNoteContent('');
      setEditingNoteId(null);
      fetchNotes();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteNote = async (noteId) => {
    if (confirm('Are you sure you want to delete this note?')) {
      await apiCall(`${API_BASE}/notes/${noteId}`, { method: 'DELETE' });
      fetchNotes();
    }
  };

  // Tasks CRUD
  const fetchTasks = async () => {
    const data = await apiCall(`${API_BASE}/tasks`);
    setTasks(data);
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;
    await apiCall(`${API_BASE}/tasks`, {
      method: 'POST',
      body: JSON.stringify({ title: taskTitle, description: 'Added from desktop panel', priority: taskPriority })
    });
    setTaskTitle('');
    fetchTasks();
  };

  const handleToggleTask = async (task) => {
    await apiCall(`${API_BASE}/tasks/${task.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        title: task.title,
        description: task.description,
        completed: !task.completed,
        priority: task.priority
      })
    });
    fetchTasks();
  };

  const handleDeleteTask = async (taskId) => {
    await apiCall(`${API_BASE}/tasks/${taskId}`, { method: 'DELETE' });
    fetchTasks();
  };

  // Memories CRUD
  const fetchMemories = async () => {
    const data = await apiCall(`${API_BASE}/memory`);
    setMemories(data);
  };

  const handleCreateMemory = async (e) => {
    e.preventDefault();
    if (!memoryContent.trim()) return;
    await apiCall(`${API_BASE}/memory`, {
      method: 'POST',
      body: JSON.stringify({ content: memoryContent })
    });
    setMemoryContent('');
    fetchMemories();
  };

  const handleDeleteMemory = async (memId) => {
    await apiCall(`${API_BASE}/memory/${memId}`, { method: 'DELETE' });
    fetchMemories();
  };

  // Devices & Revocation
  const fetchDevices = async () => {
    const data = await apiCall(`${API_BASE}/devices`);
    setDevices(data);
    return data;
  };

  const handleRevokeDevice = async (id) => {
    if (confirm('Revoking this device will instantly terminate all active sessions. Proceed?')) {
      await apiCall(`${API_BASE}/devices/${id}`, { method: 'DELETE' });
      fetchDevices();
    }
  };

  // Permissions Center fetching/handling
  const fetchDevicePermissions = async (devId) => {
    const data = await apiCall(`${API_BASE}/permissions?deviceId=${devId}`);
    setDevicePermissions(data);
  };

  const fetchToolPermissions = async () => {
    const data = await apiCall(`${API_BASE}/permissions/tools`);
    setToolPermissions(data);
  };

  const handleUpdatePermission = async (permName, status) => {
    const devs = await apiCall(`${API_BASE}/devices`);
    const currentDev = devs.find(d => d.deviceId === deviceId);
    if (!currentDev) return;
    await apiCall(`${API_BASE}/permissions/request`, {
      method: 'POST',
      body: JSON.stringify({
        deviceId: currentDev.id,
        permissionName: permName,
        status: status
      })
    });
    fetchDevicePermissions(currentDev.id);
  };

  const handleUpdateToolPermissionStatus = async (toolName, status) => {
    await apiCall(`${API_BASE}/permissions/tools`, {
      method: 'POST',
      body: JSON.stringify({ toolName, status })
    });
    fetchToolPermissions();
  };

  // Action logs
  const fetchActionLogs = async () => {
    const data = await apiCall(`${API_BASE}/actions`);
    setActionLogs(data);
  };

  if (!token) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-6 ${isDarkMode ? 'dark-mode bg-[#0b0c10]' : 'bg-[#f5f7fb]'}`}>
        <div className="w-full max-w-md glass-panel p-8 flex flex-col space-y-6">
          <div className="text-center">
            <h1 className="text-3xl font-extrabold tracking-tight font-display gradient-text">VESPER AI</h1>
            <p className="text-sm mt-1 text-[#8c9ba5]">Cross-Device Personal Security Assistant</p>
          </div>
          <form onSubmit={handleAuth} className="flex flex-col space-y-4">
            {authError && <div className="p-3 bg-red-900/30 border border-red-500/50 rounded-lg text-red-400 text-xs">{authError}</div>}
            <div className="flex flex-col space-y-1">
              <label className="text-xs font-semibold text-[#8c9ba5]">Username</label>
              <input 
                type="text" 
                value={authUsername} 
                onChange={(e) => setAuthUsername(e.target.value)}
                className="bg-[#14161f] border border-white/5 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-[#2f80ed] text-sm" 
                required
              />
            </div>
            {isRegister && (
              <div className="flex flex-col space-y-1">
                <label className="text-xs font-semibold text-[#8c9ba5]">Email Address</label>
                <input 
                  type="email" 
                  value={authEmail} 
                  onChange={(e) => setAuthEmail(e.target.value)}
                  className="bg-[#14161f] border border-white/5 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-[#2f80ed] text-sm" 
                  required
                />
              </div>
            )}
            <div className="flex flex-col space-y-1">
              <label className="text-xs font-semibold text-[#8c9ba5]">Password</label>
              <input 
                type="password" 
                value={authPassword} 
                onChange={(e) => setAuthPassword(e.target.value)}
                className="bg-[#14161f] border border-white/5 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-[#2f80ed] text-sm" 
                required
              />
            </div>
            <button 
              type="submit" 
              className="bg-gradient-to-r from-[#00f2fe] to-[#2f80ed] text-white font-bold py-3 rounded-lg text-sm mt-4 hover:shadow-lg transition duration-200"
            >
              {isRegister ? 'Sign Up' : 'Sign In'}
            </button>
          </form>
          <div className="text-center">
            <button 
              onClick={() => setIsRegister(!isRegister)} 
              className="text-xs text-[#2f80ed] hover:underline"
            >
              {isRegister ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
            </button>
          </div>

          <div className="pt-4 border-t border-white/5 flex flex-col space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-[#8c9ba5] font-medium">Backend Endpoint:</span>
              <div className="flex space-x-1.5">
                <button 
                  type="button" 
                  onClick={() => {
                    const url = import.meta.env.VITE_API_URL || 'https://vesper-ai-oei3.onrender.com/api';
                    setApiBaseUrl(url);
                    localStorage.setItem('apiBaseUrl', url);
                  }}
                  className="px-2 py-0.5 text-[10px] bg-cyan-950/60 border border-cyan-500/30 text-cyan-400 rounded hover:bg-cyan-900/40"
                >
                  Cloud
                </button>
                <button 
                  type="button" 
                  onClick={() => {
                    const url = 'http://localhost:8080/api';
                    setApiBaseUrl(url);
                    localStorage.setItem('apiBaseUrl', url);
                  }}
                  className="px-2 py-0.5 text-[10px] bg-white/5 border border-white/10 text-[#8c9ba5] rounded hover:bg-white/10"
                >
                  Local
                </button>
              </div>
            </div>
            <input 
              type="text" 
              value={apiBaseUrl} 
              onChange={(e) => {
                setApiBaseUrl(e.target.value);
                localStorage.setItem('apiBaseUrl', e.target.value);
              }}
              className="bg-[#14161f] border border-white/5 rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#2f80ed] w-full" 
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex h-screen overflow-hidden ${isDarkMode ? 'dark-mode bg-[#0b0c10]' : 'bg-[#f5f7fb]'}`}>
      
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-[#14161f] border-r border-white/5 flex flex-col justify-between py-6 px-4">
        <div className="flex flex-col space-y-8">
          <div className="flex items-center space-x-3 px-2">
            <div className="p-2.5 bg-gradient-to-tr from-[#00f2fe] to-[#7f00ff] rounded-xl shadow-lg">
              <Cpu className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold font-display gradient-text">Vesper Assistant</h2>
              <span className="text-[10px] text-[#8c9ba5]">DEVICE ID: {deviceId.substring(0, 10)}</span>
            </div>
          </div>

          <nav className="flex flex-col space-y-1">
            {[
              { id: 'chat', label: 'AI Chat', icon: MessageSquare },
              { id: 'notes', label: 'Notes Catalog', icon: BookOpen },
              { id: 'tasks', label: 'Tasks Board', icon: CheckSquare },
              { id: 'memory', label: 'Memory Core', icon: BrainCircuit },
              { id: 'devices', label: 'Devices Registry', icon: Smartphone },
              { id: 'permissions', label: 'Permissions Center', icon: ShieldCheck },
              { id: 'logs', label: 'Security History', icon: History },
            ].map(item => {
              const Icon = item.icon;
              const isAct = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center space-x-3 px-3.5 py-3 rounded-xl transition text-sm font-medium ${isAct ? 'bg-[#2f80ed] text-white shadow-lg shadow-[#2f80ed]/20' : 'text-[#8c9ba5] hover:bg-white/5 hover:text-white'}`}
                >
                  <Icon className="w-4.5 h-4.5" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="flex flex-col space-y-4 px-2">
          <div className="border-t border-white/5 pt-3">
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-xs text-[#8c9ba5]">Signed in as</span>
                <span className="text-sm font-bold text-white">{username}</span>
                <span className="text-[10px] text-green-400 font-semibold">IP: {localIP}</span>
              </div>
              <button 
                onClick={() => setIsDarkMode(!isDarkMode)} 
                className="p-2 hover:bg-white/5 rounded-lg text-[#8c9ba5]"
              >
                {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
            </div>
            <div className="mt-2 flex flex-col space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[9px] text-[#8c9ba5] uppercase font-bold tracking-wider">Server API</span>
                <div className="flex space-x-1">
                  <button 
                    type="button" 
                    onClick={() => {
                      const url = import.meta.env.VITE_API_URL || 'https://vesper-ai-oei3.onrender.com/api';
                      setApiBaseUrl(url);
                      localStorage.setItem('apiBaseUrl', url);
                    }}
                    className="px-1.5 py-0.5 text-[8px] bg-cyan-950/60 border border-cyan-500/30 text-cyan-400 rounded hover:bg-cyan-900/40"
                  >
                    Cloud
                  </button>
                  <button 
                    type="button" 
                    onClick={() => {
                      const url = 'http://localhost:8080/api';
                      setApiBaseUrl(url);
                      localStorage.setItem('apiBaseUrl', url);
                    }}
                    className="px-1.5 py-0.5 text-[8px] bg-white/5 border border-white/10 text-[#8c9ba5] rounded hover:bg-white/10"
                  >
                    Local
                  </button>
                </div>
              </div>
              <input 
                type="text" 
                value={apiBaseUrl} 
                onChange={(e) => {
                  setApiBaseUrl(e.target.value);
                  localStorage.setItem('apiBaseUrl', e.target.value);
                }}
                className="bg-[#14161f]/80 border border-white/5 rounded px-2 py-1 text-[9px] text-white focus:outline-none focus:border-[#2f80ed] w-full" 
              />
            </div>
          </div>
          <button 
            onClick={handleLogout} 
            className="flex items-center space-x-2 text-xs font-semibold text-red-400 hover:text-red-300 w-full pt-1"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main View Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#0b0c10]">
        
        {/* Top Header bar with Assistant Speech state */}
        <header className="h-16 border-b border-white/5 px-6 flex items-center justify-between bg-[#14161f]/50">
          <h2 className="text-base font-semibold capitalize font-display">{activeTab} View</h2>
          <div className="flex items-center space-x-4">
            {/* Assistant Voice Status indicator */}
            <div className="flex items-center space-x-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/5">
              <span className="relative flex h-2 w-2">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  assistantState === 'LISTENING' ? 'bg-[#00f2fe]' : 
                  assistantState === 'THINKING' ? 'bg-[#7f00ff]' : 
                  assistantState === 'SPEAKING' ? 'bg-green-400' : 'bg-[#8c9ba5]'
                }`}></span>
                <span className={`relative inline-flex rounded-full h-2 w-2 ${
                  assistantState === 'LISTENING' ? 'bg-[#00f2fe]' : 
                  assistantState === 'THINKING' ? 'bg-[#7f00ff]' : 
                  assistantState === 'SPEAKING' ? 'bg-green-400' : 'bg-[#8c9ba5]'
                }`}></span>
              </span>
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#8c9ba5]">{assistantState}</span>
            </div>

            <button 
              onClick={() => setVoiceEnabled(!voiceEnabled)} 
              className={`p-2 rounded-lg border border-white/5 ${voiceEnabled ? 'text-green-400 bg-green-500/10' : 'text-[#8c9ba5] bg-white/5'}`}
              title={voiceEnabled ? 'Mute Assistant Voice' : 'Unmute Assistant Voice'}
            >
              {voiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
          </div>
        </header>

        {/* Tab content renderer */}
        <div className="flex-1 overflow-y-auto p-6 relative">
          
          {/* TAB 1: Chat Area */}
          {activeTab === 'chat' && (
            <div className="h-full flex flex-col justify-between">
              
              {/* Message History */}
              <div className="flex-1 overflow-y-auto space-y-4 pr-2 mb-4">
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center space-y-3 opacity-60">
                    <BrainCircuit className="w-12 h-12 text-[#2f80ed] animate-pulse" />
                    <p className="text-sm">Say "Open YouTube", "Show notes", or "Call Mom" to start.</p>
                  </div>
                ) : (
                  messages.map((m, index) => (
                    <div 
                      key={index} 
                      className={`flex ${m.sender === 'USER' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`max-w-xl rounded-2xl p-4 border ${m.sender === 'USER' ? 'bg-[#2f80ed]/10 border-[#2f80ed]/30 text-white' : 'bg-[#14161f] border-white/5 text-white'}`}>
                        <div className="text-[10px] text-[#8c9ba5] mb-1 font-semibold">{m.sender}</div>
                        <div className="text-sm whitespace-pre-wrap">{m.content}</div>
                        {m.image && (
                          <img src={m.image} alt="Desktop Capture" className="mt-3 rounded-lg border border-white/10 max-w-full h-auto" />
                        )}
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input section */}
              <div className="flex items-center space-x-3 bg-[#14161f] border border-white/5 p-2 rounded-2xl">
                <button 
                  onClick={toggleListening} 
                  className={`p-3 rounded-xl transition ${assistantState === 'LISTENING' ? 'bg-red-500 text-white pulse-listening' : 'bg-white/5 text-[#8c9ba5] hover:text-white'}`}
                >
                  {assistantState === 'LISTENING' ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </button>
                <input 
                  type="text" 
                  value={chatInput} 
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder={assistantState === 'LISTENING' ? 'Listening...' : 'Message assistant...'} 
                  className="flex-1 bg-transparent border-0 outline-none text-sm text-white px-2"
                  onKeyDown={(e) => e.key === 'Enter' && sendChatMessage()}
                />
                <button 
                  onClick={() => sendChatMessage()} 
                  disabled={assistantState === 'THINKING'}
                  className="p-3 bg-[#2f80ed] hover:bg-[#2f80ed]/90 text-white rounded-xl shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>

            </div>
          )}

          {/* TAB 2: Notes Grid */}
          {activeTab === 'notes' && (
            <div className="space-y-6">
              <form onSubmit={handleSaveNote} className="glass-panel p-5 flex flex-col space-y-4">
                <h3 className="text-sm font-bold tracking-wide text-white uppercase">{editingNoteId ? 'Edit Note' : 'Create New Note'}</h3>
                <input 
                  type="text" 
                  placeholder="Note Title" 
                  value={noteTitle} 
                  onChange={(e) => setNoteTitle(e.target.value)}
                  className="bg-[#14161f] border border-white/5 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#2f80ed]"
                  required
                />
                <textarea 
                  placeholder="Note Content..." 
                  value={noteContent} 
                  onChange={(e) => setNoteContent(e.target.value)}
                  className="bg-[#14161f] border border-white/5 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#2f80ed] h-24"
                />
                <div className="flex space-x-2">
                  <button type="submit" className="px-4 py-2.5 bg-[#2f80ed] text-white text-xs font-bold rounded-lg hover:bg-[#2f80ed]/90">
                    Save Note
                  </button>
                  {editingNoteId && (
                    <button type="button" onClick={() => { setEditingNoteId(null); setNoteTitle(''); setNoteContent(''); }} className="px-4 py-2.5 bg-white/5 text-[#8c9ba5] text-xs font-bold rounded-lg">
                      Cancel
                    </button>
                  )}
                </div>
              </form>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {notes.map(note => (
                  <div key={note.id} className="glass-panel p-5 flex flex-col justify-between space-y-3">
                    <div>
                      <h4 className="font-bold text-base text-white">{note.title}</h4>
                      <p className="text-xs text-[#8c9ba5] mt-1 whitespace-pre-wrap">{note.content}</p>
                    </div>
                    <div className="flex justify-end space-x-2 pt-3 border-t border-white/5">
                      <button onClick={() => { setEditingNoteId(note.id); setNoteTitle(note.title); setNoteContent(note.content); }} className="p-1.5 hover:bg-white/5 rounded text-[#2f80ed]">
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDeleteNote(note.id)} className="p-1.5 hover:bg-white/5 rounded text-red-400">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: Tasks Catalog */}
          {activeTab === 'tasks' && (
            <div className="space-y-6">
              <form onSubmit={handleCreateTask} className="glass-panel p-5 flex space-x-3 items-end">
                <div className="flex-1 flex flex-col space-y-1">
                  <label className="text-xs font-semibold text-[#8c9ba5]">New Task Title</label>
                  <input 
                    type="text" 
                    placeholder="Task details..." 
                    value={taskTitle} 
                    onChange={(e) => setTaskTitle(e.target.value)}
                    className="bg-[#14161f] border border-white/5 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#2f80ed]"
                    required
                  />
                </div>
                <div className="flex flex-col space-y-1 w-32">
                  <label className="text-xs font-semibold text-[#8c9ba5]">Priority</label>
                  <select 
                    value={taskPriority} 
                    onChange={(e) => setTaskPriority(e.target.value)}
                    className="bg-[#14161f] border border-white/5 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#2f80ed]"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                  </select>
                </div>
                <button type="submit" className="p-3 bg-[#2f80ed] text-white rounded-lg hover:bg-[#2f80ed]/90">
                  <Plus className="w-5 h-5" />
                </button>
              </form>

              <div className="glass-panel p-6 space-y-4">
                <h3 className="text-sm font-bold text-white tracking-wide uppercase mb-2">My Checklist</h3>
                {tasks.length === 0 ? <p className="text-xs text-[#8c9ba5]">No tasks created yet.</p> : (
                  <div className="space-y-2">
                    {tasks.map(t => (
                      <div key={t.id} className="flex items-center justify-between p-3.5 bg-[#14161f] border border-white/5 rounded-xl">
                        <div className="flex items-center space-x-3">
                          <input 
                            type="checkbox" 
                            checked={t.completed} 
                            onChange={() => handleToggleTask(t)}
                            className="w-4 h-4 rounded border-white/10 bg-transparent text-[#2f80ed] focus:ring-0 cursor-pointer"
                          />
                          <span className={`text-sm font-medium ${t.completed ? 'line-through text-[#8c9ba5]' : 'text-white'}`}>{t.title}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${t.priority === 'HIGH' ? 'bg-red-500/10 text-red-400' : t.priority === 'LOW' ? 'bg-green-500/10 text-green-400' : 'bg-yellow-500/10 text-yellow-400'}`}>{t.priority}</span>
                        </div>
                        <button onClick={() => handleDeleteTask(t.id)} className="p-1 hover:bg-white/5 rounded text-[#8c9ba5] hover:text-red-400">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: Memory Catalog */}
          {activeTab === 'memory' && (
            <div className="space-y-6">
              <form onSubmit={handleCreateMemory} className="glass-panel p-5 flex space-x-3 items-end">
                <div className="flex-1 flex flex-col space-y-1">
                  <label className="text-xs font-semibold text-[#8c9ba5]">Remember Fact</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Remember that I am learning Java" 
                    value={memoryContent} 
                    onChange={(e) => setMemoryContent(e.target.value)}
                    className="bg-[#14161f] border border-white/5 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#2f80ed]"
                    required
                  />
                </div>
                <button type="submit" className="p-3 bg-[#2f80ed] text-white rounded-lg hover:bg-[#2f80ed]/90">
                  <Plus className="w-5 h-5" />
                </button>
              </form>

              <div className="glass-panel p-6 space-y-4">
                <h3 className="text-sm font-bold text-white tracking-wide uppercase mb-2">Memory Core Facts</h3>
                {memories.length === 0 ? <p className="text-xs text-[#8c9ba5]">No memories logged yet.</p> : (
                  <div className="space-y-2">
                    {memories.map(m => (
                      <div key={m.id} className="flex items-center justify-between p-3.5 bg-[#14161f] border border-white/5 rounded-xl">
                        <span className="text-sm font-medium text-white">{m.content}</span>
                        <button onClick={() => handleDeleteMemory(m.id)} className="p-1 hover:bg-white/5 rounded text-[#8c9ba5] hover:text-red-400">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 5: Devices Registry */}
          {activeTab === 'devices' && (
            <div className="space-y-6">
              <div className="glass-panel p-6 space-y-4">
                <h3 className="text-sm font-bold text-white tracking-wide uppercase mb-2">Authenticated Devices</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {devices.map(d => (
                    <div key={d.id} className="p-4 bg-[#14161f] border border-white/5 rounded-xl flex justify-between items-center">
                      <div>
                        <h4 className="font-bold text-sm text-white flex items-center space-x-2">
                          <Smartphone className="w-4.5 h-4.5 text-[#2f80ed]" />
                          <span>{d.deviceName}</span>
                          {d.deviceId === deviceId && <span className="text-[10px] bg-green-500/10 text-green-400 px-2 py-0.5 rounded-full font-bold ml-2">Current</span>}
                        </h4>
                        <p className="text-[10px] text-[#8c9ba5] mt-1">Platform: {d.platform} | Last seen: {new Date(d.lastSeen).toLocaleTimeString()}</p>
                      </div>
                      {d.deviceId !== deviceId && (
                        <button 
                          onClick={() => handleRevokeDevice(d.id)}
                          className="px-3 py-1.5 bg-red-950/40 text-red-400 border border-red-500/30 rounded-lg text-xs font-bold hover:bg-red-500 hover:text-white transition duration-150"
                        >
                          Revoke
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: Permissions Center */}
          {activeTab === 'permissions' && (
            <div className="space-y-6">
              {/* Device Capabilities */}
              <div className="glass-panel p-6 space-y-4">
                <h3 className="text-sm font-bold text-white tracking-wide uppercase mb-2 flex items-center space-x-2">
                  <ShieldCheck className="w-5 h-5 text-[#00f2fe]" />
                  <span>Desktop OS Capabilities</span>
                </h3>
                <div className="space-y-3">
                  {[
                    'MICROPHONE', 'CAMERA', 'NOTIFICATIONS', 'FILE_ACCESS', 'BROWSER_ACCESS', 
                    'APPLICATION_LAUNCHING', 'SCREEN_CAPTURE', 'CLIPBOARD', 'LOCATION', 'ACCESSIBILITY'
                  ].map(permName => {
                    const statusRecord = devicePermissions.find(dp => dp.permissionName === permName);
                    const status = statusRecord ? statusRecord.status : 'NOT_REQUESTED';
                    return (
                      <div key={permName} className="flex justify-between items-center p-3 bg-[#14161f] border border-white/5 rounded-xl">
                        <div>
                          <span className="text-sm font-semibold text-white">{permName.replace('_', ' ')}</span>
                        </div>
                        <div className="flex items-center space-x-3">
                          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${status === 'GRANTED' ? 'bg-green-500/10 text-green-400' : status === 'DENIED' ? 'bg-red-500/10 text-red-400' : 'bg-white/5 text-[#8c9ba5]'}`}>
                            {status}
                          </span>
                          <div className="flex space-x-1">
                            <button 
                              onClick={() => handleUpdatePermission(permName, 'GRANTED')}
                              className="px-2.5 py-1 bg-green-500/10 text-green-400 border border-green-500/20 text-xs font-semibold rounded hover:bg-green-500 hover:text-white transition"
                            >
                              Allow
                            </button>
                            <button 
                              onClick={() => handleUpdatePermission(permName, 'DENIED')}
                              className="px-2.5 py-1 bg-red-500/10 text-red-400 border border-red-500/20 text-xs font-semibold rounded hover:bg-red-500 hover:text-white transition"
                            >
                              Deny
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Tool Execution Rules */}
              <div className="glass-panel p-6 space-y-4">
                <h3 className="text-sm font-bold text-white tracking-wide uppercase mb-2 flex items-center space-x-2">
                  <ShieldAlert className="w-5 h-5 text-yellow-400" />
                  <span>AI Tool Gating Policies</span>
                </h3>
                <div className="space-y-3">
                  {toolPermissions.map(tp => (
                    <div key={tp.toolName} className="flex justify-between items-center p-3 bg-[#14161f] border border-white/5 rounded-xl">
                      <div>
                        <span className="text-sm font-semibold text-white">{tp.toolName}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        {['GRANTED', 'CONFIRM_REQUIRED', 'DENIED'].map(statusOpt => (
                          <button
                            key={statusOpt}
                            onClick={() => handleUpdateToolPermissionStatus(tp.toolName, statusOpt)}
                            className={`text-[10px] font-bold px-2 py-1 rounded border transition ${tp.status === statusOpt ? 'bg-white/10 text-white border-white/20' : 'text-[#8c9ba5] border-white/5 hover:bg-white/5'}`}
                          >
                            {statusOpt.replace('_', ' ')}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 7: Security History logs */}
          {activeTab === 'logs' && (
            <div className="glass-panel p-6 space-y-4">
              <h3 className="text-sm font-bold text-white tracking-wide uppercase mb-2">Audit Trails & Action Logs</h3>
              <div className="space-y-3">
                {actionLogs.length === 0 ? <p className="text-xs text-[#8c9ba5]">No historical logs yet.</p> : (
                  actionLogs.map(log => (
                    <div key={log.id} className="p-4 bg-[#14161f] border border-white/5 rounded-xl flex flex-col space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-bold text-white">{log.toolName}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          log.status === 'EXECUTED' ? 'bg-green-500/10 text-green-400' :
                          log.status === 'FAILED' || log.status === 'DENIED' ? 'bg-red-500/10 text-red-400' :
                          'bg-yellow-500/10 text-yellow-400'
                        }`}>{log.status}</span>
                      </div>
                      <p className="text-xs text-[#8c9ba5] break-all">{log.parameters}</p>
                      <div className="text-[10px] text-white/40">{new Date(log.createdAt).toLocaleString()}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

        </div>
      </main>

      {/* MODAL 1: PERMISSION REQUEST OVERLAY */}
      {pendingPermission && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-6 z-50 animate-fade-in">
          <div className="w-full max-w-md glass-panel p-6 flex flex-col space-y-5 border border-yellow-500/30">
            <div className="flex items-center space-x-3 text-yellow-400">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-lg font-bold">OS Permission Requested</h3>
            </div>
            <p className="text-sm text-white font-semibold">The assistant requires capability: {pendingPermission.permissionName}</p>
            <p className="text-xs text-[#8c9ba5] bg-[#14161f] p-3 rounded-lg border border-white/5">
              Reason: {pendingPermission.explanation}
            </p>
            <div className="flex space-x-3 pt-3 border-t border-white/5">
              <button 
                onClick={handleApprovePermission} 
                className="flex-1 py-2.5 bg-[#2f80ed] hover:bg-[#2f80ed]/90 text-white text-xs font-bold rounded-lg"
              >
                Allow Permission
              </button>
              <button 
                onClick={handleDenyPermission} 
                className="flex-1 py-2.5 bg-white/5 text-[#8c9ba5] text-xs font-bold rounded-lg hover:bg-white/10"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: CONFIRMATION REQUIRED OVERLAY */}
      {pendingConfirmation && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-6 z-50">
          <div className="w-full max-w-md glass-panel p-6 flex flex-col space-y-5 border border-[#e67e22]/30">
            <div className="flex items-center space-x-3 text-[#e67e22]">
              <ShieldAlert className="w-6 h-6" />
              <h3 className="text-lg font-bold">Action Requires Confirmation</h3>
            </div>
            <div className="space-y-3 bg-[#14161f] p-4 rounded-xl border border-white/5 text-xs">
              <div className="flex justify-between">
                <span className="text-[#8c9ba5]">Action:</span>
                <span className="font-bold text-white">{pendingConfirmation.toolName}</span>
              </div>
              <div className="flex flex-col space-y-1">
                <span className="text-[#8c9ba5]">Parameters:</span>
                <span className="font-mono text-[#00f2fe] bg-black/30 p-2 rounded break-all">
                  {JSON.stringify(pendingConfirmation.parameters)}
                </span>
              </div>
            </div>
            <div className="flex space-x-3 pt-2">
              <button 
                onClick={() => handleConfirmAction(true)} 
                className="flex-1 py-2.5 bg-[#e67e22] text-white text-xs font-bold rounded-lg hover:bg-[#e67e22]/90"
              >
                Approve & Execute
              </button>
              <button 
                onClick={() => handleConfirmAction(false)} 
                className="flex-1 py-2.5 bg-white/5 text-[#8c9ba5] text-xs font-bold rounded-lg hover:bg-white/10"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
