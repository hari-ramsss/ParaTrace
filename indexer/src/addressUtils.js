'use strict';

/**
 * addressUtils.js
 *
 * Utilities for converting between Substrate SS58 / AccountId32 addresses and
 * Ethereum H160 addresses so the indexer can pass wallet addresses to the
 * Solidity registry.
 *
 * Mapping convention used on Polkadot Hub (pallet-evm / pallet-revive):
 *   H256 AccountId  =  12 zero-bytes  +  20-byte H160 EVM address
 *
 * So:  H160  →  H256  :  pad with 12 leading zero bytes
 *      H256  →  H160  :  take the last 20 bytes
 *
 * For pure Substrate (SS58) wallets that have never used EVM, the last-20-bytes
 * truncation is used as a best-effort representative address for the registry.
 */

const { decodeAddress } = require('@polkadot/util-crypto');
const { u8aToHex, hexToU8a } = require('@polkadot/util');

/**
 * Convert a Substrate AccountId32 (SS58 string or raw hex) to an EVM-style
 * H160 address string.
 *
 * @param {string} substrateAddress  SS58-encoded or "0x"-prefixed hex account
 * @returns {string}  Checksummed 20-byte hex address, e.g. "0x1234…abcd"
 */
function substrateToEvm(substrateAddress) {
  try {
    // decodeAddress handles both SS58 strings and raw hex
    const accountId32 = decodeAddress(substrateAddress); // Uint8Array, 32 bytes
    // Take the last 20 bytes
    const h160 = accountId32.slice(12);
    return u8aToHex(h160); // "0x" + 40 hex chars
  } catch {
    // If decoding fails (e.g. already an H160), return as-is
    if (
      typeof substrateAddress === 'string' &&
      substrateAddress.startsWith('0x') &&
      substrateAddress.length === 42
    ) {
      return substrateAddress;
    }
    throw new Error(
      `substrateToEvm: cannot convert address "${substrateAddress}"`
    );
  }
}

/**
 * Convert an EVM H160 address to a 32-byte Substrate AccountId32 hex string.
 * (Inverse of substrateToEvm for mapped accounts.)
 *
 * @param {string} evmAddress  "0x"-prefixed 20-byte hex string
 * @returns {string}  "0x"-prefixed 32-byte hex string
 */
function evmToSubstrate(evmAddress) {
  const h160 = hexToU8a(evmAddress); // 20 bytes
  const h256 = new Uint8Array(32);
  h256.set(h160, 12); // zero-pad to 32 bytes
  return u8aToHex(h256);
}

/**
 * Return true if the address looks like an EVM H160 (20-byte hex string).
 *
 * @param {string} address
 * @returns {boolean}
 */
function isEvmAddress(address) {
  return /^0x[0-9a-fA-F]{40}$/.test(address);
}

/**
 * Normalise any address format to an EVM H160 string.
 * Accepts SS58, AccountId32 hex (0x + 64 chars), or H160 (0x + 40 chars).
 *
 * @param {string} address
 * @returns {string}
 */
function toEvmAddress(address) {
  if (isEvmAddress(address)) return address;
  // 32-byte hex (AccountId32 as hex)
  if (/^0x[0-9a-fA-F]{64}$/.test(address)) {
    const bytes = hexToU8a(address);
    return u8aToHex(bytes.slice(12));
  }
  // Otherwise assume SS58
  return substrateToEvm(address);
}

module.exports = { substrateToEvm, evmToSubstrate, isEvmAddress, toEvmAddress };
