export interface TourStep {
    id: string;
    target: string;
    title: string;
    content: string;
    placement: "top" | "bottom" | "left" | "right" | "center";
    spotlightPadding?: number;
    disableOverlay?: boolean;
}

export const TOUR_STEPS: TourStep[] = [
    {
        id: "welcome",
        target: '[data-tour="hero-banner"]',
        title: "Welcome to ParaTrace",
        content:
            "Your cross-chain risk intelligence dashboard for Polkadot. Let us show you around the key features!",
        placement: "center",
        disableOverlay: true,
    },
    {
        id: "navigation",
        target: '[data-tour="nav-links"]',
        title: "Navigation",
        content:
            "Access all features from here: Dashboard overview, Wallet Lookup, Flagged Wallets, Transactions, and Live Demo.",
        placement: "bottom",
        spotlightPadding: 8,
    },
    {
        id: "wallet-lookup-nav",
        target: '[data-tour="nav-wallet-lookup"]',
        title: "Wallet Lookup",
        content:
            "Search any EVM address to view its complete risk profile, transaction history, and cross-chain interactions.",
        placement: "bottom",
    },
    {
        id: "flagged-nav",
        target: '[data-tour="nav-flagged"]',
        title: "Flagged Wallets",
        content:
            "Monitor wallets that have exceeded the risk threshold. These addresses require attention for potential suspicious activity.",
        placement: "bottom",
    },
    {
        id: "connect-wallet",
        target: '[data-tour="connect-wallet"]',
        title: "Connect Your Wallet",
        content:
            "Connect your Polkadot wallet (Talisman or Polkadot.js) to access personalized features and try the Live XCM Demo.",
        placement: "bottom",
    },
    {
        id: "stat-cards",
        target: '[data-tour="stat-cards"]',
        title: "Quick Stats",
        content:
            "At-a-glance metrics showing total transactions, monitored wallets, flagged addresses, and average risk scores across the network.",
        placement: "bottom",
        spotlightPadding: 16,
    },
    {
        id: "analytics-charts",
        target: '[data-tour="analytics"]',
        title: "Risk Analytics",
        content:
            "Visual breakdowns of risk distribution and chain activity trends. Hover over charts for detailed data points.",
        placement: "top",
        spotlightPadding: 16,
    },
    {
        id: "recent-activity",
        target: '[data-tour="recent-activity"]',
        title: "Recent Activity",
        content:
            "Live feed of recent XCM transactions with risk scores. Click any transaction to explore the wallet's full profile.",
        placement: "top",
    },
    {
        id: "theme-toggle",
        target: '[data-tour="theme-toggle"]',
        title: "Theme Preference",
        content:
            "Toggle between light and dark modes based on your preference. Your choice is saved automatically.",
        placement: "bottom",
    },
];
