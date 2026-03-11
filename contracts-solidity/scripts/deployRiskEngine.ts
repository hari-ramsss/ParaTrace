import { ethers } from "hardhat"
import * as fs from "fs"
import * as path from "path"

async function main() {
    // Read the ink! Solidity-compatible artifacts
    const abiPath = path.resolve(__dirname, "../../contracts-rust/risk_engine/target/ink/risk_engine.abi")
    const bytecodePath = path.resolve(__dirname, "../../contracts-rust/risk_engine/target/ink/risk_engine.polkavm")

    const abi = JSON.parse(fs.readFileSync(abiPath, "utf8"))
    const bytecode = "0x" + fs.readFileSync(bytecodePath).toString("hex")

    console.log("=== Deploying ink! Risk Engine via eth-rpc ===\n")
    console.log("ABI functions:", abi.filter((x: any) => x.type === "function").map((x: any) => x.name))

    const [deployer] = await ethers.getSigners()
    console.log("Deployer:", deployer.address)

    // Deploy using the raw ABI + bytecode
    const factory = new ethers.ContractFactory(abi, bytecode, deployer)
    const contract = await factory.deploy()
    await contract.waitForDeployment()

    const address = await contract.getAddress()
    console.log("\n✅ Risk Engine deployed to:", address)
    console.log("\nUse this address as riskEngineAddress when deploying ParaTraceRegistry")
}

main().catch(console.error)
