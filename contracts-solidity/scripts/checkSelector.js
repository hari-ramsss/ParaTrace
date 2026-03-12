const ethers = require("ethers")
const sig = "calculate_score(uint128,uint32)"
const selector = ethers.id(sig).slice(0, 10)
console.log("Solidity selector for " + sig + ": " + selector)
console.log("ink! contract uses: 0x0a0b0c0d")
console.log("Match: " + (selector === "0x0a0b0c0d"))
