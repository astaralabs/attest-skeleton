import {
  EAS,
  SchemaEncoder,
  SchemaItem,
  SchemaRegistry,
} from "@ethereum-attestation-service/eas-sdk";
import { EventLog, ethers } from "ethers";

import * as dotenv from "dotenv";
import Web3 from "web3";
import schemaRegistry from "./ABI/SchemaRegistry.json";

dotenv.config();

export async function blockchainConnection() {
  return new ethers.JsonRpcProvider(process.env.ALCHEMY_URL);
}

export async function signerConnection() {
  const provider = await blockchainConnection();

  const signer = new ethers.Wallet(
    process.env.ADMIN_PRIVATE_KEY as string,
    provider
  );
  return signer;
}

export async function getContract() {
  const web3 = new Web3(process.env.ALCHEMY_URL);
  const contract = new web3.eth.Contract(
    schemaRegistry.abi,
    schemaRegistry.address
  );
  return contract;
}

export async function easConnection() {
  //Initialize SDK
  const eas = new EAS(process.env.EAS_CONTRACT_ADDRESS as any);

  //Connect to attest
  const signer = await signerConnection();
  eas.connect(signer);
  return eas;
}

export async function registryConnection() {
  const schemaRegistry = new SchemaRegistry(
    process.env.REGISTRY_CONTRACT_ADDRESS as any
  );

  return schemaRegistry;
}

export async function registerSchema(schema: string) {
  const schemaRegistry = await registryConnection();

  const signer = await signerConnection();
  schemaRegistry.connect(signer);

  const tx = await schemaRegistry.register({
    schema,
    revocable: true,
  });

  await tx.wait();

  const contract = await getContract();
  const event: any = await contract.getPastEvents();
  const uid = event[0].returnValues.uid;
  return uid;
}

export async function onChainAttest(
  schema: string,
  schemaUID: string,
  data: []
) {
  //Data preprocessing
  const schemaElements = schema.split(", ");

  let schemaElementsSplited: string[][] = [];

  schemaElements.forEach((element) => {
    let splitedAgain = element.split(" ");
    schemaElementsSplited.push(splitedAgain);
  });

  let dataToEncode: SchemaItem[] = [];
  let i = 0;
  schemaElementsSplited.forEach((element) => {
    dataToEncode.push(
      JSON.parse(
        `{"name": "${element[1]}", "value": "${data[i]}", "type": "${element[0]}"}`
      )
    );
    i++;
  });

  //Attest something
  const schemaEncoder = new SchemaEncoder(schema);
  const encodeData = schemaEncoder.encodeData(dataToEncode);

  const eas = await easConnection();

  const tx = await eas.attest({
    schema: schemaUID,
    data: {
      recipient: "0xc3F064CbFDBf76673051B24f9BFB62fd211E6DCa", //Testing purposes
      data: encodeData,
    },
  });

  const newAttestationUID = await tx.wait();
  return newAttestationUID;
}

export async function getSchemaInfo(schemaUID: string) {
  const uidRegex = /0x(?!0{64})[a-fA-F0-9]{64}/;

  if (!schemaUID.match(uidRegex)) {
    throw Error("Incorrect schema format");
  }

  const schemaRegistry = await registryConnection();

  const signer = await signerConnection();
  schemaRegistry.connect(signer);

  try {
    const record = await schemaRegistry.getSchema({ uid: schemaUID });
    return record;
  } catch (e) {
    throw Error("Schema not found");
  }
}

export async function getAttestation(uid: string) {
  const uidRegex = /0x(?!0{64})[a-fA-F0-9]{64}/;

  if (!uid.match(uidRegex)) {
    throw Error("Incorrect format");
  }

  const eas = await easConnection();
  const attestation = await eas.getAttestation(uid);

  const zero_address =
    "0x0000000000000000000000000000000000000000000000000000000000000000";

  if (attestation.schema === zero_address) {
    throw Error("Attestation not found");
  }

  return attestation;
}

export async function revokeOnChainAttest(
  schemaUID: string,
  attestationUID: string
) {
  try {
    await getSchemaInfo(schemaUID);
  } catch (e) {
    throw Error("Something went wrong while trying to get the schema");
  }

  try {
    await getAttestation(attestationUID);
  } catch (e) {
    throw Error("Something went wrong while trying to get the attestation");
  }

  const eas = await easConnection();

  const revoke = await eas.revoke({
    schema: schemaUID,
    data: { uid: attestationUID },
  });

  return revoke;
}
