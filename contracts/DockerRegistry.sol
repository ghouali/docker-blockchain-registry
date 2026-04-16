// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title   DockerRegistry
 * @notice  Registre décentralisé des hashs SHA256 d'images Docker sur Ethereum.
 *          Chaque image est identifiée par son nom et son hash SHA256.
 *          Le hash est stocké on-chain de façon immuable après enregistrement.
 *          Toute tentative de falsification est détectable par comparaison de hash.
 *
 * @dev     Contrat déployé sur Ethereum Sepolia Testnet.
 *          Utilise le pattern Ownable manuel (sans OpenZeppelin) pour le contrôle d'accès.
 *          Les événements sont émis à chaque mutation d'état pour permettre
 *          l'indexation côté frontend (ethers.js queryFilter).
 */
contract DockerRegistry {

    // =========================================================================
    // STRUCTURES DE DONNÉES
    // =========================================================================

    /**
     * @dev Représente une image Docker enregistrée on-chain.
     *
     * @param imageHash    Hash SHA256 de l'image au moment de l'enregistrement (32 bytes).
     * @param timestamp    Horodatage Unix du bloc d'enregistrement.
     * @param registeredBy Adresse du wallet qui a enregistré l'image.
     * @param exists       True si l'image a été enregistrée au moins une fois.
     * @param revoked      True si l'image a été révoquée par le propriétaire.
     */
    struct ImageRecord {
        bytes32 imageHash;
        uint256 timestamp;
        address registeredBy;
        bool    exists;
        bool    revoked;
    }

    // =========================================================================
    // VARIABLES D'ÉTAT
    // =========================================================================

    /// @notice Adresse du propriétaire du contrat (seul autorisé à écrire).
    address public owner;

    /**
     * @notice Table de correspondance nom d'image → enregistrement.
     * @dev    La clé est le nom complet de l'image, ex: "myapp:v1.2.3".
     *         Les entrées ne sont jamais supprimées, seulement révoquées.
     */
    mapping(string => ImageRecord) private registry;

    /// @notice Liste ordonnée des noms d'images enregistrées (pour itération frontend).
    string[] private imageNames;

    // =========================================================================
    // ÉVÉNEMENTS
    // =========================================================================

    /**
     * @notice Émis lors de l'enregistrement d'une nouvelle image.
     * @param imageName    Nom de l'image enregistrée.
     * @param imageHash    Hash SHA256 de l'image.
     * @param registeredBy Adresse du wallet ayant effectué l'enregistrement.
     * @param timestamp    Horodatage du bloc.
     */
    event ImageRegistered(
        string  indexed imageName,
        bytes32 indexed imageHash,
        address indexed registeredBy,
        uint256         timestamp
    );

    /**
     * @notice Émis lors de la révocation d'une image.
     * @param imageName  Nom de l'image révoquée.
     * @param revokedBy  Adresse du wallet ayant effectué la révocation.
     * @param timestamp  Horodatage du bloc.
     */
    event ImageRevoked(
        string  indexed imageName,
        address indexed revokedBy,
        uint256         timestamp
    );

    /**
     * @notice Émis lors d'une vérification de hash (succès ou échec).
     * @param imageName  Nom de l'image vérifiée.
     * @param valid      True si le hash correspond, false sinon.
     * @param checkedBy  Adresse du wallet ayant effectué la vérification.
     */
    event ImageVerified(
        string  indexed imageName,
        bool            valid,
        address indexed checkedBy
    );

    // =========================================================================
    // MODIFICATEURS
    // =========================================================================

    /**
     * @dev Restreint l'appel au propriétaire du contrat.
     *
     * Précondition  : msg.sender == owner
     * Postcondition : l'exécution continue normalement si la condition est vraie,
     *                 sinon la transaction est annulée (revert).
     */
    modifier onlyOwner() {
        require(msg.sender == owner, "DockerRegistry: caller is not the owner");
        _;
    }

    /**
     * @dev Vérifie que le nom d'image fourni n'est pas vide.
     *
     * Précondition  : bytes(imageName).length > 0
     * Postcondition : l'exécution continue si le nom est non vide,
     *                 sinon la transaction est annulée.
     */
    modifier validName(string calldata imageName) {
        require(bytes(imageName).length > 0, "DockerRegistry: image name cannot be empty");
        _;
    }

    // =========================================================================
    // CONSTRUCTEUR
    // =========================================================================

    /**
     * @notice Initialise le contrat et assigne le déployeur comme propriétaire.
     *
     * Précondition  : aucune (appel unique au déploiement).
     * Postcondition : owner == msg.sender (adresse du déployeur).
     */
    constructor() {
        owner = msg.sender;
    }

    // =========================================================================
    // FONCTIONS D'ÉCRITURE (restreintes au owner)
    // =========================================================================

    /**
     * @notice Enregistre le hash SHA256 d'une image Docker on-chain.
     *
     * Préconditions :
     *   - msg.sender == owner
     *   - imageName != ""
     *   - imageHash != bytes32(0)
     *   - L'image n'existe pas déjà avec un hash actif (non révoquée)
     *
     * Postconditions :
     *   - registry[imageName].imageHash == imageHash
     *   - registry[imageName].exists == true
     *   - registry[imageName].revoked == false
     *   - registry[imageName].registeredBy == msg.sender
     *   - registry[imageName].timestamp == block.timestamp
     *   - L'événement ImageRegistered est émis
     *
     * @param imageName  Nom complet de l'image, ex: "myapp:v1.2.3".
     * @param imageHash  Hash SHA256 de l'image encodé en bytes32.
     */
    function registerImage(
        string calldata imageName,
        bytes32         imageHash
    )
        external
        onlyOwner
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
            imageHash:    imageHash,
            timestamp:    block.timestamp,
            registeredBy: msg.sender,
            exists:       true,
            revoked:      false
        });

        emit ImageRegistered(imageName, imageHash, msg.sender, block.timestamp);
    }

    /**
     * @notice Révoque une image Docker enregistrée.
     *
     * Préconditions :
     *   - msg.sender == owner
     *   - imageName != ""
     *   - registry[imageName].exists == true
     *   - registry[imageName].revoked == false
     *
     * Postconditions :
     *   - registry[imageName].revoked == true
     *   - L'événement ImageRevoked est émis
     *
     * @param imageName  Nom de l'image à révoquer.
     */
    function revokeImage(string calldata imageName)
        external
        onlyOwner
        validName(imageName)
    {
        require(registry[imageName].exists,   "DockerRegistry: image not found");
        require(!registry[imageName].revoked, "DockerRegistry: image already revoked");

        registry[imageName].revoked = true;

        emit ImageRevoked(imageName, msg.sender, block.timestamp);
    }

    // =========================================================================
    // FONCTIONS DE LECTURE
    // =========================================================================

    /**
     * @notice Vérifie qu'un hash SHA256 correspond à celui enregistré on-chain.
     *
     * Préconditions :
     *   - imageName != ""
     *   - imageHash != bytes32(0)
     *
     * Postconditions :
     *   - Retourne true  si : image existe, non révoquée, hash identique
     *   - Retourne false si : image inexistante, révoquée, ou hash différent
     *   - L'événement ImageVerified est émis avec le résultat
     *
     * @param imageName  Nom de l'image à vérifier.
     * @param imageHash  Hash SHA256 recalculé localement à comparer.
     * @return valid     True si l'image est intègre et active, false sinon.
     */
    function verifyImage(
        string calldata imageName,
        bytes32         imageHash
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

    /**
     * @notice Retourne l'enregistrement complet d'une image.
     *
     * Préconditions :
     *   - imageName != ""
     *   - registry[imageName].exists == true
     *
     * Postconditions :
     *   - Retourne les 5 champs de l'ImageRecord correspondant
     */
    function getImage(string calldata imageName)
        external
        view
        validName(imageName)
        returns (
            bytes32 imageHash,
            uint256 timestamp,
            address registeredBy,
            bool    exists,
            bool    revoked
        )
    {
        require(registry[imageName].exists, "DockerRegistry: image not found");

        ImageRecord storage record = registry[imageName];
        return (
            record.imageHash,
            record.timestamp,
            record.registeredBy,
            record.exists,
            record.revoked
        );
    }

    /**
     * @notice Retourne la liste de tous les noms d'images enregistrées.
     *
     * Précondition  : aucune.
     * Postcondition : retourne le tableau imageNames (peut être vide).
     */
    function getAllImageNames() external view returns (string[] memory) {
        return imageNames;
    }

    /**
     * @notice Retourne le nombre total d'images enregistrées.
     *
     * Précondition  : aucune.
     * Postcondition : retourne imageNames.length.
     */
    function getImageCount() external view returns (uint256) {
        return imageNames.length;
    }
}