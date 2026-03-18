const { ethers } = require("ethers");

const ETH_RPC_URL = "https://services.polkadothub-rpc.com/testnet";
const REGISTRY_ADDRESS = "0xbA686106E15b9b27407b94Cb51bf734705cAF80a";

const REGISTRY_ABI = [
    "event TransactionRecorded(address indexed wallet, uint128 amount, uint8 sourceChain, uint8 destChain, uint8 newScore)",
    "event WalletFlagged(address indexed wallet, uint8 riskScore)"
];

async function main() {
    console.log("Connecting to", ETH_RPC_URL);
    const provider = new ethers.JsonRpcProvider(ETH_RPC_URL);
    const currentBlock = await provider.getBlockNumber();

    const contract = new ethers.Contract(REGISTRY_ADDRESS, REGISTRY_ABI, provider);

    // Polkadot Hub Testnet blocks started around 6m? Let's just try 6000000.
    const fromBlock = 6400000;
    console.log("Querying for events from block", fromBlock, "to", currentBlock);

    try {
        const events = await contract.queryFilter(contract.filters.TransactionRecorded(), fromBlock, currentBlock);
        console.log("TransactionRecorded events found:", events.length);
        if (events.length > 0) {
            console.log("Sample event:", events[events.length - 1].args);
            console.log("Sample block:", events[events.length - 1].blockNumber);
        }
    } catch (e) {
        console.error("Error querying events:", e.message);
    }
}

main();
