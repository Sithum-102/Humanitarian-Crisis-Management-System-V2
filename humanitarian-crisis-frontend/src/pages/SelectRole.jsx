import React, { useMemo, useState } from 'react';

const portals = [
    {
        id: 'affected',
        title: 'Affected Person',
        description:
            'Request emergency aid, medical assistance, shelter, or report critical situations in your area.',
        action: 'Request Assistance',
        icon: 'person',
        style: 'affected',
    },
    {
        id: 'volunteer',
        title: 'Volunteer',
        description:
            'Join active relief missions, distribute supplies, and support communities on the ground.',
        action: 'Join Field Operations',
        icon: 'heart',
        style: 'volunteer',
    },
    {
        id: 'coordination',
        title: 'Emergency Coordination',
        description:
            'Access crisis response alerts, dispatch rescue teams, and manage live emergency operations.',
        action: 'Open Command Center',
        badge: 'COMMAND CENTER',
        icon: 'alert',
        style: 'coordination',
    },
    {
        id: 'dashboard',
        title: 'Main Management Dashboard',
        description:
            'Access resource allocation, shelters, volunteers, and complete organizational statistics.',
        action: 'Open Workspace',
        badge: 'WORKSPACE',
        icon: 'grid',
        style: 'dashboard',
    },
];

const styles = `
.portal-page {
    position: relative;
    isolation: isolate;
    width: 100%;
    min-height: 100vh;
    overflow: hidden;
    color: #f4fffb;
    font-family: 'DM Sans', 'Segoe UI', Arial, sans-serif;
    background:
        linear-gradient(rgba(0, 23, 20, .52), rgba(0, 15, 13, .72)),
        url('/forest-bg.png') center / cover fixed no-repeat;
}
.portal-page * { box-sizing: border-box; }
.portal-page button { font: inherit; }
.portal-page a { color: inherit; text-decoration: none; }
.portal-page > * { position: relative; z-index: 1; }
.portal-page :is(button, a):focus-visible {
    outline: 3px solid #62e3c0;
    outline-offset: 3px;
}

/* Rain layers */
.portal-page::before,
.portal-page::after {
    position: fixed;
    z-index: 0;
    inset: -180px 0 0;
    content: '';
    pointer-events: none;
    background-repeat: repeat;
    transform: translateZ(0);
}
.portal-page::before {
    opacity: .17;
    background-image: repeating-linear-gradient(
        103deg,
        transparent 0 34px,
        rgba(218, 242, 255, .48) 35px 36px,
        transparent 37px 96px
    );
    background-size: 96px 180px;
    animation: rain-far .8s linear infinite;
}
.portal-page::after {
    opacity: .22;
    background-image: repeating-linear-gradient(
        103deg,
        transparent 0 53px,
        rgba(230, 248, 255, .55) 54px 55px,
        transparent 56px 125px
    );
    background-size: 125px 145px;
    animation: rain-near .48s linear infinite;
}
@keyframes rain-far {
    from { background-position: 0 0; }
    to { background-position: -18px 180px; }
}
@keyframes rain-near {
    from { background-position: 0 0; }
    to { background-position: -28px 145px; }
}

.portal-header {
    display: flex;
    min-height: 96px;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
    padding: 15px 4.5%;
    border-bottom: 1px solid rgba(220, 255, 245, .16);
    background: rgba(0, 24, 21, .48);
    backdrop-filter: blur(18px);
    -webkit-backdrop-filter: blur(18px);
}
.portal-brand {
    display: flex;
    flex: 0 0 auto;
    align-items: center;
    gap: 14px;
}
.portal-logo {
    display: grid;
    width: 52px;
    height: 52px;
    place-items: center;
    border: 1px solid rgba(255, 255, 255, .28);
    border-radius: 16px;
    background: rgba(68, 211, 174, .23);
    color: #d9fff4;
    font-size: 24px;
    font-weight: 800;
}
.portal-brand strong,
.portal-brand small { display: block; }
.portal-brand strong {
    color: #fff;
    font-size: 21px;
    letter-spacing: .06em;
}
.portal-brand small {
    margin-top: 5px;
    color: rgba(230, 255, 248, .72);
    font-size: 10px;
    letter-spacing: .08em;
}
.portal-nav { display: flex; gap: 36px; }
.portal-nav a {
    color: rgba(245, 255, 252, .86);
    font-size: 15px;
    font-weight: 700;
}
.portal-nav a:hover { color: #65e5c3; }
.portal-help-button {
    display: inline-flex;
    min-height: 50px;
    align-items: center;
    gap: 12px;
    padding: 11px 19px;
    border: 1px solid rgba(255, 255, 255, .24);
    border-radius: 8px;
    background: rgba(71, 190, 161, .27);
    color: #fff;
    font-weight: 800;
    cursor: pointer;
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
}
.portal-help-button:hover { background: rgba(71, 190, 161, .42); }

.portal-hero {
    padding: 65px 20px 36px;
    color: #fff;
    text-align: center;
}
.portal-welcome {
    display: inline-block;
    margin: 0 0 20px;
    padding: 9px 18px;
    border: 1px solid rgba(221, 255, 246, .2);
    border-radius: 30px;
    background: rgba(221, 255, 246, .12);
    color: #d8fff3;
    font-weight: 700;
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
}
.portal-hero h1 {
    margin: 0;
    color: #fff;
    font-family: inherit;
    font-size: clamp(38px, 5vw, 70px);
    font-weight: 800;
    letter-spacing: -.045em;
    line-height: 1.1;
    text-shadow: 0 3px 22px rgba(0, 0, 0, .35);
}
.portal-subtitle {
    margin: 16px 0 0;
    color: rgba(243, 255, 251, .84);
    font-size: clamp(16px, 1.5vw, 20px);
    line-height: 1.6;
}

.portal-grid {
    display: grid;
    width: min(1180px, 91%);
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 18px 20px;
    margin: 0 auto;
    padding: 24px 0 58px;
}
.portal-card {
    display: flex;
    min-height: 190px;
    align-items: flex-start;
    gap: 18px;
    padding: 24px;
    border: 1px solid rgba(228, 255, 247, .25);
    border-radius: 17px;
    background: rgba(226, 255, 247, .12);
    box-shadow: 0 12px 34px rgba(0, 0, 0, .18);
    color: #fff;
    text-align: left;
    cursor: pointer;
    backdrop-filter: blur(18px);
    -webkit-backdrop-filter: blur(18px);
    transition: transform 160ms ease, background 160ms ease;
}
.portal-card:hover {
    transform: translateY(-3px);
    border-color: rgba(255, 255, 255, .48);
    background: rgba(226, 255, 247, .2);
}
.portal-card-icon {
    display: grid;
    width: 50px;
    height: 50px;
    flex: 0 0 50px;
    place-items: center;
    border: 1px solid rgba(255, 255, 255, .28);
    border-radius: 14px;
    background: rgba(255, 255, 255, .14);
    color: #b8ffe9;
}
.portal-card-affected .portal-card-icon { color: #9fc5ff; }
.portal-card-volunteer .portal-card-icon { color: #69f0c0; }
.portal-card-coordination .portal-card-icon { color: #ffb0aa; }
.portal-card-dashboard .portal-card-icon { color: #a9c5ff; }
.portal-card-icon svg {
    width: 26px;
    height: 26px;
    fill: none;
    stroke: currentColor;
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-width: 1.9;
}
.portal-card-content {
    display: flex;
    min-width: 0;
    flex: 1;
    flex-direction: column;
    gap: 10px;
}
.portal-card-title {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 9px 12px;
}
.portal-card-title strong { color: #fff; font-size: 21px; }
.portal-card-description {
    color: rgba(244, 255, 251, .84);
    font-size: 15px;
    line-height: 1.55;
}
.portal-card-action {
    margin-top: 4px;
    color: #8df1d1;
    font-weight: 800;
}
.portal-card-affected .portal-card-action { color: #b6d3ff; }
.portal-card-volunteer .portal-card-action { color: #7af0c6; }
.portal-card-arrow {
    align-self: center;
    margin-left: auto;
    color: #fff;
    font-size: 22px;
}
.portal-badge {
    padding: 7px 12px;
    border: 1px solid rgba(255, 255, 255, .3);
    border-radius: 25px;
    background: rgba(255, 255, 255, .15);
    color: #fff;
    font-size: 11px;
    font-weight: 900;
    letter-spacing: .03em;
}

@media (max-width: 760px) {
    .portal-header { flex-wrap: wrap; padding: 13px 5%; }
    .portal-nav { display: none; }
    .portal-help-button {
        min-height: 43px;
        padding: 9px 12px;
        font-size: 12px;
    }
    .portal-hero { padding: 52px 18px 28px; }
    .portal-hero h1 { font-size: clamp(36px, 10vw, 54px); }
    .portal-grid {
        width: 91%;
        grid-template-columns: 1fr;
        padding-top: 18px;
    }
    .portal-card { min-height: 165px; padding: 19px; }
}
@media (prefers-reduced-motion: reduce) {
    .portal-page::before,
    .portal-page::after { animation: none; }
}
.sr-only { position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip:rect(0,0,0,0); white-space:nowrap; border:0; }
.portal-header-actions { display:flex; align-items:center; justify-content:flex-end; flex-wrap:wrap; gap:10px; }
.portal-user { display:flex; flex-direction:column; gap:3px; padding:0 10px; color:#fff; font-size:12px; }
.portal-user small { color:rgba(230,255,248,.7); font-size:10px; }
.portal-language, .portal-notifications, .portal-signout {
    min-height:42px; padding:9px 12px; border:1px solid rgba(255,255,255,.24); border-radius:9px;
    background:rgba(255,255,255,.1); color:#fff; font:700 12px 'DM Sans', sans-serif;
}
.portal-language { cursor:pointer; }
.portal-notifications, .portal-signout { cursor:pointer; }
.portal-notifications:hover, .portal-signout:hover, .portal-language:hover { background:rgba(255,255,255,.2); }
.portal-notice-count { display:inline-grid; min-width:20px; height:20px; place-items:center; margin-left:5px; border-radius:20px; background:#ff7474; color:#fff; font-size:10px; }
.portal-notice-panel { position:absolute; z-index:5; right:4.5%; top:82px; width:min(330px,90vw); padding:16px; border:1px solid rgba(255,255,255,.25); border-radius:13px; background:rgba(8,31,28,.95); color:white; box-shadow:0 14px 35px rgba(0,0,0,.3); }
.portal-notice-panel p { margin:8px 0 0; color:rgba(240,255,250,.8); font-size:13px; }
.portal-request-notices { display:grid; gap:9px; margin:12px 0 0; padding:0; list-style:none; }
.portal-request-notices li { padding:10px 11px; border:1px solid rgba(255,255,255,.14); border-radius:9px; background:rgba(255,255,255,.06); }
.portal-request-notices strong,.portal-request-notices span { display:block; }
.portal-request-notices strong { font-size:12px; }
.portal-request-notices span { margin-top:4px; color:rgba(240,255,250,.72); font-size:11px; line-height:1.4; }
.portal-review-requests { width:100%; margin-top:11px; padding:9px 12px; border:1px solid rgba(83,224,185,.45); border-radius:8px; background:rgba(20,111,86,.45); color:#dffff5; font:700 12px 'DM Sans',sans-serif; cursor:pointer; }
.portal-emergency-alert { display:flex; align-items:center; gap:12px; width:min(1180px,91%); margin:18px auto 0; padding:13px 17px; border:1px solid rgba(255,157,125,.55); border-radius:12px; background:rgba(111,35,26,.62); color:#fff2ed; }
.portal-emergency-alert strong { color:#ffd0bc; }
.portal-help-note { display:flex; justify-content:center; flex-wrap:wrap; gap:8px; padding:0 20px 28px; color:rgba(240,255,250,.72); font-size:12px; text-align:center; }
.portal-help-note strong { color:#fff; }
.portal-emergency-alert span { font-size:13px; }
@media (max-width:760px) {
    .portal-header-actions { width:100%; justify-content:flex-start; }
    .portal-user { padding-left:0; }
    .portal-notice-panel { top:145px; right:5%; }
    .portal-emergency-alert { align-items:flex-start; flex-direction:column; gap:5px; }
}
`;

function PortalIcon({ name }) {
    if (name === 'person') {
        return (
            <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="7.5" r="3.5" />
                <path d="M5 20v-1.2a7 7 0 0 1 14 0V20H5Z" />
            </svg>
        );
    }

    if (name === 'heart') {
        return (
            <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M20.8 8.8c0-4-4.7-5.8-8.8-1.7-4.1-4.1-8.8-2.3-8.8 1.7 0 2.8 4 6 8.8 10.5 4.8-4.5 8.8-7.7 8.8-10.5Z" />
            </svg>
        );
    }

    if (name === 'alert') {
        return (
            <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M10.3 4.8a2 2 0 0 1 3.4 0l7.6 13A2 2 0 0 1 19.6 21H4.4a2 2 0 0 1-1.7-3.2l7.6-13Z" />
                <path d="M12 9v4m0 3.5h.01" />
            </svg>
        );
    }

    return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="3" y="3" width="7" height="7" rx="1.5" />
            <rect x="14" y="3" width="7" height="7" rx="1.5" />
            <rect x="3" y="14" width="7" height="7" rx="1.5" />
            <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </svg>
    );
}

const portalCopy = {
    en: {
        home: 'Home', portals: 'Response Portals', help: 'Help', helpText: 'For account or access support, contact your organization coordinator.',
        welcome: 'Welcome', heading: 'Select Your Response Portal',
        subtitle: 'Choose how you would like to interact with the humanitarian network.',
        language: 'Language', notifications: 'Notifications', signOut: 'Log out',
        activeEmergency: 'ACTIVE EMERGENCY', pending: 'pending assistance request(s)',
        noNotices: 'No pending assistance requests.',
        cards: {
            affected: ['Affected Person', 'Request emergency aid, medical assistance, shelter, or report critical situations in your area.', 'Request Assistance'],
            volunteer: ['Volunteer', 'Join active relief missions, distribute supplies, and support communities on the ground.', 'Join Field Operations'],
            coordination: ['Emergency Coordination', 'Access crisis response alerts, dispatch rescue teams, and manage live emergency operations.', 'Open Command Center'],
            dashboard: ['Main Management Dashboard', 'Access resource allocation, shelters, volunteers, and complete organizational statistics.', 'Open Workspace']
        }
    },
    si: {
        home: 'මුල් පිටුව', portals: 'ප්‍රතිචාර ද්වාර', help: 'උදව්', helpText: 'ගිණුමට හෝ ප්‍රවේශයට සහාය සඳහා ඔබේ ආයතන සම්බන්ධීකාරක අමතන්න.',
        welcome: 'ආයුබෝවන්', heading: 'ඔබගේ ප්‍රතිචාර ද්වාරය තෝරන්න',
        subtitle: 'මානුෂීය සහන ජාලය සමඟ සම්බන්ධ වීමට අවශ්‍ය ආකාරය තෝරන්න.',
        language: 'භාෂාව', notifications: 'දැනුම්දීම්', signOut: 'ඉවත් වන්න',
        activeEmergency: 'ක්‍රියාත්මක හදිසි තත්ත්වයක්', pending: 'ඉල්ලීම් තවමත් විසඳා නැත',
        noNotices: 'අලුත් ආධාර ඉල්ලීම් නැත.',
        cards: {
            affected: ['පීඩාවට පත් පුද්ගලයා', 'හදිසි ආධාර, වෛද්‍ය සහාය හෝ නවාතැන් ඉල්ලන්න. ඔබේ ප්‍රදේශයේ තත්ත්වයක් වාර්තා කරන්න.', 'ආධාර ඉල්ලන්න'],
            volunteer: ['ස්වේච්ඡා සේවක', 'සහන මෙහෙයුම්වලට එක්වී සැපයුම් බෙදාහැරීමට සහ ප්‍රජාවන්ට සහාය වන්න.', 'ක්ෂේත්‍ර මෙහෙයුම්වලට එක්වන්න'],
            coordination: ['හදිසි සම්බන්ධීකරණය', 'හදිසි අනතුරු ඇඟවීම් පරීක්ෂා කර, ගලවාගැනීමේ කණ්ඩායම් යොදවා, මෙහෙයුම් කළමනාකරණය කරන්න.', 'මෙහෙයුම් මධ්‍යස්ථානය විවෘත කරන්න'],
            dashboard: ['ප්‍රධාන කළමනාකරණ පුවරුව', 'සම්පත්, නවාතැන්, ස්වේච්ඡා සේවකයන් සහ ආයතනික දත්ත කළමනාකරණය කරන්න.', 'කාර්ය අවකාශය විවෘත කරන්න']
        }
    }
};

export default function SelectRole({
    onSelectRole,
    session,
    allowedPortalIds,
    notifications = 0,
    pendingRequests = [],
    onOpenRequests,
    activeIncidents = [],
    onSignOut
}) {
    const [language, setLanguage] = useState('en');
    const [showNotifications, setShowNotifications] = useState(false);
    const copy = portalCopy[language];
    const visiblePortals = useMemo(() => {
        // Public and Viewer accounts can open the management dashboard in read-only mode.
        // Keep this fallback here as well as in App.jsx so the portal remains visible
        // even if an older caller passes an incomplete allow-list.
        const isPublicUser = !['Admin', 'Coordinator'].includes(session?.role);
        const permittedIds = Array.isArray(allowedPortalIds) && allowedPortalIds.length > 0
            ? [...allowedPortalIds]
            : portals.map((portal) => portal.id);

        if (isPublicUser && !permittedIds.includes('dashboard')) {
            permittedIds.push('dashboard');
        }

        return portals.filter((portal) => permittedIds.includes(portal.id));
    }, [allowedPortalIds, session?.role]);

    const displayName = session?.name || session?.email || 'User';
    const displayRole = Array.isArray(session?.roles) && session.roles.length > 1
        ? session.roles.join(' · ')
        : session?.role || 'User';
    const currentIncident = activeIncidents[0];
    const requestCount = notifications || pendingRequests.length;

    return (
        <>
            <style>{styles}</style>
            <main className="portal-page">
                <header className="portal-header">
                    <a className="portal-brand" href="#portal-home" aria-label="HUMANAID home">
                        <span className="portal-logo">H</span>
                        <span>
                            <strong>HUMANAID</strong>
                            <small>CRISIS RESPONSE PLATFORM</small>
                        </span>
                    </a>

                    <nav className="portal-nav" aria-label="Main navigation">
                        <a href="#portal-home">{copy.home}</a>
                        <a href="#portals">{copy.portals}</a>
                    </nav>

                    <div className="portal-header-actions">
                        <label className="sr-only" htmlFor="portal-language">{copy.language}</label>
                        <select
                            id="portal-language"
                            className="portal-language"
                            value={language}
                            onChange={(event) => setLanguage(event.target.value)}
                            aria-label={copy.language}
                        >
                            <option value="en">EN</option>
                            <option value="si">සිංහල</option>
                        </select>
                        <a className="portal-help-button" href="#portal-help">{copy.help}</a>
                        <button
                            className="portal-notifications"
                            type="button"
                            aria-expanded={showNotifications}
                            onClick={() => setShowNotifications((shown) => !shown)}
                        >
                            ♧ {copy.notifications}
                            {requestCount > 0 && <span className="portal-notice-count">{requestCount}</span>}
                        </button>
                        <span className="portal-user">
                            <strong>{displayName}</strong>
                            <small>{displayRole}</small>
                        </span>
                        <button className="portal-signout" type="button" onClick={onSignOut}>
                            {copy.signOut}
                        </button>
                    </div>
                </header>

                {showNotifications && (
                    <aside className="portal-notice-panel" aria-live="polite">
                        <strong>{copy.notifications}</strong>
                        <p>{requestCount > 0 ? `${requestCount} ${copy.pending}` : copy.noNotices}</p>
                        {pendingRequests.length > 0 && <>
                            <ul className="portal-request-notices">
                                {pendingRequests.slice(0, 5).map(request => (
                                    <li key={request.id}>
                                        <strong>Request #{request.id} · {request.category || 'General'}</strong>
                                        <span>{request.requester || request.requesterName || 'Public requester'} · {request.location || 'Location not provided'}</span>
                                    </li>
                                ))}
                            </ul>
                            {onOpenRequests && <button type="button" className="portal-review-requests" onClick={onOpenRequests}>Review requests in Emergency Coordination →</button>}
                        </>}
                    </aside>
                )}

                {currentIncident && (
                    <section className="portal-emergency-alert" role="alert">
                        <strong>⚠ {copy.activeEmergency}</strong>
                        <span>
                            {currentIncident.title || currentIncident.name || 'Emergency response in progress'}
                            {currentIncident.location ? ` · ${currentIncident.location}` : ''}
                            {currentIncident.severity ? ` · ${currentIncident.severity}` : ''}
                        </span>
                    </section>
                )}

                <section className="portal-hero" id="portal-home">
                    <p className="portal-welcome">{copy.welcome}, {displayName}</p>
                    <h1>{copy.heading}</h1>
                    <p className="portal-subtitle">{copy.subtitle}</p>
                </section>

                <section className="portal-grid" id="portals" aria-label={copy.portals}>
                    {visiblePortals.map((portal) => {
                        const [title, description, action] = copy.cards[portal.id];
                        return (
                            <button
                                key={portal.id}
                                className={'portal-card portal-card-' + portal.style}
                                type="button"
                                onClick={() => onSelectRole(portal.id)}
                            >
                                <span className="portal-card-icon"><PortalIcon name={portal.icon} /></span>
                                <span className="portal-card-content">
                                    <span className="portal-card-title">
                                        <strong>{title}</strong>
                                        {portal.badge && <span className="portal-badge">{portal.badge}</span>}
                                    </span>
                                    <span className="portal-card-description">{description}</span>
                                    <span className="portal-card-action">{action} →</span>
                                </span>
                                <span className="portal-card-arrow" aria-hidden="true">→</span>
                            </button>
                        );
                    })}
                </section>

                <footer id="portal-help" className="portal-help-note">
                    <strong>{copy.help}</strong>
                    <span>{copy.helpText}</span>
                </footer>
            </main>
        </>
    );
}
