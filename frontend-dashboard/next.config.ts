import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Fix "Octal escape sequences are not allowed in template strings" in production.
  // @polkadot packages contain \0 (null/octal) escapes that break when bundled into
  // template literals in strict mode. This replaces them with the valid \x00 hex form.
  webpack: (config) => {
    config.module.rules.push({
      test: /\.js$/,
      include: /node_modules[\\/]@polkadot/,
      loader: 'string-replace-loader',
      options: {
        multiple: [
          {
            // Match literal \0 in source text (regex \\0, JS string '\\\\0')
            search: '\\0',
            replace: '\\x00',
            flags: 'g',
          },
        ],
      },
    });
    return config;
  },
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
