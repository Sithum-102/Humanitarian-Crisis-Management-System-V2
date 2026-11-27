import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../services/api/client';
import { validatePhone, validateEmail, sanitizePhoneInput, handlePhoneKeyDown } from '../utils/validation';

const emptyForm = { recipientName: '', email: '', phone: '', channels: ['Email'], subject: '', message: '' };
const dateText = value => value ? new Date(value).toLocaleString() : '—';

export default function NotificationCenter({ canWrite, session }) {
    const [form, setForm] = useState(emptyForm);
    const [rows, setRows] = useState([]);
    const [settings, setSettings] = useState(null);
    const [filter, setFilter] = useState('All');
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const [history, delivery] = await Promise.all([
                api('notifications?page=1&pageSize=100'),
                api('notifications/status')
            ]);
            setRows(history.items || []);
            setSettings(delivery);
        } catch (err) {
            setError(err.message || 'Could not load notification history.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);
    useEffect(() => {
        const timer = window.setInterval(load, 30000);
        return () => window.clearInterval(timer);
    }, [load]);

    const counts = useMemo(() => ({
        total: rows.length,
        sent: rows.filter(row => row.status === 'Sent').length,
        needsAttention: rows.filter(row => ['Failed', 'NotConfigured'].includes(row.status)).length
    }), [rows]);
    const shownRows = filter === 'All' ? rows : rows.filter(row => row.status === filter);

    function update(key, value) { setForm(current => ({ ...current, [key]: value })); }
    function toggleChannel(channel) {
        setForm(current => ({
            ...current,
            channels: current.channels.includes(channel)
                ? current.channels.filter(item => item !== channel)
                : [...current.channels, channel]
        }));
    }

    async function send(event) {
        event.preventDefault();
        setBusy(true); setError(''); setNotice('');

        if (form.channels.includes('SMS')) {
            const phoneCheck = validatePhone(form.phone, { required: true });
            if (!phoneCheck.isValid) {
                setError(phoneCheck.error);
                setBusy(false);
                return;
            }
        } else if (form.phone.trim()) {
            const phoneCheck = validatePhone(form.phone);
            if (!phoneCheck.isValid) {
                setError(phoneCheck.error);
                setBusy(false);
                return;
            }
        }

        if (form.channels.includes('Email')) {
            const emailCheck = validateEmail(form.email, { required: true });
            if (!emailCheck.isValid) {
                setError(emailCheck.error);
                setBusy(false);
                return;
            }
        } else if (form.email.trim()) {
            const emailCheck = validateEmail(form.email);
            if (!emailCheck.isValid) {
                setError(emailCheck.error);
                setBusy(false);
                return;
            }
        }

        try {
            const result = await api('notifications', {
                method: 'POST',
                body: { ...form, recipientName: form.recipientName || null }
            });
            setNotice(result.message || 'Notification attempt recorded.');
            setForm(emptyForm);
            await load();
        } catch (err) {
            setError(err.message || 'Could not send notification.');
        } finally { setBusy(false); }
    }

    async function retry(id) {
        setBusy(true); setError(''); setNotice('');
        try {
            const updated = await api(`notifications/${id}/retry`, { method: 'POST' });
            setNotice(`Retry completed: ${updated.status}.`);
            await load();
        } catch (err) { setError(err.message || 'Could not retry delivery.'); }
        finally { setBusy(false); }
    }

    async function markRead(id) {
        try {
            await api(`notifications/${id}/read`, { method: 'POST' });
            setRows(current => current.map(item => item.id === id ? { ...item, readAt: new Date().toISOString() } : item));
        } catch (err) { setError(err.message || 'Could not update notification.'); }
    }

    const ownUserId = Number(session?.userId ?? session?.id);

    return (
        <div className="notification-center">
            <div className="page-heading">
                <div><div className="eyebrow"><span /> COMMUNICATIONS</div><h1>Notification Center</h1><p>Send operational updates and review delivery history.</p></div>
                <button type="button" className="secondary-button" onClick={load} disabled={loading}>↻ Refresh history</button>
            </div>

            {error && <div className="api-error" role="alert">{error}</div>}
            {notice && <div className="notification-success" role="status">{notice}</div>}

            <div className="stats-grid notification-stats">
                <article className="stat-card stat-blue"><div className="stat-top"><span>Recent messages</span><div className="stat-icon">▤</div></div><strong>{counts.total}</strong><div className="stat-bottom">History records loaded</div></article>
                <article className="stat-card stat-cyan"><div className="stat-top"><span>Delivered</span><div className="stat-icon">✓</div></div><strong>{counts.sent}</strong><div className="stat-bottom">Provider accepted</div></article>
                <article className="stat-card stat-red"><div className="stat-top"><span>Needs attention</span><div className="stat-icon">!</div></div><strong>{counts.needsAttention}</strong><div className="stat-bottom">Failed or not configured</div></article>
            </div>

            <div className="notification-provider-row">
                <span>Email: {settings?.emailConfigured ? 'Configured' : 'Needs SMTP setup'}</span>
                <span>SMS: {settings?.smsConfigured ? 'Configured' : 'Needs Twilio setup'}</span>
                <small>Provider credentials stay on the API server.</small>
            </div>

            {canWrite && <section className="panel notification-compose">
                <div className="panel-heading"><div><h2>Compose notification</h2><p>Choose one channel or send through both.</p></div></div>
                <form onSubmit={send}>
                    <div className="form-grid notification-form-grid">
                        <label>Recipient name<input value={form.recipientName} onChange={e => update('recipientName', e.target.value)} placeholder="Optional" maxLength="150" /></label>
                        <label>Email address<input type="email" value={form.email} onChange={e => update('email', e.target.value)} placeholder="person@example.org" /></label>
                        <label>Phone number<input type="tel" inputMode="numeric" value={form.phone} onKeyDown={handlePhoneKeyDown} onChange={e => update('phone', sanitizePhoneInput(e.target.value))} placeholder="+9477..." maxLength={15} /></label>
                        <fieldset><legend>Delivery channel</legend><label><input type="checkbox" checked={form.channels.includes('Email')} onChange={() => toggleChannel('Email')} /> Email</label><label><input type="checkbox" checked={form.channels.includes('SMS')} onChange={() => toggleChannel('SMS')} /> SMS</label></fieldset>
                        <label className="notification-wide">Email subject<input value={form.subject} onChange={e => update('subject', e.target.value)} placeholder="HUMANAID response update" maxLength="200" /></label>
                        <label className="notification-wide">Message<textarea value={form.message} onChange={e => update('message', e.target.value)} required minLength="2" maxLength="4000" rows="4" placeholder="Write a clear response or safety update…" /></label>
                    </div>
                    <div className="notification-form-footer"><small>Delivery attempts and results are saved to notification history.</small><button className="primary-button" type="submit" disabled={busy}>{busy ? 'Sending…' : 'Send notification →'}</button></div>
                </form>
            </section>}

            <section className="panel notification-history">
                <div className="panel-heading"><div><h2>Notification history</h2><p>Delivery result, channel, recipient and retry count.</p></div><select value={filter} onChange={e => setFilter(e.target.value)} aria-label="Filter delivery status"><option>All</option><option>Sent</option><option>Failed</option><option>NotConfigured</option><option>Queued</option></select></div>
                {loading ? <p className="notification-empty">Loading history…</p> : shownRows.length === 0 ? <p className="notification-empty">No notifications match this view.</p> : <div className="notification-list">
                    {shownRows.map(item => {
                        const own = item.recipientAccountId != null && Number(item.recipientAccountId) === ownUserId;
                        return <article className="notification-row" key={item.id}>
                            <div className="notification-row-top"><span className={`notification-status status-${String(item.status).toLowerCase()}`}>{item.status}</span><span className="notification-channel">{item.channel}</span><time>{dateText(item.createdAt)}</time></div>
                            <strong>{item.subject || 'SMS update'} · {item.recipientName || item.recipient}</strong>
                            <p>{item.message}</p>
                            <div className="notification-row-meta"><span>By {item.createdByName} · {item.attempts} attempt(s)</span>{item.lastError && <span className="notification-error">{item.lastError}</span>}</div>
                            <div className="notification-row-actions">
                                {own && !item.readAt && <button type="button" className="text-button" onClick={() => markRead(item.id)}>Mark as read</button>}
                                {canWrite && item.status !== 'Sent' && item.attempts < 3 && <button type="button" className="text-button" onClick={() => retry(item.id)} disabled={busy}>Retry delivery</button>}
                            </div>
                        </article>;
                    })}
                </div>}
            </section>
        </div>
    );
}
