export const CONTRACT_ABI = [
  // Owner direct
  "function registerImage(string calldata imageName, bytes32 imageHash) external",
  // Signature-based (recommended)
  "function registerImageWithSignature(string calldata imageName, bytes32 imageHash, uint256 version, bytes calldata signature) external",
  // Signer management
  "function addSigner(address signer) external",
  "function removeSigner(address signer) external",
  "function getTrustedSigners() external view returns (address[])",
  "function trustedSigners(address) external view returns (bool)",
  "function getMessageHash(string calldata imageName, bytes32 imageHash, uint256 version) external view returns (bytes32)",
  // Revocation
  "function revokeImage(string calldata imageName) external",
  // Verification
  "function verifyImage(string calldata imageName, bytes32 imageHash) external returns (bool)",
  // Getters
  "function getImage(string calldata imageName) external view returns (bytes32 imageHash, uint256 timestamp, address registeredBy, bool exists, bool revoked, uint256 version, bool signatureBased)",
  "function getAllImageNames() external view returns (string[])",
  "function getImageCount() external view returns (uint256)",
  "function owner() external view returns (address)",
  // Events
  "event ImageRegistered(string indexed imageName, bytes32 indexed imageHash, address indexed registeredBy, uint256 timestamp)",
  "event ImageRegisteredWithSignature(string indexed imageName, bytes32 indexed imageHash, address indexed signer, uint256 version, uint256 timestamp)",
  "event ImageRevoked(string indexed imageName, address indexed revokedBy, uint256 timestamp)",
  "event ImageVerified(string indexed imageName, bool valid, address indexed checkedBy)",
  "event SignerAdded(address indexed signer, address indexed addedBy)",
  "event SignerRemoved(address indexed signer, address indexed removedBy)",
];
