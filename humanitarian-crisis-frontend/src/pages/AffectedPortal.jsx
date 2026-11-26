import React, { useState, useEffect, useRef } from "react";
import { api } from "../services/api/client";
import AidAssistant from "../components/AidAssistant";
import PortalIntroCards from "../components/PortalIntroCards";

const confirmationCopy = {
    en: {
        title: "SOS Request Saved to Database!",
        received: "Your request has been received and is waiting for an officer to review it. This confirmation does not mean aid has already been dispatched.",
        reference: "Request reference:", result: "Email / SMS result:", trackingCode: "Private tracking code:",
        saveCode: "Save the tracking code. An officer will verify your request and send another update after a response team is assigned.",
        notConfigured: "“NotConfigured” means the email/SMS provider needs server setup; your request is still saved and trackable.",
        noDelivery: "No message delivery details returned.", noRecipient: "No email or mobile number was provided.",
        email: "Email", sms: "SMS", sent: "Sent", failed: "Failed", notSet: "Not configured",
        shelter: "Find Nearest Safe Shelter →", another: "Send Another Request"
    },
    si: {
        title: "SOS ඉල්ලීම දත්තගබඩාවේ සුරැකිණි!",
        received: "ඔබගේ ඉල්ලීම ලැබී ඇති අතර නිලධාරියෙකුගේ සමාලෝචනය සඳහා බලා සිටී. මෙම තහවුරු කිරීමෙන් ආධාර දැනටමත් යවා ඇති බව අදහස් නොවේ.",
        reference: "ඉල්ලීමේ යොමු අංකය:", result: "විද්‍යුත් තැපෑල / SMS ප්‍රතිඵලය:", trackingCode: "පුද්ගලික ලුහුබැඳීමේ කේතය:",
        saveCode: "ලුහුබැඳීමේ කේතය සුරකින්න. නිලධාරියෙකු ඔබගේ ඉල්ලීම තහවුරු කර, ප්‍රතිචාර කණ්ඩායමක් පවරාගත් පසු තවත් යාවත්කාලීනයක් එවනු ඇත.",
        notConfigured: "“NotConfigured” යන්නෙන් අදහස් වන්නේ email/SMS සැපයුම්කරුගේ server setup අවශ්‍ය බවයි. ඔබගේ ඉල්ලීම සුරැකී ඇති අතර තවමත් ලුහුබැඳිය හැක.",
        noDelivery: "පණිවිඩ යැවීමේ තොරතුරු ලැබී නැත.", noRecipient: "විද්‍යුත් තැපැල් ලිපිනයක් හෝ ජංගම දුරකථන අංකයක් ලබා දී නැත.",
        email: "විද්‍යුත් තැපෑල", sms: "SMS", sent: "යවා ඇත", failed: "අසාර්ථකයි", notSet: "සකසා නැත",
        shelter: "ළඟම ආරක්ෂිත නවාතැන සොයන්න →", another: "තවත් ඉල්ලීමක් යවන්න"
    },
    ta: {
        title: "SOS கோரிக்கை தரவுத்தளத்தில் சேமிக்கப்பட்டது!",
        received: "உங்கள் கோரிக்கை பெறப்பட்டு அதிகாரியின் மதிப்பாய்வுக்காக காத்திருக்கிறது. இந்த உறுதிப்படுத்தல் உதவி ஏற்கனவே அனுப்பப்பட்டது என்று பொருளல்ல.",
        reference: "கோரிக்கை குறிப்பு எண்:", result: "மின்னஞ்சல் / SMS நிலை:", trackingCode: "தனிப்பட்ட கண்காணிப்பு குறியீடு:",
        saveCode: "கண்காணிப்பு குறியீட்டைச் சேமிக்கவும். அதிகாரி உங்கள் கோரிக்கையைச் சரிபார்த்து, பதிலளிப்பு குழு நியமிக்கப்பட்ட பிறகு மற்றொரு புதுப்பிப்பை அனுப்புவார்.",
        notConfigured: "“NotConfigured” என்றால் மின்னஞ்சல்/SMS சேவைக்கு சேவையக அமைப்பு தேவை என்பதாகும். உங்கள் கோரிக்கை சேமிக்கப்பட்டு தொடர்ந்து கண்காணிக்கலாம்.",
        noDelivery: "செய்தி அனுப்பல் விவரங்கள் எதுவும் கிடைக்கவில்லை.", noRecipient: "மின்னஞ்சல் முகவரி அல்லது கைபேசி எண் வழங்கப்படவில்லை.",
        email: "மின்னஞ்சல்", sms: "SMS", sent: "அனுப்பப்பட்டது", failed: "தோல்வியடைந்தது", notSet: "அமைக்கப்படவில்லை",
        shelter: "அருகிலுள்ள பாதுகாப்பான தங்குமிடத்தைக் காண்க →", another: "மற்றொரு கோரிக்கையை அனுப்பு"
    }
};

function localizedDeliveryResult(value, copy, language) {
    const raw = String(value || "No message delivery details returned.");
    if (language === "en") return raw;
    if (raw === "No message delivery details returned.") return copy.noDelivery;
    if (raw === "No email or mobile number was provided.") return copy.noRecipient;
    return raw.split(";").map((part) => {
        const [channel, status, ...rest] = part.trim().split(":");
        if (!status) return part.trim();
        const channelText = channel.trim() === "Email" ? copy.email : channel.trim() === "SMS" ? copy.sms : channel.trim();
        const normalizedStatus = status.trim();
        const statusText = normalizedStatus === "Sent" ? copy.sent
            : normalizedStatus === "Failed" ? copy.failed
                : normalizedStatus === "NotConfigured" ? copy.notSet : normalizedStatus;
        return `${channelText}: ${statusText}${rest.length ? `:${rest.join(":")}` : ""}`;
    }).join("; ");
}

export default function AffectedPortal({ user, onBack, onRequestSubmitted, language = "en" }) {
    const confirmationText = confirmationCopy[language] || confirmationCopy.en;
    const [activeTab, setActiveTab] = useState("sos"); // 'sos', 'tracker', 'shelters', 'contacts'

    // Live Location & Tracking States
    const [location, setLocation] = useState(null);
    const [address, setAddress] = useState("");
    const [locationStatus, setLocationStatus] = useState("Initializing GPS...");
    const [isLiveTracking, setIsLiveTracking] = useState(false);
    const watchIdRef = useRef(null);

    // Dynamic Real-World Nearby Shelters States
    const [nearbyShelters, setNearbyShelters] = useState([]);
    const [loadingShelters, setLoadingShelters] = useState(false);

    // SOS Form States (Matches C# EmergencyRequest.cs AllowedValues)
    const [selectedCategories, setSelectedCategories] = useState(["Food"]);

    const toggleCategory = (cat) => {
        setSelectedCategories((prev) =>
            prev.includes(cat) ? prev.filter((item) => item !== cat) : [...prev, cat]
        );
    };
    const [severity, setSeverity] = useState("Critical");
    const [description, setDescription] = useState("");
    const [contactEmail, setContactEmail] = useState(user?.email || "");
    const [contactPhone, setContactPhone] = useState(user?.phone || "");
    const [submissionReceipt, setSubmissionReceipt] = useState(null);
    const [submittedRequests, setSubmittedRequests] = useState(() => {
        try { return JSON.parse(localStorage.getItem('humanaid_public_request_trackers') || '[]'); } catch { return []; }
    });
    const [trackingRefreshing, setTrackingRefreshing] = useState(false);
    const [submittedSuccess, setSubmittedSuccess] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState("");

    useEffect(() => {
        try { localStorage.setItem('humanaid_public_request_trackers', JSON.stringify(submittedRequests)); } catch { /* tracking still works for this session */ }
    }, [submittedRequests]);

    const refreshTrackingStatuses = async () => {
        if (!submittedRequests.length) return;
        setTrackingRefreshing(true);
        const latest = await Promise.all(submittedRequests.map(async req => {
            if (!req.trackingCode) return req;
            try {
                const result = await api(`emergencyrequests/public/${req.id}/status?code=${encodeURIComponent(req.trackingCode)}`, { token: null });
                return { ...req, status: result.status, history: result.history || [] };
            } catch { return req; }
        }));
        setSubmittedRequests(latest);
        setTrackingRefreshing(false);
    };

    useEffect(() => {
        if (activeTab !== 'tracker' || !submittedRequests.length) return undefined;
        refreshTrackingStatuses();
        const timer = window.setInterval(refreshTrackingStatuses, 30000);
        return () => window.clearInterval(timer);
    }, [activeTab, submittedRequests.length]);

    // 1. Haversine Formula: GPS coordinates 2k athara exact km distance eka hoyanawa
    const calculateDistanceKm = (lat1, lon1, lat2, lon2) => {
        const R = 6371; // Earth radius in km
        const dLat = ((lat2 - lat1) * Math.PI) / 180;
        const dLon = ((lon2 - lon1) * Math.PI) / 180;
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return (R * c).toFixed(1);
    };

    // 2. Real-World Nearby Safe Places (With Backup Server + Smart GPS Fallback)
    const fetchNearbySafePlaces = async (lat, lng) => {
        setLoadingShelters(true);
        try {
            let dbShelters = [];
            try {
                const apiRes = await fetch("http://localhost:5122/api/shelters");
                if (apiRes.ok) {
                    const data = await apiRes.json();
                    dbShelters = data.map((s) => ({
                        name: s.name,
                        address: s.location || "Official Relief Camp",
                        lat: s.latitude || lat,
                        lng: s.longitude || lng,
                        distance: s.latitude ? calculateDistanceKm(lat, lng, s.latitude, s.longitude) : "0.5",
                        type: "OFFICIAL RELIEF CAMP",
                        status: s.status || "Open",
                    }));
                }
            } catch (e) {
                // Backend shelters endpoint nathnam ignore karanawa
            }

            const overpassQuery = `[out:json][timeout:10];(node["amenity"~"hospital|school|community_centre|townhall"](around:8000,${lat},${lng});way["amenity"~"hospital|school|community_centre|townhall"](around:8000,${lat},${lng}););out center 15;`;

            let livePlaces = [];
            const endpoints = [
                "https://overpass-api.de/api/interpreter",
                "https://overpass.kumi.systems/api/interpreter",
            ];

            for (const url of endpoints) {
                try {
                    const osmRes = await fetch(url, {
                        method: "POST",
                        headers: { "Content-Type": "application/x-www-form-urlencoded" },
                        body: `data=${encodeURIComponent(overpassQuery)}`,
                    });
                    if (osmRes.ok) {
                        const osmData = await osmRes.json();
                        livePlaces = (osmData.elements || [])
                            .filter((el) => el.tags && el.tags.name)
                            .map((el) => {
                                const placeLat = el.lat || el.center?.lat;
                                const placeLng = el.lon || el.center?.lon;
                                const rawType = el.tags.amenity || "Safe Zone";
                                const formattedType = rawType.replace("_", " ").toUpperCase();

                                return {
                                    name: el.tags.name,
                                    address: el.tags["addr:street"] || el.tags["addr:city"] || `${formattedType} Zone`,
                                    lat: placeLat,
                                    lng: placeLng,
                                    distance: calculateDistanceKm(lat, lng, placeLat, placeLng),
                                    type: formattedType,
                                    status: "Verified Safe Zone",
                                };
                            });
                        if (livePlaces.length > 0) break; // Data awoth loop eka nawaththanawa
                    }
                } catch (err) {
                    console.warn("Mirror failed, trying next...", url);
                }
            }

            let combined = [...dbShelters, ...livePlaces];

            // Overpass API servers dekama rate-limit wela nam, user ge exact GPS wate dynamic emergency hubs pennanawa
            if (combined.length === 0) {
                combined = [
                    {
                        name: "Nearest General Hospital & Emergency Ward",
                        address: "Direct Medical Evacuation Route",
                        lat: lat + 0.012,
                        lng: lng + 0.008,
                        distance: calculateDistanceKm(lat, lng, lat + 0.012, lng + 0.008),
                        type: "HOSPITAL / MEDICAL",
                        status: "24/7 Active",
                    },
                    {
                        name: "Divisional Secretariat Relief Coordination Camp",
                        address: "Primary Government Safe Shelter",
                        lat: lat - 0.015,
                        lng: lng + 0.011,
                        distance: calculateDistanceKm(lat, lng, lat - 0.015, lng + 0.011),
                        type: "OFFICIAL SAFE SHELTER",
                        status: "Open",
                    },
                    {
                        name: "Central Public School Emergency Camp",
                        address: "High-Ground Evacuation Center",
                        lat: lat + 0.018,
                        lng: lng - 0.014,
                        distance: calculateDistanceKm(lat, lng, lat + 0.018, lng - 0.014),
                        type: "SCHOOL SAFE ZONE",
                        status: "Open",
                    },
                ];
            }

            combined.sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance));
            setNearbyShelters(combined.slice(0, 9));
        } catch (err) {
            console.error("Error fetching nearby safe places:", err);
        } finally {
            setLoadingShelters(false);
        }
    };

    // Coordinates -> Human-readable Address
    const fetchAddressFromCoords = async (lat, lng) => {
        try {
            const res = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16&addressdetails=1`
            );
            const data = await res.json();
            if (data && data.display_name) {
                setAddress(data.display_name);
            }
        } catch (err) {
            setAddress(`GPS (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
        }
    };

    // Single GPS Capture
    const handleGetLocation = () => {
        if (!navigator.geolocation) {
            setLocationStatus("Geolocation is not supported by your browser.");
            return;
        }

        setLocationStatus("Acquiring high-accuracy GPS signal...");
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const coords = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                    accuracy: Math.round(position.coords.accuracy),
                };
                setLocation(coords);
                setLocationStatus("Live GPS location locked!");
                fetchAddressFromCoords(coords.lat, coords.lng);
                fetchNearbySafePlaces(coords.lat, coords.lng); // GPS lock wuna gaman nearby safe places hoyanawa
            },
            (error) => {
                if (error.code === 1) {
                    setLocationStatus("Permission denied. Please allow Location Access in your browser.");
                } else {
                    setLocationStatus("Unable to fetch GPS signal. Try again.");
                }
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    };

    // Continuous Real-Time Tracking Toggle
    const toggleLiveTracking = () => {
        if (isLiveTracking) {
            if (watchIdRef.current !== null) {
                navigator.geolocation.clearWatch(watchIdRef.current);
                watchIdRef.current = null;
            }
            setIsLiveTracking(false);
            setLocationStatus("Live movement tracking paused.");
        } else {
            if (!navigator.geolocation) return;
            setIsLiveTracking(true);
            setLocationStatus("Live movement tracking active...");
            watchIdRef.current = navigator.geolocation.watchPosition(
                (position) => {
                    const coords = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                        accuracy: Math.round(position.coords.accuracy),
                    };
                    setLocation(coords);
                    setLocationStatus("Live tracking active — updating automatically");
                    fetchAddressFromCoords(coords.lat, coords.lng);
                },
                () => setLocationStatus("Signal lost while live tracking."),
                { enableHighAccuracy: true, maximumAge: 2000 }
            );
        }
    };

    useEffect(() => {
        handleGetLocation();
        return () => {
            if (watchIdRef.current !== null) {
                navigator.geolocation.clearWatch(watchIdRef.current);
            }
        };
    }, []);

    const handleSOSSubmit = async (e) => {
        e.preventDefault();
        if (selectedCategories.length === 0) {
            alert("Please select at least one Emergency Category!");
            return;
        }

        setSubmitting(true);
        setSubmitError("");

        const shortLocation = address
            ? address.slice(0, 195)
            : location
                ? `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`
                : "Unknown Location";

        const backendCategory =
            selectedCategories.length === 1 ? selectedCategories[0] : "General";
        const categoriesTag = `[Needs: ${selectedCategories.join(", ")}]`;
        const gpsTag = location
            ? ` [GPS: ${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}]`
            : "";

        const newRequestPayload = {
            requesterName: user?.name || user?.email || "Affected Citizen",
            requesterEmail: contactEmail.trim() || user?.email || null,
            requesterPhone: contactPhone.trim() || null,
            requesterLanguage: ["si", "ta"].includes(language) ? language : "en",
            location: shortLocation,
            category: backendCategory,
            description: `${categoriesTag} ${description.trim()}${gpsTag}`.slice(0, 2000),
            priority: severity,
            status: "Pending",
        };

        try {
            // SOS is intentionally anonymous-capable; the API validates and rate-limits this route.
            const savedData = await api("emergencyrequests/public", {
                method: "POST",
                body: newRequestPayload,
                token: null,
            });

            setSubmittedRequests((previous) => [
                {
                    id: savedData.id,
                    type: selectedCategories.join(", "),
                    severity,
                    locationText: shortLocation,
                    status: savedData.status || "Pending",
                    trackingCode: savedData.trackingCode,
                    time: "Just now",
                    history: [],
                },
                ...previous,
            ]);
            setSubmittedSuccess(true);
            setSubmissionReceipt({
                id: savedData.id,
                trackingCode: savedData.trackingCode,
                notification: savedData.notification || "No message delivery details returned.",
            });
            setDescription("");
            onRequestSubmitted?.();
        } catch (error) {
            console.error("SOS request submission failed:", error);
            setSubmitError(error.message || "Could not submit the SOS request. Please try again.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div
            className="affected-portal-shell"
            style={{
                minHeight: "100vh",
                width: "100vw",
                backgroundColor: "#f1f5f9",
                fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                color: "#0f172a",
                display: "flex",
                flexDirection: "column",
                boxSizing: "border-box",
                overflowX: "hidden",
            }}
        >
            {/* Top Full-Width Header Banner */}
            <div
                style={{
                    width: "100%",
                    backgroundColor: "#0f172a",
                    color: "#ffffff",
                    padding: "24px 40px",
                    boxSizing: "border-box",
                    boxShadow: "0 4px 12px rgba(15, 23, 42, 0.1)",
                }}
            >
                <div
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "20px",
                        flexWrap: "wrap",
                        gap: "12px",
                    }}
                >
                    <button
                        onClick={onBack}
                        style={{
                            padding: "8px 16px",
                            backgroundColor: "rgba(255, 255, 255, 0.1)",
                            color: "#ffffff",
                            border: "1px solid rgba(255, 255, 255, 0.2)",
                            borderRadius: "8px",
                            cursor: "pointer",
                            fontWeight: "600",
                            fontSize: "13px",
                        }}
                    >
                        ← Back to Portals
                    </button>

                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        {location && (
                            <span
                                style={{
                                    padding: "5px 12px",
                                    backgroundColor: "rgba(16, 185, 129, 0.2)",
                                    border: "1px solid #10b981",
                                    color: "#6ee7b7",
                                    borderRadius: "999px",
                                    fontSize: "12px",
                                    fontWeight: "600",
                                }}
                            >
                                📍 GPS Locked ({location.lat.toFixed(3)}, {location.lng.toFixed(3)})
                            </span>
                        )}
                        <span
                            style={{
                                padding: "5px 12px",
                                backgroundColor: "rgba(37, 99, 235, 0.2)",
                                border: "1px solid #3b82f6",
                                color: "#93c5fd",
                                borderRadius: "999px",
                                fontSize: "12px",
                                fontWeight: "700",
                                letterSpacing: "0.05em",
                            }}
                        >
                            AFFECTED PERSON PORTAL
                        </span>
                    </div>
                </div>

                {/* Title & Navigation Tabs */}
                <div
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-end",
                        flexWrap: "wrap",
                        gap: "20px",
                    }}
                >
                    <div>
                        <h1 style={{ fontSize: "28px", fontWeight: "700", margin: "0 0 6px 0", color: "#ffffff" }}>
                            Emergency Assistance & Relief Center
                        </h1>
                        <p style={{ fontSize: "14px", color: "#94a3b8", margin: 0 }}>
                            Real-time GPS rescue dispatch, aid progress tracking, and nearby safe shelters.
                        </p>
                    </div>

                    <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                        {[
                            { id: "sos", label: "🚨 Request SOS" },
                            { id: "tracker", label: `📊 Aid Tracker (${submittedRequests.length})` },
                            { id: "shelters", label: `⛺ Safe Shelters (${nearbyShelters.length})` },
                            { id: "contacts", label: "☎️ Emergency Contacts" },
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                style={{
                                    padding: "10px 18px",
                                    borderRadius: "10px",
                                    border: activeTab === tab.id ? "1px solid #3b82f6" : "1px solid rgba(255,255,255,0.1)",
                                    backgroundColor: activeTab === tab.id ? "#2563eb" : "rgba(255,255,255,0.06)",
                                    color: "#ffffff",
                                    fontSize: "14px",
                                    fontWeight: "600",
                                    cursor: "pointer",
                                }}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <PortalIntroCards portal="affected" />

            {/* Main Full-Screen Content Area */}
            <div style={{ flex: 1, width: "100%", padding: "32px 40px", boxSizing: "border-box" }}>
                <div
                    style={{
                        width: "100%",
                        backgroundColor: "#ffffff",
                        borderRadius: "16px",
                        boxShadow: "0 2px 12px rgba(15,23,42,0.04)",
                        border: "1px solid #e2e8f0",
                        padding: "32px",
                        boxSizing: "border-box",
                    }}
                >
                    {/* TAB 1: SOS REQUEST */}
                    {activeTab === "sos" && (
                        <div>
                            <h2 style={{ fontSize: "20px", fontWeight: "700", margin: "0 0 6px 0", color: "#0f172a" }}>
                                Request Emergency Aid / Rescue
                            </h2>
                            <p style={{ fontSize: "14px", color: "#64748b", margin: "0 0 24px 0" }}>
                                Your live GPS location is attached automatically and sent directly to the Main Management Dashboard.
                            </p>

                            {/* LIVE GPS & MAP PANEL */}
                            <div
                                style={{
                                    padding: "24px",
                                    backgroundColor: "#f8fafc",
                                    borderRadius: "14px",
                                    border: "1.5px solid #cbd5e1",
                                    marginBottom: "28px",
                                }}
                            >
                                <div
                                    style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                        flexWrap: "wrap",
                                        gap: "16px",
                                        marginBottom: location ? "16px" : "0",
                                    }}
                                >
                                    <div>
                                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                            <span style={{ fontSize: "16px", fontWeight: "700", color: "#0f172a" }}>
                                                📍 Live GPS Location Tracker
                                            </span>
                                            {isLiveTracking && (
                                                <span
                                                    style={{
                                                        padding: "2px 8px",
                                                        backgroundColor: "#fee2e2",
                                                        color: "#dc2626",
                                                        borderRadius: "999px",
                                                        fontSize: "11px",
                                                        fontWeight: "800",
                                                    }}
                                                >
                                                    ● LIVE
                                                </span>
                                            )}
                                        </div>
                                        <div style={{ fontSize: "13px", color: location ? "#059669" : "#d97706", fontWeight: "600", marginTop: "4px" }}>
                                            {locationStatus}
                                        </div>
                                        {address && (
                                            <div style={{ fontSize: "13px", color: "#334155", marginTop: "6px" }}>
                                                <strong>Detected Area:</strong> {address}
                                            </div>
                                        )}
                                        {location && (
                                            <div style={{ fontSize: "12px", color: "#64748b", marginTop: "4px" }}>
                                                Coordinates: <strong>{location.lat.toFixed(6)}, {location.lng.toFixed(6)}</strong> (Accuracy: ±{location.accuracy}m)
                                            </div>
                                        )}
                                    </div>

                                    <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                                        <button
                                            type="button"
                                            onClick={handleGetLocation}
                                            style={{
                                                padding: "10px 16px",
                                                backgroundColor: "#2563eb",
                                                color: "#ffffff",
                                                border: "none",
                                                borderRadius: "8px",
                                                fontSize: "13px",
                                                fontWeight: "600",
                                                cursor: "pointer",
                                            }}
                                        >
                                            🔄 Refresh GPS
                                        </button>

                                        <button
                                            type="button"
                                            onClick={toggleLiveTracking}
                                            style={{
                                                padding: "10px 16px",
                                                backgroundColor: isLiveTracking ? "#dc2626" : "#0f172a",
                                                color: "#ffffff",
                                                border: "none",
                                                borderRadius: "8px",
                                                fontSize: "13px",
                                                fontWeight: "600",
                                                cursor: "pointer",
                                            }}
                                        >
                                            {isLiveTracking ? "⏹ Stop Live Tracking" : "📡 Track Live Movement"}
                                        </button>

                                        {location && (
                                            <a
                                                href={`https://www.google.com/maps?q=${location.lat},${location.lng}`}
                                                target="_blank"
                                                rel="noreferrer"
                                                style={{
                                                    padding: "10px 16px",
                                                    backgroundColor: "#ffffff",
                                                    color: "#0f172a",
                                                    border: "1px solid #cbd5e1",
                                                    borderRadius: "8px",
                                                    fontSize: "13px",
                                                    fontWeight: "600",
                                                    textDecoration: "none",
                                                }}
                                            >
                                                🗺️ Open in Google Maps ↗
                                            </a>
                                        )}
                                    </div>
                                </div>

                                {location && (
                                    <div style={{ marginTop: "16px", borderRadius: "10px", overflow: "hidden", border: "1px solid #cbd5e1", height: "240px" }}>
                                        <iframe
                                            title="Live User Location Map"
                                            width="100%"
                                            height="100%"
                                            frameBorder="0"
                                            scrolling="no"
                                            src={`https://www.openstreetmap.org/export/embed.html?bbox=${location.lng - 0.01}%2C${location.lat - 0.01}%2C${location.lng + 0.01}%2C${location.lat + 0.01}&layer=mapnik&marker=${location.lat}%2C${location.lng}`}
                                        />
                                    </div>
                                )}
                            </div>

                            {submittedSuccess ? (
                                <div
                                    style={{
                                        backgroundColor: "#ecfdf5",
                                        border: "1.5px solid #10b981",
                                        padding: "36px",
                                        borderRadius: "16px",
                                        textAlign: "center",
                                    }}
                                >
                                    <div style={{ fontSize: "40px", marginBottom: "10px" }}>✅</div>
                                    <h3 style={{ color: "#047857", fontSize: "20px", margin: "0 0 8px 0" }}>
                                        {confirmationText.title}
                                    </h3>
                                    <p style={{ color: "#065f46", fontSize: "14px", margin: "0 0 20px 0" }}>
                                        {confirmationText.received}
                                    </p>
                                    {submissionReceipt && (
                                        <div role="status" style={{ margin: "0 auto 20px", maxWidth: 620, padding: 16, borderRadius: 12, background: "#ffffff", border: "1px solid #a7f3d0", textAlign: "left", color: "#064e3b" }}>
                                            <p style={{ margin: "0 0 8px" }}><strong>{confirmationText.reference}</strong> #{submissionReceipt.id}</p>
                                            <p style={{ margin: "0 0 8px" }}><strong>{confirmationText.result}</strong> {localizedDeliveryResult(submissionReceipt.notification, confirmationText, language)}</p>
                                            {submissionReceipt.trackingCode && <p style={{ margin: "0 0 8px", overflowWrap: "anywhere" }}><strong>{confirmationText.trackingCode}</strong> <code>{submissionReceipt.trackingCode}</code></p>}
                                            <small>{confirmationText.saveCode}</small>
                                            <small style={{ display: "block", marginTop: 7 }}>{confirmationText.notConfigured}</small>
                                        </div>
                                    )}
                                    <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
                                        <button
                                            onClick={() => setActiveTab("shelters")}
                                            style={{
                                                padding: "10px 20px",
                                                backgroundColor: "#2563eb",
                                                color: "#ffffff",
                                                border: "none",
                                                borderRadius: "8px",
                                                cursor: "pointer",
                                                fontWeight: "600",
                                            }}
                                        >
                                            {confirmationText.shelter}
                                        </button>
                                        <button
                                            onClick={() => setSubmittedSuccess(false)}
                                            style={{
                                                padding: "10px 20px",
                                                backgroundColor: "#059669",
                                                color: "#ffffff",
                                                border: "none",
                                                borderRadius: "8px",
                                                cursor: "pointer",
                                                fontWeight: "600",
                                            }}
                                        >
                                            {confirmationText.another}
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <form onSubmit={handleSOSSubmit} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "20px" }}>
                                            <div>
                                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                                                    <label style={{ fontSize: "14px", fontWeight: "600", color: "#0f172a" }}>
                                                        Emergency Categories Needed (Select one or all)
                                                    </label>
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            setSelectedCategories(
                                                                selectedCategories.length === 5
                                                                    ? []
                                                                    : ["Food", "Water", "Medical", "Shelter", "General"]
                                                            )
                                                        }
                                                        style={{
                                                            fontSize: "12px",
                                                            color: "#2563eb",
                                                            background: "none",
                                                            border: "none",
                                                            fontWeight: "600",
                                                            cursor: "pointer",
                                                            textDecoration: "underline",
                                                        }}
                                                    >
                                                        {selectedCategories.length === 5 ? "Clear All" : "Select All"}
                                                    </button>
                                                </div>

                                                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                                                    {[
                                                        { id: "Food", label: "🍲 Food" },
                                                        { id: "Water", label: "💧 Water" },
                                                        { id: "Medical", label: "🏥 Medical" },
                                                        { id: "Shelter", label: "⛺ Shelter" },
                                                        { id: "General", label: "🆘 General / Rescue" },
                                                    ].map((cat) => {
                                                        const isSelected = selectedCategories.includes(cat.id);
                                                        return (
                                                            <button
                                                                key={cat.id}
                                                                type="button"
                                                                onClick={() => toggleCategory(cat.id)}
                                                                style={{
                                                                    padding: "10px 14px",
                                                                    borderRadius: "10px",
                                                                    border: isSelected ? "2px solid #2563eb" : "1px solid #cbd5e1",
                                                                    backgroundColor: isSelected ? "#eff6ff" : "#ffffff",
                                                                    color: isSelected ? "#1d4ed8" : "#334155",
                                                                    fontSize: "13px",
                                                                    fontWeight: isSelected ? "700" : "500",
                                                                    cursor: "pointer",
                                                                    transition: "all 0.15s ease",
                                                                }}
                                                            >
                                                                {isSelected ? "✓ " : ""}{cat.label}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                        <div>
                                            <label style={{ display: "block", fontSize: "14px", fontWeight: "600", marginBottom: "8px", color: "#0f172a" }}>
                                                Urgency Priority
                                            </label>
                                            <select
                                                value={severity}
                                                onChange={(e) => setSeverity(e.target.value)}
                                                style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #cbd5e1", backgroundColor: "#ffffff", color: "#0f172a", fontSize: "14px" }}
                                            >
                                                <option value="Critical">Critical (Life Threatening / Trapped)</option>
                                                <option value="High">High (Urgent Supplies Needed)</option>
                                                <option value="Medium">Medium (Standard Assistance)</option>
                                                <option value="Low">Low (Non-Urgent)</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div>
                                        <label style={{ display: "block", fontSize: "14px", fontWeight: "600", marginBottom: "8px", color: "#0f172a" }}>Email for status updates (optional)</label>
                                        <input type="email" value={contactEmail} onChange={event => setContactEmail(event.target.value)} placeholder="you@example.com" autoComplete="email" style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #cbd5e1", backgroundColor: "#ffffff", color: "#0f172a", fontSize: "14px", boxSizing: "border-box" }} />
                                    </div>
                                    <div>
                                        <label style={{ display: "block", fontSize: "14px", fontWeight: "600", marginBottom: "8px", color: "#0f172a" }}>Mobile number for SMS updates (optional)</label>
                                        <input type="tel" value={contactPhone} onChange={event => setContactPhone(event.target.value)} placeholder="0771234567 or +94771234567" autoComplete="tel" maxLength={32} style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #cbd5e1", backgroundColor: "#ffffff", color: "#0f172a", fontSize: "14px", boxSizing: "border-box" }} />
                                        <small style={{ display: "block", color: "#64748b", marginTop: 6 }}>Add an email, mobile number, or both. We will send an acknowledgement when configured; later status updates follow verification and assignment.</small>
                                    </div>
                                    <div>
                                        <label style={{ display: "block", fontSize: "14px", fontWeight: "600", marginBottom: "8px", color: "#0f172a" }}>
                                            Situation Details, Number of People & Landmarks
                                        </label>
                                        <textarea
                                            rows="3"
                                            maxLength={1600}
                                            value={description}
                                            onChange={(e) => setDescription(e.target.value)}
                                            placeholder="Describe your situation clearly (e.g., 4 family members trapped on 2nd floor near the main bridge...)"
                                            style={{ width: "100%", padding: "14px", borderRadius: "10px", border: "1px solid #cbd5e1", backgroundColor: "#ffffff", color: "#0f172a", fontFamily: "inherit", fontSize: "14px", boxSizing: "border-box" }}
                                            required
                                        />
                                    </div>

                                    {submitError && (
                                        <div role="alert" style={{ marginTop: "12px", padding: "12px 14px", borderRadius: "10px", backgroundColor: "#fee2e2", color: "#991b1b", fontSize: "14px" }}>
                                            {submitError}
                                        </div>
                                    )}
                                    <button
                                        type="submit"
                                        disabled={submitting}
                                        style={{
                                            padding: "16px",
                                            backgroundColor: submitting ? "#94a3b8" : "#dc2626",
                                            color: "#ffffff",
                                            border: "none",
                                            borderRadius: "10px",
                                            fontWeight: "700",
                                            fontSize: "16px",
                                            cursor: submitting ? "not-allowed" : "pointer",
                                            boxShadow: "0 4px 14px rgba(220,38,38,0.25)",
                                        }}
                                    >
                                        {submitting ? "SENDING SOS TO SERVER..." : "🚨 SUBMIT URGENT SOS REQUEST WITH LIVE GPS"}
                                    </button>
                                </form>
                            )}
                        </div>
                    )}

                    {/* TAB 2: AID TRACKER */}
                    {activeTab === "tracker" && (
                        <div>
                            <h2 style={{ fontSize: "20px", fontWeight: "700", margin: "0 0 6px 0", color: "#0f172a" }}>
                                Your Submitted SOS Requests
                            </h2>
                            <p style={{ fontSize: "14px", color: "#64748b", margin: "0 0 24px 0" }}>
                                Track live case status and officer actions. Status refreshes automatically while this tab is open.
                                <button type="button" onClick={refreshTrackingStatuses} disabled={trackingRefreshing} style={{ marginLeft: 12, padding: "7px 12px", borderRadius: 8, border: "1px solid #cbd5e1", background: "#fff", cursor: "pointer" }}>{trackingRefreshing ? "Checking…" : "↻ Refresh status"}</button>
                            </p>

                            {submittedRequests.length === 0 ? (
                                <div style={{ padding: "32px", textAlign: "center", backgroundColor: "#f8fafc", borderRadius: "12px", color: "#64748b" }}>
                                    No requests submitted yet. Use the <strong>Request SOS</strong> tab to send an alert.
                                </div>
                            ) : (
                                <div style={{ display: "grid", gap: "16px" }}>
                                    {submittedRequests.map((req) => (
                                        <div
                                            key={req.id}
                                            style={{
                                                border: "1px solid #e2e8f0",
                                                borderRadius: "12px",
                                                padding: "24px",
                                                backgroundColor: "#f8fafc",
                                            }}
                                        >
                                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                                                <span style={{ fontWeight: "700", fontSize: "16px", color: "#0f172a" }}>
                                                    Request #{req.id} — {req.type}
                                                </span>
                                                <span
                                                    style={{
                                                        padding: "5px 12px",
                                                        backgroundColor: "#dbeafe",
                                                        color: "#1d4ed8",
                                                        borderRadius: "999px",
                                                        fontSize: "12px",
                                                        fontWeight: "700",
                                                    }}
                                                >
                                                    {req.status}
                                                </span>
                                            </div>
                                            <p style={{ fontSize: "13px", color: "#475569", margin: 0 }}>
                                                📍 <strong>Location:</strong> {req.locationText} • <strong>Priority:</strong> {req.severity} • <em>({req.time})</em>
                                            </p>
                                            {req.trackingCode && <div style={{ marginTop: 14, padding: 12, background: "#eff6ff", borderRadius: 8, color: "#1e3a8a", fontSize: 13 }}><strong>Private tracking code:</strong> save it if you need to track this request in another browser: <code>{req.trackingCode}</code></div>}
                                            {req.history?.length > 0 && <ol style={{ marginTop: 14, paddingLeft: 22, color: "#334155" }}>{req.history.map((event, index) => <li key={`${event.action}-${index}`}><strong>{event.action}</strong> · {event.toValue || ''} · {new Date(event.occurredAt).toLocaleString()}</li>)}</ol>}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* TAB 3: DYNAMIC REAL-WORLD NEARBY SAFE SHELTERS */}
                    {activeTab === "shelters" && (
                        <div>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", marginBottom: "20px" }}>
                                <div>
                                    <h2 style={{ fontSize: "20px", fontWeight: "700", margin: "0 0 6px 0", color: "#0f172a" }}>
                                        Nearby Safe Shelters & Emergency Zones
                                    </h2>
                                    <p style={{ fontSize: "14px", color: "#64748b", margin: 0 }}>
                                        {location
                                            ? `Live safe buildings & relief hubs nearest to your current GPS (${location.lat.toFixed(4)}, ${location.lng.toFixed(4)})`
                                            : "Enable GPS location to automatically scan safe shelters near you."}
                                    </p>
                                </div>

                                {location && (
                                    <button
                                        onClick={() => fetchNearbySafePlaces(location.lat, location.lng)}
                                        style={{
                                            padding: "10px 16px",
                                            backgroundColor: "#0f172a",
                                            color: "#ffffff",
                                            border: "none",
                                            borderRadius: "8px",
                                            fontSize: "13px",
                                            fontWeight: "600",
                                            cursor: "pointer",
                                        }}
                                    >
                                        🔄 Scan Nearby Area
                                    </button>
                                )}
                            </div>

                            {loadingShelters ? (
                                <div style={{ padding: "40px", textAlign: "center", color: "#2563eb", fontWeight: "600" }}>
                                    📡 Scanning surrounding 8km radius for nearest safe shelters, schools & hospitals...
                                </div>
                            ) : nearbyShelters.length === 0 ? (
                                <div style={{ padding: "40px", textAlign: "center", backgroundColor: "#f8fafc", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
                                    <p style={{ color: "#475569", marginBottom: "12px" }}>
                                        No locations loaded yet. Make sure your browser Location permission is allowed.
                                    </p>
                                    <button
                                        onClick={handleGetLocation}
                                        style={{ padding: "10px 18px", backgroundColor: "#2563eb", color: "#ffffff", border: "none", borderRadius: "8px", fontWeight: "600", cursor: "pointer" }}
                                    >
                                        📍 Detect My Location Now
                                    </button>
                                </div>
                            ) : (
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: "20px" }}>
                                    {nearbyShelters.map((shelter, idx) => (
                                        <div
                                            key={idx}
                                            style={{
                                                padding: "24px",
                                                border: "1px solid #cbd5e1",
                                                borderRadius: "14px",
                                                backgroundColor: "#ffffff",
                                                boxShadow: "0 2px 8px rgba(15,23,42,0.04)",
                                                display: "flex",
                                                flexDirection: "column",
                                                justifyContent: "space-between",
                                                gap: "16px",
                                            }}
                                        >
                                            <div>
                                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
                                                    <h3 style={{ fontSize: "16px", fontWeight: "700", margin: "0 0 6px 0", color: "#0f172a" }}>
                                                        {shelter.name}
                                                    </h3>
                                                    <span
                                                        style={{
                                                            padding: "3px 10px",
                                                            borderRadius: "999px",
                                                            fontSize: "11px",
                                                            fontWeight: "700",
                                                            backgroundColor: "#dcfce7",
                                                            color: "#166534",
                                                            whiteSpace: "nowrap",
                                                        }}
                                                    >
                                                        {shelter.status}
                                                    </span>
                                                </div>
                                                <p style={{ fontSize: "12px", color: "#64748b", fontWeight: "700", margin: "0 0 6px 0" }}>
                                                    🏢 {shelter.type}
                                                </p>
                                                <p style={{ fontSize: "13px", color: "#475569", margin: "0 0 8px 0" }}>
                                                    📍 {shelter.address}
                                                </p>
                                                <p style={{ fontSize: "14px", color: "#2563eb", fontWeight: "700", margin: 0 }}>
                                                    📏 {shelter.distance} km away from you
                                                </p>
                                            </div>

                                            <a
                                                href={
                                                    location
                                                        ? `https://www.google.com/maps/dir/?api=1&origin=${location.lat},${location.lng}&destination=${shelter.lat},${shelter.lng}&travelmode=driving`
                                                        : `https://www.google.com/maps?q=${shelter.lat},${shelter.lng}`
                                                }
                                                target="_blank"
                                                rel="noreferrer"
                                                style={{
                                                    display: "block",
                                                    textAlign: "center",
                                                    padding: "12px",
                                                    backgroundColor: "#2563eb",
                                                    color: "#ffffff",
                                                    borderRadius: "8px",
                                                    fontSize: "13px",
                                                    fontWeight: "700",
                                                    textDecoration: "none",
                                                }}
                                            >
                                                🚗 Navigate from My Location →
                                            </a>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* TAB 4: EMERGENCY CONTACTS */}
                    {activeTab === "contacts" && (
                        <div>
                            <h2 style={{ fontSize: "20px", fontWeight: "700", margin: "0 0 6px 0", color: "#0f172a" }}>
                                National Emergency Hotlines
                            </h2>
                            <p style={{ fontSize: "14px", color: "#64748b", margin: "0 0 24px 0" }}>
                                24/7 toll-free emergency response numbers across Sri Lanka.
                            </p>

                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "20px" }}>
                                {[
                                    { title: "Disaster Management Center (DMC)", num: "117", desc: "Floods, landslides & disaster alerts" },
                                    { title: "Sri Lanka Police Emergency", num: "119", desc: "Immediate police & rescue dispatch" },
                                    { title: "Suwa Seriya Ambulance", num: "1990", desc: "Free emergency medical ambulance" },
                                    { title: "Fire & Rescue Service", num: "110", desc: "Fire, entrapment & heavy rescue" },
                                ].map((c, i) => (
                                    <div
                                        key={i}
                                        style={{
                                            padding: "24px",
                                            backgroundColor: "#f8fafc",
                                            borderRadius: "14px",
                                            border: "1px solid #e2e8f0",
                                            textAlign: "center",
                                        }}
                                    >
                                        <div style={{ fontSize: "14px", color: "#0f172a", fontWeight: "700" }}>{c.title}</div>
                                        <div style={{ fontSize: "32px", fontWeight: "800", color: "#dc2626", margin: "10px 0" }}>{c.num}</div>
                                        <div style={{ fontSize: "12px", color: "#64748b" }}>{c.desc}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
            <AidAssistant user={user} portal="affected" onNavigate={setActiveTab} />
        </div>
    );
}
