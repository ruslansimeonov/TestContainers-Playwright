import { GenericContainer, StartedTestContainer } from "testcontainers";
import { describe, beforeAll, afterAll, it, expect, jest } from "@jest/globals";

describe("Database tests", () => {
  let container: StartedTestContainer;

  beforeAll(async () => {
    jest.setTimeout(10000);
    try {
      container = await new GenericContainer("postgres")
        .withEnvironment({ POSTGRES_PASSWORD: "example" })
        .withExposedPorts(5432)
        .start();
      console.log("Container started:", container.getId());
    } catch (error) {
      console.error("Error starting container:", error);
    }
  });

  afterAll(async () => {
    if (container) {
      await container.stop();
      console.log("Container stopped");
    }
  });

  it("should connect to the database", async () => {
    if (!container) {
      throw new Error("Container not started");
    }
    const host = container.getHost();
    const port = container.getMappedPort(5432);
    console.log(`Database running at ${host}:${port}`);
    // Add your database connection logic here
    expect(host).toBeDefined();
    expect(port).toBeDefined();
  });
});
