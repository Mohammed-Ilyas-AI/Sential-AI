export type EnvironmentVariables = Readonly<Record<string, string | undefined>>;

/** The only module in sentinel-core that reads process.env. */
export function readEnvironment(): EnvironmentVariables {
  return process.env;
}
