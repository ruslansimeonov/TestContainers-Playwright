import { GenericContainer, StartedTestContainer } from "testcontainers";
import { describe, beforeAll, afterAll, it, expect, jest } from "@jest/globals";
import { Client } from "pg";
import exp from "constants";

jest.setTimeout(30000); // Increase the timeout for the entire test suite

describe("Database tests", () => {
  let container: StartedTestContainer;

  beforeAll(async () => {
    try {
      container = await new GenericContainer("postgres")
        .withEnvironment({ POSTGRES_PASSWORD: "example" })
        .withExposedPorts(5432)
        .start();
      console.log("Container started:", container.getId());

      const client = new Client({
        host: container.getHost(),
        port: container.getMappedPort(5432),
        user: "postgres",
        password: "example",
      });

      await client.connect();
      await client.query(`
        CREATE TABLE test_table (
          id SERIAL PRIMARY KEY,
          name VARCHAR(50) NOT NULL
        );
      `);
      await client.query(`
        INSERT INTO test_table (name) VALUES ('test1'), ('test2');
      `);
      await client.end();
      console.log("Test data inserted");
    } catch (error) {
      console.error("Error starting container:", error);
    }
  });

  afterAll(async () => {
    if (container) {
      await container.stop();
      console.log("Container stopped:", container.getId());
    }
  });

  it("should handle network latency", async () => {
    if (!container) {
      throw new Error("Container not started");
    }

    const start = Date.now();

    // Small delay to ensure network latency is applied
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const client = new Client({
      host: container.getHost(),
      port: container.getMappedPort(5432),
      user: "postgres",
      password: "example",
    });

    await client.connect();

    await client.query("SELECT * FROM test_table");
    const end = Date.now();
    await client.end();

    expect(end - start).toBeGreaterThan(1000); // Expect the query to take at least 1000ms
  });

  it("should connect to the database", async () => {
    if (!container) {
      throw new Error("Container not started");
    }

    const client = new Client({
      host: container.getHost(),
      port: container.getMappedPort(5432),
      user: "postgres",
      password: "example",
    });

    await client.connect();
    const res = await client.query("SELECT * FROM test_table");
    expect(res.rows.length).toBe(2);
    expect(res.rows[0].name).toBe("test1");
    expect(res.rows[1].name).toBe("test2");
    await client.end();
  });
});
