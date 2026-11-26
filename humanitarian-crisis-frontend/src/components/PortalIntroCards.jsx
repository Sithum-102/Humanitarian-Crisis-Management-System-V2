import React from "react";
import "./PortalIntroCards.css";

const messages = [
    {
        id: "affected",
        label: "Affected Person",
        title: "We’re Here to Help.",
        description: "Get the support and assistance you need during difficult times.",
        icon: "⌂",
    },
    {
        id: "volunteer",
        label: "Volunteer",
        title: "Be the Reason Someone Smiles.",
        description: "Your time and kindness can make a difference in someone’s life.",
        icon: "♡",
    },
    {
        id: "coordination",
        label: "Emergency Coordination",
        title: "Command. Coordinate. Respond.",
        description: "Lead emergency operations with intelligent coordination and timely decisions.",
        icon: "⌁",
    },
];

export default function PortalIntroCards({ portal }) {
    const message = messages.find((item) => item.id === portal);

    if (!message) return null;

    return (
        <section className="portal-intro-section" aria-label={`${message.label} portal introduction`}>
            <div className="portal-intro-grid">
                <article className={`portal-intro-card portal-intro-card--${message.id}`}>
                    <div className="portal-intro-card-top">
                        <span className="portal-intro-icon" aria-hidden="true">{message.icon}</span>
                        <span className="portal-intro-label">{message.label}</span>
                    </div>
                    <h2>{message.title}</h2>
                    <p>{message.description}</p>
                </article>
            </div>
        </section>
    );
}
