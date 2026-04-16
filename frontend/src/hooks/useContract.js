import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { CONTRACT_ABI } from "../utils/contractABI.js";

const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS;
const RPC_URL          = import.meta.env.VITE_RPC_URL;
const CHAIN_ID         = Number(import.meta.env.VITE_CHAIN_ID ?? 1337);
const CHAIN_HEX        = "0x" + CHAIN_ID.toString(16);

function getReadProvider() {
  if (RPC_URL) return new ethers.JsonRpcProvider(RPC_URL);
  return new ethers.JsonRpcProvider("http://127.0.0.1:7545");
}

export function useContract() {
  const [signer,       setSigner]       = useState(null);
  const [contract,     setContract]     = useState(null);
  const [readContract, setReadContract] = useState(null);
  const [account,      setAccount]      = useState(null);
  const [isOwner,      setIsOwner]      = useState(false);
  const [chainOk,      setChainOk]      = useState(false);
  const [connecting,   setConnecting]   = useState(false);
  const [images,       setImages]       = useState([]);
  const [signers,      setSigners]      = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState(null);

  useEffect(() => {
    try {
      if (!CONTRACT_ADDRESS) throw new Error("VITE_CONTRACT_ADDRESS is not set");
      if (!ethers.isAddress(CONTRACT_ADDRESS)) throw new Error("VITE_CONTRACT_ADDRESS is not a valid address");
      const ro = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, getReadProvider());
      setReadContract(ro);
    } catch (e) {
      setError(e?.message ?? "Impossible de se connecter au contrat");
    }
  }, []);

  const connect = useCallback(async () => {
    if (!window.ethereum) throw new Error("MetaMask non détecté");
    if (!CONTRACT_ADDRESS) throw new Error("VITE_CONTRACT_ADDRESS is not set");
    if (!ethers.isAddress(CONTRACT_ADDRESS)) throw new Error("VITE_CONTRACT_ADDRESS is not a valid address");
    setConnecting(true);
    setError(null);
    try {
      await window.ethereum.request({ method: "eth_requestAccounts" });

      const chainIdHex = await window.ethereum.request({ method: "eth_chainId" });
      if (parseInt(chainIdHex, 16) !== CHAIN_ID) {
        try {
          await window.ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: CHAIN_HEX }],
          });
        } catch (e) {
          if (e.code === 4902) {
            await window.ethereum.request({
              method: "wallet_addEthereumChain",
              params: [{
                chainId: CHAIN_HEX,
                chainName: `Ganache (${CHAIN_ID})`,
                nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
                rpcUrls: [RPC_URL || "http://127.0.0.1:7545"],
              }],
            });
          } else throw e;
        }
        await new Promise((r) => setTimeout(r, 1000));
      }

      const web3Provider = new ethers.BrowserProvider(window.ethereum);
      const network      = await web3Provider.getNetwork();
      const ok           = Number(network.chainId) === CHAIN_ID;
      setChainOk(ok);
      if (!ok) throw new Error(`Réseau incorrect — sélectionne chainId=${CHAIN_ID}`);

      const s    = await web3Provider.getSigner();
      const addr = await s.getAddress();
      const c    = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, s);
      const ownerAddr = await c.owner();

      setSigner(s);
      setContract(c);
      setAccount(addr);
      setIsOwner(addr.toLowerCase() === ownerAddr.toLowerCase());
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
          const [hash, timestamp, registeredBy, exists, revoked, version, signatureBased] =
            await c.getImage(name);
          return { name, hash, timestamp: Number(timestamp), registeredBy, exists, revoked, version: Number(version), signatureBased };
        })
      );
      setImages(records);
    } catch (e) {
      console.error("fetchImages:", e);
    } finally {
      setLoading(false);
    }
  }, [contract, readContract]);

  const fetchSigners = useCallback(async () => {
    const c = contract || readContract;
    if (!c) return;
    try {
      const list = await c.getTrustedSigners();
      setSigners(list);
    } catch (e) {
      console.error("fetchSigners:", e);
    }
  }, [contract, readContract]);

  useEffect(() => {
    if (!readContract) return;
    fetchImages();
    fetchSigners();
  }, [readContract, fetchImages, fetchSigners]);

  useEffect(() => {
    const c = contract || readContract;
    if (!c) return;
    const onReg    = () => { fetchImages(); fetchSigners(); };
    const onRevoke = () => fetchImages();
    const onSigner = () => fetchSigners();
    c.on(c.filters.ImageRegistered(),              onReg);
    c.on(c.filters.ImageRegisteredWithSignature(), onReg);
    c.on(c.filters.ImageRevoked(),                 onRevoke);
    c.on(c.filters.SignerAdded(),                  onSigner);
    c.on(c.filters.SignerRemoved(),                onSigner);
    return () => {
      c.off(c.filters.ImageRegistered(),              onReg);
      c.off(c.filters.ImageRegisteredWithSignature(), onReg);
      c.off(c.filters.ImageRevoked(),                 onRevoke);
      c.off(c.filters.SignerAdded(),                  onSigner);
      c.off(c.filters.SignerRemoved(),                onSigner);
    };
  }, [contract, readContract, fetchImages, fetchSigners]);

  useEffect(() => {
    if (!window.ethereum) return;
    const onAccounts = () => connect().catch(() => {});
    const onChain    = () => window.location.reload();
    window.ethereum.on("accountsChanged", onAccounts);
    window.ethereum.on("chainChanged",    onChain);
    return () => {
      window.ethereum.removeListener("accountsChanged", onAccounts);
      window.ethereum.removeListener("chainChanged",    onChain);
    };
  }, [connect]);

  const registerImage = useCallback(async (imageName, sha256Hex) => {
    if (!contract) throw new Error("Non connecté");
    const bytes32 = "0x" + sha256Hex.replace(/^0x/, "").padStart(64, "0");
    const tx = await contract.registerImage(imageName, bytes32);
    return tx.wait();
  }, [contract]);

  const addSigner = useCallback(async (address) => {
    if (!contract) throw new Error("Non connecté");
    const tx = await contract.addSigner(address);
    return tx.wait();
  }, [contract]);

  const removeSigner = useCallback(async (address) => {
    if (!contract) throw new Error("Non connecté");
    const tx = await contract.removeSigner(address);
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
    images, signers, loading,
    connect, fetchImages, fetchSigners,
    registerImage, addSigner, removeSigner,
    revokeImage, verifyImage,
  };
}
