import { GenericContainer, StartedTestContainer } from "testcontainers";

let container: StartedTestContainer;

const globalSetup = async () => {
  container = await new GenericContainer("postgres")
    .withEnvironment({ POSTGRES_PASSWORD: "example" })
    .withExposedPorts(5432)
    .start();

  process.env.DB_HOST = container.getHost();
  process.env.DB_PORT = container.getMappedPort(5432).toString();
};

const globalTeardown = async () => {
  if (container) {
    await container.stop();
  }
};

export default async () => {
  await globalSetup();
  return globalTeardown;
};