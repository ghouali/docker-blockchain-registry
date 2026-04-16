export const CONTRACT_ABI = [
  "function registerImage(string calldata imageName, bytes32 imageHash) external",
  "function revokeImage(string calldata imageName) external",
  "function verifyImage(string calldata imageName, bytes32 imageHash) external returns (bool)",
  "function getImage(string calldata imageName) external view returns (bytes32 imageHash, uint256 timestamp, address registeredBy, bool exists, bool revoked)",
  "function getAllImageNames() external view returns (string[])",
  "function getImageCount() external view returns (uint256)",
  "function owner() external view returns (address)",
  "event ImageRegistered(string indexed imageName, bytes32 indexed imageHash, address indexed registeredBy, uint256 timestamp)",
  "event ImageRevoked(string indexed imageName, address indexed revokedBy, uint256 timestamp)",
  "event ImageVerified(string indexed imageName, bool valid, address indexed checkedBy)",
];
