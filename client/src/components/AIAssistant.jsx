import React, { useState, useRef, useEffect } from 'react';
import API_BASE from '../utils/apiBase';
import './AIAssistant.css';

function AIAssistant({ onApplySearch, onClose, isOpen }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationState, setConversationState] = useState(null);
  const [searchParams, setSearchParams] = useState(null);
  const [searchReady, setSearchReady] = useState(false);
  const [showLeadCapture, setShowLeadCapture] = useState(false);
  const [leadEmail, setLeadEmail] = useState('');
  const [leadCaptured, setLeadCaptured] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Start conversation when opened
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      startConversation();
    }
  }, [isOpen]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  const startConversation = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/assistant/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: '', conversationState: null }),
      });
      const data = await res.json();
      setMessages([{ role: 'assistant', text: data.reply }]);
      setConversationState(data.conversationState);
    } catch (err) {
      setMessages([{ role: 'assistant', text: 'Hey! I\'m ready to help you find a home. What city are you looking in?' }]);
    }
    setLoading(false);
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', text: userMessage }]);
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/assistant/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          conversationState,
        }),
      });
      const data = await res.json();
      setMessages((prev) => [...prev, { role: 'assistant', text: data.reply }]);
      setConversationState(data.conversationState);
      if (data.searchReady) {
        setSearchReady(true);
        setSearchParams(data.searchParams);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', text: 'Sorry, something went wrong. Please try again.' },
      ]);
    }
    setLoading(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSearchNow = () => {
    if (searchParams && onApplySearch) {
      onApplySearch(searchParams);
    }
  };

  const handleRestart = () => {
    setMessages([]);
    setConversationState(null);
    setSearchReady(false);
    setSearchParams(null);
    setTimeout(() => startConversation(), 100);
  };

  // Simple markdown-like rendering for bold text
  const renderText = (text) => {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i}>{part.slice(2, -2)}</strong>;
      }
      // Handle newlines
      return part.split('\n').map((line, j) => (
        <React.Fragment key={`${i}-${j}`}>
          {j > 0 && <br />}
          {line}
        </React.Fragment>
      ));
    });
  };

  if (!isOpen) return null;

  return (
    <div className="ai-assistant-overlay" onClick={onClose}>
      <div className="ai-assistant" onClick={(e) => e.stopPropagation()}>
        <div className="ai-header">
          <div className="ai-header-left">
            <div className="ai-avatar">AI</div>
            <div>
              <h3>Home Finding Assistant</h3>
              <span className="ai-status">Online</span>
            </div>
          </div>
          <div className="ai-header-right">
            <button onClick={handleRestart} className="ai-restart" title="Start over">
              &#8635;
            </button>
            <button onClick={onClose} className="ai-close" title="Close">
              &times;
            </button>
          </div>
        </div>

        <div className="ai-messages">
          {messages.map((msg, i) => (
            <div key={i} className={`ai-message ${msg.role}`}>
              {msg.role === 'assistant' && <div className="msg-avatar">AI</div>}
              <div className="msg-bubble">{renderText(msg.text)}</div>
            </div>
          ))}
          {loading && (
            <div className="ai-message assistant">
              <div className="msg-avatar">AI</div>
              <div className="msg-bubble typing">
                <span></span><span></span><span></span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {searchReady && searchParams && (
          <div className="ai-search-action">
            <button onClick={handleSearchNow} className="btn-search-now">
              Search Now &rarr;
            </button>
            {!leadCaptured && !showLeadCapture && (
              <button onClick={() => setShowLeadCapture(true)} className="btn-get-agent-help">
                Want a local expert to help?
              </button>
            )}
            {showLeadCapture && !leadCaptured && (
              <form className="ai-lead-form" onSubmit={async (e) => {
                e.preventDefault();
                if (!leadEmail) return;
                try {
                  await fetch(`${API_BASE}/api/leads/capture`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      buyerEmail: leadEmail,
                      prompt: messages.filter(m => m.role === 'user').map(m => m.text).join(' | '),
                      parsedIntent: searchParams,
                      source: 'ai_assistant_chat',
                    }),
                  });
                  setLeadCaptured(true);
                  localStorage.setItem('hm_lead_submitted', JSON.stringify({ email: leadEmail, ts: Date.now() }));
                } catch {}
              }}>
                <input type="email" placeholder="Your email" value={leadEmail} onChange={e => setLeadEmail(e.target.value)} className="ai-lead-input" required />
                <button type="submit" className="ai-lead-btn" disabled={!leadEmail}>Connect</button>
              </form>
            )}
            {leadCaptured && (
              <div className="ai-lead-success">&#10003; Agent will reach out soon!</div>
            )}
          </div>
        )}

        <div className="ai-input-area">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your answer..."
            disabled={loading}
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="btn-send"
          >
            &#10148;
          </button>
        </div>
      </div>
    </div>
  );
}

export default AIAssistant;
