import "@nomicfoundation/hardhat-toolbox";
import { HardhatUserConfig } from "hardhat/config";
import * as dotenv from "dotenv";

dotenv.config();

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.19",
  },
  networks: {
    hardhat: {
      forking: {
        url: process.env.ALCHEMY_URL || "",
        blockNumber: 42235495,
      },
    },
  },
};

export default config;
