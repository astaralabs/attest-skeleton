import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  expectTypeOf,
} from "vitest";
import { createServer, Server } from "node:http";
import supertest, { SuperTest, Test } from "supertest";
import { koaApp } from "../src/api/index";
import { SchemaRecord } from "@ethereum-attestation-service/eas-sdk";
import * as dotenv from "dotenv";
import { createRandomWord } from "./helpers";

dotenv.config();
interface LocalTestContext {
  server: Server;
  testClient: SuperTest<Test>;
}

describe("All endpoints test", () => {
  beforeEach<LocalTestContext>(async (context) => {
    context.server = createServer(koaApp.callback()).listen();
    context.testClient = supertest(context.server);
  });

  afterEach<LocalTestContext>(async (context) => {
    context.server.close();
  });

  it<LocalTestContext>("Register new schema fails if schema has incorrect format", async ({
    testClient,
  }) => {
    const res = await testClient.post("/register-schema").send({
      schema: "noType field0, bool field1, address field2",
    });
    expect(res.body).toEqual({
      message: "Field 'schema' has incorrect format",
    });
    expect(res.status).toEqual(400);
  });

  it<LocalTestContext>("Register new schema fails if schema is already registered", async ({
    testClient,
  }) => {
    const res = await testClient.post("/register-schema").send({
      schema: "Transaction failed",
    });
    expect(res.body).toEqual({
      message: "Field 'schema' has incorrect format",
    });
    expect(res.status).toEqual(400);
  });

  it<LocalTestContext>("Register new schema", async ({ testClient }) => {
    const field1 = createRandomWord();
    const field2 = createRandomWord();
    const field3 = createRandomWord();
    const field4 = createRandomWord();

    const schema = `uint256 ${field1}, bool ${field2}, address ${field3}, string ${field4}`;
    console.log("The schema: ", schema);
    const res = await testClient.post("/register-schema").send({
      schema,
    });

    const schemaRegex = /^\{\s*"message":\s*"0x[a-fA-F0-9]{64}"\s*\}$/;

    const body = res.body as JSON;
    const strBody = JSON.stringify(body);
    const matchAddress = strBody.match(schemaRegex);
    expect(matchAddress?.input).toEqual(strBody);
    expect(res.status).toEqual(200);
  }, 15000);

  it<LocalTestContext>("Attest fails if schema has incorrect format", async ({
    testClient,
  }) => {
    const res = await testClient.post("/onchain-attest").send({
      schema: "noType field0, bool field1, address field2",
      schemaUID:
        "0x2F8A2CBCAD8A03E8C51CF1081A7B0DC67DB2980D52B9631F97B43A67CB83208A",
      data: [1, false, "0x55D26f9ae0203EF95494AE4C170eD35f4Cf77797"],
    });
    expect(res.body).toEqual({
      message: "Field 'schema' has incorrect format",
    });
    expect(res.status).toEqual(400);
  });

  it<LocalTestContext>("Attest fails if schemaUID has incorrect format", async ({
    testClient,
  }) => {
    const res = await testClient.post("/onchain-attest").send({
      schema: "uint256 field0, bool field1, address field2",
      schemaUID:
        "2F8A2CBCAD8A03E8C51CF1081A7B0DC67DB2980D52B9631F97B43A67CB83208A",
      data: [1, false, "0x55D26f9ae0203EF95494AE4C170eD35f4Cf77797"],
    });
    expect(res.body).toEqual({
      message: "Field 'schemaUID' has incorrect format",
    });
    expect(res.status).toEqual(400);
  });

  it<LocalTestContext>("Attest fails if schema and data has different size", async ({
    testClient,
  }) => {
    const res = await testClient.post("/onchain-attest").send({
      schema: "uint256 field0, bool field1, address field2",
      schemaUID:
        "0x2F8A2CBCAD8A03E8C51CF1081A7B0DC67DB2980D52B9631F97B43A67CB83208A",
      data: [1, "0x55D26f9ae0203EF95494AE4C170eD35f4Cf77797"],
    });
    expect(res.body).toEqual({
      message:
        "Field 'schema' and 'data' must contain the same number of elements",
    });
    expect(res.status).toEqual(400);
  });

  it<LocalTestContext>("Attest fails if schemaUID not exists", async ({
    testClient,
  }) => {
    const res = await testClient.post("/onchain-attest").send({
      schema: "uint256 field0, bool field1, address field2",
      schemaUID:
        "0x2F8A2CBCAD8A03E8C51CF1081A7B0DC67DB2980D52B9631F97B43A67CB83208B",
      data: [1, false, "0x55D26f9ae0203EF95494AE4C170eD35f4Cf77797"],
    });
    expect(res.body).toEqual({
      message: "Something went wrong while launching the transaction",
    });
    expect(res.status).toEqual(400);
  });

  it<LocalTestContext>("Make an attestation", async ({ testClient }) => {
    const res = await testClient.post("/onchain-attest").send({
      schema: "uint256 field11, bool field1, address field2, string field3", //Schema created previously
      schemaUID:
        "0x2F8A2CBCAD8A03E8C51CF1081A7B0DC67DB2980D52B9631F97B43A67CB83208A",
      data: [
        1,
        false,
        "0x55D26f9ae0203EF95494AE4C170eD35f4Cf77797",
        "test attestation",
      ],
    });

    const attestationUID = /^\{\s*"message":\s*"0x[a-fA-F0-9]{64}"\s*\}$/;

    const body: any = res.body as JSON;
    const strBody = JSON.stringify(body);
    const matchAddress = strBody.match(attestationUID);

    expect(matchAddress?.input).toEqual(strBody);
    expect(res.status).toEqual(200);
  }, 20000);

  it<LocalTestContext>("Getting an attestation fails if attest UID has incorrect format", async ({
    testClient,
  }) => {
    const res = await testClient.get(
      "/attestation-info?attestUID=86b4f55c5aebc99a3f55b1515d60a76525711f50bef7792c932fcc461b53d266"
    );

    expect(res.body).toEqual({
      message: "Something went wrong",
    });
    expect(res.status).toEqual(400);
  });

  it<LocalTestContext>("Getting an attestation fails if attest UID is unknown", async ({
    testClient,
  }) => {
    const res = await testClient.get(
      "/attestation-info?attestUID=0x86b4f55c5aebc99a3f55b1515d60a76525711f50bef7792c932fcc461b53d267"
    );

    expect(res.body).toEqual({
      message: "Something went wrong",
    });
    expect(res.status).toEqual(400);
  });

  it<LocalTestContext>("Get the attestation info", async ({ testClient }) => {
    const res = await testClient.get(
      "/attestation-info?attestUID=0x86b4f55c5aebc99a3f55b1515d60a76525711f50bef7792c932fcc461b53d266"
    );

    expect(res.status).toEqual(200);
    expectTypeOf(res.body).parameter(0).toMatchTypeOf<JSON>;
  });

  it<LocalTestContext>("Getting an schema fails if schemaUID has incorrect format", async ({
    testClient,
  }) => {
    const res = await testClient.get(
      "/schema-info?schemaUID=2F8A2CBCAD8A03E8C51CF1081A7B0DC67DB2980D52B9631F97B43A67CB83208A"
    );

    expect(res.body).toEqual({
      message: "Something went wrong",
    });
    expect(res.status).toEqual(400);
  });

  it<LocalTestContext>("Getting an schema fails if schemaUID is unknown", async ({
    testClient,
  }) => {
    const res = await testClient.get(
      "/schema-info?schemaUID=2F8A2CBCAD8A03E8C51CF1081A7B0DC67DB2980D52B9631F97B43A67CB832FFF"
    );

    expect(res.body).toEqual({
      message: "Something went wrong",
    });
    expect(res.status).toEqual(400);
  });

  it<LocalTestContext>("Getting an schema", async ({ testClient }) => {
    const res = await testClient.get(
      "/schema-info?schemaUID=0x2F8A2CBCAD8A03E8C51CF1081A7B0DC67DB2980D52B9631F97B43A67CB83208A"
    );

    expectTypeOf(res.body).parameter(0).toMatchTypeOf<SchemaRecord>;
    expect(res.status).toEqual(200);
  });

  it<LocalTestContext>("Revoking fails if schemaUID has incorrect format", async ({
    testClient,
  }) => {
    const res = await testClient.post("/revoke-onchain-attest").send({
      schemaUID:
        "2F8A2CBCAD8A03E8C51CF1081A7B0DC67DB2980D52B9631F97B43A67CB83208A",
      attestationUID:
        "0x86b4f55c5aebc99a3f55b1515d60a76525711f50bef7792c932fcc461b53d266",
    });
    expect(res.status).toEqual(400);
    expect(res.body).toEqual({
      message: "Something went wrong",
    });
  });

  it<LocalTestContext>("Revoking fails if schemaUID not exist", async ({
    testClient,
  }) => {
    const res = await testClient.post("/revoke-onchain-attest").send({
      schemaUID:
        "0x2F8A2CBCAD8A03E8C51CF1081A7B0DC67DB2980D52B9631F97B43A67CB83FFFF",
      attestationUID:
        "0x86b4f55c5aebc99a3f55b1515d60a76525711f50bef7792c932fcc461b53d266",
    });
    expect(res.status).toEqual(400);
    expect(res.body).toEqual({
      message: "Something went wrong",
    });
  });

  it<LocalTestContext>("Revoking fails if attestationUID has incorrect format", async ({
    testClient,
  }) => {
    const res = await testClient.post("/revoke-onchain-attest").send({
      schemaUID:
        "0x2F8A2CBCAD8A03E8C51CF1081A7B0DC67DB2980D52B9631F97B43A67CB83208A",
      attestationUID:
        "86b4f55c5aebc99a3f55b1515d60a76525711f50bef7792c932fcc461b53d266",
    });
    expect(res.status).toEqual(400);
    expect(res.body).toEqual({
      message: "Something went wrong",
    });
  });

  it<LocalTestContext>("Revoking fails if attestationUID not exist", async ({
    testClient,
  }) => {
    const res = await testClient.post("/revoke-onchain-attest").send({
      schemaUID:
        "0x2F8A2CBCAD8A03E8C51CF1081A7B0DC67DB2980D52B9631F97B43A67CB83208A",
      attestationUID:
        "0x86b4f55c5aebc99a3f55b1515d60a76525711f50bef7792c932fcc461b53FFFF",
    });
    expect(res.status).toEqual(400);
    expect(res.body).toEqual({
      message: "Something went wrong",
    });
  });

  it<LocalTestContext>("Revoking works if information is correct", async ({
    testClient,
  }) => {
    const response = await testClient.post("/onchain-attest").send({
      schema: "uint256 field11, bool field1, address field2, string field3",
      schemaUID:
        "0x2F8A2CBCAD8A03E8C51CF1081A7B0DC67DB2980D52B9631F97B43A67CB83208A",
      data: [
        2,
        false,
        "0x55D26f9ae0203EF95494AE4C170eD35f4Cf77797",
        "Attest and revoke",
      ],
    });

    const body: any = response.body as JSON;
    const attestationUID = body.message;

    const res = await testClient.post("/revoke-onchain-attest").send({
      schemaUID:
        "0x2F8A2CBCAD8A03E8C51CF1081A7B0DC67DB2980D52B9631F97B43A67CB83208A",
      attestationUID,
    });
    expect(res.status).toEqual(200);
    expect(res.body).toEqual({
      message: "Attestation revoked successfully",
    });
  }, 15000);

  //revoke fails if we try to revoke an already revoked attestation
});
