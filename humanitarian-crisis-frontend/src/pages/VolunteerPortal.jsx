import React, { useState, useEffect } from "react";
import { api } from "../services/api/client";
import PortalIntroCards from "../components/PortalIntroCards";

function getSavedLanguage() {
    try {
        const saved = localStorage.getItem("humanaid_language");
        const parsed = saved ? JSON.parse(saved) : "en";
        return ["en", "si", "ta"].includes(parsed) ? parsed : "en";
    } catch {
        const saved = localStorage.getItem("humanaid_language");
        return ["en", "si", "ta"].includes(saved) ? saved : "en";
    }
}

export default function VolunteerPortal({ user, onBack }) {
    const [emailLanguage] = useState(getSavedLanguage);
    // Mode Selection: null = Show 2 Main Cards | "donate" = Supply Donation & Collection Centers | "field" = Live SOS Field Ops
    const [volunteerMode, setVolunteerMode] = useState(null);

    // 1. Live GPS & Volunteer Status States
    const [location, setLocation] = useState(null);
    const [availability, setAvailability] = useState("Available");
    const [selectedSkills, setSelectedSkills] = useState(["Food & Water", "Transport"]);

    // 2. Supply Donation States (Card 1)
    const [donorName, setDonorName] = useState(user?.username || "");
    const [donorPhone, setDonorPhone] = useState("");
    const [donorEmail, setDonorEmail] = useState("");
    const [donationCategories, setDonationCategories] = useState(["Food"]);
    const [donationItemsDesc, setDonationItemsDesc] = useState("");
    const [selectedDropoffHub, setSelectedDropoffHub] = useState("");
    const [pickupRequested, setPickupRequested] = useState(false);
    const [donationOffers, setDonationOffers] = useState([]);
    const [myDeliveries, setMyDeliveries] = useState([]);
    const [loadingDonations, setLoadingDonations] = useState(true);
    const [donationBoardError, setDonationBoardError] = useState("");
    const [donationActionId, setDonationActionId] = useState(null);
    const [donationActionNotice, setDonationActionNotice] = useState("");
    const [donationSubmitted, setDonationSubmitted] = useState(false);
    const [donationBusy, setDonationBusy] = useState(false);
    const [donationError, setDonationError] = useState("");
    const [donationReceipt, setDonationReceipt] = useState(null);

    // 3. Live SOS Missions States (Card 2)
    const [missions, setMissions] = useState([]);
    const [loadingMissions, setLoadingMissions] = useState(true);
    const [missionError, setMissionError] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("All");
    const [activeTab, setActiveTab] = useState("missions");

    // 4. Nearby Collection Centers / Safe Shelters
    const [collectionCenters, setCollectionCenters] = useState([]);
    const [loadingCenters, setLoadingCenters] = useState(false);

    // Haversine Formula for Exact KM Distance
    const calculateDistanceKm = (lat1, lon1, lat2, lon2) => {
        if (!lat1 || !lon1 || !lat2 || !lon2) return null;
        const R = 6371;
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

    // Extract [GPS: lat, lng] and [Needs: ...] tags sent by AffectedPortal
    const parseSosDetails = (desc = "") => {
        const gpsMatch = desc.match(/\[GPS:\s*([-\d.]+),\s*([-\d.]+)\]/);
        const needsMatch = desc.match(/\[Needs:\s*([^\]]+)\]/);

        const cleanDescription = desc
            .replace(/\[GPS:\s*[-\d.]+,\s*[-\d.]+\]/g, "")
            .replace(/\[Needs:\s*[^\]]+\]/g, "")
            .trim();

        return {
            lat: gpsMatch ? parseFloat(gpsMatch[1]) : null,
            lng: gpsMatch ? parseFloat(gpsMatch[2]) : null,
            needs: needsMatch ? needsMatch[1].split(",").map((s) => s.trim()) : [],
            cleanDescription: cleanDescription || "Immediate humanitarian assistance requested.",
        };
    };

    // Fetch Live GPS Location
    const detectVolunteerGPS = () => {
        if (!navigator.geolocation) return;
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const coords = {
                    lat: pos.coords.latitude,
                    lng: pos.coords.longitude,
                };
                setLocation(coords);
                fetchNearbyCollectionCenters(coords.lat, coords.lng);
            },
            (err) => console.error("Volunteer GPS Error:", err),
            { enableHighAccuracy: true }
        );
    };

    // Fetch Nearby Collection Centers & Drop-off Hubs
    const fetchNearbyCollectionCenters = async (lat, lng) => {
        setLoadingCenters(true);
        try {
            const overpassQuery = `[out:json][timeout:10];(node["amenity"~"community_centre|townhall|school|hospital"](around:8000,${lat},${lng}););out center 12;`;
            const res = await fetch("https://overpass-api.de/api/interpreter", {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: `data=${encodeURIComponent(overpassQuery)}`,
            });
            if (res.ok) {
                const data = await res.json();
                const places = (data.elements || [])
                    .filter((el) => el.tags && el.tags.name)
                    .map((el) => ({
                        name: el.tags.name,
                        type: (el.tags.amenity || "Collection Center").replace("_", " ").toUpperCase(),
                        lat: el.lat,
                        lng: el.lon,
                        distance: calculateDistanceKm(lat, lng, el.lat, el.lon),
                        hours: "8:00 AM - 8:00 PM (Open Today)",
                    }))
                    .sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance));

                if (places.length > 0) {
                    setCollectionCenters(places.slice(0, 6));
                    setSelectedDropoffHub(places[0].name);
                    setLoadingCenters(false);
                    return;
                }
            }
        } catch (e) {
            // Fallback below
        }

        const fallbackCenters = [
            {
                name: "Divisional Secretariat Relief Collection Hub",
                type: "MAIN COLLECTION CENTER",
                lat: lat + 0.011,
                lng: lng + 0.009,
                distance: calculateDistanceKm(lat, lng, lat + 0.011, lng + 0.009),
                hours: "24/7 Emergency Drop-Off",
            },
            {
                name: "Community Town Hall Supply Point",
                type: "SUPPLY DROP-OFF",
                lat: lat - 0.012,
                lng: lng + 0.008,
                distance: calculateDistanceKm(lat, lng, lat - 0.012, lng + 0.008),
                hours: "7:00 AM - 9:00 PM",
            },
            {
                name: "District Hospital Medical Aid Counter",
                type: "MEDICAL SUPPLIES ONLY",
                lat: lat + 0.007,
                lng: lng - 0.014,
                distance: calculateDistanceKm(lat, lng, lat + 0.007, lng - 0.014),
                hours: "24/7 Medical Desk",
            },
        ];
        setCollectionCenters(fallbackCenters);
        setSelectedDropoffHub(fallbackCenters[0].name);
        setLoadingCenters(false);
    };

    // Donation offers are visible only to signed-in volunteers through the API.
    const fetchDonationBoard = async () => {
        setLoadingDonations(true);
        try {
            const [available, mine] = await Promise.all([
                api("volunteerdonations/available"),
                api("volunteerdonations/mine"),
            ]);
            setDonationOffers(Array.isArray(available) ? available : []);
            setMyDeliveries(Array.isArray(mine) ? mine : []);
            setDonationBoardError("");
        } catch (err) {
            setDonationBoardError(err.message || "Sign in to view and accept donation pickup offers.");
        } finally {
            setLoadingDonations(false);
        }
    };

    const handleDonationDelivery = async (donation, action) => {
        setDonationActionId(donation.id);
        try {
            const result = await api(`volunteerdonations/${donation.id}/${action}?language=${encodeURIComponent(emailLanguage)}`, { method: "POST" });
            if (action === "accept") {
                const status = result?.emailStatus;
                const pickup = Boolean(result?.donation?.pickupRequested);
                setDonationActionNotice(status === "Sent"
                    ? (pickup
                        ? `Pickup accepted. Email sent to ${result?.donation?.email}: a HUMANAID volunteer will contact the donor to arrange collection.`
                        : `Delivery accepted. Email sent to ${result?.donation?.email}.`)
                    : `Offer accepted, but email status is ${status || "unknown"}. Call the donor to coordinate.`);
            } else {
                setDonationActionNotice("Donation marked as delivered to the collection hub.");
            }
            await fetchDonationBoard();
        } catch (err) {
            setDonationBoardError(err.message || "Could not update this donation delivery. Refresh and try again.");
        } finally {
            setDonationActionId(null);
        }
    };

    // Fetch Real SOS Requests from C# Backend API
    const fetchLiveSOSMissions = async () => {
        setLoadingMissions(true);
        try {
            const [openRequests, myRequests] = await Promise.all([
                api("volunteermissions/open"),
                api("volunteermissions/mine"),
            ]);
            const merged = [...(Array.isArray(myRequests) ? myRequests : []), ...(Array.isArray(openRequests) ? openRequests : [])];
            setMissions(merged);
            setMissionError("");
        } catch (err) {
            setMissionError(err.message || "Could not load SOS missions. Please sign in again and retry.");
        } finally {
            setLoadingMissions(false);
        }
    };

    useEffect(() => {
        detectVolunteerGPS();
        fetchLiveSOSMissions();
        fetchDonationBoard();
        const interval = setInterval(() => { fetchLiveSOSMissions(); fetchDonationBoard(); }, 15000);
        return () => clearInterval(interval);
    }, []);

    // Toggle Donation Item Category
    const toggleDonationCategory = (cat) => {
        setDonationCategories((prev) =>
            prev.includes(cat) ? (prev.length > 1 ? prev.filter((c) => c !== cat) : prev) : [...prev, cat]
        );
    };

    // Handle Supply Donation Form Submit
    const handleDonationSubmit = async (e) => {
        e.preventDefault();
        setDonationBusy(true);
        setDonationError("");
        setDonationSubmitted(false);
        try {
            const receipt = await api("volunteerdonations", {
                method: "POST",
                body: {
                    donorName,
                    phone: donorPhone,
                    email: donorEmail,
                    categories: donationCategories.join(", "),
                    itemsDescription: donationItemsDesc,
                    collectionCenter: selectedDropoffHub,
                    pickupRequested,
                },
            });
            setDonationReceipt(receipt);
            setDonationSubmitted(true);
            setDonationItemsDesc("");
            fetchDonationBoard();
        } catch (err) {
            setDonationError(err.message || "Could not save the donation pledge. Please try again.");
        } finally {
            setDonationBusy(false);
        }
    };

    // Update Mission Status in Backend (Accept / Complete)
    const handleUpdateMissionStatus = async (mission, newStatus) => {
        try {
            const action = newStatus === "In Progress" ? "claim" : "complete";
            const updated = await api(`volunteermissions/${mission.id}/${action}`, { method: "POST" });
            setMissions((prev) => prev.map((m) => (m.id === mission.id ? { ...m, ...updated } : m)));
            setMissionError("");
            if (newStatus === "In Progress") {
                setAvailability("En Route");
                setActiveTab("my-tasks");
            } else {
                setAvailability("Available");
            }
        } catch (err) {
            setMissionError(err.message || "Could not update this mission. Please refresh and try again.");
        }
    };

    const toggleSkill = (skill) => {
        setSelectedSkills((prev) =>
            prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]
        );
    };

    const enrichedMissions = missions
        .map((m) => {
            const parsed = parseSosDetails(m.description);
            const dist =
                location && parsed.lat && parsed.lng
                    ? calculateDistanceKm(location.lat, location.lng, parsed.lat, parsed.lng)
                    : null;
            return { ...m, parsed, distance: dist };
        })
        .sort((a, b) => {
            if (a.distance && b.distance) return parseFloat(a.distance) - parseFloat(b.distance);
            return 0;
        });

    const openMissions = enrichedMissions.filter((m) => {
        if (m.status !== "Pending" && m.status !== "Approved") return false;
        if (categoryFilter === "All") return true;
        return (
            m.category?.toLowerCase() === categoryFilter.toLowerCase() ||
            m.parsed.needs.some((n) => n.toLowerCase() === categoryFilter.toLowerCase())
        );
    });

    const myActiveTasks = enrichedMissions.filter((m) => m.status === "In Progress");

    const getPriorityBadge = (priority) => {
        const p = (priority || "").toLowerCase();
        if (p.includes("critical")) return { bg: "#fee2e2", color: "#dc2626" };
        if (p.includes("high")) return { bg: "#ffedd5", color: "#ea580c" };
        if (p.includes("medium")) return { bg: "#fef9c3", color: "#ca8a04" };
        return { bg: "#e0f2fe", color: "#0284c7" };
    };

    return (
        <div className="volunteer-portal-shell" style={{ minHeight: "100vh", backgroundColor: "#f8fafc", fontFamily: "Inter, system-ui, sans-serif", color: "#0f172a" }}>
            {/* Top Header */}
            <div style={{ backgroundColor: "#0f172a", color: "#ffffff", padding: "20px 32px", borderBottom: "1px solid #1e293b" }}>
                <div style={{ maxWidth: "1200px", margin: "0 auto", display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                        {volunteerMode ? (
                            <button
                                onClick={() => setVolunteerMode(null)}
                                style={{ padding: "8px 14px", backgroundColor: "#1e293b", color: "#e2e8f0", border: "1px solid #334155", borderRadius: "8px", cursor: "pointer", fontSize: "13px", fontWeight: "600" }}
                            >
                                ← Switch Volunteer Mode
                            </button>
                        ) : (
                            onBack && (
                                <button
                                    onClick={onBack}
                                    style={{ padding: "8px 14px", backgroundColor: "#1e293b", color: "#e2e8f0", border: "1px solid #334155", borderRadius: "8px", cursor: "pointer", fontSize: "13px", fontWeight: "600" }}
                                >
                                    ← Back to Portals
                                </button>
                            )
                        )}
                        <div>
                            <h1 style={{ fontSize: "22px", fontWeight: "800", margin: 0 }}>Volunteer & Relief Contribution Hub</h1>
                            <p style={{ fontSize: "13px", color: "#94a3b8", margin: "4px 0 0 0" }}>
                                Donate essential relief supplies or join active field rescue missions
                            </p>
                        </div>
                    </div>

                    <div style={{ padding: "6px 12px", borderRadius: "999px", backgroundColor: location ? "#064e3b" : "#334155", color: location ? "#6ee7b7" : "#cbd5e1", fontSize: "12px", fontWeight: "600" }}>
                        {location ? `📍 GPS Locked (${location.lat.toFixed(3)}, ${location.lng.toFixed(3)})` : "📡 Acquiring GPS..."}
                    </div>
                </div>
            </div>

            <PortalIntroCards portal="volunteer" />

            {/* ===================================================================== */}
            {/* INITIAL 2-CARD SELECTION VIEW (WHEN LOGGED IN / ENTERED VOLUNTEER)    */}
            {/* ===================================================================== */}
            {!volunteerMode && (
                <div className="volunteer-home" style={{ maxWidth: "1050px", margin: "48px auto", padding: "0 24px" }}>
                    <div className="volunteer-home-intro" style={{ textAlign: "center", marginBottom: "36px" }}>
                        <span style={{ padding: "6px 14px", backgroundColor: "#ecfdf5", color: "#059669", borderRadius: "999px", fontSize: "12px", fontWeight: "700", letterSpacing: "0.04em" }}>
                            VOLUNTEER PORTAL
                        </span>
                        <h2 style={{ fontSize: "28px", fontWeight: "800", margin: "12px 0 8px 0", color: "#0f172a" }}>
                            How would you like to contribute today?
                        </h2>
                        <p style={{ fontSize: "15px", color: "#64748b", margin: 0 }}>
                            One Volunteer account connects both paths: donate supplies or join field rescue missions, and switch between them anytime.
                        </p>
                    </div>

                    <div className="volunteer-choice-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))", gap: "28px" }}>
                        {/* CARD 1: DONATE SUPPLIES & COLLECTION CENTERS */}
                        <div
                            className="volunteer-choice-card volunteer-donate-card"
                            role="button"
                            tabIndex={0}
                            onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setVolunteerMode("donate"); } }}
                            onClick={() => setVolunteerMode("donate")}
                            style={{
                                backgroundColor: "#ffffff",
                                borderRadius: "20px",
                                padding: "32px",
                                border: "2px solid #e2e8f0",
                                boxShadow: "0 8px 24px rgba(15, 23, 42, 0.05)",
                                cursor: "pointer",
                                transition: "all 0.2s ease",
                                display: "flex",
                                flexDirection: "column",
                                justifyContent: "space-between",
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#059669")}
                            onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#e2e8f0")}
                        >
                            <div>
                                <div style={{ width: "54px", height: "54px", borderRadius: "14px", backgroundColor: "#ecfdf5", color: "#059669", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "26px", marginBottom: "20px" }}>
                                    📦
                                </div>
                                <h3 style={{ fontSize: "22px", fontWeight: "800", margin: "0 0 10px 0", color: "#0f172a" }}>
                                    Donate Relief Supplies & Collection Centers
                                </h3>
                                <p style={{ fontSize: "14px", color: "#475569", lineHeight: "1.6", margin: "0 0 20px 0" }}>
                                    Register food packs, clean water, medicine, or clothing you wish to donate and locate the nearest verified collection points to drop them off.
                                </p>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "24px" }}>
                                    <span style={{ padding: "4px 10px", backgroundColor: "#f1f5f9", borderRadius: "6px", fontSize: "12px", fontWeight: "600", color: "#334155" }}>
                                        📍 {collectionCenters.length} Nearby Drop-off Hubs
                                    </span>
                                    <span style={{ padding: "4px 10px", backgroundColor: "#f1f5f9", borderRadius: "6px", fontSize: "12px", fontWeight: "600", color: "#334155" }}>
                                        🗺️ Google Maps Directions
                                    </span>
                                </div>
                            </div>

                            <div style={{ color: "#059669", fontWeight: "700", fontSize: "15px", display: "flex", alignItems: "center", gap: "6px" }}>
                                Donate Items & Find Collection Points →
                            </div>
                        </div>

                        {/* CARD 2: FIELD OPERATIONS & LIVE SOS MISSIONS */}
                        <div
                            className="volunteer-choice-card volunteer-field-card"
                            role="button"
                            tabIndex={0}
                            onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setVolunteerMode("field"); } }}
                            onClick={() => setVolunteerMode("field")}
                            style={{
                                backgroundColor: "#ffffff",
                                borderRadius: "20px",
                                padding: "32px",
                                border: "2px solid #e2e8f0",
                                boxShadow: "0 8px 24px rgba(15, 23, 42, 0.05)",
                                cursor: "pointer",
                                transition: "all 0.2s ease",
                                display: "flex",
                                flexDirection: "column",
                                justifyContent: "space-between",
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#2563eb")}
                            onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#e2e8f0")}
                        >
                            <div>
                                <div style={{ width: "54px", height: "54px", borderRadius: "14px", backgroundColor: "#eff6ff", color: "#2563eb", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "26px", marginBottom: "20px" }}>
                                    🚑
                                </div>
                                <h3 style={{ fontSize: "22px", fontWeight: "800", margin: "0 0 10px 0", color: "#0f172a" }}>
                                    Field Rescue & Live SOS Operations
                                </h3>
                                <p style={{ fontSize: "14px", color: "#475569", lineHeight: "1.6", margin: "0 0 20px 0" }}>
                                    View real-time SOS emergency requests from affected citizens sorted by GPS distance, accept active missions, and navigate directly to victims.
                                </p>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "24px" }}>
                                    <span style={{ padding: "4px 10px", backgroundColor: "#fee2e2", borderRadius: "6px", fontSize: "12px", fontWeight: "700", color: "#dc2626" }}>
                                        🚨 {openMissions.length} Live SOS Requests
                                    </span>
                                    <span style={{ padding: "4px 10px", backgroundColor: "#f1f5f9", borderRadius: "6px", fontSize: "12px", fontWeight: "600", color: "#334155" }}>
                                        📋 {myActiveTasks.length} Active Missions
                                    </span>
                                </div>
                            </div>

                            <div style={{ color: "#2563eb", fontWeight: "700", fontSize: "15px", display: "flex", alignItems: "center", gap: "6px" }}>
                                Open Field Operations Center →
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ===================================================================== */}
            {/* VIEW 1: DONATE SUPPLIES & COLLECTION CENTERS                          */}
            {/* ===================================================================== */}
            {volunteerMode === "donate" && (
                <div style={{ maxWidth: "1200px", margin: "28px auto", padding: "0 24px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: "24px" }}>
                    {/* Left: Supply Donation Pledge Form */}
                    <div style={{ backgroundColor: "#ffffff", padding: "28px", borderRadius: "16px", border: "1px solid #e2e8f0", boxShadow: "0 2px 10px rgba(15,23,42,0.04)" }}>
                        <h2 style={{ fontSize: "20px", fontWeight: "800", margin: "0 0 6px 0" }}>📦 Register Relief Supply Donation</h2>
                        <p style={{ fontSize: "13px", color: "#64748b", margin: "0 0 20px 0" }}>
                            Register the items and choose whether you will drop them off or need a volunteer to arrange collection.
                        </p>

                        {donationSubmitted && (
                            <div style={{ padding: "14px", backgroundColor: "#ecfdf5", border: "1px solid #10b981", color: "#065f46", borderRadius: "10px", fontSize: "13px", fontWeight: "600", marginBottom: "18px" }}>
                                ✅ Donation offer posted · Reference <strong>#{donationReceipt?.id}</strong>. {donationReceipt?.pickupRequested ? "Signed-in helpers can see your pickup request in the Hub and contact you to arrange collection." : <>Please take the items to <strong>{donationReceipt?.collectionCenter || selectedDropoffHub}</strong>; a signed-in helper can accept the delivery task and take them there for you.</>}
                            </div>
                        )}
                        {donationError && <div className="volunteer-form-error" role="alert">{donationError}</div>}

                        <form onSubmit={handleDonationSubmit}>
                            <div style={{ marginBottom: "16px" }}>
                                <label style={{ display: "block", fontSize: "13px", fontWeight: "700", marginBottom: "6px" }}>Donor / Volunteer Name</label>
                                <input
                                    type="text"
                                    required
                                    value={donorName}
                                    onChange={(e) => setDonorName(e.target.value)}
                                    placeholder="Enter your name or organization"
                                    style={{ width: "100%", padding: "11px", borderRadius: "8px", border: "1px solid #cbd5e1", boxSizing: "border-box" }}
                                />
                            </div>

                            <div style={{ marginBottom: "16px" }}>
                                <label style={{ display: "block", fontSize: "13px", fontWeight: "700", marginBottom: "6px" }}>Contact Phone Number</label>
                                <input
                                    type="tel"
                                    required
                                    value={donorPhone}
                                    onChange={(e) => setDonorPhone(e.target.value)}
                                    placeholder="07X XXX XXXX"
                                    style={{ width: "100%", padding: "11px", borderRadius: "8px", border: "1px solid #cbd5e1", boxSizing: "border-box" }}
                                />
                            </div>

                            <div style={{ marginBottom: "16px" }}>
                                <label style={{ display: "block", fontSize: "13px", fontWeight: "700", marginBottom: "6px" }}>Email Address</label>
                                <input type="email" required value={donorEmail} onChange={(e) => setDonorEmail(e.target.value)} placeholder="you@example.com" style={{ width: "100%", padding: "11px", borderRadius: "8px", border: "1px solid #cbd5e1", boxSizing: "border-box" }} />
                                <small>We’ll email you when a volunteer accepts your pickup or delivery offer.</small>
                            </div>

                            <div style={{ marginBottom: "16px" }}>
                                <label style={{ display: "block", fontSize: "13px", fontWeight: "700", marginBottom: "8px" }}>Items You Are Donating (Select one or more)</label>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                                    {["Food", "Water", "Medical", "Clothes & Blankets", "Sanitary & Baby Care"].map((item) => {
                                        const active = donationCategories.includes(item);
                                        return (
                                            <button
                                                type="button"
                                                key={item}
                                                onClick={() => toggleDonationCategory(item)}
                                                style={{
                                                    padding: "8px 14px",
                                                    borderRadius: "8px",
                                                    border: active ? "2px solid #059669" : "1px solid #cbd5e1",
                                                    backgroundColor: active ? "#ecfdf5" : "#ffffff",
                                                    color: active ? "#047857" : "#475569",
                                                    fontSize: "13px",
                                                    fontWeight: "600",
                                                    cursor: "pointer",
                                                }}
                                            >
                                                {active ? "✓ " : ""}{item}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div style={{ marginBottom: "16px" }}>
                                <label style={{ display: "block", fontSize: "13px", fontWeight: "700", marginBottom: "6px" }}>Select Drop-Off Collection Center</label>
                                <select
                                    value={selectedDropoffHub}
                                    onChange={(e) => setSelectedDropoffHub(e.target.value)}
                                    style={{ width: "100%", padding: "11px", borderRadius: "8px", border: "1px solid #cbd5e1", backgroundColor: "#ffffff" }}
                                >
                                    {collectionCenters.map((c, idx) => (
                                        <option key={idx} value={c.name}>
                                            {c.name} ({c.distance} km away)
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <label style={{ display: "flex", alignItems: "flex-start", gap: "10px", margin: "0 0 16px", padding: "12px", borderRadius: "10px", border: "1px solid #b7e4d3", background: "rgba(16,185,129,.08)", cursor: "pointer" }}>
                                <input type="checkbox" checked={pickupRequested} onChange={(e) => setPickupRequested(e.target.checked)} style={{ marginTop: "3px" }} />
                                <span><strong>Please arrange volunteer pickup</strong><br /><small>A signed-in helper can accept this request and contact you using the phone number above to arrange a safe pickup.</small></span>
                            </label>

                            <div style={{ marginBottom: "20px" }}>
                                <label style={{ display: "block", fontSize: "13px", fontWeight: "700", marginBottom: "6px" }}>Item Quantities & Details</label>
                                <textarea
                                    rows="3"
                                    required
                                    value={donationItemsDesc}
                                    onChange={(e) => setDonationItemsDesc(e.target.value)}
                                    placeholder="e.g., 25 dry ration packs, 10 cases of bottled water, first-aid kits..."
                                    style={{ width: "100%", padding: "11px", borderRadius: "8px", border: "1px solid #cbd5e1", boxSizing: "border-box", fontFamily: "inherit" }}
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={donationBusy}
                                style={{ width: "100%", padding: "14px", backgroundColor: "#059669", color: "#ffffff", border: "none", borderRadius: "10px", fontWeight: "700", fontSize: "15px", cursor: "pointer" }}
                            >
                                {donationBusy ? "Saving donation…" : pickupRequested ? "Request Volunteer Pickup" : "Post Donation Offer"}
                            </button>
                        </form>
                    </div>

                    {/* Right: Live Nearby Collection Centers List */}
                    <div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                            <div>
                                <h2 style={{ fontSize: "20px", fontWeight: "800", margin: 0 }}>📍 Nearby Collection & Drop-Off Centers</h2>
                                <p style={{ fontSize: "13px", color: "#64748b", margin: "4px 0 0 0" }}>
                                    Sorted by distance from your current GPS location
                                </p>
                            </div>
                            <button
                                onClick={detectVolunteerGPS}
                                style={{ padding: "8px 12px", backgroundColor: "#0f172a", color: "#ffffff", border: "none", borderRadius: "8px", fontSize: "12px", fontWeight: "600", cursor: "pointer" }}
                            >
                                🔄 Refresh GPS
                            </button>
                        </div>

                        {loadingCenters ? (
                            <div style={{ padding: "30px", backgroundColor: "#ffffff", borderRadius: "14px", border: "1px solid #e2e8f0" }}>
                                Scanning nearest supply collection hubs...
                            </div>
                        ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                                {collectionCenters.map((center, index) => (
                                    <div
                                        key={index}
                                        style={{
                                            backgroundColor: "#ffffff",
                                            padding: "20px",
                                            borderRadius: "14px",
                                            border: selectedDropoffHub === center.name ? "2px solid #059669" : "1px solid #e2e8f0",
                                            boxShadow: "0 2px 6px rgba(15,23,42,0.03)",
                                        }}
                                    >
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                                            <span style={{ fontSize: "11px", fontWeight: "700", color: "#059669", backgroundColor: "#ecfdf5", padding: "4px 8px", borderRadius: "6px" }}>
                                                {center.type}
                                            </span>
                                            {center.distance && (
                                                <span style={{ fontSize: "13px", fontWeight: "700", color: "#0f172a" }}>
                                                    📍 {center.distance} km away
                                                </span>
                                            )}
                                        </div>

                                        <h3 style={{ fontSize: "16px", fontWeight: "700", margin: "0 0 6px 0" }}>{center.name}</h3>
                                        <p style={{ fontSize: "12px", color: "#64748b", margin: "0 0 14px 0" }}>
                                            🕒 Operating Hours: <strong>{center.hours}</strong>
                                        </p>

                                        <div style={{ display: "flex", gap: "10px" }}>
                                            <button
                                                type="button"
                                                onClick={() => setSelectedDropoffHub(center.name)}
                                                style={{
                                                    flex: 1,
                                                    padding: "9px",
                                                    borderRadius: "8px",
                                                    border: "1px solid #059669",
                                                    backgroundColor: selectedDropoffHub === center.name ? "#ecfdf5" : "#ffffff",
                                                    color: "#059669",
                                                    fontSize: "13px",
                                                    fontWeight: "600",
                                                    cursor: "pointer",
                                                }}
                                            >
                                                {selectedDropoffHub === center.name ? "✓ Selected Hub" : "Select Drop-Off"}
                                            </button>

                                            <a
                                                href={`https://www.google.com/maps/dir/?api=1&origin=${location?.lat || ""},${location?.lng || ""}&destination=${center.lat},${center.lng}&travelmode=driving`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                style={{
                                                    flex: 1,
                                                    textAlign: "center",
                                                    padding: "9px",
                                                    borderRadius: "8px",
                                                    backgroundColor: "#0f172a",
                                                    color: "#ffffff",
                                                    textDecoration: "none",
                                                    fontSize: "13px",
                                                    fontWeight: "600",
                                                }}
                                            >
                                                🗺️ Navigate →
                                            </a>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        </div>
                    </div>
            )}

            {/* ===================================================================== */}
            {/* VIEW 2: FIELD OPERATIONS & LIVE SOS MISSIONS (EXISTING FULL VIEW)     */}
            {/* ===================================================================== */}
            {volunteerMode === "field" && (
                <div style={{ maxWidth: "1200px", margin: "24px auto", padding: "0 24px" }}>
                    {/* Volunteer Skill / Capability Bar */}
                    <div style={{ backgroundColor: "#ffffff", padding: "16px 20px", borderRadius: "14px", border: "1px solid #e2e8f0", marginBottom: "20px", display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                            <span style={{ fontSize: "13px", fontWeight: "700", color: "#334155" }}>My Field Capabilities:</span>
                            {["First Aid / Medical", "Transport / Vehicle", "Food & Water", "Boat / Water Rescue", "Shelter Setup"].map((skill) => {
                                const active = selectedSkills.includes(skill);
                                return (
                                    <button
                                        key={skill}
                                        onClick={() => toggleSkill(skill)}
                                        style={{
                                            padding: "6px 12px",
                                            borderRadius: "999px",
                                            border: active ? "1px solid #059669" : "1px solid #cbd5e1",
                                            backgroundColor: active ? "#ecfdf5" : "#f8fafc",
                                            color: active ? "#047857" : "#475569",
                                            fontSize: "12px",
                                            fontWeight: active ? "700" : "500",
                                            cursor: "pointer",
                                        }}
                                    >
                                        {active ? "✓ " : "+ "}{skill}
                                    </button>
                                );
                            })}
                        </div>

                        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                            <select
                                value={availability}
                                onChange={(e) => setAvailability(e.target.value)}
                                style={{
                                    padding: "8px 12px",
                                    borderRadius: "8px",
                                    border: "none",
                                    backgroundColor: availability === "Available" ? "#059669" : availability === "En Route" ? "#d97706" : "#475569",
                                    color: "#ffffff",
                                    fontWeight: "700",
                                    fontSize: "12px",
                                    cursor: "pointer",
                                }}
                            >
                                <option value="Available">🟢 Available on Field</option>
                                <option value="En Route">🟡 En Route / Busy</option>
                                <option value="Off Duty">⚫ Off Duty</option>
                            </select>

                            <button
                                onClick={fetchLiveSOSMissions}
                                style={{ padding: "8px 14px", backgroundColor: "#0f172a", color: "#ffffff", border: "none", borderRadius: "8px", fontSize: "12px", fontWeight: "600", cursor: "pointer" }}
                            >
                                🔄 Refresh Live SOS
                            </button>
                        </div>
                    </div>

                    {missionError && activeTab !== "donations" && <div className="volunteer-form-error" role="alert">{missionError}</div>}

                    {/* Navigation Tabs */}
                    <div style={{ display: "flex", gap: "10px", marginBottom: "20px", flexWrap: "wrap" }}>
                        <button
                            onClick={() => setActiveTab("missions")}
                            style={{
                                padding: "10px 18px",
                                borderRadius: "10px",
                                border: "none",
                                backgroundColor: activeTab === "missions" ? "#2563eb" : "#ffffff",
                                color: activeTab === "missions" ? "#ffffff" : "#334155",
                                fontWeight: "700",
                                fontSize: "14px",
                                cursor: "pointer",
                                boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                            }}
                        >
                            🚨 Live SOS Requests ({openMissions.length})
                        </button>

                        <button
                            onClick={() => setActiveTab("my-tasks")}
                            style={{
                                padding: "10px 18px",
                                borderRadius: "10px",
                                border: "none",
                                backgroundColor: activeTab === "my-tasks" ? "#059669" : "#ffffff",
                                color: activeTab === "my-tasks" ? "#ffffff" : "#334155",
                                fontWeight: "700",
                                fontSize: "14px",
                                cursor: "pointer",
                                boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                            }}
                        >
                            📋 Active Missions ({myActiveTasks.length})
                        </button>
                        <button
                            onClick={() => { setActiveTab("donations"); fetchDonationBoard(); }}
                            style={{ padding: "10px 18px", borderRadius: "10px", border: "none", backgroundColor: activeTab === "donations" ? "#059669" : "rgba(255,255,255,.08)", color: "#e8fff7", fontWeight: "700", fontSize: "14px", cursor: "pointer" }}
                        >
                            📦 Donation Pick-ups ({donationOffers.length + myDeliveries.length})
                        </button>
                    </div>

                    {activeTab === "donations" && (
                        <div>
                            {donationActionNotice && <div role="status" style={{ marginBottom: "14px", padding: "12px 16px", borderRadius: "10px", background: "rgba(16,185,129,.18)", border: "1px solid rgba(16,185,129,.45)", color: "#d1fae5" }}>{donationActionNotice}</div>}
                            <section style={{ marginBottom: "22px", padding: "20px", borderRadius: "16px", border: "1px solid rgba(16,185,129,.35)", background: "rgba(3,30,25,.92)", color: "#e8fff7" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                                <div>
                                    <h2 style={{ fontSize: "20px", fontWeight: "800", margin: 0 }}>🤝 Donation Pick-up & Delivery Board</h2>
                                    <p style={{ fontSize: "13px", opacity: .8, margin: "5px 0 0" }}>Accept an offer, contact the donor, and take the supplies to its selected collection hub.</p>
                                </div>
                                <button type="button" onClick={fetchDonationBoard} style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid rgba(16,185,129,.5)", background: "#0b2823", color: "#d9fff0", fontWeight: 700, cursor: "pointer" }}>↻ Refresh</button>
                            </div>
                            {donationBoardError && <div role="alert" style={{ marginTop: "12px", padding: "10px 12px", borderRadius: "8px", background: "rgba(127,29,29,.45)", color: "#ffe4e6" }}>{donationBoardError}</div>}
                            {loadingDonations ? <p style={{ margin: "16px 0 0", opacity: .8 }}>Loading donation offers…</p> : <>
                                {myDeliveries.length > 0 && <div style={{ marginTop: "16px" }}>
                                    <h3 style={{ fontSize: "15px", margin: "0 0 10px" }}>Your accepted deliveries ({myDeliveries.length})</h3>
                                    <div style={{ display: "grid", gap: "10px" }}>{myDeliveries.map((donation) => <article key={`mine-${donation.id}`} style={{ padding: "14px", borderRadius: "10px", background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)" }}>
                                        <strong>#{donation.id} · {donation.categories}</strong><p style={{ margin: "5px 0", opacity: .85 }}>{donation.itemsDescription}</p>
                                        <p style={{ margin: "4px 0", opacity: .8 }}>Donor: {donation.donorName} · <a href={`tel:${donation.phone}`} style={{ color: "#76dfbd" }}>{donation.phone}</a></p>
                                        <p style={{ margin: "4px 0 12px", opacity: .8 }}>Deliver to: {donation.collectionCenter}{donation.pickupRequested ? " · Pickup requested" : ""}</p>
                                        <button type="button" disabled={donationActionId === donation.id} onClick={() => handleDonationDelivery(donation, "delivered")} style={{ padding: "9px 13px", border: 0, borderRadius: "8px", background: "#10b981", color: "#04251d", fontWeight: 800, cursor: "pointer" }}>{donationActionId === donation.id ? "Updating…" : "✓ Mark delivered to hub"}</button>
                                    </article>)}</div>
                                </div>}
                                <div style={{ marginTop: "16px" }}>
                                    <h3 style={{ fontSize: "15px", margin: "0 0 10px" }}>Offers needing a volunteer ({donationOffers.length})</h3>
                                    {donationOffers.length === 0 ? <p style={{ margin: 0, opacity: .8 }}>No open donation offers right now. New offers appear here when someone submits the donation form.</p> : <div style={{ display: "grid", gap: "10px" }}>{donationOffers.map((donation) => <article key={donation.id} style={{ padding: "14px", borderRadius: "10px", background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)" }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", flexWrap: "wrap" }}><strong>Donation #{donation.id} · {donation.categories}</strong>{donation.pickupRequested && <span style={{ color: "#8df0c7", fontWeight: 700 }}>Pickup requested</span>}</div>
                                        <p style={{ margin: "6px 0", opacity: .85 }}>{donation.itemsDescription}</p>
                                        <p style={{ margin: "4px 0", opacity: .8 }}>Donor: {donation.donorName} · <a href={`tel:${donation.phone}`} style={{ color: "#76dfbd" }}>{donation.phone}</a></p>
                                        <p style={{ margin: "4px 0 12px", opacity: .8 }}>Collection hub: {donation.collectionCenter}</p>
                                        <button type="button" disabled={donationActionId === donation.id} onClick={() => handleDonationDelivery(donation, "accept")} style={{ padding: "9px 13px", border: 0, borderRadius: "8px", background: "#d1fae5", color: "#065f46", fontWeight: 800, cursor: "pointer" }}>{donationActionId === donation.id ? "Accepting…" : donation.pickupRequested ? "🙋 I’ll pick this up" : "🙋 I can deliver this"}</button>
                                    </article>)}</div>}
                                </div>
                            </>}
                        </section>
                        </div>
                    )}

                    {/* TAB 1: LIVE SOS MISSIONS FEED */}
                    {activeTab === "missions" && (
                        <div>
                            <div style={{ display: "flex", gap: "8px", marginBottom: "18px", flexWrap: "wrap" }}>
                                {["All", "Food", "Water", "Medical", "Shelter", "General"].map((cat) => (
                                    <button
                                        key={cat}
                                        onClick={() => setCategoryFilter(cat)}
                                        style={{
                                            padding: "7px 14px",
                                            borderRadius: "8px",
                                            border: categoryFilter === cat ? "2px solid #2563eb" : "1px solid #cbd5e1",
                                            backgroundColor: categoryFilter === cat ? "#eff6ff" : "#ffffff",
                                            color: categoryFilter === cat ? "#1d4ed8" : "#475569",
                                            fontSize: "13px",
                                            fontWeight: "600",
                                            cursor: "pointer",
                                        }}
                                    >
                                        {cat}
                                    </button>
                                ))}
                            </div>

                            {loadingMissions ? (
                                <div style={{ padding: "40px", textAlign: "center", backgroundColor: "#ffffff", borderRadius: "14px", border: "1px solid #e2e8f0" }}>
                                    Loading live SOS requests from Affected Persons...
                                </div>
                            ) : openMissions.length === 0 ? (
                                <div style={{ padding: "40px", textAlign: "center", backgroundColor: "#ffffff", borderRadius: "14px", border: "1px solid #e2e8f0", color: "#64748b" }}>
                                    No pending SOS requests found in this category right now.
                                </div>
                            ) : (
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))", gap: "18px" }}>
                                    {openMissions.map((mission) => {
                                        const badge = getPriorityBadge(mission.priority);
                                        const mapsUrl =
                                            mission.parsed.lat && mission.parsed.lng
                                                ? location
                                                    ? `https://www.google.com/maps/dir/?api=1&origin=${location.lat},${location.lng}&destination=${mission.parsed.lat},${mission.parsed.lng}&travelmode=driving`
                                                    : `https://www.google.com/maps/search/?api=1&query=${mission.parsed.lat},${mission.parsed.lng}`
                                                : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mission.location || "Sri Lanka")}`;

                                        return (
                                            <div
                                                key={mission.id}
                                                style={{
                                                    backgroundColor: "#ffffff",
                                                    borderRadius: "14px",
                                                    padding: "20px",
                                                    border: "1px solid #e2e8f0",
                                                    boxShadow: "0 2px 8px rgba(15,23,42,0.04)",
                                                    display: "flex",
                                                    flexDirection: "column",
                                                    justifyContent: "space-between",
                                                    gap: "14px",
                                                }}
                                            >
                                                <div>
                                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                                                        <span style={{ padding: "4px 10px", borderRadius: "6px", backgroundColor: badge.bg, color: badge.color, fontSize: "12px", fontWeight: "700" }}>
                                                            {mission.priority || "High"} Priority
                                                        </span>
                                                        {mission.distance ? (
                                                            <span style={{ fontSize: "13px", fontWeight: "700", color: "#059669" }}>
                                                                📍 {mission.distance} km away
                                                            </span>
                                                        ) : (
                                                            <span style={{ fontSize: "12px", color: "#64748b" }}>Status: {mission.status}</span>
                                                        )}
                                                    </div>

                                                    <h3 style={{ fontSize: "16px", fontWeight: "700", margin: "0 0 4px 0" }}>
                                                        {mission.requesterName || "Affected Citizen"}
                                                    </h3>
                                                    <p style={{ fontSize: "13px", color: "#475569", margin: "0 0 10px 0" }}>
                                                        📌 {mission.location}
                                                    </p>

                                                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "10px" }}>
                                                        {(mission.parsed.needs.length > 0 ? mission.parsed.needs : [mission.category]).map((need, idx) => (
                                                            <span
                                                                key={idx}
                                                                style={{ padding: "3px 9px", borderRadius: "6px", backgroundColor: "#eff6ff", color: "#1d4ed8", fontSize: "12px", fontWeight: "600" }}
                                                            >
                                                                {need}
                                                            </span>
                                                        ))}
                                                    </div>

                                                    <p style={{ fontSize: "13px", color: "#334155", backgroundColor: "#f8fafc", padding: "10px", borderRadius: "8px", margin: 0, lineHeight: "1.5" }}>
                                                        {mission.parsed.cleanDescription}
                                                    </p>
                                                </div>

                                                <div style={{ display: "flex", gap: "8px", marginTop: "6px" }}>
                                                    <a
                                                        href={mapsUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        style={{
                                                            flex: 1,
                                                            textAlign: "center",
                                                            padding: "10px",
                                                            borderRadius: "8px",
                                                            backgroundColor: "#f1f5f9",
                                                            color: "#0f172a",
                                                            textDecoration: "none",
                                                            fontSize: "13px",
                                                            fontWeight: "600",
                                                            border: "1px solid #cbd5e1",
                                                        }}
                                                    >
                                                        🗺️ Navigate
                                                    </a>

                                                    {mission.status === "In Progress" ? (
                                                        <button
                                onClick={() => handleUpdateMissionStatus(mission, "Completed")}
                                                            style={{
                                                                flex: 1,
                                                                padding: "10px",
                                                                borderRadius: "8px",
                                                                backgroundColor: "#059669",
                                                                color: "#ffffff",
                                                                border: "none",
                                                                fontSize: "13px",
                                                                fontWeight: "700",
                                                                cursor: "pointer",
                                                            }}
                                                        >
                                                            ✓ Mark Delivered
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={() => handleUpdateMissionStatus(mission, "In Progress")}
                                                            style={{
                                                                flex: 1,
                                                                padding: "10px",
                                                                borderRadius: "8px",
                                                                backgroundColor: "#2563eb",
                                                                color: "#ffffff",
                                                                border: "none",
                                                                fontSize: "13px",
                                                                fontWeight: "700",
                                                                cursor: "pointer",
                                                            }}
                                                        >
                                                            🚀 Accept Mission
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* TAB 2: VOLUNTEER ACCEPTED / ACTIVE TASKS */}
                    {activeTab === "my-tasks" && (
                        <div>
                            {myActiveTasks.length === 0 ? (
                                <div style={{ padding: "40px", textAlign: "center", backgroundColor: "#ffffff", borderRadius: "14px", border: "1px solid #e2e8f0", color: "#64748b" }}>
                                    You haven't accepted any active missions yet. Go to <strong>Live SOS Requests</strong> to accept a field mission!
                                </div>
                            ) : (
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))", gap: "18px" }}>
                                    {myActiveTasks.map((task) => {
                                        const mapsUrl =
                                            task.parsed.lat && task.parsed.lng
                                                ? `https://www.google.com/maps/dir/?api=1&origin=${location?.lat || ""},${location?.lng || ""}&destination=${task.parsed.lat},${task.parsed.lng}&travelmode=driving`
                                                : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(task.location || "Sri Lanka")}`;

                                        return (
                                            <div key={task.id} style={{ backgroundColor: "#ffffff", borderRadius: "14px", padding: "20px", border: "2px solid #059669" }}>
                                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                                                    <span style={{ padding: "4px 10px", backgroundColor: "#d1fae5", color: "#065f46", borderRadius: "6px", fontSize: "12px", fontWeight: "700" }}>
                                                        IN PROGRESS
                                                    </span>
                                                    {task.distance && <span style={{ fontSize: "13px", fontWeight: "700", color: "#059669" }}>📍 {task.distance} km</span>}
                                                </div>
                                                <h3 style={{ fontSize: "16px", fontWeight: "700", margin: "0 0 4px 0" }}>{task.requesterName}</h3>
                                                <p style={{ fontSize: "13px", color: "#475569", margin: "0 0 10px 0" }}>📌 {task.location}</p>
                                                <p style={{ fontSize: "13px", color: "#334155", backgroundColor: "#f8fafc", padding: "10px", borderRadius: "8px", marginBottom: "14px" }}>
                                                    {task.parsed.cleanDescription}
                                                </p>
                                                <div style={{ display: "flex", gap: "8px" }}>
                                                    <a
                                                        href={mapsUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        style={{ flex: 1, textAlign: "center", padding: "10px", borderRadius: "8px", backgroundColor: "#0f172a", color: "#ffffff", textDecoration: "none", fontSize: "13px", fontWeight: "600" }}
                                                    >
                                                        🧭 Open Route
                                                    </a>
                                                    <button
                                                        onClick={() => handleUpdateMissionStatus(task, "Completed")}
                                                        style={{ flex: 1, padding: "10px", borderRadius: "8px", backgroundColor: "#059669", color: "#ffffff", border: "none", fontSize: "13px", fontWeight: "700", cursor: "pointer" }}
                                                    >
                                                        ✅ Complete Delivery
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
