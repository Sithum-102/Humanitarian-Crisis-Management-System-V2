import { useEffect, useMemo, useRef, useState } from 'react';
import './App.css';
import { api, login, register, loadData, save, remove, clearToken, getToken, onUnauthorized, health, API_BASE } from './services/api/client';
import SelectRole from './pages/SelectRole';
import AffectedPortal from "./pages/AffectedPortal";
import VolunteerPortal from "./pages/VolunteerPortal";
import PortalRoleSelector from "./pages/PortalRoleSelector";
import NotificationCenter from './pages/NotificationCenter';
import AidAssistant from './components/AidAssistant';
import PortalIntroCards from './components/PortalIntroCards';
import { applyPageLanguage, LANGUAGE_STORAGE_KEY, languageNames } from './i18n';

function LanguagePicker({ language, onChange }) {
    return (
        <label className="language-picker" aria-label="Choose language">
            <span aria-hidden="true">🌐</span>
            <select value={language} onChange={(event) => onChange(event.target.value)} aria-label="Choose language">
                {Object.entries(languageNames).map(([code, name]) => <option key={code} value={code}>{name}</option>)}
            </select>
        </label>
    );
}

function PageLanguageTranslator({ language }) {
    useEffect(() => {
        applyPageLanguage(language);
        const observer = new MutationObserver(() => applyPageLanguage(language));
        observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['placeholder', 'aria-label', 'title'] });
        return () => observer.disconnect();
    }, [language]);
    return null;
}
const navigation = [
    {
        title: 'WORKSPACE',
        items: [
            ['Dashboard', '▦'],
            ['Crisis Monitoring', '◇'],
            ['Emergency Requests', '⚑'],
            ['Live Operations', '⌁'],
            ['Notifications', '♧']
        ]
    },
    {
        title: 'MANAGEMENT',
        items: [
            ['Resources & Aid', '▤'],
            ['Shelter Management', '⌂'],
            ['Volunteers', '♧'],
            ['Organizations', '▣']
        ]
    },
    {
        title: 'INTELLIGENCE',
        items: [
            ['AI Intelligence', '✧'],
            ['Analytics & Reports', '▥']
        ]
    },
    {
        title: 'ADMINISTRATION',
        items: [
            ['User Management', '♙'],
            ['Settings', '⚙']
        ]
    }
];

const emptyData = () => ({
    incidents: [], requests: [], operations: [], resources: [],
    shelters: [], volunteers: [], organizations: [], users: []
});

const severityRank = { Critical: 4, High: 3, Medium: 2, Low: 1 };

// Field tuples are [key, label, 'readonly'?]. Readonly fields show in tables/exports but not in the form.
// `options` lists the status values the API accepts for that registry (kept in sync with the backend models).
const modules = {
    'Crisis Monitoring': {
        key: 'incidents',
        description: 'Monitor incidents, assess severity and coordinate emergency response.',
        fields: [['title', 'Incident'], ['location', 'Location'], ['severity', 'Severity'], ['status', 'Status'], ['people', 'People affected'], ['reportedAt', 'Reported', 'readonly']],
        defaults: { title: '', location: '', severity: 'Medium', status: 'Reported', people: 0 },
        options: { status: ['Reported', 'Active', 'Responding', 'Monitoring', 'In Progress', 'Resolved'] }
    },
    'Emergency Requests': {
        key: 'requests',
        description: 'Manage humanitarian assistance requests and response priorities.',
        fields: [['requester', 'Requester'], ['need', 'Assistance needed'], ['location', 'Location'], ['category', 'Category'], ['priority', 'Priority'], ['status', 'Status'], ['createdAt', 'Created', 'readonly']],
        defaults: { requester: '', need: '', location: '', category: 'General', priority: 'Medium', status: 'Pending' },
        options: { status: ['Pending', 'Approved', 'In Progress', 'Completed', 'Rejected'] }
    },
    'Live Operations': {
        key: 'operations',
        description: 'Track response operations, field teams and active assignments.',
        fields: [['name', 'Operation'], ['area', 'Area'], ['team', 'Team'], ['status', 'Status'], ['startedAt', 'Started', 'readonly']],
        defaults: { name: '', area: '', team: '', status: 'Planned' },
        options: { status: ['Planned', 'In Progress', 'On Hold', 'Completed'] }
    },
    'Resources & Aid': {
        key: 'resources',
        description: 'Track emergency supplies, stock availability and distribution centres.',
        fields: [['name', 'Resource'], ['category', 'Category'], ['quantity', 'Quantity'], ['unit', 'Unit'], ['location', 'Location'], ['status', 'Status']],
        defaults: { name: '', category: 'General', quantity: 0, unit: 'units', location: '', status: 'Available' },
        options: { status: ['Available', 'Low stock', 'Out of stock', 'Reserved'] }
    },
    'Shelter Management': {
        key: 'shelters',
        description: 'Monitor emergency shelter capacity, occupancy and availability.',
        fields: [['name', 'Shelter'], ['location', 'Location'], ['capacity', 'Capacity'], ['occupied', 'Occupied'], ['status', 'Status']],
        defaults: { name: '', location: '', capacity: 100, occupied: 0, status: 'Open' },
        options: { status: ['Open', 'Full', 'Closed'] }
    },
    Volunteers: {
        key: 'volunteers',
        description: 'Manage volunteers, skills, assignments and availability.',
        fields: [['name', 'Volunteer'], ['skill', 'Skill'], ['location', 'Location'], ['phone', 'Phone'], ['availability', 'Availability']],
        defaults: { name: '', skill: '', location: '', phone: '', availability: 'Available' },
        optional: ['phone']
    },
    Organizations: {
        key: 'organizations',
        description: 'Coordinate humanitarian organizations and response partners.',
        fields: [['name', 'Organization'], ['type', 'Type'], ['contact', 'Contact'], ['status', 'Status']],
        defaults: { name: '', type: 'NGO', contact: '', status: 'Pending' },
        options: { status: ['Pending', 'Verified', 'Active', 'Inactive'] }
    },
    'User Management': {
        key: 'users',
        description: 'Manage platform users, organizational roles and account status.',
        fields: [['name', 'Name'], ['email', 'Email'], ['role', 'Role'], ['status', 'Status'], ['password', 'Password (new/optional on edit)']],
        defaults: { name: '', email: '', role: 'Viewer', status: 'Active', password: '' },
        options: { status: ['Active', 'Inactive'] }
    }
};

const choices = {
    severity: ['Low', 'Medium', 'High', 'Critical'],
    priority: ['Low', 'Medium', 'High', 'Critical'],
    availability: ['Available', 'On assignment', 'Unavailable'],
    category: ['Food', 'Water', 'Medical', 'Shelter', 'General'],
    role: ['Admin', 'Coordinator', 'Volunteer', 'Viewer'],
    type: ['NGO', 'Healthcare', 'Government', 'Community']
};

const numericFields = ['people', 'quantity', 'capacity', 'occupied'];
const dateFields = ['reportedAt', 'createdAt', 'startedAt'];
const badgeFields = ['severity', 'priority', 'status', 'availability'];

function formatDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

function initials(name = '') {
    const parts = String(name).trim().split(/\s+/).filter(Boolean);
    return ((parts[0]?.[0] || '?') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

function compareRows(a, b, key) {
    const x = a[key];
    const y = b[key];
    if (key === 'severity' || key === 'priority') return (severityRank[x] || 0) - (severityRank[y] || 0);
    if (key === 'id' || numericFields.includes(key)) return Number(x || 0) - Number(y || 0);
    if (dateFields.includes(key)) return new Date(x || 0).getTime() - new Date(y || 0).getTime();
    return String(x ?? '').localeCompare(String(y ?? ''), undefined, { numeric: true, sensitivity: 'base' });
}

// Prefix formula-looking cells so spreadsheets never execute user-entered text.
function csvCell(value) {
    let text = String(value ?? '');
    if (/^[=+\-@]/.test(text)) text = `'${text}`;
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function downloadCsv(name, fields, rows) {
    const header = fields.map(([, label]) => csvCell(label)).join(',');
    const lines = rows.map(row => fields.map(([key]) =>
        csvCell(dateFields.includes(key) && row[key] ? new Date(row[key]).toISOString() : row[key])).join(','));
    const blob = new Blob(['\uFEFF' + [header, ...lines].join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `humanaid-${name}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function usePersistentState(key, initial) {
    const [value, setValue] = useState(() => {
        try {
            const raw = localStorage.getItem(key);
            return raw === null ? initial : JSON.parse(raw);
        } catch { return initial; }
    });
    useEffect(() => {
        try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
    }, [key, value]);
    return [value, setValue];
}

function Badge({ value }) {
    const text = String(value ?? '');
    const tone = ['Critical', 'High', 'Full', 'Low stock', 'Out of stock', 'Rejected', 'Closed', 'Unavailable'].includes(text)
        ? 'danger'
        : ['Pending', 'Responding', 'Monitoring', 'Planned', 'In Progress', 'On Hold', 'Reserved', 'On assignment'].includes(text)
            ? 'warning'
            : ['Active', 'Available', 'Approved', 'Verified', 'Open', 'Completed', 'Resolved'].includes(text)
                ? 'success'
                : 'info';

    return <span className={`badge badge-${tone}`}>{text}</span>;
}

function Sidebar({ active, navigate, open, close, requests, isPublic = false }) {
    const visibleNavigation = isPublic
        ? navigation.filter((group) => group.title !== 'ADMINISTRATION')
        : navigation;
    return (
        <>
            {open && <button className="scrim" onClick={close} aria-label="Close navigation" />}
            <aside className={`sidebar ${open ? 'sidebar-open' : ''}`}>
                <div className="brand">
                    <div className="brand-logo">H</div>
                    <div>
                        <strong>HUMANAID</strong>
                        <small>CRISIS RESPONSE PLATFORM</small>
                    </div>
                </div>

                <div className="workspace">
                    <div className="workspace-icon">G</div>
                    <div>
                        <strong>Global Operations</strong>
                        <small>Humanitarian workspace</small>
                    </div>
                    <span>⌄</span>
                </div>

                <div className="sidebar-navigation">
                    {visibleNavigation.map(group => (
                        <div className="nav-group" key={group.title}>
                            <div className="nav-heading">{group.title}</div>
                            {group.items.map(([name, icon]) => (
                                <button
                                    key={name}
                                    className={`nav-link ${active === name ? 'nav-active' : ''}`}
                                    onClick={() => {
                                        navigate(name);
                                        close();
                                    }}
                                >
                                    <span className="nav-icon">{icon}</span>
                                    <span>{name}</span>
                                    {name === 'Emergency Requests' && requests > 0 && (
                                        <span className="nav-count">{requests}</span>
                                    )}
                                </button>
                            ))}
                        </div>
                    ))}
                </div>

                <div className="sidebar-bottom">
                    <span className="status-dot" />
                    {import.meta.env.DEV ? 'Development build' : 'Production'}
                    <small>HUMANAID · Version 1.1</small>
                </div>
            </aside>
        </>
    );
}

function Header({ active, onMenu, session }) {
    return (
        <header className="topbar">
            <div className="topbar-left">
                <button className="menu-button" onClick={onMenu} aria-label="Open navigation">☰</button>
                <div className="breadcrumb">
                    Workspace <span>/</span> <strong>{active}</strong>
                </div>
            </div>

            <div className="topbar-right">
                <span className="environment-badge">
                    <span className="status-dot" />
                    {import.meta.env.DEV ? 'DEVELOPMENT API' : 'LIVE API'}
                </span>
                <span className="topbar-divider" />
                <div className="avatar" title={`${session.name || session.email} · ${session.role}`}>
                    {initials(session.name || session.email)}
                </div>
            </div>
        </header>
    );
}

function PageHeading({ eyebrow = 'HUMANITARIAN OPERATIONS', title, description, action, onAction }) {
    return (
        <div className="page-heading">
            <div>
                <div className="eyebrow"><span />{eyebrow}</div>
                <h1>{title}</h1>
                <p>{description}</p>
            </div>
            {action && <button className="primary-button" onClick={onAction}><span>＋</span> {action}</button>}
        </div>
    );
}

function StatCard({ label, value, icon, tone = 'blue', detail }) {
    return (
        <article className={`stat-card stat-${tone}`}>
            <div className="stat-top">
                <span>{label}</span>
                <div className="stat-icon">{icon}</div>
            </div>
            <strong>{value}</strong>
            <div className="stat-bottom">
                <span className="stat-indicator" />
                {detail}
            </div>
        </article>
    );
}

function Panel({ title, subtitle, action, onAction, children, className = '' }) {
    return (
        <section className={`panel ${className}`}>
            <div className="panel-heading">
                <div>
                    <h2>{title}</h2>
                    {subtitle && <p>{subtitle}</p>}
                </div>
                {action && (
                    <button className="text-button" onClick={onAction}>{action} →</button>
                )}
            </div>
            {children}
        </section>
    );
}

function OccupancyCell({ row }) {
    const capacity = Number(row.capacity || 0);
    const occupied = Number(row.occupied || 0);
    const pct = capacity ? Math.round(occupied / capacity * 100) : 0;

    return (
        <div className="occupancy" title={`${pct}% occupied`}>
            <span>{occupied.toLocaleString()} / {capacity.toLocaleString()} · {pct}%</span>
            <div className="occupancy-track">
                <div className={`occupancy-fill ${pct >= 100 ? 'full' : pct >= 80 ? 'high' : ''}`} style={{ width: `${Math.min(pct, 100)}%` }} />
            </div>
        </div>
    );
}

function renderCell(key, row) {
    if (badgeFields.includes(key)) return <Badge value={row[key]} />;
    if (key === 'occupied') return <OccupancyCell row={row} />;
    if (dateFields.includes(key)) return row[key] ? formatDate(row[key]) : '—';
    if (numericFields.includes(key)) return Number(row[key] || 0).toLocaleString();
    return row[key] === undefined || row[key] === null || row[key] === '' ? '—' : row[key];
}

function DataTable({ rows, fields, onEdit, onHistory, sort, onSort }) {
    if (!rows.length) {
        return (
            <div className="empty-state">
                <div className="empty-icon">◇</div>
                <strong>No matching records</strong>
                <p>Try changing your search or add a new record.</p>
            </div>
        );
    }

    return (
        <div className="table-container">
            <table>
                <thead>
                    <tr>
                        {fields.map(([key, label]) => (
                            <th key={key} aria-sort={sort?.key === key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}>
                                {onSort
                                    ? (
                                        <button type="button" className="th-sort" onClick={() => onSort(key)}>
                                            {label}<span aria-hidden="true">{sort?.key === key ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ''}</span>
                                        </button>
                                    )
                                    : label}
                            </th>
                        ))}
                        {(onEdit || onHistory) && <th>Actions</th>}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, index) => (
                        <tr key={row.id ?? index}>
                            {fields.map(([key]) => <td key={key}>{renderCell(key, row)}</td>)}
                            {(onEdit || onHistory) && (
                                <td>
                                    {onHistory && <button className="table-action" onClick={() => onHistory(row)}>History ↗</button>}{' '}
                                    {onEdit && <button className="table-action" onClick={() => onEdit(row)}>Edit ↗</button>}
                                </td>
                            )}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

// Deterministic "radar" position per incident id (illustrative only, not geographic).
function markerPosition(id) {
    const n = Number(id) || 1;
    const angle = (n * 137.508 * Math.PI) / 180;
    const radius = 12 + ((n * 47) % 31);
    return {
        x: Math.min(92, Math.max(8, 50 + radius * Math.cos(angle))),
        y: Math.min(90, Math.max(10, 50 + radius * Math.sin(angle)))
    };
}

function ResponseMap({ incidents, navigate }) {
    const ranked = [...incidents]
        .filter(incident => incident.status !== 'Resolved')
        .sort((a, b) => (severityRank[b.severity] || 0) - (severityRank[a.severity] || 0) || Number(b.id) - Number(a.id));

    return (
        <section className="response-map-panel" aria-label="Illustrative incident radar overview">
            <div className="response-map-header">
                <div>
                    <div className="radar-kicker"><span className="radar-live-dot" /> RESPONSE INTELLIGENCE / DEMO</div>
                    <h2>Incident Situation Map</h2>
                    <p>Illustrative radar positions · not geographic coordinates or live tracking</p>
                </div>
                <button className="radar-action" onClick={() => navigate('Crisis Monitoring')}>Explore incidents ↗</button>
            </div>
            <div className="response-map-body">
                <div className="radar-surface">
                    <div className="radar-ring radar-ring-one" />
                    <div className="radar-ring radar-ring-two" />
                    <div className="radar-ring radar-ring-three" />
                    <div className="radar-sweep" />
                    <div className="radar-crosshair" />
                    {ranked.slice(0, 8).map(incident => {
                        const { x, y } = markerPosition(incident.id);
                        return (
                            <button
                                key={incident.id}
                                type="button"
                                className={`radar-marker ${incident.severity === 'Critical' ? 'radar-critical' : incident.severity === 'High' ? 'radar-high' : 'radar-medium'}`}
                                style={{ left: `${x}%`, top: `${y}%` }}
                                title={`${incident.title} — ${incident.location} (${incident.severity})`}
                                onClick={() => navigate('Crisis Monitoring')}
                                aria-label={`View ${incident.title} in Crisis Monitoring`}
                            ><span /></button>
                        );
                    })}
                    <div className="radar-center-label">HUMANAID <small>RESPONSE GRID</small></div>
                    <div className="radar-coordinate">SIMULATED SITUATION DISPLAY</div>
                </div>
                <div className="radar-incident-list">
                    <div className="radar-list-title">PRIORITY INCIDENTS <span>{ranked.length} OPEN</span></div>
                    {ranked.length === 0 && <div className="radar-footnote">No open incidents right now.</div>}
                    {ranked.slice(0, 4).map(incident => (
                        <button key={incident.id} className="radar-incident" onClick={() => navigate('Crisis Monitoring')}>
                            <span className={`radar-list-dot ${String(incident.severity || 'medium').toLowerCase()}`} />
                            <span className="radar-incident-copy"><strong>{incident.title}</strong><small>{incident.location} · #{incident.id}</small></span>
                            <Badge value={incident.severity} />
                        </button>
                    ))}
                    <div className="radar-footnote">Unverified operational data. Confirm with official sources before acting.</div>
                </div>
            </div>
        </section>
    );
}

function computePriorityScore(req) {
    let score = 40;
    const p = String(req.priority || '').toLowerCase();
    if (p === 'critical') score += 45;
    else if (p === 'high') score += 30;
    else if (p === 'medium') score += 15;
    const text = `${req.need || ''} ${req.description || ''} ${req.details || ''}`.toLowerCase();
    if (text.includes('trapped') || text.includes('flood') || text.includes('elderly') || text.includes('child')) score += 10;
    return Math.min(99, score);
}

function mergeDuplicateRequests(requests = []) {
    const groups = new Map();

    for (const req of requests) {
        const requesterKey = String(req.requester || '').trim().toLowerCase();
        const locationKey = String(req.location || '').trim().toLowerCase();
        const statusKey = req.status === 'Completed' ? 'Completed' : 'Active';
        // Do not group records if we cannot reliably identify both reporter and location.
        const groupKey = requesterKey && locationKey
            ? `${requesterKey}::${locationKey}::${statusKey}`
            : `single-record::${req.id}`;

        if (!groups.has(groupKey)) {
            groups.set(groupKey, {
                ...req,
                mergedItems: [req],
                mergedIds: [req.id],
                combinedNeeds: [req.need || req.description || 'Urgent assistance requested']
            });
        } else {
            const existing = groups.get(groupKey);
            existing.mergedItems.push(req);
            existing.mergedIds.push(req.id);
            const detailText = req.need || req.description || '';
            if (detailText && !existing.combinedNeeds.includes(detailText)) {
                existing.combinedNeeds.push(detailText);
            }
            if (req.status === 'In Progress') existing.status = 'In Progress';
        }
    }

    return Array.from(groups.values()).map(group => {
        const baseScore = Math.max(...group.mergedItems.map(computePriorityScore));
        const duplicateBonus = Math.min(10, (group.mergedItems.length - 1) * 4);
        return {
            ...group,
            priorityScore: Math.min(99, baseScore + duplicateBonus),
            need: group.combinedNeeds.join('  |  ')
        };
    }).sort((a, b) => b.priorityScore - a.priorityScore || Number(b.id || 0) - Number(a.id || 0));
}

function getPriorityBreakdown(req) {
    const sourceItems = req.mergedItems || [req];
    const priorityRank = { critical: 4, high: 3, medium: 2, low: 1 };
    const highestPriorityItem = [...sourceItems].sort((a, b) => (priorityRank[String(b.priority || 'Medium').toLowerCase()] || 0) - (priorityRank[String(a.priority || 'Medium').toLowerCase()] || 0))[0] || req;
    const priority = String(highestPriorityItem.priority || 'Medium').toLowerCase();
    const priorityPoints = priority === 'critical' ? 45 : priority === 'high' ? 30 : priority === 'medium' ? 15 : 0;
    const text = sourceItems.map(item => `${item.need || ''} ${item.description || ''} ${item.details || ''}`).join(' ').toLowerCase();
    const urgentKeyword = ['trapped', 'flood', 'elderly', 'child'].find(word => text.includes(word));
    const duplicateBonus = Math.min(10, Math.max(0, ((req.mergedIds?.length || 1) - 1) * 4));
    const factors = [
        { label: 'Base review score', points: 40 },
        ...(priorityPoints ? [{ label: `${highestPriorityItem.priority || 'Medium'} priority`, points: priorityPoints }] : []),
        ...(urgentKeyword ? [{ label: `Urgency keyword: “${urgentKeyword}”`, points: 10 }] : []),
        ...(duplicateBonus ? [{ label: `${req.mergedIds.length} grouped reports`, points: duplicateBonus }] : [])
    ];
    let excess = Math.max(0, factors.reduce((sum, factor) => sum + factor.points, 0) - Number(req.priorityScore || 0));
    for (let index = factors.length - 1; index >= 0 && excess > 0; index--) {
        const reduction = Math.min(excess, factors[index].points);
        factors[index] = { ...factors[index], points: factors[index].points - reduction };
        excess -= reduction;
    }
    return factors.filter(factor => factor.points > 0);
}

function CommandCenterWorkspace({ data, onBack, onRefresh, loading, onDispatch, onVerify, onReject, onClose, onAddRequest }) {
    const [teamName, setTeamName] = useState('Rapid Flood & Boat Rescue Unit 01');
    const [resourceId, setResourceId] = useState('');
    const [resourceQuantity, setResourceQuantity] = useState(0);
    const [shelterId, setShelterId] = useState('');
    const [shelterPeople, setShelterPeople] = useState(0);
    const [volunteerIds, setVolunteerIds] = useState([]);
    const [selectedId, setSelectedId] = useState(null);
    const [searchText, setSearchText] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('All');
    const [statusFilter, setStatusFilter] = useState('Open');
    const [showSeparateReports, setShowSeparateReports] = useState(false);
    const [auditHistory, setAuditHistory] = useState([]);
    const [auditHistoryError, setAuditHistoryError] = useState('');
    const [auditHistoryLoading, setAuditHistoryLoading] = useState(false);

    const rawRequests = data.requests || [];
    const mergedRequests = useMemo(() => mergeDuplicateRequests(rawRequests), [rawRequests]);
    const reviewRequests = useMemo(() => showSeparateReports
        ? rawRequests.map(req => ({ ...req, mergedItems: [req], mergedIds: [req.id], priorityScore: computePriorityScore(req), need: req.need || req.description || 'Urgent assistance requested' }))
        : mergedRequests, [rawRequests, mergedRequests, showSeparateReports]);
    const categories = [...new Set(rawRequests.map(req => req.category || 'General'))].sort();
    const filteredRequests = reviewRequests.filter(req => {
        const status = req.status || 'Pending';
        const isOpen = !['Completed', 'Rejected'].includes(status);
        const query = searchText.trim().toLowerCase();
        const matchesQuery = !query || `${req.requester || ''} ${req.location || ''} ${req.need || ''} ${req.category || ''}`.toLowerCase().includes(query);
        const matchesCategory = categoryFilter === 'All' || (req.category || 'General') === categoryFilter;
        const matchesStatus = statusFilter === 'All' || (statusFilter === 'Open' ? isOpen : status === statusFilter);
        return matchesQuery && matchesCategory && matchesStatus;
    });
    const activeReq = filteredRequests.find(req => String(req.id) === String(selectedId)) || filteredRequests[0] || null;
    const pendingDispatchCount = mergedRequests.filter(req => ['Pending', 'Approved'].includes(req.status || 'Pending')).length;
    const staleRequests = rawRequests.filter(req => {
        if (!['Pending', 'Approved'].includes(req.status || 'Pending') || !req.createdAt) return false;
        const age = Date.now() - new Date(req.createdAt).getTime();
        return Number.isFinite(age) && age >= 60 * 60 * 1000;
    });

    useEffect(() => {
        if (!activeReq?.mergedIds?.length) {
            setAuditHistory([]);
            setAuditHistoryError('');
            return undefined;
        }
        let cancelled = false;
        setAuditHistoryLoading(true);
        setAuditHistoryError('');
        Promise.all(activeReq.mergedIds.map(id => api(`auditlogs?entityType=EmergencyRequest&entityId=${encodeURIComponent(id)}`)))
            .then(results => {
                if (cancelled) return;
                const entries = results.flatMap((result, index) => (Array.isArray(result) ? result : []).map(item => ({ ...item, requestId: activeReq.mergedIds[index] })));
                entries.sort((a, b) => new Date(b.occurredAt || b.OccurredAt || 0) - new Date(a.occurredAt || a.OccurredAt || 0));
                setAuditHistory(entries.slice(0, 8));
            })
            .catch(err => { if (!cancelled) { setAuditHistory([]); setAuditHistoryError(err.message || 'Could not load request history.'); } })
            .finally(() => { if (!cancelled) setAuditHistoryLoading(false); });
        return () => { cancelled = true; };
    }, [activeReq?.mergedIds?.join(',')]);

    const getMapUrl = req => {
        const combined = `${req.location || ''} ${req.need || ''}`;
        const coords = combined.match(/(?:GPS\s*:\s*)?(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/i);
        const query = coords ? `${coords[1]},${coords[2]}` : (req.location || req.need || 'Sri Lanka');
        return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
    };
    const locationTokens = String(activeReq?.location || '').toLowerCase().split(/[^a-z0-9]+/).filter(token => token.length >= 4);
    const possibleShelters = (data.shelters || []).filter(shelter => {
        const capacity = Number(shelter.capacity || 0);
        const occupied = Number(shelter.occupied ?? shelter.occupancy ?? 0);
        return shelter.status !== 'Closed' && shelter.status !== 'Full' && capacity > occupied;
    }).map(shelter => ({
        ...shelter,
        freeSpace: Math.max(0, Number(shelter.capacity || 0) - Number(shelter.occupied ?? shelter.occupancy ?? 0)),
        locationTextMatch: locationTokens.some(token => String(shelter.location || '').toLowerCase().includes(token))
    })).sort((a, b) => Number(b.locationTextMatch) - Number(a.locationTextMatch));
    const wantedCategory = String(activeReq?.category || '').toLowerCase();
    const matchingResources = (data.resources || []).filter(resource => Number(resource.quantity || 0) > 0 && !['out of stock', 'reserved'].includes(String(resource.status || '').toLowerCase()))
        .map(resource => ({ ...resource, categoryMatch: wantedCategory && String(resource.category || '').toLowerCase() === wantedCategory, locationTextMatch: locationTokens.some(token => String(resource.location || '').toLowerCase().includes(token)) }))
        .filter(resource => resource.categoryMatch || resource.locationTextMatch)
        .sort((a, b) => Number(b.categoryMatch) - Number(a.categoryMatch) || Number(b.locationTextMatch) - Number(a.locationTextMatch)).slice(0, 4);
    const recentOperations = [...(data.operations || [])].sort((a, b) => new Date(b.startedAt || b.createdAt || 0) - new Date(a.startedAt || a.createdAt || 0)).slice(0, 5);

    return (
        <main className="portal-page coordination-portal-page">
            <div className="coordination-container">
                <header className="coordination-toolbar">
                    <button type="button" className="coordination-button coordination-back" onClick={onBack}>← Back to Portals</button>
                    <div className="coordination-toolbar-actions">
                        <button type="button" className="coordination-button" onClick={onRefresh} disabled={loading}>{loading ? 'Syncing…' : '↻ Sync Queue'}</button>
                        <button type="button" className="coordination-button coordination-new" onClick={onAddRequest}>＋ New SOS / Request</button>
                    </div>
                </header>

                <PortalIntroCards portal="coordination" />

                <section className="coordination-hero">
                    <div className="coordination-kicker"><span /> LIVE EMERGENCY COORDINATION · RULE-BASED TRIAGE</div>
                    <h1>Emergency Coordination Command Center</h1>
                    <p>Review requests, check the explainable rule score and confirm response actions. Original request records remain separate.</p>
                </section>

                {staleRequests.length > 0 && <aside className="coordination-stale-alert" role="status"><strong>Needs review:</strong> {staleRequests.length} pending request{staleRequests.length === 1 ? '' : 's'} have been waiting over 60 minutes. Check details and contact the requester before dispatch.</aside>}

                <section className="coordination-metrics" aria-label="Coordination summary">
                    <article className="coordination-glass-card"><span>Open Cases <small>(raw reports: {rawRequests.length})</small></span><strong>{mergedRequests.filter(req => !['Completed', 'Rejected'].includes(req.status)).length}</strong></article>
                    <article className="coordination-glass-card"><span>Awaiting Dispatch</span><strong className="coordination-amber">{pendingDispatchCount}</strong></article>
                    <article className="coordination-glass-card"><span>Active Operations</span><strong className="coordination-cyan">{(data.operations || []).filter(op => op.status === 'In Progress').length}</strong></article>
                    <article className="coordination-glass-card"><span>Available Shelter Places</span><strong className="coordination-green">{possibleShelters.reduce((sum, shelter) => sum + shelter.freeSpace, 0).toLocaleString()}</strong></article>
                </section>

                <div className="coordination-grid">
                    <section className="coordination-glass-card coordination-queue-panel">
                        <div className="coordination-panel-heading">
                            <div><h2>Priority SOS &amp; Assistance Queue</h2><p>Use filters to find requests. Select one to inspect details.</p></div>
                            <span className="coordination-queue-count">{filteredRequests.length} shown</span>
                        </div>
                        <div className="coordination-filters">
                            <label>Search<input value={searchText} onChange={event => setSearchText(event.target.value)} placeholder="Requester, location or need" /></label>
                            <label>Need category<select value={categoryFilter} onChange={event => setCategoryFilter(event.target.value)}><option value="All">All categories</option>{categories.map(category => <option key={category}>{category}</option>)}</select></label>
                            <label>Status<select value={statusFilter} onChange={event => setStatusFilter(event.target.value)}><option value="Open">Open only</option><option value="All">All statuses</option>{['Pending', 'Approved', 'In Progress', 'Completed', 'Rejected'].map(status => <option key={status}>{status}</option>)}</select></label>
                        </div>
                        <label className="coordination-duplicate-toggle"><input type="checkbox" checked={showSeparateReports} onChange={event => setShowSeparateReports(event.target.checked)} /> Review grouped reports separately ({mergedRequests.filter(req => req.mergedIds.length > 1).length} groups)</label>
                        {filteredRequests.length === 0 ? <p className="coordination-empty">No requests match the selected filters.</p> : (
                            <div className="coordination-queue-list">
                                {filteredRequests.map(req => {
                                    const isSelected = String(activeReq?.id) === String(req.id);
                                    const isMerged = req.mergedIds.length > 1;
                                    const stale = ['Pending', 'Approved'].includes(req.status || 'Pending') && req.createdAt && Date.now() - new Date(req.createdAt).getTime() >= 60 * 60 * 1000;
                                    return <button key={req.mergedIds.join('-')} type="button" onClick={() => setSelectedId(req.id)} className={`coordination-queue-item${isSelected ? ' is-selected' : ''}`}>
                                        <span className="coordination-queue-title"><strong>#{req.mergedIds.join(', #')} · {req.requester || 'Emergency SOS'}</strong><span className="coordination-queue-tags">{isMerged && <span className="coordination-tag coordination-merged">{req.mergedIds.length} grouped reports</span>}<span className="coordination-tag coordination-score">Rule score: {req.priorityScore}/99</span>{stale && <span className="coordination-tag coordination-overdue">Waiting 60m+</span>}</span></span>
                                        <span className="coordination-need">{req.need}</span>
                                        <span className="coordination-queue-meta"><span>{req.location || 'Location not provided'} · {req.category || 'General'}</span><span>Status: {req.status || 'Pending'}</span></span>
                                    </button>;
                                })}
                            </div>
                        )}
                    </section>

                    <section className="coordination-glass-card coordination-dispatch-panel">
                        <div className="coordination-panel-heading"><div><h2>Response Review &amp; Dispatch</h2><p>Verify the request and suggested matches before taking action.</p></div></div>
                        {!activeReq ? <p className="coordination-empty">Select a request from the queue to review it.</p> : <div className="coordination-dispatch-content">
                            <article className="coordination-selected-request">
                                <span className="coordination-selected-kicker">Selected {activeReq.mergedIds.length > 1 ? `${activeReq.mergedIds.length} grouped records · #${activeReq.mergedIds.join(', #')}` : `record · #${activeReq.id}`}</span>
                                <h3>{activeReq.requester || 'Emergency SOS'} — {activeReq.category || 'General'}</h3>
                                <p>{activeReq.need}</p><span>Location: <strong>{activeReq.location || 'Unknown'}</strong> · Priority: <strong>{activeReq.priority || 'Medium'}</strong></span>
                                <a className="coordination-map-link" href={getMapUrl(activeReq)} target="_blank" rel="noreferrer">⌖ Open request location in Google Maps</a>
                            </article>
                            <details className="coordination-score-details"><summary>Why this rule score? <strong>{activeReq.priorityScore}/99</strong></summary><ul>{getPriorityBreakdown(activeReq).map((factor, index) => <li key={`${factor.label}-${index}`}><span>{factor.label}</span><b>+{factor.points}</b></li>)}</ul><small>Sorting aid only; this is not an AI prediction. Confirm facts with the requester.</small></details>
                            <section className="coordination-match-box"><h3>Possible response matches</h3><p>Suggestions use available records and text matches only. Confirm distance, stock and capacity before assignment.</p>
                                <h4>Available resources</h4>{matchingResources.length ? <ul>{matchingResources.map(resource => <li key={resource.id || resource.name}><strong>{resource.name}</strong> · {resource.quantity} {resource.unit || 'units'} <small>{resource.categoryMatch ? 'Category match' : 'Location text match'}</small></li>)}</ul> : <p className="coordination-match-empty">No matching available resource records found.</p>}
                                <h4>Open shelters with space</h4>{possibleShelters.length ? <ul>{possibleShelters.slice(0, 4).map(shelter => <li key={shelter.id || shelter.name}><strong>{shelter.name}</strong> · {shelter.freeSpace.toLocaleString()} places · {shelter.location || 'Location not set'} <small>{shelter.locationTextMatch ? 'Possible location text match' : 'Check travel distance'}</small></li>)}</ul> : <p className="coordination-match-empty">No open shelter records with available capacity.</p>}
                            </section>
                            {activeReq.mergedIds.length > 1 && <p className="coordination-workflow-note">This queue item groups separate public reports. Turn on “Review grouped reports separately” to verify and allocate each request safely.</p>}
                            <div className="coordination-assignment-fields">
                                <label>Resource<select value={resourceId} onChange={event => setResourceId(event.target.value)}><option value="">No resource</option>{(data.resources || []).filter(r => Number(r.quantity || 0) > 0).map(r => <option key={r.id} value={r.id}>{r.name} · {r.quantity} {r.unit || 'units'}</option>)}</select></label>
                                <label>Resource quantity<input type="number" min="0" value={resourceQuantity} onChange={event => setResourceQuantity(Math.max(0, Number(event.target.value)))} /></label>
                                <label>Shelter<select value={shelterId} onChange={event => setShelterId(event.target.value)}><option value="">No shelter</option>{possibleShelters.map(s => <option key={s.id} value={s.id}>{s.name} · {s.freeSpace} places</option>)}</select></label>
                                <label>People to place<input type="number" min="0" value={shelterPeople} onChange={event => setShelterPeople(Math.max(0, Number(event.target.value)))} /></label>
                                <label className="coordination-volunteers-field">Available volunteers<select multiple value={volunteerIds.map(String)} onChange={event => setVolunteerIds([...event.target.selectedOptions].map(option => Number(option.value)))}>{(data.volunteers || []).filter(v => (v.status || v.availability) === 'Available').map(v => <option key={v.id} value={v.id}>{v.name} · {v.skill || 'General'}</option>)}</select><small>Use Ctrl/⌘ to select more than one.</small></label>
                                <label className="coordination-team-field">Response team name<input type="text" value={teamName} onChange={event => setTeamName(event.target.value)} maxLength={150} /></label>
                            </div>
                            <div className="coordination-dispatch-actions">
                                {activeReq.status === 'Pending' && <button type="button" className="coordination-button" disabled={activeReq.mergedIds.length > 1} onClick={() => onVerify(activeReq)}>✓ Verify request</button>}
                                {['Pending', 'Approved'].includes(activeReq.status || 'Pending') && <button type="button" className="coordination-button coordination-reject" disabled={activeReq.mergedIds.length > 1} onClick={() => {
                                    const reason = window.prompt('Explain why this request cannot be approved yet and what information/action is needed:');
                                    if (reason && reason.trim().length >= 5) onReject(activeReq, reason.trim());
                                    else if (reason !== null) window.alert('Please enter a clear reason (at least 5 characters).');
                                }}>✕ Request more information / Reject</button>}
                                {['Approved', 'Pending'].includes(activeReq.status || 'Pending') && <button type="button" className="coordination-button coordination-dispatch" disabled={activeReq.mergedIds.length > 1} onClick={() => onDispatch(activeReq, { teamName, resourceId: resourceId ? Number(resourceId) : null, resourceQuantity: Number(resourceQuantity), shelterId: shelterId ? Number(shelterId) : null, shelterPeople: Number(shelterPeople), volunteerIds })}>🚑 Assign response &amp; notify</button>}
                                {activeReq.status === 'In Progress' && <button type="button" className="coordination-button coordination-dispatch" disabled={activeReq.mergedIds.length > 1} onClick={() => onClose(activeReq)}>✓ Close case &amp; notify</button>}
                            </div>
                            <section className="coordination-history"><h3>Request action history</h3>{auditHistoryLoading ? <p>Loading history…</p> : auditHistoryError ? <p>{auditHistoryError}</p> : auditHistory.length ? <ol>{auditHistory.map((event, index) => <li key={event.id || `${event.requestId}-${index}`}><strong>{event.action || event.Action || 'Updated'}</strong><span>Request #{event.requestId} · {event.actorName || event.ActorName || 'Authorized officer'} · {new Date(event.occurredAt || event.OccurredAt).toLocaleString()}</span><small>{event.details || event.Details || event.toValue || event.ToValue || ''}</small></li>)}</ol> : <p>No recorded actions for the selected request yet.</p>}</section>
                        </div>}
                    </section>
                </div>

                <section className="coordination-glass-card coordination-operations-history"><div className="coordination-panel-heading"><div><h2>Recent Field Operations</h2><p>Latest operation records available from the API.</p></div><span className="coordination-queue-count">{recentOperations.length} records</span></div>{recentOperations.length ? <div className="coordination-operation-list">{recentOperations.map(op => <article key={op.id || `${op.name || op.title}-${op.startedAt}`}><strong>{op.name || op.title || 'Response operation'}</strong><span>{op.team || 'Team not assigned'} · {op.area || op.location || 'Area not set'}</span><small>{op.status || 'Status unavailable'}{(op.startedAt || op.createdAt) ? ` · ${new Date(op.startedAt || op.createdAt).toLocaleString()}` : ''}</small></article>)}</div> : <p className="coordination-empty">No field operations have been recorded yet.</p>}</section>
                <p className="coordination-disclaimer">Human review is required before dispatch. Text-based shelter/resource matches are suggestions, not verified distance or live stock checks. Confirm with official sources.</p>
            </div>
        </main>
    );
}
function Dashboard({ data, navigate, addRecord, canWrite }) {
    const active = data.incidents.filter(x => x.status !== 'Resolved').length;
    const affected = data.incidents.reduce((sum, x) => sum + Number(x.people || 0), 0);
    const stock = data.resources.reduce((sum, x) => sum + Number(x.quantity || 0), 0);
    const volunteers = data.volunteers.filter(x => x.availability === 'Available').length;
    const critical = data.incidents.filter(x => x.severity === 'Critical' && x.status !== 'Resolved').length;
    const recentIncidents = [...data.incidents].sort((a, b) => Number(b.id) - Number(a.id)).slice(0, 5);
    const shelterCapacity = data.shelters.reduce((sum, x) => sum + Number(x.capacity || 0), 0);
    const shelterOccupied = data.shelters.reduce((sum, x) => sum + Number(x.occupied || 0), 0);
    const shelterPct = shelterCapacity ? Math.round(shelterOccupied / shelterCapacity * 100) : 0;

    return (
        <>
            <div className="command-banner">
                <div className="command-banner-content">
                    <div className="eyebrow"><span /> GLOBAL CRISIS OVERVIEW</div>
                    <h1>Humanitarian Command Center</h1>
                    <p>One unified workspace for crisis monitoring, emergency coordination and humanitarian response.</p>
                    <div className="command-tags">
                        <span><i /> OPERATIONAL OVERVIEW</span>
                        <span>GLOBAL RESPONSE NETWORK</span>
                        <span>LIVE API DATA</span>
                    </div>
                </div>
                <div className="dashboard-banner-actions">
                    {canWrite && <button className="primary-button" onClick={addRecord}>＋ New Emergency</button>}
                </div>
                <div className="banner-orbit orbit-one" />
                <div className="banner-orbit orbit-two" />
                <div className="banner-orbit orbit-three" />
            </div>

            <div className="section-label">
                <span>OPERATIONAL METRICS</span>
                <span>API DATA</span>
            </div>

            <div className="stats-grid">
                <StatCard label="Active Emergencies" value={active} icon="△" tone="red" detail="Incidents requiring attention" />
                <StatCard label="People Affected" value={affected.toLocaleString()} icon="♧" tone="blue" detail="Across reported incidents" />
                <StatCard label="Resources Available" value={stock.toLocaleString()} icon="▤" tone="cyan" detail="Tracked inventory units" />
                <StatCard label="Available Volunteers" value={volunteers} icon="♙" tone="purple" detail="Ready for assignment" />
            </div>

            <ResponseMap incidents={data.incidents} navigate={navigate} />

            <div className="dashboard-grid">
                <Panel
                    title="Emergency Incident Feed"
                    subtitle="Latest reported humanitarian incidents"
                    action="View all incidents"
                    onAction={() => navigate('Crisis Monitoring')}
                >
                    <DataTable
                        rows={recentIncidents}
                        fields={[
                            ['id', 'Incident ID'],
                            ['title', 'Incident'],
                            ['location', 'Location'],
                            ['severity', 'Severity'],
                            ['status', 'Status']
                        ]}
                    />
                </Panel>

                <div className="intelligence-card">
                    <div className="intelligence-top">
                        <span className="intelligence-symbol">✧</span>
                        <span className="intelligence-label">DECISION SUPPORT</span>
                    </div>
                    <h2>AI Intelligence</h2>
                    <p>Explore incident risk signals and response recommendations. Outputs require human review.</p>
                    <div className="intelligence-divider" />
                    <div className="intelligence-metric">
                        <strong>{String(critical).padStart(2, '0')}</strong>
                        <span>Unresolved critical incidents in current records</span>
                    </div>
                    <div className="intelligence-divider" />
                    <button className="primary-button full-width" onClick={() => navigate('AI Intelligence')}>
                        Open Intelligence Center →
                    </button>
                </div>
            </div>

            <div className="dashboard-grid lower-grid">
                <Panel title="Response Operations" subtitle="Current operational assignments" action="View operations" onAction={() => navigate('Live Operations')}>
                    <DataTable
                        rows={data.operations}
                        fields={[
                            ['name', 'Operation'],
                            ['area', 'Location'],
                            ['team', 'Assigned Team'],
                            ['status', 'Status']
                        ]}
                    />
                </Panel>

                <Panel title="Response Network" subtitle="Humanitarian coordination overview">
                    <div className="network-list">
                        {[
                            ['Emergency Requests', data.requests.length, '⚑'],
                            ['Emergency Shelters', data.shelters.length, '⌂'],
                            ['Shelter Occupancy', `${shelterPct}%`, '▥'],
                            ['Partner Organizations', data.organizations.length, '▣'],
                            ['Registered Volunteers', data.volunteers.length, '♧']
                        ].map(([label, value, icon]) => (
                            <div className="network-item" key={label}>
                                <div className="network-icon">{icon}</div>
                                <span>{label}</span>
                                <strong>{value}</strong>
                            </div>
                        ))}
                    </div>
                </Panel>
            </div>
        </>
    );
}

function ModulePage({ name, data, onAdd, onEdit, onHistory, canWrite }) {
    const config = modules[name];
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState('All');
    const [sort, setSort] = useState({ key: 'id', dir: 'desc' });

    const records = data[config.key] || [];
    const visibleFields = config.fields.filter(([key]) => key !== 'password');

    const filtered = useMemo(() => {
        const term = search.trim().toLowerCase();
        const direction = sort.dir === 'asc' ? 1 : -1;

        return records
            .filter(row => {
                const matchesSearch = !term || Object.values(row).some(value => String(value ?? '').toLowerCase().includes(term));
                const matchesFilter = filter === 'All' || [row.status, row.severity, row.priority, row.availability].includes(filter);
                return matchesSearch && matchesFilter;
            })
            .sort((a, b) => compareRows(a, b, sort.key) * direction);
    }, [records, search, filter, sort]);

    const filterValues = [...new Set(records.flatMap(row =>
        [row.status, row.severity, row.priority, row.availability].filter(Boolean)
    ))];

    function toggleSort(key) {
        setSort(previous => previous.key === key
            ? { key, dir: previous.dir === 'asc' ? 'desc' : 'asc' }
            : { key, dir: 'asc' });
    }

    return (
        <>
            <PageHeading
                title={name}
                description={config.description}
                action={canWrite ? 'Add New Record' : undefined}
                onAction={canWrite ? onAdd : undefined}
            />

            <div className="module-metrics">
                <StatCard label="Total Records" value={records.length} icon="▤" detail="Registered entries" />
                <StatCard label="Filtered Results" value={filtered.length} icon="⌕" tone="cyan" detail="Matching records" />
                <StatCard label="Workspace" value="HUMANAID" icon="◇" tone="purple" detail="Operational data register" />
            </div>

            <Panel title={`${name} Registry`} subtitle="Manage and review humanitarian operational records">
                <div className="table-toolbar">
                    <div className="toolbar-label">
                        <span className="toolbar-dot" />
                        {filtered.length} RECORDS
                    </div>

                    <div className="toolbar-controls">
                        <input
                            className="search-input"
                            placeholder="Search records..."
                            aria-label="Search records"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                        <select className="filter-select" aria-label="Filter by status" value={filter} onChange={e => setFilter(e.target.value)}>
                            <option value="All">All statuses</option>
                            {filterValues.map(value => <option key={value}>{value}</option>)}
                        </select>
                        <button
                            type="button"
                            className="secondary-button toolbar-button"
                            onClick={() => downloadCsv(config.key, visibleFields, filtered)}
                            disabled={!filtered.length}
                        >
                            ⭳ Export CSV
                        </button>
                    </div>
                </div>

                <DataTable
                    rows={filtered}
                    fields={visibleFields}
                    onEdit={canWrite ? onEdit : undefined}
                    onHistory={name === 'Emergency Requests' && canWrite ? onHistory : undefined}
                    sort={sort}
                    onSort={toggleSort}
                />
            </Panel>
        </>
    );
}

// Rule-based decision support computed from live registry data. These are transparent rules, not AI predictions.
function buildInsights(data) {
    const insights = [];
    const list = (rows, pick, limit = 3) =>
        rows.slice(0, limit).map(pick).join(', ') + (rows.length > limit ? ` +${rows.length - limit} more` : '');

    const critical = data.incidents.filter(x => x.severity === 'Critical' && x.status !== 'Resolved');
    if (critical.length) {
        insights.push({
            title: 'Critical incident prioritisation',
            level: 'HIGH PRIORITY',
            confidence: 0.94,
            reason: `The incident registry contains ${critical.length} record(s) with Critical severity and a status other than Resolved.`,
            description: `${critical.length} unresolved critical incident${critical.length > 1 ? 's' : ''}: ${list(critical, x => `${x.title} (${x.location})`)}. Assess immediately and confirm response resources are assigned.`
        });
    }

    const crowded = data.shelters.filter(x => x.status !== 'Closed' && Number(x.capacity) > 0 && Number(x.occupied) / Number(x.capacity) >= 0.85);
    if (crowded.length) {
        insights.push({
            title: 'Shelter capacity pressure',
            level: 'HIGH PRIORITY',
            confidence: 0.90,
            reason: 'These open shelters have occupancy at or above the configured 85% capacity threshold.',
            description: `${list(crowded, x => `${x.name} (${Math.round(Number(x.occupied) / Number(x.capacity) * 100)}%)`)} at or near capacity. Plan overflow space or transfers.`
        });
    }

    const urgent = data.requests.filter(x => x.status === 'Pending' && ['High', 'Critical'].includes(x.priority));
    if (urgent.length) {
        insights.push({
            title: 'Urgent requests awaiting review',
            level: 'HIGH PRIORITY',
            confidence: 0.93,
            reason: `There are ${urgent.length} request(s) with Pending status and High or Critical priority.`,
            description: `${urgent.length} high-priority request${urgent.length > 1 ? 's are' : ' is'} still pending: ${list(urgent, x => `${x.requester} (${x.category || 'General'})`)}.`
        });
    }

    const short = data.resources.filter(x => ['Low stock', 'Out of stock'].includes(x.status) || Number(x.quantity) === 0);
    if (short.length) {
        insights.push({
            title: 'Supply shortfall',
            level: 'RECOMMENDATION',
            confidence: 0.88,
            reason: 'These resource records are marked Low stock/Out of stock or have a quantity of zero.',
            description: `${list(short, x => x.name)} ${short.length > 1 ? 'are' : 'is'} low or out of stock. Review replenishment against open requests.`
        });
    }

    const pending = data.requests.filter(x => x.status === 'Pending').length;
    const available = data.volunteers.filter(x => x.availability === 'Available').length;
    if (pending > available) {
        insights.push({
            title: 'Volunteer capacity gap',
            level: 'OPERATIONAL INSIGHT',
            confidence: 0.82,
            reason: `The number of Pending requests (${pending}) is greater than the number of volunteers marked Available (${available}).`,
            description: `${pending} pending requests but only ${available} available volunteer${available === 1 ? '' : 's'}. Consider recruiting or re-prioritising assignments.`
        });
    } else if (available > 0) {
        insights.push({
            title: 'Volunteer deployment planning',
            level: 'OPERATIONAL INSIGHT',
            confidence: 0.80,
            reason: `The volunteer registry currently lists ${available} volunteer(s) as Available.`,
            description: `${available} volunteer${available > 1 ? 's are' : ' is'} available. Match skills to open requests before assigning field teams.`
        });
    }

    if (!insights.length) {
        insights.push({
            title: 'No elevated risk signals',
            level: 'ALL CLEAR',
            confidence: 0.80,
            reason: 'No current records matched the configured critical incident, shelter crowding, urgent request, or supply shortfall rules.',
            description: 'Current records show no critical incidents, crowded shelters, supply gaps or urgent pending requests.'
        });
    }

    return insights;
}

// Transparent request triage. This is a weighted rule score, not a model probability.
function buildRequestTriage(data) {
    const priorityPoints = { critical: 55, high: 40, medium: 25, low: 10 };
    const incidentPoints = { critical: 20, high: 15, medium: 10, low: 5 };
    const normalize = value => String(value || '').trim().toLowerCase();
    const now = Date.now();

    return data.requests
        .filter(request => normalize(request.status) === 'pending')
        .map(request => {
            const priority = normalize(request.priority) || 'medium';
            const factors = [`${priority[0].toUpperCase()}${priority.slice(1)} priority (+${priorityPoints[priority] || 25})`];
            let score = priorityPoints[priority] || 25;
            const createdAt = Date.parse(request.createdAt || '');
            let waitHours = null;

            if (Number.isFinite(createdAt)) {
                waitHours = Math.max(0, Math.floor((now - createdAt) / 3600000));
                const waitPoints = Math.min(15, Math.floor(waitHours / 12) * 5);
                if (waitPoints > 0) {
                    score += waitPoints;
                    factors.push(`Waiting ${waitHours < 24 ? `${waitHours}h` : `${Math.floor(waitHours / 24)}d ${waitHours % 24}h`} (+${waitPoints})`);
                }
            }

            const requestLocation = normalize(request.location);
            const relatedIncidents = requestLocation
                ? data.incidents.filter(incident => normalize(incident.location) === requestLocation && normalize(incident.status) !== 'resolved')
                : [];
            const strongestIncident = relatedIncidents
                .sort((a, b) => (incidentPoints[normalize(b.severity)] || 0) - (incidentPoints[normalize(a.severity)] || 0))[0];
            if (strongestIncident) {
                const points = incidentPoints[normalize(strongestIncident.severity)] || 5;
                score += points;
                factors.push(`${strongestIncident.severity || 'Active'} incident at this location (+${points})`);
            }

            const category = normalize(request.category);
            const matchingResources = category
                ? data.resources.filter(resource => normalize(resource.category) === category)
                : [];
            const shortage = matchingResources.length > 0 && matchingResources.every(resource =>
                ['low stock', 'out of stock'].includes(normalize(resource.status)) || Number(resource.quantity) <= 0
            );
            if (shortage) {
                score += 10;
                factors.push(`Matching ${request.category} resources are low or out of stock (+10)`);
            }

            const missingEvidence = [];
            if (!requestLocation) missingEvidence.push('location');
            if (!Number.isFinite(createdAt)) missingEvidence.push('submission time');
            return {
                request,
                score: Math.min(100, score),
                waitHours,
                factors,
                missingEvidence,
                level: score >= 80 ? 'CRITICAL REVIEW' : score >= 60 ? 'HIGH REVIEW' : score >= 40 ? 'STANDARD REVIEW' : 'MONITOR'
            };
        })
        .sort((a, b) => b.score - a.score || (b.waitHours ?? -1) - (a.waitHours ?? -1));
}

function IntelligencePage({ data, onRecordAiDecision, canWrite }) {
    const critical = data.incidents.filter(x => x.severity === 'Critical');
    const high = data.incidents.filter(x => x.severity === 'High');
    const recommendations = useMemo(() => buildInsights(data), [data]);
    const triageQueue = useMemo(() => buildRequestTriage(data), [data]);
    const [review, setReview] = useState({ requestId: '', insightTitle: recommendations[0]?.title || '', decision: 'Accepted', appliedValue: '', notes: '' });
    const [reviewBusy, setReviewBusy] = useState(false);
    const [reviewMessage, setReviewMessage] = useState('');
    const reviewPanelRef = useRef(null);
    const selectedInsight = recommendations.find(item => item.title === review.insightTitle) || recommendations[0];
    const selectedTriage = triageQueue.find(item => String(item.request.id) === String(review.requestId));

    useEffect(() => {
        if (!recommendations.some(item => item.title === review.insightTitle)) {
            setReview(previous => ({ ...previous, insightTitle: recommendations[0]?.title || '' }));
        }
    }, [recommendations, review.insightTitle]);

    function selectForReview(title, requestId = '') {
        setReview(previous => ({ ...previous, insightTitle: title, requestId: requestId ? String(requestId) : previous.requestId }));
        requestAnimationFrame(() => reviewPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }

    async function submitReview(event) {
        event.preventDefault();
        setReviewBusy(true);
        setReviewMessage('');
        try {
            const triageContext = selectedTriage
                ? ` Request triage score: ${selectedTriage.score}/100. Evidence: ${selectedTriage.factors.join('; ')}.`
                : '';
            await onRecordAiDecision({
                requestId: Number(review.requestId),
                recommendation: `${selectedInsight.title}: ${selectedInsight.description}${triageContext}`,
                confidence: selectedInsight.confidence,
                decision: review.decision,
                appliedValue: review.appliedValue,
                notes: review.notes
            });
            setReviewMessage('AI review decision recorded in the request audit history.');
            setReview(previous => ({ ...previous, appliedValue: '', notes: '' }));
        } catch (error) {
            setReviewMessage(error.message || 'Could not record the AI review decision.');
        } finally {
            setReviewBusy(false);
        }
    }

    return (
        <>
            <PageHeading
                eyebrow="INTELLIGENCE & DECISION SUPPORT"
                title="AI Intelligence Center"
                description="Risk signals and suggested actions derived from your current operational records."
            />

            <div className="stats-grid">
                <StatCard label="Reported Incidents" value={data.incidents.length} icon="◇" detail="Recorded incidents" />
                <StatCard label="Critical Incidents" value={critical.length} icon="△" tone="red" detail="Require priority review" />
                <StatCard label="High Severity" value={high.length} icon="⚑" tone="cyan" detail="Require monitoring" />
                <StatCard label="Active Signals" value={recommendations.length} icon="✧" tone="purple" detail="Rule-based insights" />
            </div>

            <div className="ai-notice">
                <span>✧</span>
                <div>
                    <strong>Rule-based decision support</strong>
                    <p>These insights come from simple, transparent rules applied to your live records. They are not machine-learning predictions. Human validation is required.</p>
                </div>
            </div>

            <Panel title="Explainable request triage" subtitle="Pending requests ranked using priority, wait time, nearby incident severity and matching resource availability.">
                {triageQueue.length === 0 ? <p className="triage-empty">No pending requests need triage right now.</p> : (
                    <div className="triage-queue">
                        {triageQueue.slice(0, 6).map(item => (
                            <article className="triage-item" key={item.request.id}>
                                <div className="triage-item-heading">
                                    <div>
                                        <span className={`triage-level triage-${item.level.toLowerCase().replaceAll(' ', '-')}`}>{item.level}</span>
                                        <h3>Request #{item.request.id} · {item.request.requester || item.request.requesterName || 'Requester'}</h3>
                                    </div>
                                    <strong className="triage-score">{item.score}<small>/100 rule score</small></strong>
                                </div>
                                <p className="triage-summary">{item.request.category || 'General'} · {item.request.location || 'Location not provided'} · {item.request.priority || 'Medium'} priority</p>
                                <ul>{item.factors.map((factor, index) => <li key={`${item.request.id}-${index}`}>{factor}</li>)}</ul>
                                {item.missingEvidence.length > 0 && <p className="triage-data-note">Limited evidence: missing {item.missingEvidence.join(' and ')}.</p>}
                                {canWrite && <button type="button" className="secondary-button" onClick={() => selectForReview(recommendations[0]?.title || '', item.request.id)}>Review this request</button>}
                            </article>
                        ))}
                    </div>
                )}
                <p className="triage-disclaimer">Scores are transparent operational heuristics, not machine-learning predictions. Staff must verify the evidence before acting.</p>
            </Panel>

            <Panel title="Intelligence Recommendations" subtitle="Suggested operational actions based on current records">
                <div className="recommendation-grid">
                    {recommendations.map((item, index) => (
                        <div className="recommendation-card" key={item.title}>
                            <div className="recommendation-number">{String(index + 1).padStart(2, '0')}</div>
                            <span className="recommendation-level">{item.level}</span>
                            <h3>{item.title}</h3>
                            <p>{item.description}</p>
                            <div className="recommendation-confidence" aria-label={`Rule confidence ${Math.round(item.confidence * 100)} percent`}>
                                <div><span>Rule confidence</span><strong>{Math.round(item.confidence * 100)}%</strong></div>
                                <div className="recommendation-confidence-track"><span style={{ width: `${Math.round(item.confidence * 100)}%` }} /></div>
                            </div>
                            <p className="recommendation-reason"><strong>Why:</strong> {item.reason}</p>
                            <div className="recommendation-footer">HUMAN REVIEW REQUIRED ↗</div>
                            {canWrite && <button type="button" className="secondary-button recommendation-review-button" onClick={() => selectForReview(item.title)}>Review this recommendation</button>}
                        </div>
                    ))}
                </div>
            </Panel>

            {canWrite && <div ref={reviewPanelRef}><Panel title="Human Review" subtitle="Choose the affected request and recommendation, then approve, override, reject, or defer it.">
                <form className="audit-review-form" onSubmit={submitReview}>
                    <label>Emergency request
                        <select required value={review.requestId} onChange={event => setReview({ ...review, requestId: event.target.value })}>
                            <option value="">Choose a request</option>
                            {data.requests.map(request => <option key={request.id} value={request.id}>#{request.id} · {request.requester} · {request.status}</option>)}
                        </select>
                    </label>
                    <label>Recommendation to review
                        <select required value={selectedInsight?.title || ''} onChange={event => setReview({ ...review, insightTitle: event.target.value })}>
                            {recommendations.map(item => <option key={item.title} value={item.title}>{item.title}</option>)}
                        </select>
                    </label>
                    {selectedInsight && <div className="review-evidence">
                        <p><strong>Suggested action:</strong> {selectedInsight.description}</p>
                        <p><strong>Why this was suggested:</strong> {selectedInsight.reason}</p>
                        <p><strong>Rule confidence:</strong> {Math.round(selectedInsight.confidence * 100)}% <span>(heuristic score, not a probability)</span></p>
                    </div>}
                    {selectedTriage && <div className="review-evidence triage-review-evidence">
                        <p><strong>Selected request triage:</strong> {selectedTriage.score}/100 · {selectedTriage.level}</p>
                        <p><strong>Evidence:</strong> {selectedTriage.factors.join('; ')}</p>
                    </div>}
                    <div className="audit-review-fields">
                        <label>Staff decision
                            <select value={review.decision} onChange={event => setReview({ ...review, decision: event.target.value })}>
                                <option value="Accepted">Approve recommendation</option>
                                <option value="Modified">Override / modify</option>
                                <option value="Rejected">Reject recommendation</option>
                                <option value="Deferred">Defer for later</option>
                            </select>
                        </label>
                        {review.decision === 'Modified' && <label>Approved alternative action
                            <input required maxLength={1000} value={review.appliedValue} onChange={event => setReview({ ...review, appliedValue: event.target.value })} placeholder="Describe the action staff chose instead" />
                        </label>}
                    </div>
                    <label>Reviewer notes (optional)
                        <textarea maxLength={2000} value={review.notes} onChange={event => setReview({ ...review, notes: event.target.value })} placeholder="Reason or context" />
                    </label>
                    {reviewMessage && <p className="audit-review-message" role="status">{reviewMessage}</p>}
                    <button className="primary-button" type="submit" disabled={reviewBusy || !data.requests.length}>{reviewBusy ? 'Recording…' : 'Record review decision'}</button>
                </form>
            </Panel></div>}
        </>
    );
}

function BarRow({ label, value, max, display, tone = 'medium' }) {
    const pct = max ? Math.min(100, value / max * 100) : 0;

    return (
        <div className="bar-row">
            <span title={label}>{label}</span>
            <div className="severity-track">
                <div className={`severity-fill severity-${tone}`} style={{ width: `${pct}%` }} />
            </div>
            <strong>{display ?? value}</strong>
        </div>
    );
}

function AnalyticsPage({ data }) {
    const levels = ['Critical', 'High', 'Medium', 'Low'];
    const total = data.incidents.length;
    const statuses = [...new Set(data.incidents.map(x => x.status))];
    const categories = [...new Set(data.resources.map(x => x.category || 'General'))];
    const stockByCategory = categories.map(category => ({
        label: category,
        value: data.resources.filter(x => (x.category || 'General') === category).reduce((sum, x) => sum + Number(x.quantity || 0), 0)
    }));
    const maxStock = Math.max(0, ...stockByCategory.map(x => x.value));
    const people = data.incidents.reduce((sum, x) => sum + Number(x.people || 0), 0);

    return (
        <>
            <PageHeading
                eyebrow="OPERATIONAL INTELLIGENCE"
                title="Analytics & Reports"
                description="Explore incident distribution, response activity and operational statistics."
            />

            <div className="stats-grid">
                <StatCard label="Total Incidents" value={total} icon="◇" detail={`${people.toLocaleString()} people affected`} />
                <StatCard label="Emergency Requests" value={data.requests.length} icon="⚑" tone="red" detail="Assistance requests" />
                <StatCard label="Shelter Facilities" value={data.shelters.length} icon="⌂" tone="cyan" detail="Registered shelters" />
                <StatCard label="Response Volunteers" value={data.volunteers.length} icon="♙" tone="purple" detail="Registered personnel" />
            </div>

            <div className="dashboard-grid">
                <Panel title="Incident Severity Distribution" subtitle="Distribution by reported severity">
                    <div className="bar-chart">
                        {levels.map(level => {
                            const count = data.incidents.filter(x => x.severity === level).length;
                            return <BarRow key={level} label={level} value={count} max={total} tone={level.toLowerCase()} display={count} />;
                        })}
                    </div>
                </Panel>

                <Panel title="Incident Status" subtitle="Where incidents are in the response cycle">
                    <div className="bar-chart">
                        {statuses.length === 0 && <p className="muted-note">No incidents recorded.</p>}
                        {statuses.map(status => (
                            <BarRow key={status} label={status} value={data.incidents.filter(x => x.status === status).length} max={total} />
                        ))}
                    </div>
                </Panel>
            </div>

            <div className="dashboard-grid lower-grid">
                <Panel title="Shelter Utilisation" subtitle="Occupied versus capacity">
                    <div className="bar-chart">
                        {data.shelters.length === 0 && <p className="muted-note">No shelters registered.</p>}
                        {data.shelters.map(shelter => {
                            const capacity = Number(shelter.capacity || 0);
                            const pct = capacity ? Math.round(Number(shelter.occupied || 0) / capacity * 100) : 0;
                            return (
                                <BarRow
                                    key={shelter.id}
                                    label={shelter.name}
                                    value={Number(shelter.occupied || 0)}
                                    max={capacity}
                                    display={`${pct}%`}
                                    tone={pct >= 100 ? 'critical' : pct >= 80 ? 'high' : 'low'}
                                />
                            );
                        })}
                    </div>
                </Panel>

                <Panel title="Stock by Category" subtitle="Tracked inventory units">
                    <div className="bar-chart">
                        {stockByCategory.length === 0 && <p className="muted-note">No resources registered.</p>}
                        {stockByCategory.map(item => (
                            <BarRow key={item.label} label={item.label} value={item.value} max={maxStock} display={item.value.toLocaleString()} tone="low" />
                        ))}
                    </div>
                </Panel>
            </div>
        </>
    );
}

function SettingsPage({ autoRefresh, setAutoRefresh, animations, setAnimations }) {
    const [check, setCheck] = useState(null);
    const [checking, setChecking] = useState(false);

    async function testConnection() {
        setChecking(true);
        try {
            const result = await health();
            setCheck({ ok: true, text: `${result.service} is ${result.status}` });
        } catch (err) {
            setCheck({ ok: false, text: err.message });
        } finally { setChecking(false); }
    }

    return (
        <>
            <PageHeading
                title="System Settings"
                description="Manage workspace preferences. Preferences are saved in this browser."
            />

            <Panel title="Workspace Configuration" subtitle="Personalize your HUMANAID workspace">
                <div className="settings-list">
                    <div className="setting-row">
                        <div>
                            <strong>Auto-refresh data</strong>
                            <p>Reload registries from the API every 30 seconds while this tab is visible</p>
                        </div>
                        <input type="checkbox" aria-label="Auto-refresh data" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} />
                    </div>

                    <div className="setting-row">
                        <div>
                            <strong>Background Animations</strong>
                            <p>Enable or disable animated interface effects</p>
                        </div>
                        <input type="checkbox" aria-label="Background animations" checked={animations} onChange={e => setAnimations(e.target.checked)} />
                    </div>

                    <div className="setting-row">
                        <div>
                            <strong>API connection</strong>
                            <p>{API_BASE}{check && <> · <span className={check.ok ? 'check-ok' : 'check-fail'}>{check.text}</span></>}</p>
                        </div>
                        <button type="button" className="secondary-button" onClick={testConnection} disabled={checking}>
                            {checking ? 'Testing...' : 'Test connection'}
                        </button>
                    </div>

                    <div className="setting-row">
                        <div>
                            <strong>Platform Version</strong>
                            <p>HUMANAID development build</p>
                        </div>
                        <span className="setting-value">v1.1</span>
                    </div>
                </div>
            </Panel>
        </>
    );
}

function AuditHistoryModal({ record, events, loading, error, onClose }) {
    useEffect(() => {
        const onKey = event => { if (event.key === 'Escape') onClose(); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [onClose]);

    return (
        <div className="modal-backdrop" onMouseDown={event => {
            if (event.target === event.currentTarget) onClose();
        }}>
            <section className="modal audit-history-modal" role="dialog" aria-modal="true" aria-labelledby="audit-history-title">
                <div className="modal-header">
                    <div>
                        <div className="eyebrow"><span /> REQUEST AUDIT TRAIL</div>
                        <h2 id="audit-history-title">Request #{record.id} history</h2>
                        <p>Submission, status changes and human decisions are recorded with the actor and time.</p>
                    </div>
                    <button type="button" className="modal-close" onClick={onClose} aria-label="Close history">×</button>
                </div>

                {loading && <p role="status">Loading request history…</p>}
                {error && <div className="modal-error" role="alert">{error}</div>}
                {!loading && !error && events.length === 0 && (
                    <div className="empty-state">
                        <strong>No history recorded yet</strong>
                        <p>New submissions and future status changes will appear here.</p>
                    </div>
                )}
                {!loading && !error && events.length > 0 && (
                    <ol className="audit-history-list">
                        {events.map(event => (
                            <li className="audit-history-item" key={event.id}>
                                <div className="audit-history-topline">
                                    <strong>{event.action}</strong>
                                    <time dateTime={event.occurredAt}>{new Date(event.occurredAt).toLocaleString()}</time>
                                </div>
                                <div className="audit-history-actor">{event.actorName} · {event.actorRole}</div>
                                {(event.fromValue || event.toValue) && (
                                    <div className="audit-history-change">
                                        {event.fromValue || '—'} <span aria-hidden="true">→</span> {event.toValue || '—'}
                                    </div>
                                )}
                                {event.details && <p>{event.details}</p>}
                                {event.recommendation && (
                                    <p className="audit-history-ai">
                                        AI suggestion: {event.recommendation}
                                        {event.confidence !== null && event.confidence !== undefined && ` · ${Math.round(event.confidence * 100)}% confidence`}
                                    </p>
                                )}
                            </li>
                        ))}
                    </ol>
                )}

                <div className="modal-actions">
                    <span className="actions-spacer" />
                    <button type="button" className="secondary-button" onClick={onClose}>Close</button>
                </div>
            </section>
        </div>
    );
}

function RecordModal({ config, record, onSave, onDelete, onClose, busy, error, canDelete }) {
    const fields = config.fields.filter(field => !field[2]);
    const [form, setForm] = useState(record || { ...config.defaults });
    const [localError, setLocalError] = useState('');
    const [confirmDelete, setConfirmDelete] = useState(false);

    useEffect(() => {
        const onKey = event => { if (event.key === 'Escape') onClose(); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [onClose]);

    function update(key, value) {
        setForm(previous => ({
            ...previous,
            [key]: numericFields.includes(key) ? (value === '' ? '' : Number(value)) : value
        }));
    }

    function submit(event) {
        event.preventDefault();
        if (config.key === 'shelters' && Number(form.occupied || 0) > Number(form.capacity || 0)) {
            setLocalError('Occupied cannot exceed capacity.');
            return;
        }
        setLocalError('');
        onSave(form);
    }

    const message = localError || error;

    return (
        <div className="modal-backdrop" onMouseDown={e => {
            if (e.target === e.currentTarget) onClose();
        }}>
            <form className="modal" onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="record-modal-title">
                <div className="modal-header">
                    <div>
                        <div className="eyebrow"><span /> HUMANAID DATA MANAGEMENT</div>
                        <h2 id="record-modal-title">{record ? 'Edit Record' : 'Create New Record'}</h2>
                        <p>Complete the required operational information.</p>
                    </div>
                    <button type="button" className="modal-close" onClick={onClose} aria-label="Close dialog">×</button>
                </div>

                <div className="form-grid">
                    {fields.map(([key, label], index) => {
                        const options = config.options?.[key] ?? choices[key];
                        return (
                            <label key={key}>
                                <span>{label}</span>
                                {options ? (
                                    <select value={form[key] ?? ''} onChange={e => update(key, e.target.value)} autoFocus={index === 0}>
                                        {form[key] && !options.includes(form[key]) && (
                                            <option value={form[key]}>{form[key]}</option>
                                        )}
                                        {options.map(value => <option key={value} value={value}>{value}</option>)}
                                    </select>
                                ) : (
                                    <input
                                        type={numericFields.includes(key) ? 'number' : key === 'email' ? 'email' : key === 'password' ? 'password' : 'text'}
                                        min={numericFields.includes(key) ? 0 : undefined}
                                        step={numericFields.includes(key) ? 1 : undefined}
                                        maxLength={numericFields.includes(key) ? undefined : key === 'password' ? 128 : 200}
                                        minLength={key === 'password' && !(record && !form.password) ? 8 : undefined}
                                        required={!numericFields.includes(key) && !config.optional?.includes(key) && !(key === 'password' && record)}
                                        autoComplete={key === 'password' ? 'new-password' : 'off'}
                                        autoFocus={index === 0}
                                        value={form[key] ?? ''}
                                        onChange={e => update(key, e.target.value)}
                                        placeholder={`Enter ${label.toLowerCase()}`}
                                    />
                                )}
                            </label>
                        );
                    })}
                </div>

                {message && <div className="modal-error" role="alert">{message}</div>}

                <div className="modal-actions">
                    {record && canDelete && (
                        confirmDelete
                            ? <button type="button" className="danger-button" onClick={onDelete} disabled={busy}>Confirm delete</button>
                            : <button type="button" className="danger-button ghost" onClick={() => setConfirmDelete(true)} disabled={busy}>Delete</button>
                    )}
                    <span className="actions-spacer" />
                    <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
                    <button type="submit" className="primary-button" disabled={busy}>{busy ? 'Saving...' : 'Save Record →'}</button>
                </div>
            </form>
        </div>
    );
}

function App() {
    const initialResetToken = new URLSearchParams(window.location.search).get('resetToken') || '';
    const [language, setLanguage] = useState(() => {
        const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
        return ['en', 'si', 'ta'].includes(saved) ? saved : 'en';
    });
    const [active, setActive] = useState('Dashboard');
    const [data, setData] = useState(emptyData);
    const [session, setSession] = useState(null);
    const [selectedPortal, setSelectedPortal] = useState(null);
    const [booting, setBooting] = useState(() => Boolean(getToken()) && !initialResetToken);
    const [authBusy, setAuthBusy] = useState(false);
    const [authError, setAuthError] = useState('');
    const [authNotice, setAuthNotice] = useState('');
    const [authMode, setAuthMode] = useState(() => initialResetToken ? 'reset' : 'login');
    const [resetToken, setResetToken] = useState(initialResetToken);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [lastSync, setLastSync] = useState(null);
    const [saving, setSaving] = useState(false);
    const [modalError, setModalError] = useState('');
    const [showRegister, setShowRegister] = useState(false);
    const [showAuthPassword, setShowAuthPassword] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [modal, setModal] = useState(null);
    const [auditRecord, setAuditRecord] = useState(null);
    const [auditEvents, setAuditEvents] = useState([]);
    const [auditLoading, setAuditLoading] = useState(false);
    const [auditError, setAuditError] = useState('');
    const [toast, setToast] = useState(null);
    const [autoRefresh, setAutoRefresh] = usePersistentState('humanaid_auto_refresh', true);
    const [animations, setAnimations] = usePersistentState('humanaid_animations', true);
    const refreshRef = useRef(null);
    const [loginPortalType, setLoginPortalType] = useState('public'); // 'public' | 'authorized'

    function changeLanguage(nextLanguage) {
        if (!['en', 'si', 'ta'].includes(nextLanguage)) return;
        localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);
        setLanguage(nextLanguage);
    }

    useEffect(() => {
        document.documentElement.lang = language === 'si' ? 'si-LK' : language === 'ta' ? 'ta-LK' : 'en';
    }, [language]);

    useEffect(() => {
        document.title = session ? `${active} | HUMANAID` : 'Sign in | HUMANAID';
    }, [active, session]);

    useEffect(() => {
        document.documentElement.classList.toggle('reduce-app-motion', !animations);
        return () => document.documentElement.classList.remove('reduce-app-motion');
    }, [animations]);

    useEffect(() => {
        if (!toast) return undefined;
        const timer = setTimeout(() => setToast(null), 3500);
        return () => clearTimeout(timer);
    }, [toast]);

    // Any authenticated request that comes back 401 ends the session cleanly.
    useEffect(() => {
        onUnauthorized(() => {
            clearToken();
            setSession(null);
            setData(emptyData());
            setModal(null);
            setAuthError('Your session has expired. Please sign in again.');
        });
        return () => onUnauthorized(null);
    }, []);

    function applyLoad(result) {
        setData(result.data);
        setLastSync(new Date());
        setError(result.failed.length
            ? `Could not load ${result.failed.join(', ')}: ${result.errors[0]}`
            : '');
    }

    async function refresh(role = session?.role, silent = false) {
        if (!silent) setLoading(true);
        try {
            applyLoad(await loadData(role));
        } catch (err) {
            if (err.status !== 401) setError(err.message);
        } finally {
            if (!silent) setLoading(false);
        }
    }

    async function openAuditHistory(record) {
        setAuditRecord(record);
        setAuditEvents([]);
        setAuditError('');
        setAuditLoading(true);
        try {
            const query = `auditlogs?entityType=EmergencyRequest&entityId=${encodeURIComponent(record.id)}`;
            setAuditEvents(await api(query));
        } catch (err) {
            setAuditError(err.message || 'Could not load request history.');
        } finally {
            setAuditLoading(false);
        }
    }

    async function recordAiDecision(payload) {
        await api('auditlogs/ai-decision', { method: 'POST', body: payload });
        setToast({ id: Date.now(), message: 'Human review decision recorded' });
    }

    // Restore a session after a page reload.
    useEffect(() => {
        if (resetToken) {
            clearToken();
            setBooting(false);
            return undefined;
        }
        if (!getToken()) return undefined;
        let cancelled = false;

        (async () => {
            try {
                const user = await api('auth/me');
                if (cancelled) return;
                setSession(user);
                setSelectedPortal('portal-selection');
                setActive('Dashboard');
                const result = await loadData(user.role);
                if (!cancelled) applyLoad(result);
            } catch (err) {
                if (cancelled) return;
                if (err.status === 401) clearToken();
                else setAuthError(err.message);
            } finally {
                if (!cancelled) setBooting(false);
            }
        })();

        return () => { cancelled = true; };
    }, []);

    // Periodic silent refresh (skipped while the tab is hidden or a record is being edited).
    useEffect(() => {
        refreshRef.current = () => {
            if (!document.hidden && !modal && !saving) refresh(undefined, true);
        };
    });

    useEffect(() => {
        if (!session || !autoRefresh) return undefined;
        const timer = setInterval(() => refreshRef.current?.(), 30000);
        return () => clearInterval(timer);
    }, [session, autoRefresh]);

    async function submitAuth(event) {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const password = String(form.get('password') || '');

        if (authMode === 'reset' && String(form.get('newPassword') || '') !== String(form.get('confirmNewPassword') || '')) {
            setAuthError('Passwords do not match.');
            return;
        }

        if (showRegister && password !== String(form.get('confirmPassword') || '')) {
            setAuthError('Passwords do not match.');
            return;
        }

        setAuthBusy(true);
        setAuthError('');
        setAuthNotice('');
        try {
            if (authMode === 'forgot') {
                const emailVal = String(form.get('email') || '').trim().toLowerCase();
                await api('auth/forgot-password', { method: 'POST', body: { email: emailVal }, token: null });
                setAuthNotice('If an account exists, a password reset link has been sent. Check your inbox and spam folder.');
                return;
            }

            if (authMode === 'reset') {
                await api('auth/reset-password', {
                    method: 'POST',
                    body: { token: resetToken, newPassword: String(form.get('newPassword') || '') },
                    token: null,
                });
                setAuthMode('login');
                setShowRegister(false);
                setResetToken('');
                window.history.replaceState({}, document.title, window.location.pathname);
                setAuthNotice('Password updated. You can now sign in.');
                return;
            }

            const emailVal = String(form.get('email') || '').trim().toLowerCase();
            const isAuthorizedTab = loginPortalType === 'authorized';

            if (isAuthorizedTab) {
                const result = await login(emailVal, password);

                if (!['Admin', 'Coordinator'].includes(result.role)) {
                    clearToken();
                    throw new Error('This account does not have Authorized Officer access.');
                }

                setSession({
                    name: result.name || 'Authorized Officer',
                    email: result.email || emailVal,
                    role: result.role,
                    userId: result.userId,
                });
                setSelectedPortal('portal-selection');
                setActive('Dashboard');
                setShowRegister(false);
                setAuthMode('login');
                await refresh(result.role);
                return;
            }

            // Public access login / register
            const result = showRegister
                ? await register(String(form.get('name')).trim(), emailVal, password)
                : await login(emailVal, password);

            // A public-access sign-in must never open an authorized workspace.
            if (['Admin', 'Coordinator'].includes(result.role)) {
                clearToken();
                throw new Error('This account is for Authorized Officer access. Please choose that sign-in option.');
            }

            setSession({
                name: result.name || 'Public User',
                email: result.email || emailVal,
                role: result.role || 'User',
                userId: result.userId,
            });

            setSelectedPortal('portal-selection');
            setActive('Dashboard');
            setShowRegister(false);
            setAuthMode('login');
            await refresh(result.role || 'User');
        } catch (err) {
            setAuthError(err.message);
        } finally {
            setAuthBusy(false);
        }
    }

    function signOut() {
        clearToken();
        setSession(null);
        setData(emptyData());
        setModal(null);
        setError('');
        setAuthError('');
        setAuthNotice('');
        setAuthMode('login');
        setResetToken('');
        setSelectedPortal(null);
    }

    const canWrite = session?.role === 'Admin' || session?.role === 'Coordinator';

    function navigate(page) {
        setActive(page);
        setSidebarOpen(false);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function openAdd(page = active) {
        if (!modules[page] || (!canWrite && !(page === 'User Management' && session?.role === 'Admin'))) return;
        setModalError('');
        setModal({ page, record: null });
    }

    function openEdit(record) {
        if (!canWrite || (active === 'User Management' && session?.role !== 'Admin')) return;
        setModalError('');
        setModal({ page: active, record });
    }

    async function saveRecord(form) {
        if (!modal) return;
        const isEdit = Boolean(modal.record);
        setSaving(true);
        setModalError('');
        try {
            await save(modules[modal.page].key, form, modal.record?.id);
            setModal(null);
            setToast({ id: Date.now(), message: isEdit ? 'Record updated' : 'Record created' });
            await refresh(undefined, true);
        } catch (err) {
            setModalError(err.message);
        } finally {
            setSaving(false);
        }
    }

    async function deleteRecord() {
        if (!modal?.record) return;
        setSaving(true);
        setModalError('');
        try {
            await remove(modules[modal.page].key, modal.record.id);
            setModal(null);
            setToast({ id: Date.now(), message: 'Record deleted' });
            await refresh(undefined, true);
        } catch (err) {
            setModalError(err.message);
        } finally {
            setSaving(false);
        }
    }

    async function handleVerifyRequest(req) {
        try {
            const result = await api(`emergencyrequests/${req.id}/verify`, { method: 'POST', body: {} });
            setToast({ id: Date.now(), message: `Request #${req.id} verified · email: ${result.notification || 'not sent'}` });
            await refresh(undefined, true);
        } catch (err) { setToast({ id: Date.now(), message: err.message || 'Verification failed' }); }
    }

    async function handleRejectRequest(req, reason) {
        try {
            const result = await api(`emergencyrequests/${req.id}/reject`, { method: 'POST', body: { reason } });
            setToast({ id: Date.now(), message: `Request #${req.id} rejected with guidance · ${result.notification || 'notification not sent'}` });
            await refresh(undefined, true);
        } catch (err) { setToast({ id: Date.now(), message: err.message || 'Request rejection failed' }); }
    }

    async function handleDispatchTeam(req, allocation) {
        try {
            const result = await api(`emergencyrequests/${req.id}/assign`, { method: 'POST', body: allocation });
            setToast({ id: Date.now(), message: `Response assigned to request #${req.id} · email: ${result.notification || 'not sent'}` });
            await refresh(undefined, true);
        } catch (err) { setToast({ id: Date.now(), message: err.message || 'Assignment failed' }); }
    }

    async function handleCloseRequest(req) {
        const outcome = window.prompt('Add a short case closure note (optional):', 'Assistance delivered and requester follow-up completed.');
        if (outcome === null) return;
        try {
            const result = await api(`emergencyrequests/${req.id}/close`, { method: 'POST', body: { outcome } });
            setToast({ id: Date.now(), message: `Case #${req.id} closed · email: ${result.notification || 'not sent'}` });
            await refresh(undefined, true);
        } catch (err) { setToast({ id: Date.now(), message: err.message || 'Case closure failed' }); }
    }

    function renderPage() {
        if (active === 'Dashboard') {
            return <Dashboard data={data} navigate={navigate} addRecord={() => openAdd('Crisis Monitoring')} canWrite={canWrite} />;
        }

        if (active === 'AI Intelligence') return <IntelligencePage data={data} onRecordAiDecision={recordAiDecision} canWrite={canWrite} />;
        if (active === 'Notifications') return <NotificationCenter canWrite={canWrite} session={session} />;
        if (active === 'Analytics & Reports') return <AnalyticsPage data={data} />;

        if (active === 'Settings') {
            return <SettingsPage autoRefresh={autoRefresh} setAutoRefresh={setAutoRefresh} animations={animations} setAnimations={setAnimations} />;
        }

        if (active === 'User Management' && session?.role !== 'Admin') {
            return <Panel title="Restricted access" subtitle="Only administrators can manage user accounts.">Access denied.</Panel>;
        }

        if (modules[active]) {
            return (
                <ModulePage
                    key={active}
                    name={active}
                    data={data}
                    onAdd={() => openAdd(active)}
                    onEdit={openEdit}
                    onHistory={openAuditHistory}
                    canWrite={canWrite && (active !== 'User Management' || session?.role === 'Admin')}
                />
            );
        }

        return null;
    }

    if (booting) {
        return (
            <main className="auth-page">
                <PageLanguageTranslator language={language} />
                <LanguagePicker language={language} onChange={changeLanguage} />
                <div className="boot-card" role="status">✧ HUMANAID<span>Restoring your session…</span></div>
            </main>
        );
    }

    if (!session) return (
        <main className="auth-page">
            <form className="auth-card" onSubmit={submitAuth}>
                <PageLanguageTranslator language={language} />
                <LanguagePicker language={language} onChange={changeLanguage} />
                <div className="auth-brand">✧ HUMANAID <span>COMMAND CENTER</span></div>
                <h1>{authMode === 'forgot' ? 'Forgot password' : authMode === 'reset' ? 'Set a new password' : showRegister ? 'Create your account' : 'Welcome back'}</h1>
                {(authMode === 'login' || authMode === 'register') && <PortalRoleSelector
                    selectedRole={loginPortalType}
                    onSelectRole={(val) => {
                        setLoginPortalType(val);
                        if (val === 'authorized') { setShowRegister(false); setAuthMode('login'); }
                        setAuthError('');
                        setAuthNotice('');
                    }}
                />}
                {(authMode === 'login' || authMode === 'register' || authMode === 'forgot') && <label>Email address<input name="email" type="email" required autoComplete="email" /></label>}
                {(authMode === 'login' || authMode === 'register') && (
                    <>
                        <label>Password
                            <span className="auth-password-field">
                                <input name="password" type={showAuthPassword ? 'text' : 'password'} minLength="8" maxLength="128" required autoComplete={showRegister ? 'new-password' : 'current-password'} />
                                <button
                                    type="button"
                                    className="auth-password-toggle"
                                    aria-label={showAuthPassword ? 'Hide password' : 'Show password'}
                                    aria-pressed={showAuthPassword}
                                    onClick={() => setShowAuthPassword((visible) => !visible)}
                                >
                                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                        {showAuthPassword ? (
                                            <>
                                                <path d="M3 3l18 18" />
                                                <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
                                                <path d="M9.9 5.1A10 10 0 0 1 12 4.9c5.5 0 9 7.1 9 7.1a13 13 0 0 1-2.7 3.5M6.2 6.2A12.9 12.9 0 0 0 3 12s3.5 7.1 9 7.1a9.7 9.7 0 0 0 3.1-.5" />
                                            </>
                                        ) : (
                                            <>
                                                <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
                                                <circle cx="12" cy="12" r="3" />
                                            </>
                                        )}
                                    </svg>
                                </button>
                            </span>
                        </label>
                        {showRegister && (
                            <label>Confirm password<input name="confirmPassword" type="password" minLength="8" maxLength="128" required autoComplete="new-password" /></label>
                        )}
                    </>
                )}
                {authMode === 'reset' && <>
                    <label>New password<input name="newPassword" type="password" minLength="8" maxLength="128" required autoComplete="new-password" /></label>
                    <label>Confirm new password<input name="confirmNewPassword" type="password" minLength="8" maxLength="128" required autoComplete="new-password" /></label>
                </>}
                {authMode === 'forgot' && <p className="auth-help">Enter the email address linked to your HUMANAID account. We’ll email a reset link if the account exists.</p>}
                {authError && <div className="auth-error" role="alert">{authError}</div>}
                {authNotice && <div className="auth-success" role="status">{authNotice}</div>}
                <button type="submit" className="primary-button full-width" disabled={authBusy}>
                    {authBusy ? 'Please wait...' : authMode === 'forgot' ? 'Send reset link' : authMode === 'reset' ? 'Reset password' : showRegister ? 'Create account' : 'Sign in'}
                </button>

                {authMode === 'login' && loginPortalType === 'public' && !showRegister && <button type="button" className="auth-forgot" onClick={() => { setAuthMode('forgot'); setAuthError(''); setAuthNotice(''); }}>
                    Forgot password?
                </button>}

                {authMode !== 'login' && authMode !== 'register' && <button type="button" className="auth-switch" onClick={() => { setAuthMode('login'); setResetToken(''); setAuthError(''); setAuthNotice(''); window.history.replaceState({}, document.title, window.location.pathname); }}>
                    Back to sign in
                </button>}

                {(authMode === 'login' || authMode === 'register') && loginPortalType === 'public' && (
                    <button
                        type="button"
                        className="auth-switch"
                        onClick={() => { setShowRegister(!showRegister); setAuthMode(showRegister ? 'login' : 'register'); setAuthError(''); setAuthNotice(''); }}
                    >
                        {showRegister ? 'Already have an account? Sign in' : 'New here? Create an account'}
                    </button>
                )}

                <small>Development integration • Data currently stored in server memory</small>
            </form>
        </main>
    );

    const canDelete = Boolean(modal) && (modal.page === 'User Management' ? session.role === 'Admin' : canWrite);

    // User log wela thiyenawa nam, eth portal ekak click karala nathnam:
    if (session && selectedPortal === 'portal-selection') {
        const isPublicSession = !['Admin', 'Coordinator'].includes(session.role);
        const pendingOfficerRequests = isPublicSession ? [] : (data.requests || []).filter(request => (request.status || 'Pending') === 'Pending');
        return (
            <>
                <PageLanguageTranslator language={language} />
                <LanguagePicker language={language} onChange={changeLanguage} />
                <SelectRole
                    session={session}
                    allowedPortalIds={isPublicSession ? ['affected', 'volunteer', 'dashboard'] : ['coordination', 'volunteer', 'dashboard']}
                    notifications={pendingOfficerRequests.length}
                    pendingRequests={pendingOfficerRequests}
                    onSignOut={signOut}
                    onOpenRequests={() => setSelectedPortal('coordination')}
                    onSelectRole={(role) => {
                        setSelectedPortal(role);
                        if (role === 'dashboard') setActive('Dashboard');
                    }}
                />
                <AidAssistant user={session} data={data} portal="selection" />
            </>
        );
    }

    if (session && selectedPortal === 'affected') {
  return <><PageLanguageTranslator language={language} /><LanguagePicker language={language} onChange={changeLanguage} /><AffectedPortal user={session} language={language} onBack={() => setSelectedPortal('portal-selection')} /></>;
}

   // 2. Volunteer portal eka thoruwoth:
    if (session && selectedPortal === 'volunteer') {
        return (
            <>
                <PageLanguageTranslator language={language} />
                <LanguagePicker language={language} onChange={changeLanguage} />
                <VolunteerPortal user={session} onBack={() => setSelectedPortal('portal-selection')} />
                <AidAssistant user={session} data={data} portal="volunteer" />
            </>
        );
    }
    // 3. Emergency Coordination (coordination) thoruwoth:
    if (session && selectedPortal === 'coordination') {
        return (
            <>
                <PageLanguageTranslator language={language} />
                <LanguagePicker language={language} onChange={changeLanguage} />
                <CommandCenterWorkspace
                    data={data}
                    onBack={() => setSelectedPortal('portal-selection')}
                    onRefresh={() => refresh(session.role)}
                    loading={loading}
                    onDispatch={handleDispatchTeam}
                    onVerify={handleVerifyRequest}
                    onReject={handleRejectRequest}
                    onClose={handleCloseRequest}
                    onAddRequest={() => openAdd('Emergency Requests')}
                />
                {modal && (
                    <RecordModal
                        key={`${modal.page}-${modal.record?.id || 'new'}`}
                        config={modules[modal.page]}
                        record={modal.record}
                        onSave={saveRecord}
                        onDelete={deleteRecord}
                        onClose={() => setModal(null)}
                        busy={saving}
                        error={modalError}
                        canDelete={canDelete}
                    />
                )}
                {toast && <div className="toast" role="status" key={toast.id}>✓ {toast.message}</div>}
                <AidAssistant user={session} data={data} portal="officer" />
            </>
        );
    }

    return (
        <div className="app-shell">
            <PageLanguageTranslator language={language} />
            <LanguagePicker language={language} onChange={changeLanguage} />
            <Sidebar
                active={active}
                navigate={navigate}
                open={sidebarOpen}
                close={() => setSidebarOpen(false)}
                requests={data.requests.filter(x => x.status === 'Pending').length}
                isPublic={!['Admin', 'Coordinator'].includes(session.role)}
            />

            <div className="main">
                <Header active={active} onMenu={() => setSidebarOpen(true)} session={session} />

                <div className="animated-background" aria-hidden="true">
                    <div className="background-grid" />
                    <div className="background-radar background-radar-a" />
                    <div className="background-radar background-radar-b" />
                    <div className="background-glow glow-one" />
                    <div className="background-glow glow-two" />
                    <div className="background-glow glow-three" />
                </div>

                <div className="page-content">
                    <div className="session-strip">
                        <span>
                            ● Connected to HUMANAID API · {session.name || session.email} · <b>{session.role}</b>
                            {lastSync && <> · updated {lastSync.toLocaleTimeString()}</>}
                        </span>
                        <div>
                            {active === 'Dashboard' && <button className="session-back-button" onClick={() => setSelectedPortal('portal-selection')} aria-label="Return to the portal selection screen">← Back to Portals</button>}
                            <button onClick={() => refresh()} disabled={loading}>{loading ? 'Refreshing...' : '↻ Refresh'}</button>
                            <button onClick={signOut}>Sign out</button>
                        </div>
                    </div>
                    {error && <div className="api-error" role="alert">{error}</div>}
                    {renderPage()}
                </div>

                <footer className="footer">
                    <span>© 2026 HUMANAID · Humanitarian Crisis Management Platform</span>
                    <span>API CONNECTED · IN-MEMORY DEVELOPMENT</span>
                </footer>
            </div>

            {modal && (
                <RecordModal
                    key={`${modal.page}-${modal.record?.id || 'new'}`}
                    config={modules[modal.page]}
                    record={modal.record}
                    onSave={saveRecord}
                    onDelete={deleteRecord}
                    onClose={() => setModal(null)}
                    busy={saving}
                    error={modalError}
                    canDelete={canDelete}
                />
            )}

            {auditRecord && (
                <AuditHistoryModal
                    record={auditRecord}
                    events={auditEvents}
                    loading={auditLoading}
                    error={auditError}
                    onClose={() => setAuditRecord(null)}
                />
            )}

            {toast && <div className="toast" role="status" key={toast.id}>✓ {toast.message}</div>}
            <AidAssistant user={session} data={data} portal="dashboard" />
        </div>
    );
}

export default App;
