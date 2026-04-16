const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "ETH");

  const DockerRegistry = await ethers.getContractFactory("DockerRegistry");
  console.log("Deploying DockerRegistry...");

  const contract = await DockerRegistry.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("DockerRegistry deployed to:", address);
  console.log("Transaction hash:", contract.deploymentTransaction().hash);
  console.log("\nAdd to your .env file:");
  console.log(`CONTRACT_ADDRESS=${address}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
