const { expect } = require("chai");
const { ethers } = require("hardhat");

const ZERO_HASH = ethers.ZeroHash;
const HASH_A = ethers.id("image-a-content");
const HASH_B = ethers.id("image-b-content");

describe("DockerRegistry", function () {
  let contract, owner, other;

  beforeEach(async function () {
    [owner, other] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("DockerRegistry");
    contract = await Factory.deploy();
    await contract.waitForDeployment();
  });

  // ---------------------------------------------------------------------------
  describe("Deployment", function () {
    it("sets deployer as owner", async function () {
      expect(await contract.owner()).to.equal(owner.address);
    });

    it("starts with zero images", async function () {
      expect(await contract.getImageCount()).to.equal(0n);
    });
  });

  // ---------------------------------------------------------------------------
  describe("registerImage", function () {
    it("registers a new image", async function () {
      await contract.registerImage("app:v1", HASH_A);
      const [hash, , , exists, revoked] = await contract.getImage("app:v1");
      expect(hash).to.equal(HASH_A);
      expect(exists).to.be.true;
      expect(revoked).to.be.false;
    });

    it("emits ImageRegistered event", async function () {
      await expect(contract.registerImage("app:v1", HASH_A))
        .to.emit(contract, "ImageRegistered")
        .withArgs("app:v1", HASH_A, owner.address, await latestTimestamp());
    });

    it("increments image count", async function () {
      await contract.registerImage("app:v1", HASH_A);
      await contract.registerImage("app:v2", HASH_B);
      expect(await contract.getImageCount()).to.equal(2n);
    });

    it("reverts if not owner", async function () {
      await expect(
        contract.connect(other).registerImage("app:v1", HASH_A)
      ).to.be.revertedWith("DockerRegistry: caller is not the owner");
    });

    it("reverts on empty name", async function () {
      await expect(contract.registerImage("", HASH_A)).to.be.revertedWith(
        "DockerRegistry: image name cannot be empty"
      );
    });

    it("reverts on zero hash", async function () {
      await expect(
        contract.registerImage("app:v1", ZERO_HASH)
      ).to.be.revertedWith("DockerRegistry: hash cannot be zero");
    });

    it("reverts if image already active", async function () {
      await contract.registerImage("app:v1", HASH_A);
      await expect(
        contract.registerImage("app:v1", HASH_B)
      ).to.be.revertedWith("DockerRegistry: image already registered and active");
    });

    it("allows re-registration after revocation", async function () {
      await contract.registerImage("app:v1", HASH_A);
      await contract.revokeImage("app:v1");
      await contract.registerImage("app:v1", HASH_B);
      const [hash, , , , revoked] = await contract.getImage("app:v1");
      expect(hash).to.equal(HASH_B);
      expect(revoked).to.be.false;
    });

    it("does not duplicate in imageNames after re-registration", async function () {
      await contract.registerImage("app:v1", HASH_A);
      await contract.revokeImage("app:v1");
      await contract.registerImage("app:v1", HASH_B);
      expect(await contract.getImageCount()).to.equal(1n);
    });
  });

  // ---------------------------------------------------------------------------
  describe("revokeImage", function () {
    beforeEach(async function () {
      await contract.registerImage("app:v1", HASH_A);
    });

    it("marks image as revoked", async function () {
      await contract.revokeImage("app:v1");
      const [, , , , revoked] = await contract.getImage("app:v1");
      expect(revoked).to.be.true;
    });

    it("emits ImageRevoked event", async function () {
      await expect(contract.revokeImage("app:v1"))
        .to.emit(contract, "ImageRevoked")
        .withArgs("app:v1", owner.address, await latestTimestamp());
    });

    it("reverts if not owner", async function () {
      await expect(
        contract.connect(other).revokeImage("app:v1")
      ).to.be.revertedWith("DockerRegistry: caller is not the owner");
    });

    it("reverts if image not found", async function () {
      await expect(contract.revokeImage("unknown")).to.be.revertedWith(
        "DockerRegistry: image not found"
      );
    });

    it("reverts if already revoked", async function () {
      await contract.revokeImage("app:v1");
      await expect(contract.revokeImage("app:v1")).to.be.revertedWith(
        "DockerRegistry: image already revoked"
      );
    });
  });

  // ---------------------------------------------------------------------------
  describe("verifyImage", function () {
    beforeEach(async function () {
      await contract.registerImage("app:v1", HASH_A);
    });

    it("returns true for matching hash", async function () {
      const result = await contract.verifyImage.staticCall("app:v1", HASH_A);
      expect(result).to.be.true;
    });

    it("returns false for wrong hash", async function () {
      const result = await contract.verifyImage.staticCall("app:v1", HASH_B);
      expect(result).to.be.false;
    });

    it("returns false for non-existent image", async function () {
      const result = await contract.verifyImage.staticCall("unknown", HASH_A);
      expect(result).to.be.false;
    });

    it("returns false for revoked image", async function () {
      await contract.revokeImage("app:v1");
      const result = await contract.verifyImage.staticCall("app:v1", HASH_A);
      expect(result).to.be.false;
    });

    it("emits ImageVerified event", async function () {
      await expect(contract.verifyImage("app:v1", HASH_A))
        .to.emit(contract, "ImageVerified")
        .withArgs("app:v1", true, owner.address);
    });

    it("reverts on zero hash", async function () {
      await expect(
        contract.verifyImage("app:v1", ZERO_HASH)
      ).to.be.revertedWith("DockerRegistry: hash cannot be zero");
    });
  });

  // ---------------------------------------------------------------------------
  describe("getImage", function () {
    it("reverts for unknown image", async function () {
      await expect(contract.getImage("unknown")).to.be.revertedWith(
        "DockerRegistry: image not found"
      );
    });

    it("returns correct registeredBy", async function () {
      await contract.registerImage("app:v1", HASH_A);
      const [, , registeredBy] = await contract.getImage("app:v1");
      expect(registeredBy).to.equal(owner.address);
    });
  });

  // ---------------------------------------------------------------------------
  describe("getAllImageNames", function () {
    it("returns all registered names", async function () {
      await contract.registerImage("app:v1", HASH_A);
      await contract.registerImage("app:v2", HASH_B);
      const names = await contract.getAllImageNames();
      expect(names).to.deep.equal(["app:v1", "app:v2"]);
    });
  });
});

async function latestTimestamp() {
  const block = await ethers.provider.getBlock("latest");
  return block.timestamp + 1;
}
