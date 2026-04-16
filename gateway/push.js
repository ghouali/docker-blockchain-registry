#!/usr/bin/env node
/**
 * gateway/push.js
 * Calcule le SHA256 d'une image Docker et enregistre le hash on-chain.
 *
 * Usage:
 *   node gateway/push.js <image-name> <path-to-image.tar>
 *   node gateway/push.js myapp:v1.0.0 ./myapp.tar
 */
require("dotenv").config();
const fs      = require("fs");
const crypto  = require("crypto");
const { ethers } = require("ethers");

const ABI = [
  "function registerImage(string calldata imageName, bytes32 imageHash) external",
  "event ImageRegistered(string indexed imageName, bytes32 indexed imageHash, address indexed registeredBy, uint256 timestamp)",
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
    console.error("Usage: node gateway/push.js <image-name> <path-to-image.tar>");
    process.exit(1);
  }

  if (!fs.existsSync(imagePath)) {
    console.error(`File not found: ${imagePath}`);
    process.exit(1);
  }

  console.log(`Computing SHA256 of ${imagePath}...`);
  const hexHash = await sha256File(imagePath);
  const bytes32Hash = "0x" + hexHash;
  console.log(`SHA256: ${hexHash}`);

  const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
  const wallet   = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, ABI, wallet);

  console.log(`Registering "${imageName}" on-chain...`);
  const tx      = await contract.registerImage(imageName, bytes32Hash);
  const receipt = await tx.wait();

  console.log(`\nSuccess!`);
  console.log(`  Image : ${imageName}`);
  console.log(`  Hash  : ${hexHash}`);
  console.log(`  Tx    : ${receipt.hash}`);
  console.log(`  Block : ${receipt.blockNumber}`);
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
