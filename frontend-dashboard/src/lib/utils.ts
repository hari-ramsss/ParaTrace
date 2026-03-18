import { ethers } from "ethers";
import { CHAIN_NAMES } from "./constants";

/**
 * Truncate an address: 0x1234...abcd
 */
export function truncateAddress(address: string, chars: number = 6): string {
    if (!address) return "";
    return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

/**
 * Format volume from raw units to human-readable WND (12 decimals).
 */
export function formatVolume(volume: bigint | string): string {
    try {
        return parseFloat(ethers.formatUnits(volume, 12)).toFixed(2);
    } catch {
        return "0.00";
    }
}

/**
 * Format a timestamp (unix seconds) to a readable date string.
 */
export function formatTimestamp(timestamp: number): string {
    if (timestamp === 0) return "Never";
    return new Date(timestamp * 1000).toLocaleString();
}

/**
 * Format seconds into a human-readable duration.
 */
export function formatDuration(seconds: number): string {
    if (seconds === 0) return "N/A";
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
    if (seconds < 86400) return `${Math.round(seconds / 3600)}h`;
    return `${Math.round(seconds / 86400)}d`;
}

/**
 * Get chain name from slot ID.
 */
export function getChainName(slot: number): string {
    return CHAIN_NAMES[slot] || `Chain(${slot})`;
}
