# Docker Blockchain Registry

Registre décentralisé des hashs d'images Docker sur Ethereum. Chaque image publiée est identifiée par son hash SHA256, enregistré on-chain via un smart contract Solidity. Avant tout déploiement, le hash est recalculé et comparé à la valeur on-chain pour détecter toute falsification.

## Pourquoi blockchain ?

Le registre Docker classique ne garantit pas l'intégrité d'une image entre son push et son pull. Un attaquant ayant accès au registre peut substituer une image sans laisser de trace. En stockant le hash SHA256 sur Ethereum, la référence devient **immuable et infalsifiable** : aucune entité centrale ne peut la modifier après enregistrement.

---

## Architecture

```
docker-blockchain-registry/
│
├── contracts/
│   └── DockerRegistry.sol       ← Smart contract principal (Solidity 0.8.20)
│
├── scripts/
│   ├── deploy.js                ← Déploiement sur Sepolia
│   └── interact.js              ← Appels manuels au contrat
│
├── test/
│   └── DockerRegistry.test.js   ← Tests unitaires Hardhat + Chai
│
├── gateway/
│   ├── push.js                  ← Calcule SHA256 + appelle registerImage()
│   └── verify.js                ← Recalcule SHA256 + appelle verifyImage()
│
├── .github/workflows/
│   ├── register.yml             ← CI : déclenché au docker push
│   └── verify.yml               ← CI : vérifie l'image avant déploiement
│
├── frontend/
│   └── src/
│       ├── App.jsx
│       └── components/
│           ├── ImageList.jsx    ← Liste des images enregistrées on-chain
│           ├── ImageStatus.jsx  ← Statut : valide / révoqué
│           └── AlertPanel.jsx   ← Alertes de falsification détectée
│
├── hardhat.config.js
├── .env                         ← Jamais commité (voir .env.example)
└── .env.example
```

---

## Stack technique

| Composant | Technologie |
|-----------|-------------|
| Smart contract | Solidity 0.8.20 |
| Framework blockchain | Hardhat |
| Réseau de test | Ethereum Sepolia Testnet |
| Interaction contrat | ethers.js v6 |
| Gateway | Node.js |
| CI/CD | GitHub Actions |
| Frontend | React + Chart.js |

---

## Prérequis

- Node.js >= 18
- Un wallet Ethereum avec des ETH Sepolia (faucet : [sepoliafaucet.com](https://sepoliafaucet.com))
- Un RPC URL Sepolia via [Alchemy](https://alchemy.com) ou [Infura](https://infura.io)

---

## Installation

```bash
# Cloner le dépôt
git clone https://github.com/<user>/docker-blockchain-registry.git
cd docker-blockchain-registry

# Installer les dépendances Hardhat
npm install

# Installer les dépendances du frontend
cd frontend && npm install && cd ..
```

---

## Configuration

Copier le fichier d'exemple et renseigner les valeurs :

```bash
cp .env.example .env
```

Contenu de `.env` :

```
PRIVATE_KEY=votre_cle_privee_wallet
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/votre_api_key
CONTRACT_ADDRESS=adresse_du_contrat_apres_deploiement
```

> **Important** : le fichier `.env` est dans `.gitignore`. Ne jamais le commiter.

---

## Déploiement du smart contract

```bash
# Compiler le contrat
npm run compile

# Déployer sur Sepolia
npm run deploy
```

Après déploiement, noter l'adresse du contrat affichée dans le terminal et la renseigner dans `.env` sous `CONTRACT_ADDRESS`.

---

## Tests

```bash
npm test
```

Les tests couvrent :
- `registerImage()` : enregistrement d'un hash
- `verifyImage()` : vérification hash valide / hash falsifié
- `revokeImage()` : révocation et accès interdit après révocation
- Contrôle d'accès (seul le propriétaire peut révoquer)

---

## Utilisation du gateway

### Enregistrer une image

```bash
node gateway/push.js <chemin_image_docker.tar>
```

Le script calcule le SHA256 de l'image, appelle `registerImage()` sur le contrat et affiche le hash de la transaction.

### Vérifier une image

```bash
node gateway/verify.js <chemin_image_docker.tar>
```

Le script recalcule le SHA256, appelle `verifyImage()` et retourne :
- `VALID` si le hash correspond à la valeur on-chain
- `TAMPERED` si le hash diffère
- `NOT FOUND` si l'image n'a jamais été enregistrée

---

## CI/CD GitHub Actions

### Secrets à configurer dans le dépôt GitHub

`Settings → Secrets and variables → Actions` :

| Secret | Valeur |
|--------|--------|
| `PRIVATE_KEY` | Clé privée du wallet de déploiement |
| `SEPOLIA_RPC_URL` | RPC URL Alchemy/Infura |
| `CONTRACT_ADDRESS` | Adresse du contrat déployé |

### Workflows

**`register.yml`** — se déclenche lors d'un push sur la branche `main` contenant des modifications Docker. Calcule le hash de l'image et appelle `registerImage()`.

**`verify.yml`** — se déclenche avant tout déploiement. Recalcule le hash et interrompt le pipeline si l'image a été falsifiée.

---

## Frontend

```bash
cd frontend
npm run dev
```

Le dashboard se connecte au contrat via ethers.js (réseau Sepolia) et affiche :
- La liste de toutes les images enregistrées on-chain
- Le statut de chaque image (valide / révoqué)
- Les alertes pour les images dont le hash ne correspond plus

---

## Smart contract — fonctions principales

```solidity
// Enregistrer le hash d'une image
function registerImage(string calldata imageName, bytes32 imageHash) external onlyOwner

// Vérifier un hash par rapport à la valeur on-chain
function verifyImage(string calldata imageName, bytes32 imageHash) external view returns (bool)

// Révoquer une image (la marquer comme non fiable)
function revokeImage(string calldata imageName) external onlyOwner
```

Le contrat déployé est vérifiable sur [Sepolia Etherscan](https://sepolia.etherscan.io) à l'adresse indiquée dans `.env`.

---

## Auteurs

Projet réalisé dans le cadre du cours Blockchain & Systèmes Distribués.