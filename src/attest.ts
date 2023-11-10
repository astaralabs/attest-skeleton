import {
  EAS,
  SchemaEncoder,
  SchemaItem,
  SchemaRegistry,
} from "@ethereum-attestation-service/eas-sdk";
import { ethers } from "ethers";

import * as dotenv from "dotenv";

dotenv.config();

export async function blockchainConnection() {
  return new ethers.JsonRpcProvider(); //Default provider 127.0.0.1:8545
}

export async function signerConnection() {
  const provider = await blockchainConnection();

  const signer = new ethers.Wallet(
    process.env.ADMIN_PRIVATE_KEY as string,
    provider
  );
  return signer;
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

  return tx; //Here we should return the new schema UID
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
  const schemaRegistry = await registryConnection();

  const signer = await signerConnection();
  schemaRegistry.connect(signer);

  const record = await schemaRegistry.getSchema({ uid: schemaUID });
  return record;
}

export async function getAttestation(uid: string) {
  const eas = await easConnection();
  const attestation = await eas.getAttestation(uid);

  return attestation;
}
