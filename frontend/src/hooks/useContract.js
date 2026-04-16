import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { CONTRACT_ABI } from "../utils/contractABI.js";

const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS;
const ALCHEMY_URL      = import.meta.env.VITE_ALCHEMY_URL;
const SEPOLIA_CHAIN_ID = 11155111;
const SEPOLIA_HEX      = "0xaa36a7";

// Provider lecture seule via Alchemy — fonctionne sans MetaMask
function getReadProvider() {
  if (ALCHEMY_URL) return new ethers.JsonRpcProvider(ALCHEMY_URL);
  return new ethers.JsonRpcProvider("https://rpc.sepolia.org");
}

export function useContract() {
  const [signer,     setSigner]     = useState(null);
  const [contract,   setContract]   = useState(null);
  const [readContract, setReadContract] = useState(null);
  const [account,    setAccount]    = useState(null);
  const [isOwner,    setIsOwner]    = useState(false);
  const [chainOk,    setChainOk]    = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [images,     setImages]     = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState(null);

  // Crée le contrat en lecture seule au démarrage
  useEffect(() => {
    try {
      const ro = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, getReadProvider());
      setReadContract(ro);
    } catch (e) {
      setError("Impossible de se connecter au contrat");
    }
  }, []);

  const connect = useCallback(async () => {
    if (!window.ethereum) throw new Error("MetaMask non détecté — installe l'extension");
    setConnecting(true);
    setError(null);
    try {
      // 1. Demande accès aux comptes
      await window.ethereum.request({ method: "eth_requestAccounts" });

      // 2. Vérifie le réseau
      const chainIdHex = await window.ethereum.request({ method: "eth_chainId" });
      const chainId    = parseInt(chainIdHex, 16);

      if (chainId !== SEPOLIA_CHAIN_ID) {
        try {
          // Essaie de switcher sur Sepolia
          await window.ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: SEPOLIA_HEX }],
          });
        } catch (switchErr) {
          // Sepolia pas dans MetaMask → on l'ajoute
          if (switchErr.code === 4902) {
            await window.ethereum.request({
              method: "wallet_addEthereumChain",
              params: [{
                chainId: SEPOLIA_HEX,
                chainName: "Sepolia Testnet",
                nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
                rpcUrls: [ALCHEMY_URL || "https://rpc.sepolia.org"],
                blockExplorerUrls: ["https://sepolia.etherscan.io"],
              }],
            });
          } else {
            throw switchErr;
          }
        }
        // Attend que MetaMask confirme le changement
        await new Promise((r) => setTimeout(r, 1000));
      }

      // 3. Recrée le provider APRÈS le switch
      const web3Provider = new ethers.BrowserProvider(window.ethereum);
      const network      = await web3Provider.getNetwork();
      const ok           = Number(network.chainId) === SEPOLIA_CHAIN_ID;
      setChainOk(ok);

      if (!ok) throw new Error("Réseau incorrect — sélectionne Sepolia dans MetaMask");

      // 4. Signer + contrat en écriture
      const s    = await web3Provider.getSigner();
      const addr = await s.getAddress();
      const c    = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, s);

      // 5. Vérifie ownership
      const owner = await c.owner();

      setSigner(s);
      setContract(c);
      setAccount(addr);
      setIsOwner(addr.toLowerCase() === owner.toLowerCase());
      setChainOk(true);
    } catch (e) {
      setError(e.message ?? "Erreur de connexion");
      throw e;
    } finally {
      setConnecting(false);
    }
  }, []);

  const fetchImages = useCallback(async () => {
    const c = contract || readContract;
    if (!c) return;
    setLoading(true);
    try {
      const names = await c.getAllImageNames();
      const records = await Promise.all(
        names.map(async (name) => {
          const [hash, timestamp, registeredBy, exists, revoked] = await c.getImage(name);
          return { name, hash, timestamp: Number(timestamp), registeredBy, exists, revoked };
        })
      );
      setImages(records);
    } catch (e) {
      console.error("fetchImages error:", e);
    } finally {
      setLoading(false);
    }
  }, [contract, readContract]);

  // Charge les images dès que readContract est prêt
  useEffect(() => {
    if (!readContract) return;
    fetchImages();
  }, [readContract, fetchImages]);

  // Écoute les events en temps réel
  useEffect(() => {
    const c = contract || readContract;
    if (!c) return;
    const filterReg = c.filters.ImageRegistered();
    const filterRev = c.filters.ImageRevoked();
    c.on(filterReg, () => fetchImages());
    c.on(filterRev, () => fetchImages());
    return () => { c.off(filterReg); c.off(filterRev); };
  }, [contract, readContract, fetchImages]);

  useEffect(() => {
    if (!window.ethereum) return;
    const handleAccountsChanged = () => connect().catch(() => {});
    const handleChainChanged    = () => window.location.reload();
    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged",    handleChainChanged);
    return () => {
      window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
      window.ethereum.removeListener("chainChanged",    handleChainChanged);
    };
  }, [connect]);

  const registerImage = useCallback(async (imageName, sha256Hex) => {
    if (!contract) throw new Error("Non connecté");
    const bytes32 = "0x" + sha256Hex.replace(/^0x/, "").padStart(64, "0");
    const tx = await contract.registerImage(imageName, bytes32);
    return tx.wait();
  }, [contract]);

  const revokeImage = useCallback(async (imageName) => {
    if (!contract) throw new Error("Non connecté");
    const tx = await contract.revokeImage(imageName);
    return tx.wait();
  }, [contract]);

  const verifyImage = useCallback(async (imageName, sha256Hex) => {
    const c = contract || readContract;
    if (!c) throw new Error("Non connecté");
    const bytes32 = "0x" + sha256Hex.replace(/^0x/, "").padStart(64, "0");
    return c.verifyImage.staticCall(imageName, bytes32);
  }, [contract, readContract]);

  return {
    account, isOwner, chainOk, connecting, error,
    images, loading,
    connect, fetchImages,
    registerImage, revokeImage, verifyImage,
  };
}
