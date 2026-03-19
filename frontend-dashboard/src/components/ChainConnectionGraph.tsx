"use client";

import React, { useMemo, useRef, useEffect, useState } from "react";
import ForceGraph2D, { ForceGraphMethods } from "react-force-graph-2d";
import { useTheme } from "@mui/material/styles";
import { getChainName } from "@/lib/utils";
import type { TransactionEvent } from "@/lib/registry";

interface ChainConnectionGraphProps {
    walletAddress: string;
    transactions: TransactionEvent[];
}

interface Node {
    id: string;
    name: string;
    val: number;
    color: string;
    type: "wallet" | "chain";
}

interface Link {
    source: string;
    target: string;
    value: number;
    label: string;
    volume: bigint;
}

export default function ChainConnectionGraph({ walletAddress, transactions }: ChainConnectionGraphProps) {
    const fgRef = useRef<ForceGraphMethods>();
    const containerRef = useRef<HTMLDivElement>(null);
    const [dimensions, setDimensions] = useState({ width: 0, height: 500 });
    const theme = useTheme();
    const isDark = theme.palette.mode === "dark";

    const graphData = useMemo(() => {
        const nodes: Node[] = [
            {
                id: "wallet",
                name: walletAddress,
                val: 25,
                color: "#8b5cf6", // Primary violet theme color
                type: "wallet",
            },
        ];

        const links: Link[] = [];
        const chainSet = new Set<number>();

        // Map to store chain-to-chain connections
        const chainLinks = new Map<string, { count: number; volume: bigint }>();

        // Map to track wallet's interaction with each chain
        const walletChainInteractions = new Map<number, { count: number; volume: bigint }>();

        // Build chain-to-chain connections from XCM transfers
        transactions.forEach((tx) => {
            chainSet.add(tx.sourceChain);
            chainSet.add(tx.destChain);

            // Track wallet interactions with both chains
            const sourceData = walletChainInteractions.get(tx.sourceChain) || { count: 0, volume: BigInt(0) };
            sourceData.count += 1;
            sourceData.volume += tx.amount;
            walletChainInteractions.set(tx.sourceChain, sourceData);

            const destData = walletChainInteractions.get(tx.destChain) || { count: 0, volume: BigInt(0) };
            destData.count += 1;
            destData.volume += tx.amount;
            walletChainInteractions.set(tx.destChain, destData);

            // Create chain-to-chain link (directional: source → dest)
            const linkKey = `${tx.sourceChain}-${tx.destChain}`;
            const linkData = chainLinks.get(linkKey) || { count: 0, volume: BigInt(0) };
            linkData.count += 1;
            linkData.volume += tx.amount;
            chainLinks.set(linkKey, linkData);
        });

        // Create chain nodes
        chainSet.forEach((chainId) => {
            const chainName = getChainName(chainId);
            const nodeId = `chain-${chainId}`;
            const interactionData = walletChainInteractions.get(chainId) || { count: 0, volume: BigInt(0) };

            nodes.push({
                id: nodeId,
                name: chainName,
                val: 15 + Math.min(interactionData.count * 2, 30), // Scale by activity
                color: isDark ? "#60a5fa" : "#3b82f6", // Adjust blue intensity for light mode
                type: "chain",
            });

            // Connect wallet to each chain it interacts with
            links.push({
                source: "wallet",
                target: nodeId,
                value: interactionData.count,
                label: `${interactionData.count} txs`,
                volume: interactionData.volume,
            });
        });

        // Create chain-to-chain links (XCM transfers)
        chainLinks.forEach((data, linkKey) => {
            const [sourceId, destId] = linkKey.split("-").map(Number);
            links.push({
                source: `chain-${sourceId}`,
                target: `chain-${destId}`,
                value: data.count,
                label: `${data.count} transfers`,
                volume: data.volume,
            });
        });

        return { nodes, links };
    }, [walletAddress, transactions, isDark]);

    // Cleanup and zoom adjustment
    useEffect(() => {
        if (fgRef.current) {
            // Set force simulation parameters
            fgRef.current.d3Force("charge")?.strength(-300);
            fgRef.current.d3Force("link")?.distance(100);
            fgRef.current.d3Force("center")?.strength(0.5);

            // Wait for initial layout to stabilize, then center
            setTimeout(() => {
                if (fgRef.current) {
                    fgRef.current.zoomToFit(600, 80);
                }
            }, 500);
        }
    }, [graphData]);

    // Handle container resize
    useEffect(() => {
        const updateDimensions = () => {
            if (containerRef.current) {
                setDimensions({
                    width: containerRef.current.offsetWidth,
                    height: 500,
                });
            }
        };

        updateDimensions();
        window.addEventListener("resize", updateDimensions);
        return () => window.removeEventListener("resize", updateDimensions);
    }, []);

    // Re-center after physics simulation stabilizes
    const handleEngineStop = () => {
        if (fgRef.current) {
            fgRef.current.zoomToFit(600, 80);
        }
    };

    return (
        <div
            ref={containerRef}
            className="w-full h-[500px] relative rounded-2xl overflow-hidden bg-background/50 border border-border mt-6"
        >
            <div className="absolute top-4 left-4 z-10">
                <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                    Chain Interaction Network
                </h4>
                <p className="text-[10px] text-muted">Cross-chain XCM transfer flows</p>
            </div>

            {/* Legend */}
            <div className="absolute top-4 right-4 z-10 bg-card/80 backdrop-blur-sm p-3 rounded-lg border border-border text-[10px] space-y-1.5">
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#8b5cf6]" />
                    <span className="text-muted">Wallet</span>
                </div>
                <div className="flex items-center gap-2">
                    <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: isDark ? "#60a5fa" : "#3b82f6" }}
                    />
                    <span className="text-muted">Chain</span>
                </div>
                <div className="h-px bg-border my-1" />
                <div className="flex items-center gap-2">
                    <div
                        className="w-4 h-[2px]"
                        style={{ backgroundColor: isDark ? "rgba(139, 92, 246, 0.25)" : "rgba(139, 92, 246, 0.35)" }}
                    />
                    <span className="text-muted">Wallet Connection</span>
                </div>
                <div className="flex items-center gap-2">
                    <div
                        className="w-4 h-[2px]"
                        style={{ backgroundColor: isDark ? "rgba(34, 211, 238, 0.5)" : "rgba(6, 182, 212, 0.6)" }}
                    />
                    <span className="text-muted">XCM Transfer</span>
                </div>
            </div>

            <ForceGraph2D
                ref={fgRef}
                graphData={graphData}
                backgroundColor={isDark ? "#111111" : "#f8f9fa"}
                width={dimensions.width}
                height={dimensions.height}
                onEngineStop={handleEngineStop}
                nodeLabel={(node: any) => {
                    if (node.type === "wallet") {
                        return `Wallet: ${node.name.slice(0, 10)}...${node.name.slice(-8)}`;
                    }
                    return `Chain: ${node.name}`;
                }}
                nodeColor={(node: any) => node.color}
                nodeRelSize={2}
                linkWidth={(link: any) => {
                    // Thicker lines for chain-to-chain transfers
                    const isChainTransfer = link.source.id?.startsWith("chain-") && link.target.id?.startsWith("chain-");
                    return isChainTransfer ? 3 : 2;
                }}
                linkColor={(link: any) => {
                    // Different colors for different link types
                    const sourceId = typeof link.source === "object" ? link.source.id : link.source;
                    const targetId = typeof link.target === "object" ? link.target.id : link.target;

                    // Wallet-to-chain connections: violet
                    if (sourceId === "wallet") {
                        return isDark ? "rgba(139, 92, 246, 0.25)" : "rgba(139, 92, 246, 0.35)";
                    }
                    // Chain-to-chain transfers: cyan (represents XCM)
                    if (sourceId?.startsWith("chain-") && targetId?.startsWith("chain-")) {
                        return isDark ? "rgba(34, 211, 238, 0.5)" : "rgba(6, 182, 212, 0.6)";
                    }
                    return isDark ? "rgba(139, 92, 246, 0.2)" : "rgba(139, 92, 246, 0.3)";
                }}
                linkDirectionalArrowLength={6}
                linkDirectionalArrowRelPos={1}
                linkDirectionalParticles={(link: any) => {
                    // More particles for chain-to-chain transfers
                    const sourceId = typeof link.source === "object" ? link.source.id : link.source;
                    const targetId = typeof link.target === "object" ? link.target.id : link.target;

                    if (sourceId?.startsWith("chain-") && targetId?.startsWith("chain-")) {
                        return 4; // XCM transfers get more particles
                    }
                    return 2;
                }}
                linkDirectionalParticleSpeed={0.005}
                linkDirectionalParticleWidth={2}
                linkCurvature={0.2} // Add curvature for better visibility of bidirectional links
                linkLabel={(link: any) => {
                    const sourceId = typeof link.source === "object" ? link.source.id : link.source;
                    const targetId = typeof link.target === "object" ? link.target.id : link.target;

                    if (sourceId?.startsWith("chain-") && targetId?.startsWith("chain-")) {
                        const volume = Number(link.volume) / 1e18;
                        return `${link.label}\nVolume: ${volume.toFixed(2)} WND`;
                    }
                    return link.label;
                }}
                onNodeClick={(node: any) => {
                    if (fgRef.current) {
                        fgRef.current.centerAt(node.x, node.y, 1000);
                        fgRef.current.zoom(3, 1000);
                    }
                }}
                nodeCanvasObject={(node: any, ctx, globalScale) => {
                    const label = node.id === "wallet" ? "Wallet" : node.name;
                    const fontSize = node.id === "wallet" ? 14 / globalScale : 12 / globalScale;
                    ctx.font = `${fontSize}px DM Sans`;

                    // Draw node circle
                    ctx.beginPath();
                    const radius = node.id === "wallet" ? 7 : 5;
                    ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false);
                    ctx.fillStyle = node.color;
                    ctx.fill();

                    // Add glow effect
                    if (node.id === "wallet") {
                        ctx.shadowColor = node.color;
                        ctx.shadowBlur = 15;
                        ctx.beginPath();
                        ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false);
                        ctx.fillStyle = node.color;
                        ctx.fill();
                        ctx.shadowBlur = 0;
                    }

                    // Draw label with background
                    ctx.textAlign = "center";
                    ctx.textBaseline = "middle";
                    const labelY = node.y + (node.id === "wallet" ? 14 : 12);

                    // Background for better readability (theme-adaptive)
                    const textWidth = ctx.measureText(label).width;
                    ctx.fillStyle = isDark ? "rgba(0, 0, 0, 0.7)" : "rgba(255, 255, 255, 0.9)";
                    ctx.fillRect(
                        node.x - textWidth / 2 - 4,
                        labelY - fontSize / 2 - 2,
                        textWidth + 8,
                        fontSize + 4
                    );

                    // Label text (theme-adaptive)
                    ctx.fillStyle = isDark ? "#ffffff" : "#0e0e0e";
                    ctx.fillText(label, node.x, labelY);
                }}
                cooldownTicks={100}
            />
        </div>
    );
}
