import { useState, useEffect, useRef } from 'react';
import { 
  SparklesIcon, 
  SendIcon, 
  ShieldCheckIcon, 
  CopyIcon, 
  CheckmarkIcon,
  ChevronDown
} from '../components/icons/Icons';
import StatusBadge from '../components/StatusBadge';
import RealOrderClaritySection from '../components/RealOrderClaritySection';
import { formatCurrencyAmount } from '../utils/paypalFormatting';

let messageCounter = 0;
const getUniqueId = (prefix) => {
  messageCounter += 1;
  return `${prefix}-${messageCounter}`;
};

const createWelcomeMessage = (tx) => {
  if (!tx) {
    return {
      id: getUniqueId('welcome'),
      sender: 'copilot',
      timestamp: 'Just now',
      text: '[DEMO DATA — Simulated Scenario]\nSelect a sample transaction above to inspect simulated explanations.',
      details: {}
    };
  }

  return {
    id: getUniqueId('welcome'),
    sender: 'copilot',
    timestamp: 'Just now',
    text: `[DEMO DATA — Simulated Scenario]\nShowing simulated Clarity Copilot context for **${tx.resolvedMerchant}** (${tx.id}).`,
    details: {
      headline: tx.aiExplanation?.headline,
      descriptor: tx.rawDescriptor,
      summary: tx.aiExplanation?.claritySummary,
      steps: tx.safeNextSteps
    }
  };
};

export function CopilotView({ 
  transactions = [], 
  initialTransaction, 
  initialPrompt 
}) {
  // Mode switcher: 'real' (Real PayPal Sandbox Order) or 'demo' (Demo Data Assistant)
  const [mode, setMode] = useState(() => {
    if (initialTransaction || initialPrompt) {
      return 'demo';
    }
    return 'real';
  });

  const [selectedTxId, setSelectedTxId] = useState(
    initialTransaction?.id || transactions[1]?.id || transactions[0]?.id
  );
  
  const activeTx = transactions.find(t => t.id === selectedTxId) || transactions[0];

  const [messages, setMessages] = useState(() => {
    const welcome = createWelcomeMessage(activeTx);
    if (initialPrompt) {
      const userMsg = {
        id: getUniqueId('user'),
        sender: 'user',
        timestamp: 'Just now',
        text: initialPrompt
      };
      return [welcome, userMsg];
    }
    return [welcome];
  });

  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState(null);
  const chatBottomRef = useRef(null);

  const [prevInitialId, setPrevInitialId] = useState(initialTransaction?.id);
  if (initialTransaction?.id && initialTransaction.id !== prevInitialId) {
    setPrevInitialId(initialTransaction.id);
    setSelectedTxId(initialTransaction.id);
    setMode('demo');
  }

  useEffect(() => {
    if (mode === 'demo') {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isTyping, mode]);

  const generateAnswer = (prompt, tx) => {
    setIsTyping(true);
    setTimeout(() => {
      const p = prompt.toLowerCase();
      let replyText;
      let safeTips = [];

      if (p.includes("pending") || p.includes("why is it pending") || p.includes("hold")) {
        replyText = `[DEMO DATA — Simulated Scenario]\n**Why it is Pending:** ${tx.aiExplanation?.statusReason}\n\n**Financial Impact:** ${tx.aiExplanation?.claritySummary}`;
        safeTips = tx.safeNextSteps?.map(s => s.title) || [];
      } else if (p.includes("double") || p.includes("charged twice") || p.includes("two times")) {
        if (tx.type === "authorization") {
          replyText = `[DEMO DATA — Simulated Scenario]\n**Sample Pre-Authorization Scenario:** This simulated ${formatCurrencyAmount(tx.amount, tx.currency)} transaction represents a temporary pre-authorization hold rather than a duplicate settled charge.`;
        } else if (tx.type === "echeck") {
          replyText = `[DEMO DATA — Simulated Scenario]\n**Sample eCheck Scenario:** Do NOT submit a duplicate payment while an electronic bank check (ACH) demo scenario is pending, as bank clearing can take several business days.`;
        } else {
          replyText = `[DEMO DATA — Simulated Scenario]\nIn this sample transaction dataset (${tx.id}), only a single mock authorization is modeled (this does not query a live PayPal ledger).`;
        }
      } else if (p.includes("descriptor") || p.includes("cryptic") || p.includes("statement") || p.includes("code")) {
        replyText = `[DEMO DATA — Simulated Scenario]\n**Simulated Descriptor:** '${tx.rawDescriptor}'\n\n**Sample Merchant:** ${tx.resolvedMerchant} (${tx.merchantCategory})\n\n${tx.aiExplanation?.descriptorMeaning}`;
      } else if (p.includes("dispute") || p.includes("chargeback") || p.includes("claim")) {
        replyText = `[DEMO DATA — Simulated Scenario]\n**Sample Dispute Guidance:** ${tx.aiExplanation?.riskAssessment || 'The sample transaction is in normal simulated processing.'} Review the sample guidance steps below instead of assuming an automatic dispute is needed.`;
        safeTips = tx.safeNextSteps?.map(s => `${s.title}: ${s.description}`) || [];
      } else if (p.includes("failed") || p.includes("declined")) {
        replyText = `[DEMO DATA — Simulated Scenario]\n**Why this sample payment failed:** ${tx.aiExplanation?.statusReason}\n\n**Demo Next Step:** In this simulated failed scenario, no capture occurred.`;
      } else {
        replyText = `[DEMO DATA — Simulated Scenario]\nSimulated overview for **${tx.resolvedMerchant}** (${tx.id}):\n\n• **Status Insight:** ${tx.aiExplanation?.headline}\n• **Sample Merchant:** ${tx.resolvedMerchant} (${tx.merchantCategory})\n• **Clarity Summary:** ${tx.aiExplanation?.claritySummary}\n• **Demo Protection Note:** ${tx.protection?.program} (${tx.protection?.eligible ? 'Simulated Eligible' : 'N/A'})\n\nFeel free to ask about sample fees, timelines, or next steps!`;
      }

      const copilotResponse = {
        id: getUniqueId('copilot'),
        sender: 'copilot',
        timestamp: 'Just now',
        text: replyText,
        tips: safeTips
      };

      setMessages(prev => [...prev, copilotResponse]);
      setIsTyping(false);
    }, 850);
  };

  const handleTxChange = (newTxId) => {
    setSelectedTxId(newTxId);
    const targetTx = transactions.find(t => t.id === newTxId) || transactions[0];
    setMessages([createWelcomeMessage(targetTx)]);
    setInputText('');
  };

  const handleSendMessage = (e) => {
    e?.preventDefault();
    if (!inputText.trim() || isTyping) return;

    const userMsg = {
      id: getUniqueId('user'),
      sender: 'user',
      timestamp: 'Just now',
      text: inputText.trim()
    };

    setMessages(prev => [...prev, userMsg]);
    const promptToSend = inputText;
    setInputText('');
    generateAnswer(promptToSend, activeTx);
  };

  const handleQuickPrompt = (prompt) => {
    if (isTyping) return;
    const userMsg = {
      id: getUniqueId('user'),
      sender: 'user',
      timestamp: 'Just now',
      text: prompt
    };
    setMessages(prev => [...prev, userMsg]);
    generateAnswer(prompt, activeTx);
  };

  const handleCopyMessage = (text, idx) => {
    if (!text || !navigator.clipboard?.writeText) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedIndex(idx);
      setTimeout(() => setCopiedIndex(null), 2000);
    }).catch(() => {
      setCopiedIndex(null);
    });
  };

  const quickPrompts = [
    `Why is this marked ${activeTx?.status}?`,
    "What does this cryptic statement descriptor mean?",
    "Will I be charged twice for this?",
    "Should I file a bank dispute right now?",
    "What are my suggested safe next steps?"
  ];

  return (
    <div className="copilot-view-container">
      {/* Top Header with Mode Selector */}
      <div className="copilot-header">
        <div className="copilot-header-title-block">
          <div className="copilot-title-row">
            <div className="copilot-brand-icon">
              <SparklesIcon size={20} />
            </div>
            <div>
              <h1 className="copilot-title">AI Transaction Clarity Copilot</h1>
              <p className="copilot-subtitle">
                Inspect real PayPal Sandbox orders with Gemini AI, or explore interactive demo scenarios.
              </p>
            </div>
          </div>
        </div>

        {/* View Mode Navigation Switcher */}
        <nav className="copilot-nav-pills" aria-label="Copilot mode switcher">
          <button
            type="button"
            aria-pressed={mode === 'real'}
            onClick={() => setMode('real')}
            className={`copilot-nav-pill ${mode === 'real' ? 'active-real' : ''}`}
          >
            <ShieldCheckIcon size={15} />
            <span>Real PayPal Sandbox Order</span>
            <span className="pill-badge pill-live">LIVE AI</span>
          </button>

          <button
            type="button"
            aria-pressed={mode === 'demo'}
            onClick={() => setMode('demo')}
            className={`copilot-nav-pill ${mode === 'demo' ? 'active-demo' : ''}`}
          >
            <SparklesIcon size={15} />
            <span>Interactive Demo Chat</span>
            <span className="pill-badge pill-demo">DEMO DATA</span>
          </button>
        </nav>
      </div>

      {/* Mode A: Real PayPal Sandbox Order Section */}
      {mode === 'real' && (
        <div className="copilot-mode-view-body">
          <RealOrderClaritySection />
        </div>
      )}

      {/* Mode B: Interactive Demo Chat (DEMO DATA) */}
      {mode === 'demo' && (
        <div className="copilot-demo-chat-wrapper">
          {/* Prominent Demo Notice Banner */}
          <div className="demo-notice-banner">
            <div className="demo-notice-left">
              <span className="copilot-demo-badge-pill">DEMO DATA</span>
              <span className="demo-notice-text">
                You are viewing simulated mock transaction scenarios. To explain a genuine PayPal Sandbox order using Gemini AI, switch to the <strong>Real PayPal Sandbox Order</strong> mode.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setMode('real')}
              className="demo-switch-cta-btn"
            >
              Switch to Real Order
            </button>
          </div>

          {/* Transaction Selector Dropdown */}
          <div className="copilot-tx-selector-wrap demo-selector-wrap">
            <label htmlFor="demo-tx-select" className="selector-label">Inspecting Mock Transaction (DEMO DATA):</label>
            <div className="custom-select-container">
              <select
                id="demo-tx-select"
                value={selectedTxId}
                onChange={(e) => handleTxChange(e.target.value)}
                className="copilot-tx-select"
              >
                {transactions.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.resolvedMerchant} • {t.direction === 'debit' ? '-' : '+'}{formatCurrencyAmount(t.amount, t.currency)} ({t.status}) [DEMO]
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="select-arrow" />
            </div>
          </div>

          {/* Active Transaction Context Bar */}
          {activeTx && (
            <div className="copilot-context-bar">
              <div className="context-left">
                <span className="demo-context-tag">DEMO</span>
                <span className="context-label">Context:</span>
                <span className="context-merchant">{activeTx.resolvedMerchant}</span>
                <span className="context-id">({activeTx.id})</span>
                <span className="context-descriptor">Descriptor: <code>{activeTx.rawDescriptor}</code></span>
              </div>

              <div className="context-right">
                <span className={`context-amount ${activeTx.direction === 'debit' ? 'text-debit' : 'text-credit'}`}>
                  {activeTx.direction === 'debit' ? '-' : '+'}{formatCurrencyAmount(activeTx.amount, activeTx.currency)}
                </span>
                <StatusBadge status={activeTx.status} size="sm" />
              </div>
            </div>
          )}

          {/* Chat Messages Body */}
          <div className="copilot-chat-body">
            <span className="sr-only" aria-live="polite">
              {copiedIndex !== null ? 'Assistant reply copied to clipboard.' : ''}
            </span>
            <div className="chat-messages-container">
              {messages.map((msg, idx) => {
                const isCopilot = msg.sender === 'copilot';
                return (
                  <div key={msg.id || idx} className={`chat-message-row ${isCopilot ? 'msg-copilot' : 'msg-user'}`}>
                    {isCopilot && (
                      <div className="chat-avatar copilot-avatar">
                        <SparklesIcon size={16} />
                      </div>
                    )}

                    <div className="chat-bubble-card">
                      <div className="chat-bubble-header">
                        <div className="chat-sender-box">
                          <span className="chat-sender-name">{isCopilot ? 'Clarity Copilot' : 'You'}</span>
                          {isCopilot && <span className="demo-chat-bubble-pill">DEMO DATA</span>}
                        </div>
                        <span className="chat-timestamp">{msg.timestamp}</span>
                        {isCopilot && (
                          <button
                            type="button"
                            onClick={() => handleCopyMessage(msg.text, idx)}
                            className="chat-copy-mini"
                            title="Copy message"
                            aria-label="Copy assistant message"
                          >
                            {copiedIndex === idx ? <CheckmarkIcon size={12} /> : <CopyIcon size={12} />}
                          </button>
                        )}
                      </div>

                      <div className="chat-bubble-text">
                        {msg.text.split('\n\n').map((paragraph, pIdx) => (
                          <p key={pIdx} className="chat-paragraph">
                            {paragraph.split('**').map((chunk, cIdx) =>
                              cIdx % 2 === 1 ? <strong key={cIdx}>{chunk}</strong> : chunk
                            )}
                          </p>
                        ))}
                      </div>

                      {/* Rich details */}
                      {msg.details && (
                        <div className="chat-rich-details">
                          <div className="rich-headline">
                            <SparklesIcon size={14} />
                            <span>{msg.details.headline}</span>
                          </div>
                          <div className="rich-summary">{msg.details.summary}</div>
                        </div>
                      )}

                      {/* Safe tips list if present */}
                      {msg.tips && msg.tips.length > 0 && (
                        <div className="chat-tips-box">
                          <div className="tips-title">
                            <ShieldCheckIcon size={14} />
                            <span>Recommended Safe Steps (DEMO)</span>
                          </div>
                          <ul className="tips-list">
                            {msg.tips.map((tip, tIdx) => (
                              <li key={tIdx}>{tip}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    {!isCopilot && (
                      <div className="chat-avatar user-avatar">
                        <span>AM</span>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Typing indicator */}
              {isTyping && (
                <div className="chat-message-row msg-copilot">
                  <div className="chat-avatar copilot-avatar">
                    <SparklesIcon size={16} />
                  </div>
                  <div className="chat-bubble-card typing-bubble">
                    <div className="typing-dots">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                    <span className="typing-text">Simulating demo response for walkthrough...</span>
                  </div>
                </div>
              )}

              <div ref={chatBottomRef} />
            </div>
          </div>

          {/* Suggested Quick Prompt Chips */}
          <div className="copilot-quick-prompts-bar">
            <span className="quick-prompts-label">Suggested Demo Inquiries:</span>
            <div className="quick-prompts-scroll">
              {quickPrompts.map((prompt, qIdx) => (
                <button
                  key={qIdx}
                  type="button"
                  onClick={() => handleQuickPrompt(prompt)}
                  disabled={isTyping}
                  className="quick-prompt-chip"
                >
                  <span>{prompt}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Chat Input Bar */}
          <div className="copilot-input-bar">
            <form onSubmit={handleSendMessage} className="copilot-input-form">
              <input
                type="text"
                aria-label={`Ask a demo question about ${activeTx?.resolvedMerchant || 'this transaction'}`}
                placeholder={`Ask about ${activeTx?.resolvedMerchant || 'this transaction'} (DEMO DATA)...`}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                disabled={isTyping}
                className="copilot-text-input"
              />
              <button
                type="submit"
                disabled={!inputText.trim() || isTyping}
                className="copilot-send-btn"
                title="Send inquiry"
              >
                <SendIcon size={16} />
                <span>Ask Demo Copilot</span>
              </button>
            </form>
            <div className="input-disclaimer-row">
              <span className="demo-mode-disclaimer-label">DEMO DATA MODE</span>
              <span> • Simulated mock responses for demonstration. Switch to &quot;Real PayPal Sandbox Order&quot; above for live Gemini AI explanations.</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CopilotView;
