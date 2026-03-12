import { buildModule } from "@nomicfoundation/hardhat-ignition/modules"

const ParaTraceModule = buildModule("ParaTraceModule", (m) => {
    const riskEngineAddress = m.getParameter("riskEngineAddress")
    const registry = m.contract("ParaTraceRegistry", [riskEngineAddress])
    return { registry }
})

export default ParaTraceModule
