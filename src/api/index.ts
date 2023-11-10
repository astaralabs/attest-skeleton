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
    const tx = await registerSchema(schema);
    console.log(tx);
  } catch (e) {
    console.log(e);
    ctx.response.status = 400;
    ctx.response.body = { message: "Transaction failed" };
    return;
  }

  ctx.response.status = 200;
  ctx.response.body = { message: "Schema registered successfully" };
  return;
});

router.post("/attest", async (ctx) => {
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

router.post("/attestation-info", async (ctx) => {
  const { attestUID } = ctx.request.body;

  const uidRegex = /0x(?!0{64})[a-fA-F0-9]{64}/;
  if (!attestUID.match(uidRegex)) {
    ctx.response.status = 400;
    ctx.response.body = { message: "Field 'attestUID' has incorrect format" };
    return;
  }

  const attestation = await getAttestation(attestUID);
  const zero_address =
    "0x0000000000000000000000000000000000000000000000000000000000000000";
  if (attestation.schema === zero_address) {
    ctx.response.status = 400;
    ctx.response.body = { message: "Unknown attestation UID" };
    return;
  }
  console.log(attestation);

  ctx.response.status = 200;
  ctx.response.body = { message: attestation.schema }; //Here we should return all the values
});

router.post("/schema-info", async (ctx) => {
  const { schemaUID } = ctx.request.body;

  const uidRegex = /0x(?!0{64})[a-fA-F0-9]{64}/;
  if (!schemaUID.match(uidRegex)) {
    ctx.response.status = 400;
    ctx.response.body = { message: "Field 'schemaUID' has incorrect format" };
    return;
  }

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

koaApp.use(router.routes()).use(router.allowedMethods());
