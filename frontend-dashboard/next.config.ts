import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Transpile @polkadot packages for ESM/CJS compatibility
  transpilePackages: [
    "@polkadot/api",
    "@polkadot/api-augment",
    "@polkadot/api-base",
    "@polkadot/api-contract",
    "@polkadot/api-derive",
    "@polkadot/extension-dapp",
    "@polkadot/extension-inject",
    "@polkadot/keyring",
    "@polkadot/networks",
    "@polkadot/rpc-augment",
    "@polkadot/rpc-core",
    "@polkadot/rpc-provider",
    "@polkadot/types",
    "@polkadot/types-augment",
    "@polkadot/types-codec",
    "@polkadot/types-create",
    "@polkadot/types-known",
    "@polkadot/util",
    "@polkadot/util-crypto",
    "@polkadot/wasm-crypto",
    "@polkadot/x-bigint",
    "@polkadot/x-fetch",
    "@polkadot/x-global",
    "@polkadot/x-randomvalues",
    "@polkadot/x-textdecoder",
    "@polkadot/x-textencoder",
    "@polkadot/x-ws",
  ],
};

export default nextConfig;
