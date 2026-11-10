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

let messageCounter = 0;
const getUniqueId = (prefix) => {
  messageCounter += 1;
  return `${prefix}-${messageCounter}`;
};

const createWelcomeMessage = (tx) => ({
  id: getUniqueId('welcome'),
  sender: 'copilot',
  timestamp: 'Just now',
  text: `Hello! I'm your PayPal Transaction Clarity Copilot. I've analyzed your transaction with **${tx.resolvedMerchant}** (${tx.id}).`,
  details: {
    headline: tx.aiExplanation?.headline,
    descriptor: tx.rawDescriptor,
    summary: tx.aiExplanation?.claritySummary,
    steps: tx.safeNextSteps
  }
});

export function CopilotView({ 
  transactions = [], 
  initialTransaction, 
  initialPrompt 
}) {
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

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const generateAnswer = (prompt, tx) => {
    setIsTyping(true);
    setTimeout(() => {
      const p = prompt.toLowerCase();
      let replyText;
      let safeTips = [];

      if (p.includes("pending") || p.includes("why is it pending") || p.includes("hold")) {
        replyText = `**Why it is Pending:** ${tx.aiExplanation?.statusReason}\n\n**Financial Impact:** ${tx.aiExplanation?.claritySummary}`;
        safeTips = tx.safeNextSteps?.map(s => s.title) || [];
      } else if (p.includes("double") || p.includes("charged twice") || p.includes("two times")) {
        if (tx.type === "authorization") {
          replyText = `**No double charge has occurred.** This $${tx.amount.toFixed(2)} is a temporary pre-authorization hold. When the final merchant receipt settles, the pending hold drops off and only the true fare is debited.`;
        } else if (tx.type === "echeck") {
          replyText = `**Do NOT submit a second payment.** Electronic bank checks (ACH) take 3 to 5 business days. Submitting again would cause your bank to debit your account twice once both transfers settle.`;
        } else {
          replyText = `We verified your PayPal account ledger: only a single transaction (${tx.id}) was authorized. There are no duplicate pending captures.`;
        }
      } else if (p.includes("descriptor") || p.includes("cryptic") || p.includes("statement") || p.includes("code")) {
        replyText = `**Statement Descriptor Decoded:** '${tx.rawDescriptor}'\n\n**True Entity:** ${tx.resolvedMerchant} (${tx.merchantCategory})\n\n${tx.aiExplanation?.descriptorMeaning}`;
      } else if (p.includes("dispute") || p.includes("chargeback") || p.includes("claim")) {
        replyText = `**Safe Guidance on Disputes:** We strongly recommend **against** filing a premature dispute at this moment. Why? ${tx.aiExplanation?.riskAssessment || 'The transaction is in normal processing'}. Premature bank chargebacks can cause merchant account bans or delayed resolutions. Instead, follow the verified safe steps outlined below.`;
        safeTips = tx.safeNextSteps?.map(s => `${s.title}: ${s.description}`) || [];
      } else if (p.includes("failed") || p.includes("declined")) {
        replyText = `**Why the payment failed:** ${tx.aiExplanation?.statusReason}\n\n**Safe Next Step:** No money was taken from your bank or card. You can safely retry with an alternate card or PayPal balance.`;
      } else {
        replyText = `Based on our AI merchant analysis of **${tx.resolvedMerchant}** (${tx.id}):\n\n• **Status Insight:** ${tx.aiExplanation?.headline}\n• **Merchant Entity:** ${tx.resolvedMerchant} (${tx.merchantCategory})\n• **Clarity Summary:** ${tx.aiExplanation?.claritySummary}\n• **Protection:** ${tx.protection?.program} (${tx.protection?.eligible ? 'Active' : 'N/A'})\n\nFeel free to ask about fees, settlement timelines, or next steps!`;
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
    navigator.clipboard.writeText(text).then(() => {
      setCopiedIndex(idx);
      setTimeout(() => setCopiedIndex(null), 2000);
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
      {/* View Header */}
      <div className="copilot-header">
        <div className="copilot-header-title-block">
          <div className="copilot-title-row">
            <div className="copilot-brand-icon">
              <SparklesIcon size={20} />
            </div>
            <div>
              <h1 className="copilot-title">AI Transaction Clarity Copilot</h1>
              <p className="copilot-subtitle">
                Ask anything about transaction statuses, banking holds, fees, or safe resolution next steps.
              </p>
            </div>
          </div>
        </div>

        {/* Transaction Selector Dropdown */}
        <div className="copilot-tx-selector-wrap">
          <label className="selector-label">Inspecting Transaction:</label>
          <div className="custom-select-container">
            <select
              value={selectedTxId}
              onChange={(e) => handleTxChange(e.target.value)}
              className="copilot-tx-select"
            >
              {transactions.map(t => (
                <option key={t.id} value={t.id}>
                  {t.resolvedMerchant} • {t.direction === 'debit' ? '-' : '+'}${t.amount.toFixed(2)} ({t.status})
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="select-arrow" />
          </div>
        </div>
      </div>

      {/* Active Transaction Context Bar */}
      {activeTx && (
        <div className="copilot-context-bar">
          <div className="context-left">
            <span className="context-label">Context:</span>
            <span className="context-merchant">{activeTx.resolvedMerchant}</span>
            <span className="context-id">({activeTx.id})</span>
            <span className="context-descriptor">Descriptor: <code>{activeTx.rawDescriptor}</code></span>
          </div>

          <div className="context-right">
            <span className={`context-amount ${activeTx.direction === 'debit' ? 'text-debit' : 'text-credit'}`}>
              {activeTx.direction === 'debit' ? '-' : '+'}${activeTx.amount.toFixed(2)} {activeTx.currency}
            </span>
            <StatusBadge status={activeTx.status} size="sm" />
          </div>
        </div>
      )}

      {/* Chat Messages Body */}
      <div className="copilot-chat-body">
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
                    <span className="chat-sender-name">{isCopilot ? 'Clarity Copilot' : 'You'}</span>
                    <span className="chat-timestamp">{msg.timestamp}</span>
                    {isCopilot && (
                      <button
                        type="button"
                        onClick={() => handleCopyMessage(msg.text, idx)}
                        className="chat-copy-mini"
                        title="Copy message"
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
                        <span>Recommended Safe Steps</span>
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
                <span className="typing-text">Analyzing transaction details with AI merchant graph...</span>
              </div>
            </div>
          )}

          <div ref={chatBottomRef} />
        </div>
      </div>

      {/* Suggested Quick Prompt Chips */}
      <div className="copilot-quick-prompts-bar">
        <span className="quick-prompts-label">Suggested Inquiries:</span>
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
            placeholder={`Ask about ${activeTx?.resolvedMerchant || 'this transaction'} (e.g., "Why is it pending?", "Did I get double charged?")...`}
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
            <span>Ask Copilot</span>
          </button>
        </form>
        <div className="input-disclaimer-row">
          <span>PayPal AI Hackathon Demonstration • Simulated sandbox responses.</span>
        </div>
      </div>
    </div>
  );
}

export default CopilotView;
