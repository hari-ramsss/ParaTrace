import { ethers } from "hardhat"

async function main() {
    // ═══════════════════════════════════════════════════════════════
    //  ADDRESSES — Update these after deployment
    // ═══════════════════════════════════════════════════════════════
    const REGISTRY_ADDRESS = "0xbA686106E15b9b27407b94Cb51bf734705cAF80a"

    const registry = await ethers.getContractAt("ParaTraceRegistry", REGISTRY_ADDRESS)

    console.log("╔══════════════════════════════════════════════════════╗")
    console.log("║   ParaTrace — Advanced Cross-Contract Test Suite    ║")
    console.log("╚══════════════════════════════════════════════════════╝\n")

    // ── Persona 1: Normal User ──────────────────────────────────────
    // Low volume, few txs, slow pace, 1 chain, no flagged contacts
    // Expected: ~3 pts (chain diversity: 1 chain * 3 = 3), NOT flagged
    console.log("━━━ Persona 1: Normal User ━━━")
    const normalUser = "0x0000000000000000000000000000000000000001"
    await recordTxs(registry, normalUser, [
        { amount: "5", src: 0, dst: 1, flagged: false },
        { amount: "3", src: 0, dst: 1, flagged: false },
    ], 3600) // 1 hour gaps
    await printProfile(registry, normalUser, "~3-6", false)

    // ── Persona 2: Active Trader ────────────────────────────────────
    // Medium volume (60 PAS), many txs, moderate pace, 2 chains
    // Expected: ~41 pts (vol:20 + freq:15 + velocity:0 + chains:6 + flags:0), NOT flagged
    console.log("\n━━━ Persona 2: Active Trader ━━━")
    const trader = "0x0000000000000000000000000000000000000002"
    const traderTxs = []
    for (let i = 0; i < 55; i++) {
        traderTxs.push({ amount: "1.1", src: 0, dst: 1, flagged: false })
    }
    await recordTxs(registry, trader, traderTxs, 600) // 10 min gaps
    await printProfile(registry, trader, "~41", false)

    // ── Persona 3: Chain Hopper ─────────────────────────────────────
    // Moderate volume, spreads across 6+ chains, some flagged contacts
    // Expected: ~55-65 pts (vol:10 + freq:10 + velocity:10 + chains:15 + flags:5-10), borderline
    console.log("\n━━━ Persona 3: Chain Hopper ━━━")
    const hopper = "0x0000000000000000000000000000000000000003"
    await recordTxs(registry, hopper, [
        { amount: "5", src: 0, dst: 1, flagged: false },
        { amount: "3", src: 2, dst: 3, flagged: true },
        { amount: "4", src: 4, dst: 5, flagged: false },
        { amount: "2", src: 6, dst: 7, flagged: true },
        { amount: "3", src: 8, dst: 9, flagged: false },
        { amount: "6", src: 10, dst: 11, flagged: false },
    ], 200) // ~3 min gaps
    await printProfile(registry, hopper, "~50-65", false)

    // ── Persona 4: Money Launderer ──────────────────────────────────
    // Massive volume, tons of txs, very rapid, many chains, flagged contacts
    // Expected: 100 pts (30+20+20+15+15), FLAGGED
    console.log("\n━━━ Persona 4: Money Launderer ━━━")
    const launderer = "0x0000000000000000000000000000000000000004"
    const laundererTxs = []
    for (let i = 0; i < 105; i++) {
        laundererTxs.push({
            amount: "1.5",
            src: i % 6,
            dst: (i + 1) % 6,
            flagged: i % 3 === 0 // every 3rd tx is with a flagged wallet
        })
    }
    await recordTxs(registry, launderer, laundererTxs, 30) // 30 sec gaps
    await printProfile(registry, launderer, "100", true)

    // ── Persona 5: Whale (Legitimate) ───────────────────────────────
    // Huge volume but slow, few txs, 1 chain, no flagged contacts
    // Expected: ~33 pts (vol:30 + freq:0 + velocity:0 + chains:3 + flags:0), NOT flagged
    console.log("\n━━━ Persona 5: Whale (Legitimate) ━━━")
    const whale = "0x0000000000000000000000000000000000000005"
    await recordTxs(registry, whale, [
        { amount: "200", src: 0, dst: 1, flagged: false },
        { amount: "300", src: 0, dst: 1, flagged: false },
    ], 86400) // 1 day gaps
    await printProfile(registry, whale, "~33", false)

    console.log("\n╔══════════════════════════════════════════════════════╗")
    console.log("║              All persona tests complete              ║")
    console.log("╚══════════════════════════════════════════════════════╝")
}

// ═══════════════════════════════════════════════════════════════════
//  HELPER: Record multiple transactions for a wallet
// ═══════════════════════════════════════════════════════════════════
interface TxData {
    amount: string   // in PAS (e.g. "15")
    src: number      // source chain ID
    dst: number      // dest chain ID
    flagged: boolean  // was counterparty flagged?
}

async function recordTxs(
    registry: any,
    wallet: string,
    txs: TxData[],
    gapSeconds: number  // simulated gap (note: actual block.timestamp may differ)
) {
    for (let i = 0; i < txs.length; i++) {
        const tx = await registry.recordTransaction(
            wallet,
            ethers.parseEther(txs[i].amount),
            txs[i].src,
            txs[i].dst,
            txs[i].flagged
        )
        await tx.wait()

        // Show progress for large batches
        if (txs.length > 10 && (i + 1) % 25 === 0) {
            process.stdout.write(`  [${i + 1}/${txs.length} txs recorded]\n`)
        }
    }
    console.log(`  Recorded ${txs.length} transactions`)
}

// ═══════════════════════════════════════════════════════════════════
//  HELPER: Print wallet profile and compare with expected values
// ═══════════════════════════════════════════════════════════════════
async function printProfile(
    registry: any,
    wallet: string,
    expectedScore: string,
    expectedFlag: boolean
) {
    const profile = await registry.getFullProfile(wallet)
    const score = Number(profile.riskScore)
    const flagged = profile.isFlagged

    console.log(`  Total Volume:    ${ethers.formatEther(profile.totalVolume)} PAS`)
    console.log(`  Tx Count:        ${profile.txCount}`)
    console.log(`  Avg Time Gap:    ${profile.avgTimeBetweenTxs}s`)
    console.log(`  Unique Chains:   ${profile.uniqueChains}`)
    console.log(`  Flagged Hits:    ${profile.flaggedInteractions}`)
    console.log(`  ───────────────────────────`)
    console.log(`  Risk Score:      ${score} (expected: ${expectedScore})`)
    console.log(`  Flagged:         ${flagged} (expected: ${expectedFlag})`)
    console.log(`  Result:          ${flagged === expectedFlag ? "✅ PASS" : "❌ FLAG MISMATCH"}`)
}

main().catch(console.error)
