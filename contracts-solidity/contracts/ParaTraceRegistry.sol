// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

// This interface must match the selector defined in the Rust contract
interface IRiskEngine {
    function calculate_score(uint128 volume, uint32 tx_count) external view returns (uint8);
}

contract ParaTraceRegistry {
    address public owner;
    address public riskEngineAddress;

    struct WalletProfile {
        uint8 riskScore;
        bool isFlagged;
    }

    mapping(address => WalletProfile) public registry;

    constructor(address _riskEngineAddress) {
        owner = msg.sender;
        riskEngineAddress = _riskEngineAddress;
    }

    /**
     * @notice This function performs the cross-language call
     * from Solidity (PVM) to the Rust (ink!) contract.
     */
    function processWalletAudit(address _wallet, uint128 _volume, uint32 _count) external {
        // Calling the Rust contract natively on the PVM
        uint8 score = IRiskEngine(riskEngineAddress).calculate_score(_volume, _count);

        registry[_wallet] = WalletProfile({
            riskScore: score,
            isFlagged: score > 75
        });
    }

    function getRiskData(address _wallet) external view returns (uint8, bool) {
        return (registry[_wallet].riskScore, registry[_wallet].isFlagged);
    }
}