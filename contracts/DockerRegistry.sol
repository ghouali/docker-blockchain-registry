// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/**
 * @title   DockerRegistry
 * @notice  Registre décentralisé des hashs SHA256 d'images Docker.
 *
 * @dev     Deux modes d'enregistrement :
 *          1. Owner direct    — registerImage()              (accès legacy)
 *          2. Signature ECDSA — registerImageWithSignature() (recommandé)
 *
 *          Mode signature : le CI signe off-chain, n'importe qui soumet on-chain.
 *          Le contrat vérifie que le signataire est dans trustedSigners.
 *          Cela évite d'exposer la clé privée du contrat dans les pipelines CI.
 */
contract DockerRegistry {
    using ECDSA            for bytes32;
    using MessageHashUtils for bytes32;

    // =========================================================================
    // STRUCTURES
    // =========================================================================

    struct ImageRecord {
        bytes32 imageHash;
        uint256 timestamp;
        address registeredBy;   // adresse du signataire (pas forcément msg.sender)
        bool    exists;
        bool    revoked;
        uint256 version;        // version de l'image pour éviter les replays
        bool    signatureBased; // true si enregistré via ECDSA
    }

    // =========================================================================
    // STATE
    // =========================================================================

    address public owner;

    mapping(string  => ImageRecord) private registry;
    mapping(address => bool)        public  trustedSigners;
    mapping(bytes32 => bool)        private usedSignatures; // anti-replay

    string[]  private imageNames;
    address[] private signerList;

    // =========================================================================
    // EVENTS
    // =========================================================================

    event ImageRegistered(
        string  indexed imageName,
        bytes32 indexed imageHash,
        address indexed registeredBy,
        uint256         timestamp
    );

    event ImageRegisteredWithSignature(
        string  indexed imageName,
        bytes32 indexed imageHash,
        address indexed signer,
        uint256         version,
        uint256         timestamp
    );

    event ImageRevoked(
        string  indexed imageName,
        address indexed revokedBy,
        uint256         timestamp
    );

    event ImageVerified(
        string  indexed imageName,
        bool            valid,
        address indexed checkedBy
    );

    event SignerAdded(address indexed signer, address indexed addedBy);
    event SignerRemoved(address indexed signer, address indexed removedBy);

    // =========================================================================
    // MODIFIERS
    // =========================================================================

    modifier onlyOwner() {
        require(msg.sender == owner, "DockerRegistry: caller is not the owner");
        _;
    }

    modifier validName(string calldata imageName) {
        require(bytes(imageName).length > 0, "DockerRegistry: image name cannot be empty");
        _;
    }

    // =========================================================================
    // CONSTRUCTOR
    // =========================================================================

    constructor() {
        owner = msg.sender;
    }

    // =========================================================================
    // SIGNER MANAGEMENT (owner only)
    // =========================================================================

    /**
     * @notice Ajoute une adresse comme signataire de confiance.
     * @param  signer Adresse du CI/CD ou du système off-chain autorisé.
     */
    function addSigner(address signer) external onlyOwner {
        require(signer != address(0),    "DockerRegistry: zero address");
        require(!trustedSigners[signer], "DockerRegistry: already a signer");
        trustedSigners[signer] = true;
        signerList.push(signer);
        emit SignerAdded(signer, msg.sender);
    }

    /**
     * @notice Révoque un signataire de confiance.
     * @param  signer Adresse à retirer.
     */
    function removeSigner(address signer) external onlyOwner {
        require(trustedSigners[signer], "DockerRegistry: not a signer");
        trustedSigners[signer] = false;
        // Retire de la liste
        for (uint256 i = 0; i < signerList.length; i++) {
            if (signerList[i] == signer) {
                signerList[i] = signerList[signerList.length - 1];
                signerList.pop();
                break;
            }
        }
        emit SignerRemoved(signer, msg.sender);
    }

    /**
     * @notice Retourne la liste des signataires de confiance actifs.
     */
    function getTrustedSigners() external view returns (address[] memory) {
        return signerList;
    }

    // =========================================================================
    // REGISTRATION — Mode 1 : Direct (ouvert à tous)
    // =========================================================================

    /**
     * @notice Enregistre un hash directement. Toute adresse peut enregistrer.
     *         msg.sender devient le registrant et peut révoquer sa propre image.
     */
    function registerImage(
        string  calldata imageName,
        bytes32          imageHash
    )
        external
        validName(imageName)
    {
        require(imageHash != bytes32(0), "DockerRegistry: hash cannot be zero");
        require(
            !registry[imageName].exists || registry[imageName].revoked,
            "DockerRegistry: image already registered and active"
        );

        if (!registry[imageName].exists) {
            imageNames.push(imageName);
        }

        registry[imageName] = ImageRecord({
            imageHash:      imageHash,
            timestamp:      block.timestamp,
            registeredBy:   msg.sender,
            exists:         true,
            revoked:        false,
            version:        0,
            signatureBased: false
        });

        emit ImageRegistered(imageName, imageHash, msg.sender, block.timestamp);
    }

    // =========================================================================
    // REGISTRATION — Mode 2 : Signature ECDSA (recommandé)
    // =========================================================================

    /**
     * @notice Enregistre un hash via une signature ECDSA d'un signataire de confiance.
     *
     * @dev    Le CI signe off-chain : keccak256(imageName, imageHash, version, address(this))
     *         N'importe qui peut soumettre la transaction — seule la signature compte.
     *         Protection anti-replay via usedSignatures.
     *
     * @param imageName  Nom de l'image Docker.
     * @param imageHash  Hash SHA256 de l'image (bytes32).
     * @param version    Version incrémentale (évite les replays).
     * @param signature  Signature ECDSA 65 bytes du signataire.
     */
    function registerImageWithSignature(
        string   calldata imageName,
        bytes32           imageHash,
        uint256           version,
        bytes    calldata signature
    )
        external
        validName(imageName)
    {
        require(imageHash != bytes32(0), "DockerRegistry: hash cannot be zero");
        require(
            !registry[imageName].exists || registry[imageName].revoked,
            "DockerRegistry: image already registered and active"
        );

        // Reconstruit le message signé off-chain
        bytes32 msgHash = keccak256(
            abi.encodePacked(imageName, imageHash, version, address(this))
        );
        bytes32 ethHash = msgHash.toEthSignedMessageHash();

        // Anti-replay : la même signature ne peut être soumise qu'une fois
        require(!usedSignatures[ethHash], "DockerRegistry: signature already used");

        // Récupère le signataire
        address signer = ethHash.recover(signature);
        require(trustedSigners[signer], "DockerRegistry: signer not trusted");

        // Marque la signature comme utilisée
        usedSignatures[ethHash] = true;

        if (!registry[imageName].exists) {
            imageNames.push(imageName);
        }

        registry[imageName] = ImageRecord({
            imageHash:      imageHash,
            timestamp:      block.timestamp,
            registeredBy:   signer,
            exists:         true,
            revoked:        false,
            version:        version,
            signatureBased: true
        });

        emit ImageRegisteredWithSignature(imageName, imageHash, signer, version, block.timestamp);
    }

    // =========================================================================
    // REVOCATION (registrant ou owner)
    // =========================================================================

    /**
     * @notice Révoque une image.
     *         Seul le registrant de l'image ou le owner du contrat peut révoquer.
     *         Décentralisé : chaque utilisateur contrôle ses propres images.
     */
    function revokeImage(string calldata imageName)
        external
        validName(imageName)
    {
        require(registry[imageName].exists,   "DockerRegistry: image not found");
        require(!registry[imageName].revoked, "DockerRegistry: image already revoked");
        require(
            msg.sender == registry[imageName].registeredBy || msg.sender == owner,
            "DockerRegistry: caller is not the registrant nor the owner"
        );

        registry[imageName].revoked = true;

        emit ImageRevoked(imageName, msg.sender, block.timestamp);
    }

    // =========================================================================
    // VERIFICATION
    // =========================================================================

    /**
     * @notice Vérifie qu'un hash correspond à l'enregistrement on-chain.
     * @return valid True si l'image est intègre et non révoquée.
     */
    function verifyImage(
        string  calldata imageName,
        bytes32          imageHash
    )
        external
        validName(imageName)
        returns (bool valid)
    {
        require(imageHash != bytes32(0), "DockerRegistry: hash cannot be zero");

        ImageRecord storage record = registry[imageName];

        valid = (
            record.exists &&
            !record.revoked &&
            record.imageHash == imageHash
        );

        emit ImageVerified(imageName, valid, msg.sender);
        return valid;
    }

    // =========================================================================
    // GETTERS
    // =========================================================================

    function getImage(string calldata imageName)
        external
        view
        validName(imageName)
        returns (
            bytes32 imageHash,
            uint256 timestamp,
            address registeredBy,
            bool    exists,
            bool    revoked,
            uint256 version,
            bool    signatureBased
        )
    {
        require(registry[imageName].exists, "DockerRegistry: image not found");
        ImageRecord storage r = registry[imageName];
        return (r.imageHash, r.timestamp, r.registeredBy, r.exists, r.revoked, r.version, r.signatureBased);
    }

    function getAllImageNames() external view returns (string[] memory) {
        return imageNames;
    }

    function getImageCount() external view returns (uint256) {
        return imageNames.length;
    }

    /**
     * @notice Retourne le hash du message à signer off-chain pour une image.
     * @dev    Utile pour que le CI construise exactement le bon message.
     */
    function getMessageHash(
        string  calldata imageName,
        bytes32          imageHash,
        uint256          version
    ) external view returns (bytes32) {
        return keccak256(abi.encodePacked(imageName, imageHash, version, address(this)));
    }
}
