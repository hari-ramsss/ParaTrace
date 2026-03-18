import { HardhatUserConfig, vars } from "hardhat/config"
import "@nomicfoundation/hardhat-toolbox"
import "@parity/hardhat-polkadot"

const config: HardhatUserConfig = {
    solidity: "0.8.28",
    networks: {
        hardhat: {
            polkadot: {
                target: "pvm",
            },
            nodeConfig: {
                nodeBinaryPath: "./bin/revive-dev-node-linux-x64", 
                rpcPort: 8000,
                dev: true,
            },
            adapterConfig: {
                adapterBinaryPath: "./bin/eth-rpc-linux-x64", 
                dev: true,
            },
        },
        localNode: {
            polkadot: {
                target: "pvm", 
            },
            url: "http://127.0.0.1:8545",
        },
        // ── Zombienet local network ─────────────────────────────────────────
        // Relay chain (rococo-local) + Asset Hub (parachain 1000) spun up via:
        //   bash zombienet/start-local-stack.sh
        // eth-rpc adapter must be running on port 8545 (started by the script).
        // Uses the same port as localNode so existing deploy/test scripts work.
        zombienet: {
            polkadot: {
                target: "pvm",
            },
            url: "http://127.0.0.1:8545",
        },
        polkadotHubTestnet: {
            polkadot: {
                target: "pvm",
            },
            url: "https://eth-rpc-testnet.polkadot.io/",
            accounts: [vars.get("PRIVATE_KEY")],
        },
    },
}
export default config