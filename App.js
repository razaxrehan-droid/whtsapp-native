import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, FlatList, SafeAreaView, StatusBar, ActivityIndicator, Alert } from 'react-native';
import { io } from 'socket.io-client';

// Aapka permanent bot-hosting server address
const SERVER_URL = "http://fi12.bot-hosting.cloud:20610"; 
const socket = io(SERVER_URL, {
  transports: ['polling','websocket'],
  jsonp: false,
  autoConnect: true
});

export default function App() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [pairingCode, setPairingCode] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [chats, setChats] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [messageText, setMessageText] = useState('');
  const [messages, setMessages] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Socket Connections
    socket.on('connect', () => {
      console.log("Connected to native server");
      socket.emit('check-session');
    });

    socket.on('session-status', (status) => {
      setIsConnected(status.connected);
    });

    socket.on('pairing-code', (code) => {
      setLoading(false);
      setPairingCode(code);
    });

    socket.on('connection-success', () => {
      setIsConnected(true);
      setLoading(false);
      Alert.alert("Success", "WhatsApp account linked successfully!");
    });

    socket.on('connect_error', (err) => {
      console.log("Connection Error: ", err.message);
    });

    socket.on('new-message', (data) => {
      const { chatId, name, text, isMe } = data;
      
      setChats((prevChats) => {
        if (!prevChats.find(c => c.id === chatId)) {
          return [...prevChats, { id: chatId, name: name || 'Unknown', lastMessage: text }];
        }
        return prevChats.map(c => c.id === chatId ? { ...c, lastMessage: text } : c);
      });

      setMessages((prevMsgs) => {
        const chatMsgs = prevMsgs[chatId] || [];
        return {
          ...prevMsgs,
          [chatId]: [...chatMsgs, { id: Math.random().toString(), text, isMe }]
        };
      });
    });

    return () => {
      socket.off('connect');
      socket.off('session-status');
      socket.off('pairing-code');
      socket.off('connection-success');
      socket.off('connect_error');
      socket.off('new-message');
    };
  }, []);

  const requestPairing = () => {
    if (!phoneNumber) {
      Alert.alert("Error", "Pehle phone number enter karein!");
      return;
    }
    setLoading(true);
    setPairingCode('');
    socket.emit('request-code', phoneNumber);
  };

  const sendMessage = () => {
    if (!messageText.trim() || !activeChat) return;

    socket.emit('send-wa', { jid: activeChat.id, text: messageText });

    setMessages((prevMsgs) => {
      const chatMsgs = prevMsgs[activeChat.id] || [];
      return {
        ...prevMsgs,
        [activeChat.id]: [...chatMsgs, { id: Math.random().toString(), text: messageText, isMe: true }]
      };
    });

    setMessageText('');
  };

  // --- SCREEN 1: LINKING / PAIRING SCREEN ---
  if (!isConnected) {
    return (
      <SafeAreaView style={styles.darkContainer}>
        <StatusBar barStyle="light-content" />
        <View style={styles.card}>
          <Text style={styles.goldTitle}>👑 GB WA Native</Text>
          <Text style={styles.subtitle}>Enter number with country code (923xxxxxxxx):</Text>
          
          <TextInput 
            style={styles.input} 
            placeholder="923XXXXXXXXX" 
            placeholderTextColor="#8696a0"
            keyboardType="phone-pad"
            value={phoneNumber}
            onChangeText={setPhoneNumber}
          />

          <TouchableOpacity style={styles.goldButton} onPress={requestPairing} disabled={loading}>
            {loading ? <ActivityIndicator color="#111b21" /> : <Text style={styles.buttonText}>Get Pairing Code</Text>}
          </TouchableOpacity>

          {pairingCode ? (
            <View style={styles.codeBox}>
              <Text style={styles.codeLabel}>Enter this code in Linked Devices:</Text>
              <Text style={styles.codeText}>{pairingCode}</Text>
            </View>
          ) : null}
        </View>
      </SafeAreaView>
    );
  }

  // --- SCREEN 2: CHAT WINDOW ---
  if (activeChat) {
    return (
      <SafeAreaView style={styles.darkContainer}>
        <View style={styles.chatHeader}>
          <TouchableOpacity onPress={() => setActiveChat(null)}>
            <Text style={styles.backButton}>⬅ Back</Text>
          </TouchableOpacity>
          <Text style={styles.chatHeaderName}>{activeChat.name}</Text>
        </View>

        <FlatList 
          data={messages[activeChat.id] || []}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={[styles.messageBubble, item.isMe ? styles.myMessage : styles.theirMessage]}>
              <Text style={styles.messageText}>{item.text}</Text>
            </View>
          )}
          style={styles.messageList}
        />

        <View style={styles.inputArea}>
          <TextInput 
            style={styles.chatInput} 
            placeholder="Type message..." 
            placeholderTextColor="#8696a0"
            value={messageText}
            onChangeText={setMessageText}
          />
          <TouchableOpacity style={styles.sendButton} onPress={sendMessage}>
            <Text style={styles.sendButtonText}>Send</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // --- SCREEN 3: CHATS LIST ---
  return (
    <SafeAreaView style={styles.darkContainer}>
      <View style={styles.homeHeader}>
        <Text style={styles.goldTitle}>👑 Chats</Text>
      </View>

      <FlatList 
        data={chats}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.chatItem} onPress={() => setActiveChat(item)}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{item.name ? item.name[0].toUpperCase() : 'W'}</Text>
            </View>
            <View style={styles.chatInfo}>
              <Text style={styles.chatName}>{item.name}</Text>
              <Text style={styles.chatPreview} numberOfLines={1}>{item.lastMessage}</Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  darkContainer: { flex: 1, backgroundColor: '#0b0f12' },
  card: { padding: 30, backgroundColor: '#111b21', margin: 20, borderRadius: 12, borderTopWidth: 4, borderTopColor: '#d4af37', alignItems: 'center', marginTop: 100 },
  goldTitle: { fontSize: 24, fontWeight: 'bold', color: '#d4af37', marginBottom: 10 },
  subtitle: { color: '#8696a0', textAlign: 'center', marginBottom: 20, fontSize: 13 },
  input: { width: '100%', height: 50, backgroundColor: '#202c33', borderRadius: 8, paddingHorizontal: 15, color: '#fff', fontSize: 16, marginBottom: 15, textAlign: 'center' },
  goldButton: { width: '100%', height: 50, backgroundColor: '#d4af37', borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  buttonText: { color: '#111b21', fontWeight: 'bold', fontSize: 16 },
  codeBox: { marginTop: 25, padding: 15, backgroundColor: '#202c33', borderRadius: 8, borderStyle: 'dashed', borderWidth: 2, borderColor: '#d4af37', width: '100%', alignItems: 'center' },
  codeLabel: { color: '#8696a0', fontSize: 12, marginBottom: 10, textAlign: 'center' },
  codeText: { fontSize: 28, fontWeight: 'bold', color: '#d4af37', letterSpacing: 4 },
  homeHeader: { height: 60, backgroundColor: '#202c33', justifyContent: 'center', paddingLeft: 20, borderBottomWidth: 1, borderBottomColor: '#d4af37' },
  chatItem: { flexDirection: 'row', padding: 15, borderBottomWidth: 1, borderBottomColor: '#222e35', alignItems: 'center' },
  avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#d4af37', justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#111b21', fontWeight: 'bold', fontSize: 20 },
  chatInfo: { marginLeft: 15, flex: 1 },
  chatName: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  chatPreview: { color: '#8696a0', marginTop: 4, fontSize: 14 },
  chatHeader: { height: 60, backgroundColor: '#202c33', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15 },
  backButton: { color: '#d4af37', fontSize: 16, marginRight: 15 },
  chatHeaderName: { color: '#fff', fontWeight: 'bold', fontSize: 18 },
  messageList: { flex: 1, padding: 15 },
  messageBubble: { padding: 12, borderRadius: 8, marginVertical: 5, maxWidth: '75%' },
  myMessage: { backgroundColor: '#005c4b', alignSelf: 'flex-end' },
  theirMessage: { backgroundColor: '#202c33', alignSelf: 'flex-start' },
  messageText: { color: '#fff', fontSize: 15 },
  inputArea: { height: 70, backgroundColor: '#202c33', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, paddingBottom: 10 },
  chatInput: { flex: 1, height: 45, backgroundColor: '#2a3942', borderRadius: 20, paddingHorizontal: 15, color: '#fff' },
  sendButton: { marginLeft: 10, backgroundColor: '#d4af37', height: 45, width: 65, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  sendButtonText: { color: '#111b21', fontWeight: 'bold' }
});
