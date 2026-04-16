#!/usr/bin/env node
/**
 * gateway/push.js
 * Enregistre une image Docker on-chain via signature ECDSA (mode recommandé)
 * ou via owner direct (mode legacy).
 *
 * Mode signature (défaut) :
 *   Le CI signe off-chain avec SIGNER_PRIVATE_KEY.
 *   N'importe quelle adresse peut soumettre la transaction.
 *
 * Usage:
 *   node gateway/push.js <image-name> <path-to-image.tar> [version]
 *   node gateway/push.js myapp:v1.0.0 ./myapp.tar 1
 */
require("dotenv").config();
const fs      = require("fs");
const crypto  = require("crypto");
const { ethers } = require("ethers");

const ABI = [
  "function registerImage(string calldata imageName, bytes32 imageHash) external",
  "function registerImageWithSignature(string calldata imageName, bytes32 imageHash, uint256 version, bytes calldata signature) external",
  "function addSigner(address signer) external",
  "function trustedSigners(address) external view returns (bool)",
  "function getMessageHash(string calldata imageName, bytes32 imageHash, uint256 version) external view returns (bytes32)",
  "event ImageRegistered(string indexed, bytes32 indexed, address indexed, uint256)",
  "event ImageRegisteredWithSignature(string indexed, bytes32 indexed, address indexed, uint256, uint256)",
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
  const [imageName, imagePath, versionArg] = process.argv.slice(2);

  if (!imageName || !imagePath) {
    console.error("Usage: node gateway/push.js <image-name> <path-to-image.tar> [version]");
    process.exit(1);
  }

  if (!fs.existsSync(imagePath)) {
    console.error(`File not found: ${imagePath}`);
    process.exit(1);
  }

  console.log(`\n[1/4] Computing SHA256 of ${imagePath}...`);
  const hexHash   = await sha256File(imagePath);
  const imageHash = "0x" + hexHash;
  console.log(`      SHA256: ${hexHash}`);

  const provider    = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
  const submitter   = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  const contract    = new ethers.Contract(process.env.CONTRACT_ADDRESS, ABI, submitter);

  // Détermine le mode : signature si SIGNER_PRIVATE_KEY est défini
  const signerKey   = process.env.SIGNER_PRIVATE_KEY;
  const useSig      = Boolean(signerKey);
  const version     = parseInt(versionArg ?? "1", 10);

  if (useSig) {
    console.log(`\n[2/4] Signing off-chain with CI signer key...`);
    const signerWallet = new ethers.Wallet(signerKey);

    // Vérifie que le signer est dans trustedSigners
    const isTrusted = await contract.trustedSigners(signerWallet.address);
    if (!isTrusted) {
      console.error(`\nError: ${signerWallet.address} is not a trusted signer.`);
      console.error("Ask the contract owner to call addSigner() first.");
      process.exit(1);
    }

    // Construit le message hash (identique au contrat)
    const msgHash = ethers.solidityPackedKeccak256(
      ["string", "bytes32", "uint256", "address"],
      [imageName, imageHash, version, process.env.CONTRACT_ADDRESS]
    );
    const signature = await signerWallet.signMessage(ethers.getBytes(msgHash));

    console.log(`      Signer  : ${signerWallet.address}`);
    console.log(`      Version : ${version}`);
    console.log(`      Sig     : ${signature.slice(0, 20)}…`);

    console.log(`\n[3/4] Submitting registerImageWithSignature() on-chain...`);
    const tx      = await contract.registerImageWithSignature(imageName, imageHash, version, signature);
    const receipt = await tx.wait();

    console.log(`\n[4/4] Success! (Signature-based attestation)`);
    console.log(`      Image   : ${imageName}`);
    console.log(`      Hash    : ${hexHash}`);
    console.log(`      Version : ${version}`);
    console.log(`      Signer  : ${signerWallet.address}`);
    console.log(`      Tx      : ${receipt.hash}`);
    console.log(`      Block   : ${receipt.blockNumber}`);

  } else {
    // Mode legacy : owner direct
    console.log(`\n[2/4] Mode legacy (owner direct)...`);
    console.log(`      Submitter: ${submitter.address}`);

    console.log(`\n[3/4] Submitting registerImage() on-chain...`);
    const tx      = await contract.registerImage(imageName, imageHash);
    const receipt = await tx.wait();

    console.log(`\n[4/4] Success! (Owner direct)`);
    console.log(`      Image : ${imageName}`);
    console.log(`      Hash  : ${hexHash}`);
    console.log(`      Tx    : ${receipt.hash}`);
    console.log(`      Block : ${receipt.blockNumber}`);
  }
}

main().catch((err) => {
  console.error("\nError:", err.reason ?? err.message);
  process.exit(1);
});
