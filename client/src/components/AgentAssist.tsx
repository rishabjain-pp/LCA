import { useState } from 'react';

type AssistAction = 'summarize' | 'topic' | 'email';

const mockResponses: Record<AssistAction, string> = {
  summarize:
    'The caller is inquiring about their recent order status. They placed an order 3 days ago and have not received a shipping confirmation. The agent is looking up the order details and providing estimated delivery information.',
  topic:
    'Current topic: Order Status Inquiry\n\nThe conversation is focused on tracking a recent purchase. Key entities mentioned: order number, shipping confirmation, delivery estimate.',
  email:
    'Subject: Follow-up on Your Order Status\n\nDear Customer,\n\nThank you for contacting us regarding your recent order. As discussed, your order is currently being processed and you should receive a shipping confirmation within the next 24 hours.\n\nIf you have any further questions, please don\'t hesitate to reach out.\n\nBest regards,\nCustomer Support Team',
};

export function AgentAssist() {
  const [response, setResponse] = useState<string | null>(null);
  const [activeAction, setActiveAction] = useState<AssistAction | null>(null);

  const handleAction = (action: AssistAction) => {
    setActiveAction(action);
    setResponse(mockResponses[action]);
  };

  return (
    <div className="agent-assist">
      <div className="agent-assist-header">
        <h3>Agent Assist Bot</h3>
        <span className="agent-assist-info">AI-Powered</span>
      </div>

      <div className="agent-assist-intro">
        LCA Agent Assistant is ready. Select an action below to get AI-powered assistance during the call.
      </div>

      <div className="agent-assist-actions">
        <button
          className={`assist-btn ${activeAction === 'summarize' ? 'assist-btn-active' : ''}`}
          onClick={() => handleAction('summarize')}
        >
          {'\uD83D\uDCCB'} SUMMARIZE CURRENT CALL
        </button>
        <button
          className={`assist-btn ${activeAction === 'topic' ? 'assist-btn-active' : ''}`}
          onClick={() => handleAction('topic')}
        >
          {'\uD83D\uDD0D'} IDENTIFY CURRENT TOPIC
        </button>
        <button
          className={`assist-btn assist-btn-primary ${activeAction === 'email' ? 'assist-btn-active' : ''}`}
          onClick={() => handleAction('email')}
        >
          {'\u2709'} GENERATE EMAIL
        </button>
      </div>

      {response && (
        <div className="agent-assist-response">
          <div className="agent-assist-response-header">
            {activeAction === 'summarize' && 'Call Summary'}
            {activeAction === 'topic' && 'Topic Analysis'}
            {activeAction === 'email' && 'Generated Email'}
          </div>
          <pre className="agent-assist-response-body">{response}</pre>
        </div>
      )}
    </div>
  );
}
