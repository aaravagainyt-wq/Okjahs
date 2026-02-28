import React, { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [messages, setMessages] = useState([{ role: 'ai', content: 'Systems online. How can I help you today, Aarav?' }]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const newMessages = [...messages, { role: 'user', content: input }];
    setMessages(newMessages);
    setInput('');
    setIsTyping(true);

    try {
      const response = await fetch("YOUR_HUGGINGFACE_SPACE_URL/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: input })
      });
      const data = await response.json();
      setMessages([...newMessages, { role: 'ai', content: data.reply }]);
    } catch (error) {
      setMessages([...newMessages, { role: 'ai', content: "Error connecting to backend." }]);
    }
    setIsTyping(false);
  };

  return (
    <div className="app-container">
      <div className="bg-animate"></div>
      <div className="chat-card">
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
          {messages.map((msg, i) => (
            <div key={i} className={msg.role === 'user' ? 'message-user' : 'message-ai'}>
              {msg.content}
            </div>
          ))}
          {isTyping && <p style={{ color: 'var(--neon-blue)', marginLeft: '10px' }}>AI is thinking...</p>}
        </div>
        <div className="input-area">
          <input 
            value={input} 
            onChange={(e) => setInput(e.target.value)} 
            placeholder="Type your command..." 
            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
          />
          <button onClick={sendMessage}>SEND</button>
        </div>
      </div>
    </div>
  );
}

export default App;
