#!/usr/bin/env node
/**
 * gateway/verify.js
 * Recalcule le SHA256 d'une image Docker et le compare au hash on-chain.
 *
 * Usage:
 *   node gateway/verify.js <image-name> <path-to-image.tar>
 *   node gateway/verify.js myapp:v1.0.0 ./myapp.tar
 *
 * Exit codes:
 *   0 — VALID    (hash matches on-chain record)
 *   1 — TAMPERED (hash mismatch or image revoked)
 *   2 — NOT FOUND (image not registered)
 */
require("dotenv").config();
const fs      = require("fs");
const crypto  = require("crypto");
const { ethers } = require("ethers");

const ABI = [
  "function getImage(string calldata imageName) external view returns (bytes32, uint256, address, bool, bool)",
  "function verifyImage(string calldata imageName, bytes32 imageHash) external returns (bool)",
];

function sha256File(filePath) {
  return new Promise((resolve, reject) => {
    const hash   = crypto.createHash("sha256");
    const stream = fs.createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end",  ()      => resolve(hash.digest("hex")));
    stream.on("error", reject);
  });
}

async function main() {
  const [imageName, imagePath] = process.argv.slice(2);

  if (!imageName || !imagePath) {
    console.error("Usage: node gateway/verify.js <image-name> <path-to-image.tar>");
    process.exit(1);
  }

  if (!fs.existsSync(imagePath)) {
    console.error(`File not found: ${imagePath}`);
    process.exit(1);
  }

  console.log(`Computing SHA256 of ${imagePath}...`);
  const hexHash     = await sha256File(imagePath);
  const bytes32Hash = "0x" + hexHash;
  console.log(`SHA256: ${hexHash}`);

  const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
  const wallet   = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, ABI, wallet);

  let record;
  try {
    record = await contract.getImage(imageName);
  } catch {
    console.error(`\n[NOT FOUND] "${imageName}" is not registered on-chain.`);
    process.exit(2);
  }

  const [onChainHash, timestamp, registeredBy, , revoked] = record;

  if (revoked) {
    console.error(`\n[REVOKED] "${imageName}" has been revoked on-chain.`);
    console.log(`  Registered by : ${registeredBy}`);
    console.log(`  At            : ${new Date(Number(timestamp) * 1000).toISOString()}`);
    process.exit(1);
  }

  const valid = await contract.verifyImage.staticCall(imageName, bytes32Hash);

  if (valid) {
    console.log(`\n[VALID] "${imageName}" integrity confirmed.`);
    console.log(`  On-chain hash : ${onChainHash}`);
    console.log(`  Local hash    : ${hexHash}`);
    console.log(`  Registered by : ${registeredBy}`);
    console.log(`  At            : ${new Date(Number(timestamp) * 1000).toISOString()}`);
    process.exit(0);
  } else {
    console.error(`\n[TAMPERED] Hash mismatch for "${imageName}"!`);
    console.error(`  Expected (on-chain) : ${onChainHash}`);
    console.error(`  Got (local)         : ${bytes32Hash}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
