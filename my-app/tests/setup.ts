import { GenericContainer, StartedTestContainer } from "testcontainers";

let container: StartedTestContainer;

export const setup = async () => {
  container = await new GenericContainer("postgres")
    .withEnvironment({ POSTGRES_PASSWORD: "example" })
    .withExposedPorts(5432)
    .start();

  process.env.DB_HOST = container.getHost();
  process.env.DB_PORT = container.getMappedPort(5432).toString();
};

export const teardown = async () => {
  if (container) {
    await container.stop();
  }
};
