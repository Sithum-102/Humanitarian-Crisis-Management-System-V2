export default function PortalRoleSelector({ selectedRole, onSelectRole }) {
    return (
        <div style={{ margin: '14px 0 16px' }}>
            <div
                role="tablist"
                aria-label="Choose your access type"
                style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    background: '#f1f5f9',
                    padding: 4,
                    borderRadius: 10,
                    border: '1px solid #cbd5e1',
                    gap: 4,
                }}
            >
                <button
                    type="button"
                    onClick={() => onSelectRole('public')}
                    style={{
                        padding: '10px 12px',
                        borderRadius: 7,
                        fontWeight: 600,
                        fontSize: 13,
                        cursor: 'pointer',
                        border: selectedRole === 'public' ? '1.5px solid #0f172a' : '1.5px solid transparent',
                        background: selectedRole === 'public' ? '#ffffff' : 'transparent',
                        color: selectedRole === 'public' ? '#0f172a' : '#64748b',
                        boxShadow: selectedRole === 'public' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                        transition: 'all 0.15s ease',
                    }}
                >
                    Public access
                </button>

                <button
                    type="button"
                    onClick={() => onSelectRole('authorized')}
                    style={{
                        padding: '10px 12px',
                        borderRadius: 7,
                        fontWeight: 600,
                        fontSize: 13,
                        cursor: 'pointer',
                        border: selectedRole === 'authorized' ? '1.5px solid #0f172a' : '1.5px solid transparent',
                        background: selectedRole === 'authorized' ? '#ffffff' : 'transparent',
                        color: selectedRole === 'authorized' ? '#0f172a' : '#64748b',
                        boxShadow: selectedRole === 'authorized' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                        transition: 'all 0.15s ease',
                    }}
                >
                    Authorized officer
                </button>
            </div>

            <p style={{ fontSize: 11.5, color: '#64748b', marginTop: 8, lineHeight: 1.4 }}>
                {selectedRole === 'public'
                    ? 'Access public portals including Affected Person, Volunteer, and field services.'
                    : 'Direct access to the Command Center Dashboard for authorized personnel.'}
            </p>
        </div>
    );
}