import { useEffect, useRef, useState } from 'react';

const greeting = (portal) => portal === 'affected'
  ? 'Hi! I can guide you through requesting emergency aid, checking a saved request, or finding the Safe Shelters page. If you are in immediate danger, contact emergency services now.'
  : 'Hi! I can help you navigate HUMANAID, review the request workflow, and summarize the current response data. An authorized officer must verify and approve every dispatch.';

const quickActions = (portal) => portal === 'affected'
  ? ['Request emergency help', 'Track my request', 'Find safe shelters']
  : ['Summarize open requests', 'How do I assign a response?', 'Available resources'];

export default function AidAssistant({ user, data, portal = 'dashboard', onNavigate }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState(() => [{ id: 'welcome', from: 'assistant', text: greeting(portal), at: new Date() }]);
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const requests = data?.requests || [];
  const resources = data?.resources || [];
  const shelters = data?.shelters || [];
  const volunteers = data?.volunteers || [];

  useEffect(() => {
    if (open) {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
      inputRef.current?.focus();
    }
  }, [open, messages]);

  function answerFor(message) {
    const text = message.toLowerCase();
    const isPublic = portal === 'affected';
    if (/^(hi|hello|hey|ayubowan|හායි|ආයුබෝවන්)/i.test(text.trim())) return 'Ayubowan! Tell me what you need help with. I can guide you through the HUMANAID pages.';
    if (/urgent|danger|trapped|life|emergency|sos|හදිසි|අනතුර|අවදානම/.test(text)) {
      if (isPublic) {
        onNavigate?.('sos');
        return 'I opened the SOS request section. Add your location and describe what is happening. If someone is in immediate danger, call local emergency services too; this chat does not dispatch a rescue team.';
      }
      return 'For immediate danger, use verified emergency channels. In HUMANAID, review the request details and location first; an authorized officer must confirm before dispatch.';
    }
    if (/track|status|my request|tracker|request #|request id|තත්ත්වය|අයදුම/.test(text)) {
      if (isPublic) {
        onNavigate?.('tracker');
        try {
          const saved = JSON.parse(localStorage.getItem('humanaid_public_request_trackers') || '[]');
          return saved.length
            ? `I opened Aid Tracker. This browser has ${saved.length} saved request${saved.length === 1 ? '' : 's'}; their latest status and action history will appear there.`
            : 'I opened Aid Tracker. No requests are saved in this browser yet. Submit an SOS first, then use the private tracking code shown after submission.';
        } catch { return 'I opened Aid Tracker. Submit an SOS first to get a private tracking code.'; }
      }
      const pending = requests.filter(x => ['Pending', 'Approved'].includes(x.status)).length;
      const active = requests.filter(x => x.status === 'In Progress').length;
      return `Current queue: ${pending} request${pending === 1 ? '' : 's'} awaiting review/dispatch and ${active} active case${active === 1 ? '' : 's'}. Select a request in Emergency Coordination to see its private action history.`;
    }
    if (/shelter|safe place|shelter place|සුරක්ෂිත|නවාතැන්/.test(text)) {
      if (isPublic) { onNavigate?.('shelters'); return 'I opened Safe Shelters. Check the listed location and status before travelling; confirm with local responders if conditions are changing.'; }
      const places = shelters.reduce((sum, item) => sum + Math.max(0, Number(item.capacity || 0) - Number(item.occupancy ?? item.occupied ?? 0)), 0);
      const openCount = shelters.filter(item => item.status === 'Open').length;
      return `Registry snapshot: ${openCount} shelters are marked Open, with about ${places.toLocaleString()} unoccupied places recorded. Confirm current conditions and travel safety before assigning people.`;
    }
    if (/resource|stock|suppl|food|water|medicine|medical|සම්පත්|ආහාර|ජලය/.test(text)) {
      const available = resources.filter(item => Number(item.quantity || 0) > 0 && !['Out of stock', 'Reserved'].includes(item.status));
      const units = available.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
      return `The registry lists ${available.length} resource item${available.length === 1 ? '' : 's'} with stock available (${units.toLocaleString()} total units). Open Resources & Aid for item-level quantities. Verify stock physically before dispatch.`;
    }
    if (/volunteer|team|staff|ස්වේච්ඡා/.test(text)) {
      const available = volunteers.filter(item => (item.status || item.availability) === 'Available').length;
      return `There are ${available} volunteer${available === 1 ? '' : 's'} marked Available in the loaded registry. Check skills and location in Volunteers before assigning anyone.`;
    }
    if (/assign|dispatch|workflow|verify|close|officer|assign kr|triage/.test(text)) {
      return 'Officer workflow: select one request, verify the reported details, choose any available resource/shelter/volunteers and a response team, then assign. The system updates the case and records actions. Close the case after follow-up. Human review is required at every decision.';
    }
    if (/help|how|use|guide|portal|උදව්|භාවිත/.test(text)) {
      return isPublic
        ? 'Use Request SOS to send your needs and location, Aid Tracker to check saved requests, and Safe Shelters to see nearby places. This assistant cannot send a rescue team by itself.'
        : 'Use Emergency Coordination to review and assign requests, Resources & Aid to manage stock, Shelter Management for capacity, Volunteers for availability, and Notifications for delivery history.';
    }
    return isPublic
      ? 'I can help with SOS requests, Aid Tracker, and Safe Shelters. Tell me which one you need. For immediate danger, contact emergency services directly.'
      : 'I can summarize open requests, recorded resources, shelters, and volunteers, or explain the officer workflow. I cannot approve or dispatch a response for you.';
  }

  function sendMessage(value = draft) {
    const text = value.trim();
    if (!text) return;
    const userMessage = { id: `${Date.now()}-u`, from: 'user', text, at: new Date() };
    const reply = { id: `${Date.now()}-a`, from: 'assistant', text: answerFor(text), at: new Date() };
    setMessages(previous => [...previous, userMessage, reply]);
    setDraft('');
  }

  return (
    <div className="aid-assistant-root">
      {open && <section className="aid-chat-panel" role="dialog" aria-label="HUMANAID Aid Assistant" aria-modal="false">
        <header className="aid-chat-header">
          <img src="/aid-assistant-avatar.svg" alt="" />
          <div><strong>HUMANAID Assistant</strong><span>Relief guidance · human-reviewed actions</span></div>
          <button type="button" className="aid-icon-btn" onClick={() => setOpen(false)} aria-label="Close assistant">×</button>
        </header>
        <div className="aid-chat-notice">Guidance only. This assistant does not dispatch emergency services.</div>
        <div className="aid-chat-messages" ref={listRef} aria-live="polite">
          {messages.map(message => <article key={message.id} className={`aid-chat-message ${message.from}`}>
            {message.from === 'assistant' && <img src="/aid-assistant-avatar.svg" alt="" />}
            <div className="aid-message-bubble">{message.text}<time>{message.at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time></div>
          </article>)}
          {messages.length <= 1 && <div className="aid-quick-actions">{quickActions(portal).map(prompt => <button type="button" key={prompt} onClick={() => sendMessage(prompt)}>{prompt}<span>›</span></button>)}</div>}
        </div>
        <form className="aid-chat-input" onSubmit={event => { event.preventDefault(); sendMessage(); }}>
          <input ref={inputRef} value={draft} onChange={event => setDraft(event.target.value)} maxLength={500} placeholder="Ask about aid or your request…" aria-label="Message HUMANAID Assistant" />
          <button type="submit" disabled={!draft.trim()} aria-label="Send message">➤</button>
        </form>
        <footer className="aid-chat-footer">Signed in as {user?.name || user?.email || 'HUMANAID user'}</footer>
      </section>}
      <button type="button" className={`aid-assistant-launcher${open ? ' is-open' : ''}`} onClick={() => setOpen(value => !value)} aria-label={open ? 'Close HUMANAID Assistant' : 'Ask HUMANAID Assistant'} aria-expanded={open}>
        {open ? <span className="aid-launcher-close">×</span> : <><img src="/aid-assistant-avatar.svg" alt="" /><span className="aid-launcher-label">Ask HUMANAID</span><i aria-hidden="true" /></>}
      </button>
    </div>
  );
}
