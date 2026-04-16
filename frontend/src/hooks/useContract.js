import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { CONTRACT_ABI } from "../utils/contractABI.js";

const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS;
const SEPOLIA_CHAIN_ID = 11155111;

export function useContract() {
  const [provider, setProvider]   = useState(null);
  const [signer, setSigner]       = useState(null);
  const [contract, setContract]   = useState(null);
  const [account, setAccount]     = useState(null);
  const [isOwner, setIsOwner]     = useState(false);
  const [chainOk, setChainOk]     = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [images, setImages]       = useState([]);
  const [loading, setLoading]     = useState(false);

  const connect = useCallback(async () => {
    if (!window.ethereum) throw new Error("MetaMask non détecté");
    setConnecting(true);
    try {
      const web3Provider = new ethers.BrowserProvider(window.ethereum);
      await web3Provider.send("eth_requestAccounts", []);

      const network = await web3Provider.getNetwork();
      const ok = Number(network.chainId) === SEPOLIA_CHAIN_ID;
      setChainOk(ok);

      if (!ok) {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: "0xaa36a7" }],
        });
      }

      const s = await web3Provider.getSigner();
      const addr = await s.getAddress();
      const c = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, s);
      const owner = await c.owner();

      setProvider(web3Provider);
      setSigner(s);
      setContract(c);
      setAccount(addr);
      setIsOwner(addr.toLowerCase() === owner.toLowerCase());
      setChainOk(true);
    } finally {
      setConnecting(false);
    }
  }, []);

  const fetchImages = useCallback(async () => {
    if (!contract) return;
    setLoading(true);
    try {
      const names = await contract.getAllImageNames();
      const records = await Promise.all(
        names.map(async (name) => {
          const [hash, timestamp, registeredBy, exists, revoked] = await contract.getImage(name);
          return { name, hash, timestamp: Number(timestamp), registeredBy, exists, revoked };
        })
      );
      setImages(records);
    } finally {
      setLoading(false);
    }
  }, [contract]);

  useEffect(() => {
    if (!contract) return;
    fetchImages();

    const filterReg = contract.filters.ImageRegistered();
    const filterRev = contract.filters.ImageRevoked();
    contract.on(filterReg, () => fetchImages());
    contract.on(filterRev, () => fetchImages());
    return () => {
      contract.off(filterReg);
      contract.off(filterRev);
    };
  }, [contract, fetchImages]);

  useEffect(() => {
    if (!window.ethereum) return;
    const handleAccountsChanged = () => connect().catch(() => {});
    const handleChainChanged = () => window.location.reload();
    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);
    return () => {
      window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
      window.ethereum.removeListener("chainChanged", handleChainChanged);
    };
  }, [connect]);

  const registerImage = useCallback(
    async (imageName, sha256Hex) => {
      if (!contract) throw new Error("Non connecté");
      const bytes32 = "0x" + sha256Hex.replace(/^0x/, "").padStart(64, "0");
      const tx = await contract.registerImage(imageName, bytes32);
      return tx.wait();
    },
    [contract]
  );

  const revokeImage = useCallback(
    async (imageName) => {
      if (!contract) throw new Error("Non connecté");
      const tx = await contract.revokeImage(imageName);
      return tx.wait();
    },
    [contract]
  );

  const verifyImage = useCallback(
    async (imageName, sha256Hex) => {
      if (!contract) throw new Error("Non connecté");
      const bytes32 = "0x" + sha256Hex.replace(/^0x/, "").padStart(64, "0");
      return contract.verifyImage.staticCall(imageName, bytes32);
    },
    [contract]
  );

  return {
    account, isOwner, chainOk, connecting,
    images, loading,
    connect, fetchImages,
    registerImage, revokeImage, verifyImage,
  };
}
