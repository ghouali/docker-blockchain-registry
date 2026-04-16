const { expect }  = require("chai");
const { ethers }  = require("hardhat");

const ZERO_HASH = ethers.ZeroHash;
const HASH_A    = ethers.id("image-a-content");
const HASH_B    = ethers.id("image-b-content");

// Helper : signe le message exactement comme le contrat l'attend
async function signRegistration(signer, imageName, imageHash, version, contractAddress) {
  const msgHash = ethers.solidityPackedKeccak256(
    ["string", "bytes32", "uint256", "address"],
    [imageName, imageHash, version, contractAddress]
  );
  return signer.signMessage(ethers.getBytes(msgHash));
}

describe("DockerRegistry", function () {
  let contract, owner, signer1, signer2, stranger;
  let contractAddress;

  beforeEach(async function () {
    [owner, signer1, signer2, stranger] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("DockerRegistry");
    contract = await Factory.deploy();
    await contract.waitForDeployment();
    contractAddress = await contract.getAddress();
  });

  // =========================================================================
  describe("Deployment", function () {
    it("sets deployer as owner", async () => {
      expect(await contract.owner()).to.equal(owner.address);
    });

    it("starts with zero images and zero signers", async () => {
      expect(await contract.getImageCount()).to.equal(0n);
      expect(await contract.getTrustedSigners()).to.deep.equal([]);
    });
  });

  // =========================================================================
  describe("Signer Management", function () {
    it("owner can add a trusted signer", async () => {
      await contract.addSigner(signer1.address);
      expect(await contract.trustedSigners(signer1.address)).to.be.true;
    });

    it("emits SignerAdded event", async () => {
      await expect(contract.addSigner(signer1.address))
        .to.emit(contract, "SignerAdded")
        .withArgs(signer1.address, owner.address);
    });

    it("owner can remove a trusted signer", async () => {
      await contract.addSigner(signer1.address);
      await contract.removeSigner(signer1.address);
      expect(await contract.trustedSigners(signer1.address)).to.be.false;
    });

    it("emits SignerRemoved event", async () => {
      await contract.addSigner(signer1.address);
      await expect(contract.removeSigner(signer1.address))
        .to.emit(contract, "SignerRemoved")
        .withArgs(signer1.address, owner.address);
    });

    it("reverts if non-owner tries to add signer", async () => {
      await expect(
        contract.connect(stranger).addSigner(signer1.address)
      ).to.be.revertedWith("DockerRegistry: caller is not the owner");
    });

    it("reverts on duplicate signer", async () => {
      await contract.addSigner(signer1.address);
      await expect(contract.addSigner(signer1.address))
        .to.be.revertedWith("DockerRegistry: already a signer");
    });

    it("reverts on zero address", async () => {
      await expect(contract.addSigner(ethers.ZeroAddress))
        .to.be.revertedWith("DockerRegistry: zero address");
    });

    it("getTrustedSigners returns active signers", async () => {
      await contract.addSigner(signer1.address);
      await contract.addSigner(signer2.address);
      const signers = await contract.getTrustedSigners();
      expect(signers).to.include(signer1.address);
      expect(signers).to.include(signer2.address);
    });
  });

  // =========================================================================
  describe("registerImage (owner direct)", function () {
    it("registers a new image", async () => {
      await contract.registerImage("app:v1", HASH_A);
      const [hash,,, exists, revoked,, sigBased] = await contract.getImage("app:v1");
      expect(hash).to.equal(HASH_A);
      expect(exists).to.be.true;
      expect(revoked).to.be.false;
      expect(sigBased).to.be.false;
    });

    it("emits ImageRegistered event", async () => {
      await expect(contract.registerImage("app:v1", HASH_A))
        .to.emit(contract, "ImageRegistered");
    });

    it("allows any address to register", async () => {
      await contract.connect(stranger).registerImage("app:v1", HASH_A);
      const [hash,,registeredBy] = await contract.getImage("app:v1");
      expect(hash).to.equal(HASH_A);
      expect(registeredBy).to.equal(stranger.address);
    });

    it("reverts on zero hash", async () => {
      await expect(contract.registerImage("app:v1", ZERO_HASH))
        .to.be.revertedWith("DockerRegistry: hash cannot be zero");
    });

    it("reverts on already active image", async () => {
      await contract.registerImage("app:v1", HASH_A);
      await expect(contract.registerImage("app:v1", HASH_B))
        .to.be.revertedWith("DockerRegistry: image already registered and active");
    });
  });

  // =========================================================================
  describe("registerImageWithSignature (ECDSA)", function () {
    beforeEach(async () => {
      await contract.addSigner(signer1.address);
    });

    it("registers with valid signature from trusted signer", async () => {
      const sig = await signRegistration(signer1, "app:v1", HASH_A, 1, contractAddress);
      await contract.connect(stranger).registerImageWithSignature("app:v1", HASH_A, 1, sig);

      const [hash,,registeredBy, exists,, version, sigBased] = await contract.getImage("app:v1");
      expect(hash).to.equal(HASH_A);
      expect(exists).to.be.true;
      expect(registeredBy).to.equal(signer1.address);
      expect(version).to.equal(1n);
      expect(sigBased).to.be.true;
    });

    it("emits ImageRegisteredWithSignature event", async () => {
      const sig = await signRegistration(signer1, "app:v1", HASH_A, 1, contractAddress);
      await expect(
        contract.registerImageWithSignature("app:v1", HASH_A, 1, sig)
      ).to.emit(contract, "ImageRegisteredWithSignature")
       .withArgs("app:v1", HASH_A, signer1.address, 1n, await latestTimestamp());
    });

    it("anyone can submit a valid signature (not just owner)", async () => {
      const sig = await signRegistration(signer1, "app:v1", HASH_A, 1, contractAddress);
      // stranger soumet — pas de revert
      await expect(
        contract.connect(stranger).registerImageWithSignature("app:v1", HASH_A, 1, sig)
      ).to.not.be.reverted;
    });

    it("reverts if signer is not trusted", async () => {
      const sig = await signRegistration(stranger, "app:v1", HASH_A, 1, contractAddress);
      await expect(
        contract.registerImageWithSignature("app:v1", HASH_A, 1, sig)
      ).to.be.revertedWith("DockerRegistry: signer not trusted");
    });

    it("reverts on signature replay (anti-replay)", async () => {
      const sig = await signRegistration(signer1, "app:v1", HASH_A, 1, contractAddress);
      await contract.registerImageWithSignature("app:v1", HASH_A, 1, sig);
      // révoque pour pouvoir re-tenter
      await contract.revokeImage("app:v1");
      // même signature → revert
      await expect(
        contract.registerImageWithSignature("app:v1", HASH_A, 1, sig)
      ).to.be.revertedWith("DockerRegistry: signature already used");
    });

    it("allows new version after revocation with new signature", async () => {
      const sig1 = await signRegistration(signer1, "app:v1", HASH_A, 1, contractAddress);
      await contract.registerImageWithSignature("app:v1", HASH_A, 1, sig1);
      await contract.revokeImage("app:v1");

      const sig2 = await signRegistration(signer1, "app:v1", HASH_B, 2, contractAddress);
      await contract.registerImageWithSignature("app:v1", HASH_B, 2, sig2);

      const [hash,,,,,version] = await contract.getImage("app:v1");
      expect(hash).to.equal(HASH_B);
      expect(version).to.equal(2n);
    });

    it("reverts if removed signer tries to register", async () => {
      await contract.removeSigner(signer1.address);
      const sig = await signRegistration(signer1, "app:v1", HASH_A, 1, contractAddress);
      await expect(
        contract.registerImageWithSignature("app:v1", HASH_A, 1, sig)
      ).to.be.revertedWith("DockerRegistry: signer not trusted");
    });

    it("getMessageHash matches off-chain hash", async () => {
      const onChain  = await contract.getMessageHash("app:v1", HASH_A, 1);
      const offChain = ethers.solidityPackedKeccak256(
        ["string", "bytes32", "uint256", "address"],
        ["app:v1", HASH_A, 1, contractAddress]
      );
      expect(onChain).to.equal(offChain);
    });
  });

  // =========================================================================
  describe("revokeImage", function () {
    it("owner can revoke", async () => {
      await contract.registerImage("app:v1", HASH_A);
      await contract.revokeImage("app:v1");
      const [,,, , revoked] = await contract.getImage("app:v1");
      expect(revoked).to.be.true;
    });

    it("emits ImageRevoked", async () => {
      await contract.registerImage("app:v1", HASH_A);
      await expect(contract.revokeImage("app:v1"))
        .to.emit(contract, "ImageRevoked")
        .withArgs("app:v1", owner.address, await latestTimestamp());
    });

    it("registrant can revoke their own image", async () => {
      await contract.connect(stranger).registerImage("app:v1", HASH_A);
      await contract.connect(stranger).revokeImage("app:v1");
      const [,,,,revoked] = await contract.getImage("app:v1");
      expect(revoked).to.be.true;
    });

    it("owner can revoke any image", async () => {
      await contract.connect(stranger).registerImage("app:v1", HASH_A);
      await contract.connect(owner).revokeImage("app:v1");
      const [,,,,revoked] = await contract.getImage("app:v1");
      expect(revoked).to.be.true;
    });

    it("reverts if unrelated address tries to revoke", async () => {
      await contract.connect(stranger).registerImage("app:v1", HASH_A);
      await expect(
        contract.connect(signer1).revokeImage("app:v1")
      ).to.be.revertedWith("DockerRegistry: caller is not the registrant nor the owner");
    });
  });

  // =========================================================================
  describe("verifyImage", function () {
    it("returns true for valid image (owner-registered)", async () => {
      await contract.registerImage("app:v1", HASH_A);
      expect(await contract.verifyImage.staticCall("app:v1", HASH_A)).to.be.true;
    });

    it("returns true for valid image (signature-registered)", async () => {
      await contract.addSigner(signer1.address);
      const sig = await signRegistration(signer1, "app:v1", HASH_A, 1, contractAddress);
      await contract.registerImageWithSignature("app:v1", HASH_A, 1, sig);
      expect(await contract.verifyImage.staticCall("app:v1", HASH_A)).to.be.true;
    });

    it("returns false for wrong hash (tampered)", async () => {
      await contract.registerImage("app:v1", HASH_A);
      expect(await contract.verifyImage.staticCall("app:v1", HASH_B)).to.be.false;
    });

    it("returns false for revoked image", async () => {
      await contract.registerImage("app:v1", HASH_A);
      await contract.revokeImage("app:v1");
      expect(await contract.verifyImage.staticCall("app:v1", HASH_A)).to.be.false;
    });

    it("returns false for unknown image", async () => {
      expect(await contract.verifyImage.staticCall("unknown", HASH_A)).to.be.false;
    });
  });
});

async function latestTimestamp() {
  const block = await ethers.provider.getBlock("latest");
  return block.timestamp + 1;
}
