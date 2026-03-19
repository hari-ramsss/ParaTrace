const { ethers } = require("ethers");

const ETH_RPC_URL = "https://services.polkadothub-rpc.com/testnet";
const REGISTRY_ADDRESS = "0xbA686106E15b9b27407b94Cb51bf734705cAF80a";
const REGISTRY_ABI = [
    "event TransactionRecorded(address indexed wallet, uint128 amount, uint8 sourceChain, uint8 destChain, uint8 newScore)",
    "event WalletFlagged(address indexed wallet, uint8 riskScore)"
];

async function getDashboardStats() {
    const provider = new ethers.JsonRpcProvider(ETH_RPC_URL);
    const contract = new ethers.Contract(REGISTRY_ADDRESS, REGISTRY_ABI, provider);
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = Math.max(0, currentBlock - 500000);
    const [txEvents, flagEvents] = await Promise.all([
        contract.queryFilter(contract.filters.TransactionRecorded(), fromBlock, currentBlock),
        contract.queryFilter(contract.filters.WalletFlagged(), fromBlock, currentBlock),
    ]);

    const uniqueWallets = new Set(txEvents.map(e => e.args[0]));
    const flaggedWallets = new Set(flagEvents.map(e => e.args[0]));

    const mapEvent = (e) => {
        return {
            wallet: e.args[0],
            amount: String(e.args[1]),
            sourceChain: Number(e.args[2]),
            destChain: Number(e.args[3]),
            newScore: Number(e.args[4]),
            blockNumber: e.blockNumber,
            transactionHash: e.transactionHash,
        };
    };

    const allTransactions = txEvents.map(mapEvent);

    return {
        totalTransactions: txEvents.length,
        totalWallets: uniqueWallets.size,
        flaggedCount: flaggedWallets.size,
        recentTransactions: allTransactions.slice(-5).reverse(),
        allTransactions: allTransactions.reverse(),
    };
}

getDashboardStats().then(data => console.log(JSON.stringify(data, null, 2))).catch(console.error);
