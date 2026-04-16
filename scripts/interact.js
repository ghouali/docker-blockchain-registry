require("dotenv").config();
const { ethers } = require("ethers");

const ABI = [
  "function registerImage(string calldata imageName, bytes32 imageHash) external",
  "function revokeImage(string calldata imageName) external",
  "function verifyImage(string calldata imageName, bytes32 imageHash) external returns (bool)",
  "function getImage(string calldata imageName) external view returns (bytes32, uint256, address, bool, bool)",
  "function getAllImageNames() external view returns (string[])",
  "function getImageCount() external view returns (uint256)",
  "function owner() external view returns (address)",
  "event ImageRegistered(string indexed imageName, bytes32 indexed imageHash, address indexed registeredBy, uint256 timestamp)",
  "event ImageRevoked(string indexed imageName, address indexed revokedBy, uint256 timestamp)",
  "event ImageVerified(string indexed imageName, bool valid, address indexed checkedBy)",
];

async function getContract() {
  const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  return new ethers.Contract(process.env.CONTRACT_ADDRESS, ABI, wallet);
}

async function register(imageName, sha256Hex) {
  const contract = await getContract();
  const hash = "0x" + sha256Hex.replace(/^0x/, "");
  const tx = await contract.registerImage(imageName, hash);
  const receipt = await tx.wait();
  console.log(`Registered "${imageName}" — tx: ${receipt.hash}`);
}

async function revoke(imageName) {
  const contract = await getContract();
  const tx = await contract.revokeImage(imageName);
  const receipt = await tx.wait();
  console.log(`Revoked "${imageName}" — tx: ${receipt.hash}`);
}

async function verify(imageName, sha256Hex) {
  const contract = await getContract();
  const hash = "0x" + sha256Hex.replace(/^0x/, "");
  const valid = await contract.verifyImage.staticCall(imageName, hash);
  console.log(`Verify "${imageName}": ${valid ? "VALID" : "TAMPERED or NOT FOUND"}`);
  return valid;
}

async function listAll() {
  const contract = await getContract();
  const names = await contract.getAllImageNames();
  console.log(`Total images: ${names.length}`);
  for (const name of names) {
    const [hash, ts, by, exists, revoked] = await contract.getImage(name);
    console.log({
      name,
      hash,
      registeredBy: by,
      date: new Date(Number(ts) * 1000).toISOString(),
      revoked,
    });
  }
}

const [, , cmd, ...args] = process.argv;

if (cmd === "register") register(args[0], args[1]);
else if (cmd === "revoke") revoke(args[0]);
else if (cmd === "verify") verify(args[0], args[1]);
else if (cmd === "list") listAll();
else console.log("Usage: node interact.js <register|revoke|verify|list> [args...]");
