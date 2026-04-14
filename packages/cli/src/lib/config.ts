import Conf from "conf";

interface SmConfig {
  apiUrl: string;
  token: string;
  locale: string;
  defaultList: string;
}

const config = new Conf<SmConfig>({
  projectName: "sm",
  defaults: {
    apiUrl: "https://sweptmind.com",
    token: "",
    locale: "cs",
    defaultList: "",
  },
});

export function getConfig<K extends keyof SmConfig>(key: K): SmConfig[K] {
  return config.get(key);
}

export function setConfig<K extends keyof SmConfig>(
  key: K,
  value: SmConfig[K],
): void {
  config.set(key, value);
}

export function getAllConfig(): SmConfig {
  return config.store;
}

export function resetConfig(): void {
  config.clear();
}

export function getToken(): string {
  return process.env.SM_TOKEN || getConfig("token");
}

export function getApiUrl(): string {
  return getConfig("apiUrl");
}
