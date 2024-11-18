import { GenericContainer, StartedTestContainer } from "testcontainers";
import { describe, beforeAll, afterAll, it, expect, jest } from "@jest/globals";
import { Client } from "pg";
import { exec } from "child_process";
import util from "util";

jest.setTimeout(30000); // Increase the timeout for the entire test suite

describe("Database tests", () => {
  let container: StartedTestContainer;
  const execAsync = util.promisify(exec);


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

  it("should persist data across connections", async () => {
    if (!container) {
      throw new Error("Container not started");
    }

    const client1 = new Client({
      host: container.getHost(),
      port: container.getMappedPort(5432),
      user: "postgres",
      password: "example",
    });

    await client1.connect();
    await client1.query(
      "INSERT INTO test_table (name) VALUES ('persist_test');"
    );
    await client1.end();

    const client2 = new Client({
      host: container.getHost(),
      port: container.getMappedPort(5432),
      user: "postgres",
      password: "example",
    });

    await client2.connect();
    const res = await client2.query(
      "SELECT * FROM test_table WHERE name = 'persist_test';"
    );
    expect(res.rows.length).toBe(1);
    expect(res.rows[0].name).toBe("persist_test");
    await client2.end();
  });

  it("should handle concurrent writes", async () => {
    if (!container) {
      throw new Error("Container not started");
    }

    const client1 = new Client({
      host: container.getHost(),
      port: container.getMappedPort(5432),
      user: "postgres",
      password: "example",
    });

    const client2 = new Client({
      host: container.getHost(),
      port: container.getMappedPort(5432),
      user: "postgres",
      password: "example",
    });

    await client1.connect();
    await client2.connect();

    // Insert data concurrently
    await Promise.all([
      client1.query("INSERT INTO test_table (name) VALUES ('concurrent1');"),
      client2.query("INSERT INTO test_table (name) VALUES ('concurrent2');"),
    ]);

    // Validate both inserts
    const res = await client1.query(
      "SELECT * FROM test_table WHERE name IN ('concurrent1', 'concurrent2');"
    );
    expect(res.rows.length).toBe(2);

    await client1.end();
    await client2.end();
  });

  it("should recover after a network partition", async () => {
    if (!container) {
      throw new Error("Container not started");
    }
  
    // Initialize the client
    let client = new Client({
      host: container.getHost(),
      port: container.getMappedPort(5432),
      user: "postgres",
      password: "example",
    });
  
    await client.connect();
  
    // Block network traffic to the database
    await execAsync(`docker network disconnect bridge ${container.getId()}`);
    console.log("Network disconnected");
  
    // Wait for the partition to simulate downtime
    await new Promise((resolve) => setTimeout(resolve, 2000));
  
    // Reconnect network
    await execAsync(`docker network connect bridge ${container.getId()}`);
    console.log("Network reconnected");
  
    // Close the invalid connection and create a new client instance
    await client.end();
    client = new Client({
      host: container.getHost(),
      port: container.getMappedPort(5432),
      user: "postgres",
      password: "example",
    });
  
    await client.connect();
  
    // Attempt to query after recovery
    const res = await client.query("SELECT * FROM test_table");
    expect(res.rows.length).toBeGreaterThan(0);
  
    await client.end();
  });

  it("should reconnect after database restart", async () => {
    if (!container) {
      throw new Error("Container not started");
    }
  
    // Initialize the client
    let client = new Client({
      host: container.getHost(),
      port: container.getMappedPort(5432),
      user: "postgres",
      password: "example",
    });
  
    await client.connect();
  
    // Insert data
    await client.query(
      "INSERT INTO test_table (name) VALUES ('restart_test');"
    );
  
    // Restart the container
    await container.restart();
    console.log("Container restarted");
  
    // Close the invalid connection and create a new client instance
    await client.end();
    client = new Client({
      host: container.getHost(),
      port: container.getMappedPort(5432),
      user: "postgres",
      password: "example",
    });
  
    await client.connect();
  
    // Validate the previously inserted data is still there
    const res = await client.query(
      "SELECT * FROM test_table WHERE name = 'restart_test';"
    );
    expect(res.rows.length).toBe(1);
    expect(res.rows[0].name).toBe("restart_test");
  
    await client.end();
  });

  // Two audiences, developers and testers
  // Two different databases, postgres and mysql
  // Redis database for caching
  // Seeding with some dummy data
  // Improvement for developers is easy, docker running
  // Improvement for testers automate test, test in different environtments, paralel testing, different versions

  // Two different versions of postgress/msql that in one results in error in one not
  // Authentication in newer msql is different, older versions are plain text. Nowadays is challange 

  // Test against dest containers in the neweset versions vs fixed versions
  // Different versions of an external api with different responses that return different things and /DOES NOT TAKE MORE TIME/

  // 
  
});
