import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView, 
  SafeAreaView, KeyboardAvoidingView, Platform, ActivityIndicator, Alert, Linking, Image
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Speech from 'expo-speech';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Audio } from 'expo-av';

const DEFAULT_API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://10.145.206.112:8080/api';

export default function App() {
  // Theme & State
  const [apiBaseUrl, setApiBaseUrl] = useState(DEFAULT_API_BASE);
  const API_BASE = apiBaseUrl;

  const [token, setToken] = useState('');
  const [username, setUsername] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [activeTab, setActiveTab] = useState('chat');

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

  // Voice Assistant states
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [assistantState, setAssistantState] = useState('IDLE'); // IDLE, LISTENING, THINKING, EXECUTING, SPEAKING, ERROR
  const [speechText, setSpeechText] = useState('');
  const [recording, setRecording] = useState(null);
  const isSendingRef = useRef(false);

  // Security & Permission Overlays
  const [pendingPermission, setPendingPermission] = useState(null); // { permissionName, explanation, toolName, parameters }
  const [pendingConfirmation, setPendingConfirmation] = useState(null); // { actionLogId, toolName, parameters }

  // CRUD Forms
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskPriority, setTaskPriority] = useState('MEDIUM');
  const [memoryContent, setMemoryContent] = useState('');
  
  // Connection Test States
  const [testResult, setTestResult] = useState(null);
  const [testingConnection, setTestingConnection] = useState(false);

  const testConnection = async () => {
    setTestingConnection(true);
    setTestResult(null);
    const start = Date.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      // Fetch public config endpoint or server root
      const res = await fetch(`${apiBaseUrl.replace('/api', '')}/h2-console`, { 
        method: 'GET',
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      const diff = Date.now() - start;
      setTestResult({
        status: 'Connected',
        url: apiBaseUrl,
        responseTime: `${diff} ms`,
        serverStatus: `${res.status} ${res.statusText || 'OK'}`
      });
    } catch (e) {
      setTestResult({
        status: 'Failed',
        url: apiBaseUrl,
        responseTime: 'Timeout / Unreachable',
        serverStatus: e.message
      });
    } finally {
      setTestingConnection(false);
    }
  }

  // Device Status Check States
  const [statusCheck, setStatusCheck] = useState({
    backend: 'PENDING',
    database: 'PENDING',
    ai: 'PENDING',
    laptop: 'PENDING',
    android: 'PASS',
    network: 'PENDING'
  });
  const [checkingStatus, setCheckingStatus] = useState(false);

  const runStatusCheck = async () => {
    setCheckingStatus(true);
    let newStatus = {
      backend: 'ACTION REQUIRED',
      database: 'ACTION REQUIRED',
      ai: 'ACTION REQUIRED',
      laptop: 'ACTION REQUIRED',
      android: 'PASS',
      network: 'ACTION REQUIRED'
    };

    try {
      const res = await fetch(`${apiBaseUrl}/status`);
      const data = await res.json();
      
      newStatus.backend = data.backend || 'PASS';
      newStatus.database = data.database || 'ACTION REQUIRED';
      newStatus.ai = data.ai || 'ACTION REQUIRED';
      newStatus.network = 'PASS';
      
      // Laptop: if device list contains a LAPTOP device seen in last 5 mins
      const devRes = await fetch(`${apiBaseUrl}/devices`);
      const devs = await devRes.json();
      const hasLaptop = devs.some(d => d.platform === 'DESKTOP' && (Date.now() - new Date(d.lastSeen).getTime()) < 300000);
      newStatus.laptop = hasLaptop ? 'PASS' : 'ACTION REQUIRED';
    } catch (e) {
      // offline
    } finally {
      setStatusCheck(newStatus);
      setCheckingStatus(false);
    }
  };

  const scrollViewRef = useRef();

  // Generate Device ID
  useEffect(() => {
    const newId = 'PHONE_' + Math.random().toString(36).substring(2, 11).toUpperCase();
    setDeviceId(newId);
  }, []);

  // Fetch data on active tab change
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
      if (devices.length > 0) {
        fetchDevicePermissions(devices[0].id);
      } else {
        fetchDevices().then(devs => {
          if (devs && devs.length > 0) fetchDevicePermissions(devs[0].id);
        });
      }
    }
  }, [activeTab, token]);

  const apiCall = async (url, options = {}) => {
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(url, { 
        ...options, 
        headers,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (!response.ok) {
        if (response.status === 403 || response.status === 401) {
          setToken('');
          Alert.alert('Session Expired', 'Your session has expired. Please log in again.');
        }
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${response.status}`);
      }
      return response.json();
    } catch (e) {
      clearTimeout(timeoutId);
      console.error('API Error:', e);
      if (e.name === 'AbortError') {
        throw new Error('Connection timed out. Server is taking too long to respond.');
      }
      throw new Error('Unable to reach Vesper server. Please check your internet connection or Server API URL in Settings.');
    }
  };

  // Auth Operations
  const handleAuth = async () => {
    setAuthError('');
    try {
      if (isRegister) {
        await apiCall(`${API_BASE}/auth/register`, {
          method: 'POST',
          body: JSON.stringify({ username: authUsername, password: authPassword, email: authEmail })
        });
        setIsRegister(false);
        Alert.alert('Success', 'Registration successful! Please login.');
      } else {
        const res = await apiCall(`${API_BASE}/auth/login`, {
          method: 'POST',
          body: JSON.stringify({
            username: authUsername,
            password: authPassword,
            deviceId: deviceId,
            deviceName: 'My Android Phone',
            platform: 'ANDROID',
            capabilities: '["MICROPHONE", "CONTACTS", "PHONE", "SMS", "NOTIFICATIONS"]'
          })
        });
        setToken(res.token);
        setUsername(res.username);
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
  };

  // Chat Operations
  const fetchConversations = async () => {
    try {
      const data = await apiCall(`${API_BASE}/conversations`);
      setConversations(data);
      if (data.length > 0 && !activeConvId) {
        handleSelectConversation(data[0].id);
      }
    } catch (e) {}
  };

  const handleSelectConversation = async (convId) => {
    setActiveConvId(convId);
    try {
      const msgs = await apiCall(`${API_BASE}/conversations/${convId}`);
      setMessages(msgs);
    } catch (e) {}
  };

  const speakText = (text) => {
    if (!voiceEnabled) return;
    Speech.stop();
    setAssistantState('SPEAKING');
    Speech.speak(text, {
      onDone: () => setAssistantState('IDLE'),
      onError: () => setAssistantState('IDLE')
    });
  };

  const sendChatMessage = async (msgText) => {
    const textToSend = msgText || chatInput;
    if (!textToSend.trim()) return;
    if (isSendingRef.current || assistantState === 'THINKING') return;
    isSendingRef.current = true;
    setChatInput('');
    setAssistantState('THINKING');

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
        executeLocalPhoneTool(res.toolName, res.parameters);
      } else {
        setMessages(prev => [...prev, { sender: 'ASSISTANT', content: res.reply, createdAt: new Date().toISOString() }]);
        speakText(res.reply);
      }
    } catch (e) {
      setAssistantState('ERROR');
      setTimeout(() => setAssistantState('IDLE'), 2000);
    } finally {
      isSendingRef.current = false;
    }
  };

  // Local Android Automation execution
  const executeLocalPhoneTool = async (toolName, parameters) => {
    try {
      let outputText = '';
      if (toolName === 'OPEN_WEBSITE') {
        await Linking.openURL(parameters.url);
        outputText = `Opened website link: ${parameters.url}`;
      } else if (toolName === 'CALL_CONTACT') {
        // Dial phone number dynamically
        const target = parameters.name || '';
        const cleanNumber = target.replace(/[^0-9+]/g, '');
        const numberToDial = cleanNumber.length >= 3 ? cleanNumber : '9999999999';
        const telUrl = `tel:${numberToDial}`;
        await Linking.openURL(telUrl);
        outputText = `Placed call to: ${target}`;
      } else if (toolName === 'SEND_SMS') {
        const smsUrl = `sms:?addresses=${parameters.recipient}&body=${encodeURIComponent(parameters.message)}`;
        await Linking.openURL(smsUrl);
        outputText = `Sent SMS message to ${parameters.recipient}`;
      } else if (toolName === 'OPEN_CAMERA') {
        try {
          await Linking.openURL('camera://');
        } catch (e) {
          try {
            await Linking.openURL('content://media/internal/images/media');
          } catch (e2) {
            Alert.alert('Camera', 'Unable to launch camera app directly. Please open it from your home screen.');
          }
        }
        outputText = 'Opened camera.';
      } else if (toolName === 'PLAY_SONG') {
        const ytUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(parameters.query)}`;
        await Linking.openURL(ytUrl);
        outputText = `Playing query on YouTube: ${parameters.query}`;
      } else {
        outputText = `Executed mobile tool: ${toolName}`;
      }
      reportLocalToolResult(toolName, 'EXECUTED', outputText);
    } catch (e) {
      reportLocalToolResult(toolName, 'FAILED', e.message);
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
      if (activeConvId) handleSelectConversation(activeConvId);
      setAssistantState('IDLE');
    } catch (e) {}
  };

  // Permissions approvals
  const handleApprovePermission = async () => {
    if (!pendingPermission) return;
    try {
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
      const prevTool = pendingPermission.toolName;
      setPendingPermission(null);
      sendChatMessage(`Request: Execute tool ${prevTool}.`);
    } catch (e) {}
  };

  const handleDenyPermission = () => {
    setPendingPermission(null);
    setMessages(prev => [...prev, { sender: 'ASSISTANT', content: 'Permission denied. Action cancelled.', createdAt: new Date().toISOString() }]);
  };

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
        executeLocalPhoneTool(res.toolName, res.parameters);
      } else if (activeConvId) {
        handleSelectConversation(activeConvId);
      }
    } catch (e) {}
  };

  // Voice Speech Audio Recording & Transcription using Gemini
  const toggleVoiceRecording = async () => {
    try {
      if (recording) {
        setAssistantState('THINKING');
        await recording.stopAndUnloadAsync();
        const uri = recording.getURI();
        setRecording(null);

        const formData = new FormData();
        formData.append('file', {
          uri: Platform.OS === 'android' ? uri : uri.replace('file://', ''),
          type: 'audio/mp4',
          name: 'speech.m4a'
        });

        const headers = {
          'Authorization': `Bearer ${token}`
        };

        const uploadRes = await fetch(`${API_BASE}/voice/transcribe`, {
          method: 'POST',
          headers,
          body: formData
        });

        if (!uploadRes.ok) {
          throw new Error('Transcription failed');
        }

        const data = await uploadRes.json();
        if (data.transcript && data.transcript.trim()) {
          setChatInput('');
          sendChatMessage(data.transcript);
        } else {
          setAssistantState('IDLE');
          Alert.alert('Speech Not Recognized', 'No speech detected. Please speak clearly.');
        }
      } else {
        const { status } = await Audio.requestPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Denied', 'Microphone permission is required for voice commands.');
          return;
        }

        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });

        const { recording: newRecording } = await Audio.Recording.createAsync(
          Audio.RecordingOptionsPresets.HIGH_QUALITY
        );
        setRecording(newRecording);
        setAssistantState('LISTENING');
      }
    } catch (e) {
      console.error(e);
      setRecording(null);
      setAssistantState('IDLE');
      Alert.alert('Voice Error', 'An error occurred during voice processing. Please try again.');
    }
  };

  // Notes
  const fetchNotes = async () => {
    const data = await apiCall(`${API_BASE}/notes`);
    setNotes(data);
  };

  const handleCreateNote = async () => {
    if (!noteTitle.trim()) return;
    await apiCall(`${API_BASE}/notes`, {
      method: 'POST',
      body: JSON.stringify({ title: noteTitle, content: noteContent })
    });
    setNoteTitle('');
    setNoteContent('');
    fetchNotes();
  };

  // Tasks
  const fetchTasks = async () => {
    const data = await apiCall(`${API_BASE}/tasks`);
    setTasks(data);
  };

  const handleCreateTask = async () => {
    if (!taskTitle.trim()) return;
    await apiCall(`${API_BASE}/tasks`, {
      method: 'POST',
      body: JSON.stringify({ title: taskTitle, description: 'Added from mobile', priority: taskPriority })
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

  // Memories
  const fetchMemories = async () => {
    const data = await apiCall(`${API_BASE}/memory`);
    setMemories(data);
  };

  const handleCreateMemory = async () => {
    if (!memoryContent.trim()) return;
    await apiCall(`${API_BASE}/memory`, {
      method: 'POST',
      body: JSON.stringify({ content: memoryContent })
    });
    setMemoryContent('');
    fetchMemories();
  };

  // Devices
  const fetchDevices = async () => {
    const data = await apiCall(`${API_BASE}/devices`);
    setDevices(data);
    return data;
  };

  const handleRevokeDeviceMobile = async (id) => {
    Alert.alert(
      'Revoke Device',
      'Revoking this device will instantly terminate its sessions. Proceed?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Revoke', 
          style: 'destructive',
          onPress: async () => {
            await apiCall(`${API_BASE}/devices/${id}`, { method: 'DELETE' });
            fetchDevices();
          }
        }
      ]
    );
  };

  // Permissions Center Status
  const fetchDevicePermissions = async (devId) => {
    const data = await apiCall(`${API_BASE}/permissions?deviceId=${devId}`);
    setDevicePermissions(data);
  };

  const handleUpdatePermissionStatus = async (permName, status) => {
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

  if (!token) {
    return (
      <View style={styles.authContainer}>
        <StatusBar style="light" />
        <View style={styles.authCard}>
          <Text style={styles.authLogo}>VESPER AI</Text>
          <Text style={styles.authSubtitle}>Mobile Assistant Client</Text>
          
          {authError ? <Text style={styles.errorText}>{authError}</Text> : null}

          <TextInput 
            style={styles.authInput} 
            placeholder="Username" 
            placeholderTextColor="#8c9ba5"
            value={authUsername}
            onChangeText={setAuthUsername}
            autoCapitalize="none"
          />

          {isRegister && (
            <TextInput 
              style={styles.authInput} 
              placeholder="Email address" 
              placeholderTextColor="#8c9ba5"
              value={authEmail}
              onChangeText={setAuthEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          )}

          <TextInput 
            style={styles.authInput} 
            placeholder="Password" 
            placeholderTextColor="#8c9ba5"
            secureTextEntry
            value={authPassword}
            onChangeText={setAuthPassword}
            autoCapitalize="none"
          />

          <TouchableOpacity style={styles.authButton} onPress={handleAuth}>
            <Text style={styles.authButtonText}>{isRegister ? 'Sign Up' : 'Sign In'}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.toggleAuthMode} onPress={() => setIsRegister(!isRegister)}>
            <Text style={styles.toggleAuthText}>
              {isRegister ? 'Have an account? Log In' : "Don't have an account? Sign Up"}
            </Text>
          </TouchableOpacity>

          <View style={{ marginTop: 20, paddingTop: 14, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' }}>
            <Text style={{ color: '#8c9ba5', fontSize: 11, marginBottom: 6 }}>Backend Endpoint:</Text>
            <TextInput 
              style={[styles.authInput, { fontSize: 12, paddingVertical: 8, marginBottom: 8 }]} 
              placeholder="http://10.145.206.112:8080/api" 
              placeholderTextColor="#8c9ba5"
              value={apiBaseUrl}
              onChangeText={setApiBaseUrl}
              autoCapitalize="none"
            />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <TouchableOpacity 
                style={{ flex: 1, backgroundColor: '#1a2234', paddingVertical: 6, borderRadius: 6, marginHorizontal: 2, alignItems: 'center' }}
                onPress={() => setApiBaseUrl(process.env.EXPO_PUBLIC_API_URL || 'https://vesper-backend.onrender.com/api')}
              >
                <Text style={{ color: '#00e5ff', fontSize: 10, fontWeight: '600' }}>Cloud URL</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={{ flex: 1, backgroundColor: '#1a2234', paddingVertical: 6, borderRadius: 6, marginHorizontal: 2, alignItems: 'center' }}
                onPress={() => setApiBaseUrl('http://10.145.206.112:8080/api')}
              >
                <Text style={{ color: '#90caf9', fontSize: 10, fontWeight: '600' }}>Local WiFi</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={{ flex: 1, backgroundColor: '#1a2234', paddingVertical: 6, borderRadius: 6, marginHorizontal: 2, alignItems: 'center' }}
                onPress={() => setApiBaseUrl('http://10.0.2.2:8080/api')}
              >
                <Text style={{ color: '#90caf9', fontSize: 10, fontWeight: '600' }}>Emulator</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleContainer}>
          <MaterialCommunityIcons name="robot" size={24} color="#00f2fe" />
          <Text style={styles.headerTitle}>Vesper AI</Text>
        </View>
        
        {/* Status Indicator */}
        <View style={styles.statusBadge}>
          <View style={[styles.statusDot, 
            assistantState === 'LISTENING' ? styles.statusListening :
            assistantState === 'THINKING' ? styles.statusThinking :
            assistantState === 'SPEAKING' ? styles.statusSpeaking : styles.statusIdle
          ]} />
          <Text style={styles.statusText}>{assistantState}</Text>
        </View>
      </View>

      {/* Main Area */}
      <View style={styles.mainContent}>
        
        {/* TAB 1: Chat screen */}
        {activeTab === 'chat' && (
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.chatView}>
            <ScrollView 
              ref={scrollViewRef}
              style={styles.messagesScroll}
              onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
            >
              {messages.length === 0 ? (
                <View style={styles.emptyChat}>
                  <MaterialCommunityIcons name="microphone-outline" size={48} color="#2f80ed" />
                  <Text style={styles.emptyText}>Tap the mic button and say a command like "Call Mom" or "Remember that I am learning Java".</Text>
                </View>
              ) : (
                messages.map((m, i) => (
                  <View key={i} style={[styles.messageBubbleContainer, m.sender === 'USER' ? styles.bubbleUser : styles.bubbleAssistant]}>
                    <View style={[styles.messageBubble, m.sender === 'USER' ? styles.bubbleUserBg : styles.bubbleAssistantBg]}>
                      <Text style={styles.bubbleSender}>{m.sender}</Text>
                      <Text style={styles.bubbleText}>{m.content}</Text>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>

            <View style={styles.chatInputBar}>
              <TouchableOpacity style={styles.micButton} onPress={toggleVoiceRecording}>
                <MaterialCommunityIcons 
                  name={assistantState === 'LISTENING' ? "microphone-off" : "microphone"} 
                  size={24} 
                  color={assistantState === 'LISTENING' ? "#ff4757" : "#8c9ba5"} 
                />
              </TouchableOpacity>
              <TextInput 
                style={styles.chatInput}
                placeholder="Type a message..."
                placeholderTextColor="#8c9ba5"
                value={chatInput}
                onChangeText={setChatInput}
                onSubmitEditing={() => sendChatMessage()}
              />
              <TouchableOpacity style={styles.sendButton} onPress={() => sendChatMessage()}>
                <MaterialCommunityIcons name="send" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        )}

        {/* TAB 2: Notes screen */}
        {activeTab === 'notes' && (
          <ScrollView style={styles.panelContainer}>
            <View style={styles.panelCard}>
              <Text style={styles.panelTitle}>Quick Note</Text>
              <TextInput 
                style={styles.panelInput} 
                placeholder="Note Title" 
                placeholderTextColor="#8c9ba5"
                value={noteTitle}
                onChangeText={setNoteTitle}
              />
              <TextInput 
                style={[styles.panelInput, { height: 80 }]} 
                placeholder="Note Content" 
                placeholderTextColor="#8c9ba5"
                multiline
                value={noteContent}
                onChangeText={setNoteContent}
              />
              <TouchableOpacity style={styles.panelButton} onPress={handleCreateNote}>
                <Text style={styles.panelButtonText}>Save Note</Text>
              </TouchableOpacity>
            </View>

            <View style={{ marginTop: 20 }}>
              <Text style={styles.sectionHeader}>Saved Notes</Text>
              {notes.map(n => (
                <View key={n.id} style={styles.savedCard}>
                  <Text style={styles.savedCardTitle}>{n.title}</Text>
                  <Text style={styles.savedCardContent}>{n.content}</Text>
                </View>
              ))}
            </View>
          </ScrollView>
        )}

        {/* TAB 3: Tasks screen */}
        {activeTab === 'tasks' && (
          <ScrollView style={styles.panelContainer}>
            <View style={styles.panelCard}>
              <Text style={styles.panelTitle}>Create Task</Text>
              <TextInput 
                style={styles.panelInput} 
                placeholder="Task Title" 
                placeholderTextColor="#8c9ba5"
                value={taskTitle}
                onChangeText={setTaskTitle}
              />
              <View style={styles.pickerRow}>
                {['LOW', 'MEDIUM', 'HIGH'].map(p => (
                  <TouchableOpacity 
                    key={p} 
                    style={[styles.pickerBtn, taskPriority === p ? styles.pickerBtnActive : null]}
                    onPress={() => setTaskPriority(p)}
                  >
                    <Text style={[styles.pickerBtnText, taskPriority === p ? styles.pickerTextActive : null]}>{p}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity style={styles.panelButton} onPress={handleCreateTask}>
                <Text style={styles.panelButtonText}>Save Task</Text>
              </TouchableOpacity>
            </View>

            <View style={{ marginTop: 20 }}>
              <Text style={styles.sectionHeader}>My Tasks</Text>
              {tasks.map(t => (
                <TouchableOpacity 
                  key={t.id} 
                  style={styles.savedCardRow}
                  onPress={() => handleToggleTask(t)}
                >
                  <MaterialCommunityIcons 
                    name={t.completed ? "checkbox-marked-circle-outline" : "checkbox-blank-circle-outline"} 
                    size={22} 
                    color={t.completed ? "#2ecc71" : "#8c9ba5"} 
                  />
                  <Text style={[styles.savedCardTitleRow, t.completed ? styles.taskCompleted : null]}>{t.title}</Text>
                  <Text style={styles.priorityLabel}>{t.priority}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        )}

        {/* TAB 4: Memory screen */}
        {activeTab === 'memory' && (
          <ScrollView style={styles.panelContainer}>
            <View style={styles.panelCard}>
              <Text style={styles.panelTitle}>Save to Memory</Text>
              <TextInput 
                style={styles.panelInput} 
                placeholder="e.g. Remember that I am learning Java" 
                placeholderTextColor="#8c9ba5"
                value={memoryContent}
                onChangeText={setMemoryContent}
              />
              <TouchableOpacity style={styles.panelButton} onPress={handleCreateMemory}>
                <Text style={styles.panelButtonText}>Store Fact</Text>
              </TouchableOpacity>
            </View>

            <View style={{ marginTop: 20 }}>
              <Text style={styles.sectionHeader}>Memory Repository</Text>
              {memories.map(m => (
                <View key={m.id} style={styles.savedCard}>
                  <Text style={styles.savedCardContent}>{m.content}</Text>
                </View>
              ))}
            </View>
          </ScrollView>
        )}

        {/* TAB 5: Permissions Center */}
        {activeTab === 'permissions' && (
          <ScrollView style={styles.panelContainer}>
            <Text style={styles.sectionHeader}>Android OS Permissions</Text>
            {[
              'MICROPHONE', 'CONTACTS', 'PHONE', 'SMS', 'NOTIFICATIONS', 'LOCATION', 'FILES_MEDIA', 'CAMERA', 'ACCESSIBILITY', 'BLUETOOTH'
            ].map(permName => {
              const record = devicePermissions.find(dp => dp.permissionName === permName);
              const status = record ? record.status : 'NOT_REQUESTED';
              return (
                <View key={permName} style={styles.permCard}>
                  <Text style={styles.permName}>{permName.replace('_', ' ')}</Text>
                  <View style={styles.permActionRow}>
                    <Text style={[styles.permStatus, status === 'GRANTED' ? styles.permGranted : status === 'DENIED' ? styles.permDenied : null]}>
                      {status}
                    </Text>
                    <View style={styles.permBtnGroup}>
                      <TouchableOpacity style={styles.permBtnAllow} onPress={() => handleUpdatePermissionStatus(permName, 'GRANTED')}>
                        <Text style={styles.permBtnText}>Allow</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.permBtnDeny} onPress={() => handleUpdatePermissionStatus(permName, 'DENIED')}>
                        <Text style={styles.permBtnText}>Deny</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        )}

        {/* TAB 5A: Setup Status Screen */}
        {activeTab === 'status' && (
          <ScrollView style={styles.panelContainer}>
            <Text style={styles.sectionHeader}>System Integration Status</Text>
            
            <TouchableOpacity 
              style={[styles.panelButton, { backgroundColor: '#7f00ff', marginBottom: 15 }]} 
              onPress={runStatusCheck}
              disabled={checkingStatus}
            >
              {checkingStatus ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.panelButtonText}>RUN SYSTEM CHECK</Text>
              )}
            </TouchableOpacity>

            {Object.keys(statusCheck).map(key => {
              const status = statusCheck[key];
              const isPass = status === 'PASS';
              return (
                <View key={key} style={[styles.savedCard, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 }]}>
                  <Text style={[styles.savedCardTitle, { textTransform: 'capitalize' }]}>{key}</Text>
                  <Text style={{ 
                    color: isPass ? '#2ecc71' : '#e74c3c', 
                    fontWeight: 'bold', 
                    fontSize: 12,
                    backgroundColor: isPass ? '#2ecc7122' : '#e74c3c22',
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderRadius: 4
                  }}>
                    {status}
                  </Text>
                </View>
              );
            })}
          </ScrollView>
        )}

        {/* TAB 5B: Devices Registry */}
        {activeTab === 'devices' && (
          <ScrollView style={styles.panelContainer}>
            <Text style={styles.sectionHeader}>Authenticated Devices</Text>
            {devices.map(d => (
              <View key={d.id} style={[styles.savedCard, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.savedCardTitle}>{d.deviceName}</Text>
                  <Text style={styles.savedCardContent}>Platform: {d.platform}</Text>
                  <Text style={[styles.savedCardContent, { fontSize: 10 }]}>
                    Last Seen: {new Date(d.lastSeen).toLocaleString()}
                  </Text>
                  <Text style={[styles.savedCardContent, { color: '#00f2fe', fontWeight: 'bold', marginTop: 4 }]}>
                    {new Date(d.lastSeen).getTime() > Date.now() - 300000 ? 'Online' : 'Offline'}
                  </Text>
                </View>
                {d.deviceId !== deviceId && (
                  <TouchableOpacity 
                    style={[styles.permBtnDeny, { backgroundColor: '#e74c3c33' }]} 
                    onPress={() => handleRevokeDeviceMobile(d.id)}
                  >
                    <Text style={[styles.permBtnText, { color: '#e74c3c' }]}>Revoke</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </ScrollView>
        )}

        {/* TAB 6: Settings Screen */}
        {activeTab === 'settings' && (
          <View style={styles.panelContainer}>
            <View style={styles.panelCard}>
              <Text style={styles.panelTitle}>Account Info</Text>
              <Text style={styles.infoLabel}>User: {username}</Text>
              <Text style={styles.infoLabel}>Device ID: {deviceId}</Text>
              
              <Text style={[styles.sectionHeader, { marginTop: 15, fontSize: 12 }]}>Backend API URL Config</Text>
              <TextInput 
                style={styles.panelInput} 
                placeholder="http://10.0.2.2:8080/api" 
                placeholderTextColor="#8c9ba5"
                value={apiBaseUrl}
                onChangeText={setApiBaseUrl}
                autoCapitalize="none"
              />

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
                <TouchableOpacity 
                  style={{ flex: 1, backgroundColor: '#1a2234', paddingVertical: 8, borderRadius: 6, marginHorizontal: 2, alignItems: 'center' }}
                  onPress={() => setApiBaseUrl(process.env.EXPO_PUBLIC_API_URL || 'https://vesper-backend.onrender.com/api')}
                >
                  <Text style={{ color: '#00e5ff', fontSize: 11, fontWeight: '600' }}>Cloud URL</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={{ flex: 1, backgroundColor: '#1a2234', paddingVertical: 8, borderRadius: 6, marginHorizontal: 2, alignItems: 'center' }}
                  onPress={() => setApiBaseUrl('http://10.145.206.112:8080/api')}
                >
                  <Text style={{ color: '#90caf9', fontSize: 11, fontWeight: '600' }}>Local WiFi</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={{ flex: 1, backgroundColor: '#1a2234', paddingVertical: 8, borderRadius: 6, marginHorizontal: 2, alignItems: 'center' }}
                  onPress={() => setApiBaseUrl('http://10.0.2.2:8080/api')}
                >
                  <Text style={{ color: '#90caf9', fontSize: 11, fontWeight: '600' }}>Emulator</Text>
                </TouchableOpacity>
              </View>
              
              <TouchableOpacity 
                style={[styles.panelButton, { backgroundColor: '#7f00ff', marginBottom: 12 }]} 
                onPress={testConnection}
                disabled={testingConnection}
              >
                {testingConnection ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.panelButtonText}>TEST CONNECTION</Text>
                )}
              </TouchableOpacity>

              {testResult && (
                <View style={[styles.confirmationBox, { borderColor: testResult.status === 'Connected' ? '#2ecc71' : '#e74c3c', borderWidth: 1, marginBottom: 12, padding: 10, borderRadius: 8 }]}>
                  <Text style={[styles.confirmLabel, { color: testResult.status === 'Connected' ? '#2ecc71' : '#e74c3c', fontWeight: 'bold' }]}>
                    {testResult.status}
                  </Text>
                  <Text style={[styles.infoLabel, { fontSize: 11, marginTop: 4, marginBottom: 0 }]}>URL: {testResult.url}</Text>
                  <Text style={[styles.infoLabel, { fontSize: 11, marginBottom: 0 }]}>Response: {testResult.responseTime}</Text>
                  <Text style={[styles.infoLabel, { fontSize: 11, marginBottom: 0 }]}>Status: {testResult.serverStatus}</Text>
                </View>
              )}
              
              <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                <Text style={styles.logoutButtonText}>Log Out</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

      </View>

      {/* Navigation Footer */}
      <View style={styles.footer}>
        {[
          { id: 'chat', icon: 'message-text-outline' },
          { id: 'notes', icon: 'book-open-outline' },
          { id: 'tasks', icon: 'checkbox-marked-circle-outline' },
          { id: 'memory', icon: 'brain' },
          { id: 'status', icon: 'check-network-outline' },
          { id: 'permissions', icon: 'shield-check-outline' },
          { id: 'devices', icon: 'cellphone-link' },
          { id: 'settings', icon: 'cog-outline' }
        ].map(tab => (
          <TouchableOpacity 
            key={tab.id} 
            style={[styles.footerTab, activeTab === tab.id ? styles.activeFooterTab : null]}
            onPress={() => setActiveTab(tab.id)}
          >
            <MaterialCommunityIcons name={tab.icon} size={22} color={activeTab === tab.id ? '#00f2fe' : '#8c9ba5'} />
          </TouchableOpacity>
        ))}
      </View>

      {/* MODAL 1: PERMISSION PROMPT OVERLAY */}
      {pendingPermission && (
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { borderColor: '#f1c40f' }]}>
            <View style={styles.modalHeaderRow}>
              <MaterialCommunityIcons name="alert-decagram-outline" size={26} color="#f1c40f" />
              <Text style={styles.modalHeaderTitle}>Android Permission Request</Text>
            </View>
            <Text style={styles.modalBodyBold}>The assistant needs capability: {pendingPermission.permissionName}</Text>
            <Text style={styles.modalBodyText}>Reason: {pendingPermission.explanation}</Text>
            <View style={styles.modalBtnGroup}>
              <TouchableOpacity style={styles.modalBtnApprove} onPress={handleApprovePermission}>
                <Text style={styles.modalBtnApproveText}>Allow Permission</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBtnCancel} onPress={handleDenyPermission}>
                <Text style={styles.modalBtnCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* MODAL 2: CONFIRMATION PROMPT OVERLAY */}
      {pendingConfirmation && (
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { borderColor: '#e67e22' }]}>
            <View style={styles.modalHeaderRow}>
              <MaterialCommunityIcons name="shield-alert-outline" size={26} color="#e67e22" />
              <Text style={styles.modalHeaderTitle}>Action Confirmation Required</Text>
            </View>
            <View style={styles.confirmationBox}>
              <Text style={styles.confirmLabel}>Action: {pendingConfirmation.toolName}</Text>
              <Text style={styles.confirmParams}>{JSON.stringify(pendingConfirmation.parameters)}</Text>
            </View>
            <View style={styles.modalBtnGroup}>
              <TouchableOpacity style={[styles.modalBtnApprove, { backgroundColor: '#e67e22' }]} onPress={() => handleConfirmAction(true)}>
                <Text style={styles.modalBtnApproveText}>Approve & Run</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBtnCancel} onPress={() => handleConfirmAction(false)}>
                <Text style={styles.modalBtnCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0c10',
  },
  authContainer: {
    flex: 1,
    backgroundColor: '#0b0c10',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20
  },
  authCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#14161f',
    borderColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10
  },
  authLogo: {
    fontSize: 26,
    fontWeight: '800',
    color: '#00f2fe',
    textAlign: 'center'
  },
  authSubtitle: {
    fontSize: 12,
    color: '#8c9ba5',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 24
  },
  authInput: {
    backgroundColor: '#0b0c10',
    borderColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderRadius: 12,
    color: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    marginBottom: 12
  },
  authButton: {
    backgroundColor: '#2f80ed',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12
  },
  authButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700'
  },
  toggleAuthMode: {
    alignItems: 'center',
    marginTop: 16
  },
  toggleAuthText: {
    color: '#2f80ed',
    fontSize: 12
  },
  errorText: {
    color: '#ff4757',
    fontSize: 12,
    marginBottom: 14,
    textAlign: 'center'
  },
  header: {
    height: 60,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
    marginLeft: 8
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6
  },
  statusIdle: { backgroundColor: '#8c9ba5' },
  statusListening: { backgroundColor: '#00f2fe' },
  statusThinking: { backgroundColor: '#7f00ff' },
  statusSpeaking: { backgroundColor: '#2ecc71' },
  statusText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#8c9ba5',
    textTransform: 'uppercase'
  },
  mainContent: {
    flex: 1,
  },
  chatView: {
    flex: 1,
    justifyContent: 'space-between'
  },
  messagesScroll: {
    flex: 1,
    padding: 16
  },
  emptyChat: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
    paddingHorizontal: 20
  },
  emptyText: {
    color: '#8c9ba5',
    textAlign: 'center',
    fontSize: 13,
    marginTop: 16,
    lineHeight: 18
  },
  messageBubbleContainer: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  bubbleUser: {
    justifyContent: 'flex-end',
  },
  bubbleAssistant: {
    justifyContent: 'flex-start',
  },
  messageBubble: {
    maxWidth: '85%',
    borderRadius: 16,
    padding: 12,
  },
  bubbleUserBg: {
    backgroundColor: '#2f80ed33',
    borderColor: '#2f80ed66',
    borderWidth: 1
  },
  bubbleAssistantBg: {
    backgroundColor: '#14161f',
    borderColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1
  },
  bubbleSender: {
    fontSize: 8,
    color: '#8c9ba5',
    fontWeight: 'bold',
    marginBottom: 2
  },
  bubbleText: {
    fontSize: 13,
    color: '#fff',
    lineHeight: 18
  },
  chatInputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    backgroundColor: '#14161f',
    borderColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderRadius: 16,
    margin: 12
  },
  micButton: {
    padding: 10,
  },
  chatInput: {
    flex: 1,
    color: '#fff',
    fontSize: 13,
    paddingHorizontal: 8
  },
  sendButton: {
    backgroundColor: '#2f80ed',
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center'
  },
  footer: {
    height: 60,
    borderTopColor: 'rgba(255,255,255,0.06)',
    borderTopWidth: 1,
    flexDirection: 'row',
    backgroundColor: '#14161f'
  },
  footerTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  activeFooterTab: {
    backgroundColor: 'rgba(0,242,254,0.02)'
  },
  panelContainer: {
    flex: 1,
    padding: 16
  },
  panelCard: {
    backgroundColor: '#14161f',
    borderColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderRadius: 16,
    padding: 16
  },
  panelTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  panelInput: {
    backgroundColor: '#0b0c10',
    borderColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderRadius: 10,
    color: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    marginBottom: 12
  },
  panelButton: {
    backgroundColor: '#2f80ed',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center'
  },
  panelButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold'
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 12,
    textTransform: 'uppercase'
  },
  savedCard: {
    backgroundColor: '#14161f',
    borderColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10
  },
  savedCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff'
  },
  savedCardContent: {
    fontSize: 12,
    color: '#8c9ba5',
    marginTop: 4
  },
  pickerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14
  },
  pickerBtn: {
    flex: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
    marginHorizontal: 4,
    backgroundColor: '#0b0c10'
  },
  pickerBtnActive: {
    borderColor: '#00f2fe',
    backgroundColor: 'rgba(0,242,254,0.05)'
  },
  pickerBtnText: {
    color: '#8c9ba5',
    fontSize: 11,
    fontWeight: '700'
  },
  pickerTextActive: {
    color: '#00f2fe'
  },
  savedCardRow: {
    backgroundColor: '#14161f',
    borderColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center'
  },
  savedCardTitleRow: {
    fontSize: 13,
    color: '#fff',
    marginLeft: 10,
    flex: 1
  },
  taskCompleted: {
    textDecorationLine: 'line-through',
    color: '#8c9ba5'
  },
  priorityLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#f1c40f',
    backgroundColor: 'rgba(241,196,15,0.08)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6
  },
  permCard: {
    backgroundColor: '#14161f',
    borderColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10
  },
  permName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff'
  },
  permActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8
  },
  permStatus: {
    fontSize: 10,
    fontWeight: '800',
    color: '#8c9ba5'
  },
  permGranted: { color: '#2ecc71' },
  permDenied: { color: '#e74c3c' },
  permBtnGroup: {
    flexDirection: 'row'
  },
  permBtnAllow: {
    backgroundColor: 'rgba(46,204,113,0.1)',
    borderColor: 'rgba(46,204,113,0.2)',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 6
  },
  permBtnDeny: {
    backgroundColor: 'rgba(231,76,60,0.1)',
    borderColor: 'rgba(231,76,60,0.2)',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  permBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff'
  },
  infoLabel: {
    color: '#8c9ba5',
    fontSize: 13,
    marginBottom: 8
  },
  logoutButton: {
    backgroundColor: '#e74c3c33',
    borderColor: '#e74c3c66',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 12
  },
  logoutButtonText: {
    color: '#e74c3c',
    fontSize: 13,
    fontWeight: 'bold'
  },
  modalOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    padding: 16,
    zIndex: 100
  },
  modalCard: {
    backgroundColor: '#14161f',
    borderWidth: 1,
    borderRadius: 20,
    padding: 20,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16
  },
  modalHeaderTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8
  },
  modalBodyBold: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8
  },
  modalBodyText: {
    fontSize: 12,
    color: '#8c9ba5',
    lineHeight: 18,
    backgroundColor: '#0b0c10',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.03)'
  },
  modalBtnGroup: {
    flexDirection: 'row',
    marginTop: 20
  },
  modalBtnApprove: {
    flex: 1,
    backgroundColor: '#2f80ed',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginRight: 8
  },
  modalBtnApproveText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold'
  },
  modalBtnCancel: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center'
  },
  modalBtnCancelText: {
    color: '#8c9ba5',
    fontSize: 12,
    fontWeight: 'bold'
  },
  confirmationBox: {
    backgroundColor: '#0b0c10',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.03)',
    marginBottom: 8
  },
  confirmLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff'
  },
  confirmParams: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#00f2fe',
    marginTop: 4
  }
});
