/**
 * postinstall-patch.js
 * 
 * Patches @polkadot packages to fix "Octal escape sequences are not allowed
 * in template strings" error in Next.js production builds.
 */

const fs = require('fs');
const path = require('path');

const filesToPatch = [
    'node_modules/@polkadot/util-crypto/bundle-polkadot-util-crypto.js',
    'node_modules/@polkadot/util/is/wasm.js',
    'node_modules/@polkadot/util/cjs/is/wasm.js',
    'node_modules/@polkadot/extension-dapp/node_modules/@polkadot/util/is/wasm.js',
    'node_modules/@polkadot/extension-dapp/node_modules/@polkadot/util/cjs/is/wasm.js',
    'node_modules/@polkadot/extension-inject/node_modules/@polkadot/util/is/wasm.js',
    'node_modules/@polkadot/extension-inject/node_modules/@polkadot/util/cjs/is/wasm.js',
];

let patchedCount = 0;

for (const relPath of filesToPatch) {
    const fullPath = path.resolve(__dirname, '..', relPath);

    if (!fs.existsSync(fullPath)) {
        continue;
    }

    let content = fs.readFileSync(fullPath, 'utf8');
    const original = content;

    // 1. Fix the specific template literal issue in util-crypto
    // The source contains: proving${'\0'}0
    content = content.replace(/proving\$\{'\\0'\}0/g, "proving${'\\\\x00'}0");

    // 2. Fix the specific comments in wasm.js
    // The source contains: // \0asm
    content = content.replace(/\/\/ \\0asm/g, "// \\\\x00asm");

    if (content !== original) {
        fs.writeFileSync(fullPath, content, 'utf8');
        patchedCount++;
        console.log(`  ✅ Patched: ${relPath}`);
    }
}

console.log(`\n🔧 @polkadot octal escape patch: ${patchedCount} file(s) patched successfully.`);
