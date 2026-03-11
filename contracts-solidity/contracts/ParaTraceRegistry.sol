// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title IRiskEngine — Interface to the Rust (ink!) Risk Engine on PVM
interface IRiskEngine {
    function calculate_score(
        uint128 total_volume,
        uint32 tx_count,
        uint32 avg_time_between_txs,
        uint8 unique_chains,
        uint8 flagged_interactions
    ) external view returns (uint8);
}

/// @title ParaTrace Registry — On-Chain Risk Oracle & Wallet Monitor
/// @notice Tracks cross-chain wallet behavior, calls the Rust Risk Engine
///         for scoring, and serves as a queryable oracle for DeFi protocols.
contract ParaTraceRegistry {
    address public owner;
    address public riskEngineAddress;
    uint8 public flagThreshold = 75;

    // ── Gas-Packed Wallet Profile ────────────────────────────────────
    // totalVolume uses slot 1 (16 bytes of a 32-byte slot).
    // All remaining fields pack into slot 2 (~19 bytes < 32).
    struct WalletProfile {
        uint128 totalVolume;
        uint32  txCount;
        uint32  lastTxTimestamp;
        uint32  avgTimeBetweenTxs;
        uint16  chainBitmap;         // 1 bit per chain ID (up to 16 chains)
        uint8   uniqueChains;
        uint8   flaggedInteractions;
        uint8   riskScore;
        bool    isFlagged;
    }

    mapping(address => WalletProfile) private profiles;

    // ── Events (LOG opcodes — cheap, no storage cost) ───────────────
    event TransactionRecorded(
        address indexed wallet,
        uint128 amount,
        uint8 sourceChain,
        uint8 destChain,
        uint8 newScore
    );
    event WalletFlagged(address indexed wallet, uint8 riskScore);
    event WalletUnflagged(address indexed wallet, uint8 newScore);
    event RiskScoreUpdated(address indexed wallet, uint8 oldScore, uint8 newScore);

    // ── Modifiers ───────────────────────────────────────────────────
    modifier onlyOwner() {
        require(msg.sender == owner, "Not authorized");
        _;
    }

    // ── Constructor ─────────────────────────────────────────────────
    constructor(address _riskEngineAddress) {
        owner = msg.sender;
        riskEngineAddress = _riskEngineAddress;
    }

    // ═══════════════════════════════════════════════════════════════
    //  WRITE FUNCTIONS (called by backend indexer)
    // ═══════════════════════════════════════════════════════════════

    /// @notice Records a cross-chain transaction and recalculates the risk score.
    /// @dev This is the main entry point. The indexer calls this when it detects
    ///      an XCM transfer. All behavioral data is accumulated in-place, and
    ///      the Rust engine is called once for scoring. Total: 1 SLOAD + 1 SSTORE.
    /// @param _wallet       The wallet address being audited
    /// @param _amount       Transfer amount in wei (10^18)
    /// @param _sourceChain  Source parachain ID (0-15)
    /// @param _destChain    Destination parachain ID (0-15)
    /// @param _counterpartyFlagged Whether the counterparty wallet is already flagged
    function recordTransaction(
        address _wallet,
        uint128 _amount,
        uint8   _sourceChain,
        uint8   _destChain,
        bool    _counterpartyFlagged
    ) external onlyOwner {
        WalletProfile storage p = profiles[_wallet];

        // ── 1. Accumulate volume ────────────────────────────────────
        p.totalVolume += _amount;

        // ── 2. Increment tx count ───────────────────────────────────
        p.txCount += 1;

        // ── 3. Update velocity (running average of time gaps) ───────
        if (p.lastTxTimestamp > 0) {
            uint32 gap = uint32(block.timestamp) - p.lastTxTimestamp;
            if (p.txCount <= 2) {
                p.avgTimeBetweenTxs = gap;
            } else {
                // Weighted running average: (old * 0.7) + (new * 0.3)
                // Using integer math: (old * 7 + gap * 3) / 10
                p.avgTimeBetweenTxs = (p.avgTimeBetweenTxs * 7 + gap * 3) / 10;
            }
        }
        p.lastTxTimestamp = uint32(block.timestamp);

        // ── 4. Update chain diversity via bitmap (zero extra storage) ─
        uint16 newBitmap = p.chainBitmap | (uint16(1) << _sourceChain) | (uint16(1) << _destChain);
        if (newBitmap != p.chainBitmap) {
            p.chainBitmap = newBitmap;
            p.uniqueChains = _popcount16(newBitmap);
        }

        // ── 5. Track flagged interactions ───────────────────────────
        if (_counterpartyFlagged) {
            p.flaggedInteractions += 1;
        }

        // ── 6. Cross-contract call to Rust Risk Engine (view = cheap) ─
        uint8 oldScore = p.riskScore;
        p.riskScore = IRiskEngine(riskEngineAddress).calculate_score(
            p.totalVolume,
            p.txCount,
            p.avgTimeBetweenTxs,
            p.uniqueChains,
            p.flaggedInteractions
        );

        // ── 7. Auto-flag / unflag based on threshold ────────────────
        bool wasFlagged = p.isFlagged;
        p.isFlagged = p.riskScore > flagThreshold;

        // ── 8. Emit events ──────────────────────────────────────────
        if (p.riskScore != oldScore) {
            emit RiskScoreUpdated(_wallet, oldScore, p.riskScore);
        }
        if (p.isFlagged && !wasFlagged) {
            emit WalletFlagged(_wallet, p.riskScore);
        }
        if (!p.isFlagged && wasFlagged) {
            emit WalletUnflagged(_wallet, p.riskScore);
        }
        emit TransactionRecorded(_wallet, _amount, _sourceChain, _destChain, p.riskScore);
    }

    /// @notice Legacy/simple audit function for backwards compatibility.
    function processWalletAudit(address _wallet, uint128 _volume, uint32 _count) external {
        uint8 score = IRiskEngine(riskEngineAddress).calculate_score(
            _volume, _count, 0, 0, 0
        );
        profiles[_wallet].riskScore = score;
        profiles[_wallet].isFlagged = score > flagThreshold;
    }

    // ═══════════════════════════════════════════════════════════════
    //  ORACLE / VIEW FUNCTIONS (free for external callers)
    // ═══════════════════════════════════════════════════════════════

    /// @notice Returns the risk score for a wallet (0-100).
    function getRiskScore(address _wallet) external view returns (uint8) {
        return profiles[_wallet].riskScore;
    }

    /// @notice Returns whether a wallet is flagged as high-risk.
    function isWalletFlagged(address _wallet) external view returns (bool) {
        return profiles[_wallet].isFlagged;
    }

    /// @notice Returns risk score and flag status (legacy interface).
    function getRiskData(address _wallet) external view returns (uint8, bool) {
        return (profiles[_wallet].riskScore, profiles[_wallet].isFlagged);
    }

    /// @notice Returns the full behavioral profile of a wallet.
    function getFullProfile(address _wallet) external view returns (WalletProfile memory) {
        return profiles[_wallet];
    }

    // ═══════════════════════════════════════════════════════════════
    //  ADMIN FUNCTIONS
    // ═══════════════════════════════════════════════════════════════

    /// @notice Update the Rust Risk Engine contract address.
    function updateRiskEngineAddress(address _newAddress) external onlyOwner {
        riskEngineAddress = _newAddress;
    }

    /// @notice Update the flag threshold (default: 75).
    function setFlagThreshold(uint8 _threshold) external onlyOwner {
        flagThreshold = _threshold;
    }

    /// @notice Transfer ownership to a new address.
    function transferOwnership(address _newOwner) external onlyOwner {
        owner = _newOwner;
    }

    // ═══════════════════════════════════════════════════════════════
    //  INTERNAL HELPERS
    // ═══════════════════════════════════════════════════════════════

    /// @dev Counts the number of set bits in a uint16 (population count).
    ///      Used to count unique chains from the bitmap. Costs ~5 bitwise ops.
    function _popcount16(uint16 x) internal pure returns (uint8) {
        uint16 count = 0;
        while (x != 0) {
            count += 1;
            x &= (x - 1); // Clear lowest set bit
        }
        return uint8(count);
    }
}