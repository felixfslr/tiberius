export type Behavior = "always_preview" | "auto_insert";

export type Settings = {
  apiBaseUrl: string;
  apiKey: string;
  agentId: string;
  behavior: Behavior;
};

export const DEFAULT_SETTINGS: Settings = {
  apiBaseUrl: "https://asktiberius.de",
  apiKey: "",
  agentId: "",
  behavior: "auto_insert",
};

export async function getSettings(): Promise<Settings> {
  const raw = (await chrome.storage.sync.get(
    DEFAULT_SETTINGS,
  )) as Partial<Settings>;
  return { ...DEFAULT_SETTINGS, ...raw };
}

export async function saveSettings(patch: Partial<Settings>): Promise<void> {
  await chrome.storage.sync.set(patch);
}

export function isConfigured(s: Settings): boolean {
  return Boolean(s.apiBaseUrl && s.apiKey && s.agentId);
}
