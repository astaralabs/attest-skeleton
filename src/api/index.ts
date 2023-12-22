import Koa from "koa";
import cors from "@koa/cors";
import Router from "@koa/router";
import { bodyParser } from "@koa/bodyparser";

import * as dotenv from "dotenv";
import {
  getAttestation,
  getSchemaInfo,
  onChainAttest,
  registerSchema,
  revokeOnChainAttest,
} from "../attest";

dotenv.config();

export const koaApp = new Koa();

export default koaApp.callback();

koaApp.use(cors());

koaApp.use(bodyParser()).listen(3000);

const router = new Router();

router.post("/register-schema", async (ctx) => {
  const { schema } = ctx.request.body;
  const schemaRegex =
    /^(bool|string|uint256|address)\s+\w+(?:,\s*(bool|string|uint256|address)\s+\w+)*$/;

  if (!schema.match(schemaRegex)) {
    ctx.response.status = 400;
    ctx.response.body = { message: "Field 'schema' has incorrect format" };
    return;
  }

  try {
    const uid = await registerSchema(schema);
    ctx.response.status = 200;
    ctx.response.body = { message: uid };
    return;
  } catch (e) {
    ctx.response.status = 400;
    ctx.response.body = { message: "Transaction failed" };
    return;
  }
});

router.post("/onchain-attest", async (ctx) => {
  const { schema, schemaUID, data } = ctx.request.body;

  const schemaElements = schema.split(", ");

  if (schemaElements.length != data.length) {
    ctx.response.status = 400;
    ctx.response.body = {
      message:
        "Field 'schema' and 'data' must contain the same number of elements",
    };
    return;
  }

  const schemaRegex =
    /^(bool|string|uint256|address)\s+\w+(?:,\s*(bool|string|uint256|address)\s+\w+)*$/;

  if (!schema.match(schemaRegex)) {
    ctx.response.status = 400;
    ctx.response.body = { message: "Field 'schema' has incorrect format" };
    return;
  }

  const uidRegex = /0x(?!0{64})[a-fA-F0-9]{64}/;
  if (!schemaUID.match(uidRegex)) {
    ctx.response.status = 400;
    ctx.response.body = { message: "Field 'schemaUID' has incorrect format" };
    return;
  }

  try {
    const newAttestationUID = await onChainAttest(schema, schemaUID, data);

    ctx.response.status = 200;
    ctx.response.body = { message: newAttestationUID };
    return;
  } catch (e) {
    ctx.response.status = 400;
    ctx.response.body = {
      message: "Something went wrong while launching the transaction",
    };
    return;
  }
});

router.post("/revoke-onchain-attest", async (ctx) => {
  const { schemaUID, attestationUID } = ctx.request.body;

  try {
    await revokeOnChainAttest(schemaUID, attestationUID);
    ctx.response.status = 200;
    ctx.response.body = { message: "Attestation revoked successfully" };
  } catch (e) {
    ctx.response.status = 400;
    ctx.response.body = { message: "Something went wrong" };
    return;
  }
});

router.get("/schema-info", async (ctx) => {
  const schemaUID: any = ctx.query.schemaUID;

  try {
    const record = await getSchemaInfo(schemaUID);
    ctx.response.status = 200;
    ctx.response.body = { message: record };
  } catch (e) {
    ctx.response.status = 400;
    ctx.response.body = { message: "Something went wrong" };
    return;
  }
});

router.get("/attestation-info", async (ctx) => {
  const attestUID: any = ctx.query.attestUID;

  try {
    const attestation = await getAttestation(attestUID);

    const attestationInfo = {
      uid: attestation.uid,
      schema: attestation.schema,
      refUID: attestation.refUID,
      time: Number(attestation.time),
      expirationTime: Number(attestation.expirationTime),
      revocationTime: Number(attestation.revocationTime),
      recipient: attestation.recipient,
      revocable: attestation.revocable,
      attester: attestation.attester,
      data: attestation.data,
    };

    ctx.response.status = 200;
    ctx.response.body = { message: attestationInfo };
    return;
  } catch (e) {
    ctx.response.status = 400;
    ctx.response.body = { message: "Something went wrong" };
    return;
  }
});

koaApp.use(router.routes()).use(router.allowedMethods());
