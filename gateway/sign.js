#!/usr/bin/env node
/**
 * gateway/sign.js
 * Utilitaire de signature ECDSA off-chain pour le CI/CD.
 *
 * Le CI signe : keccak256(imageName, imageHash, version, contractAddress)
 * La signature est soumise on-chain via registerImageWithSignature().
 * La clé privée du CI n'a jamais accès direct au contrat.
 *
 * Usage:
 *   node gateway/sign.js <image-name> <sha256-hex> <version> <contract-address>
 *   node gateway/sign.js myapp:v1.0 a3f8b2c1... 1 0x2605a84e...
 *
 * Output (JSON):
 *   { imageName, imageHash, version, contractAddress, signer, signature }
 */
require("dotenv").config();
const { ethers } = require("ethers");

async function main() {
  const [imageName, sha256Hex, version, contractAddress] = process.argv.slice(2);

  if (!imageName || !sha256Hex || !version || !contractAddress) {
    console.error("Usage: node gateway/sign.js <image-name> <sha256-hex> <version> <contract-address>");
    process.exit(1);
  }

  if (!/^[0-9a-fA-F]{64}$/.test(sha256Hex)) {
    console.error("Error: sha256-hex must be exactly 64 hex characters");
    process.exit(1);
  }

  const signerKey = process.env.SIGNER_PRIVATE_KEY || process.env.PRIVATE_KEY;
  if (!signerKey) {
    console.error("Error: SIGNER_PRIVATE_KEY not set in .env");
    process.exit(1);
  }

  const wallet      = new ethers.Wallet(signerKey);
  const imageHash   = "0x" + sha256Hex;
  const versionNum  = parseInt(version, 10);

  // Reconstruit exactement le même hash que le contrat
  const msgHash = ethers.solidityPackedKeccak256(
    ["string", "bytes32", "uint256", "address"],
    [imageName, imageHash, versionNum, contractAddress]
  );

  // Signe avec le préfixe Ethereum (\x19Ethereum Signed Message:\n32)
  const signature = await wallet.signMessage(ethers.getBytes(msgHash));

  const result = {
    imageName,
    imageHash,
    version:         versionNum,
    contractAddress,
    signer:          wallet.address,
    signature,
  };

  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
