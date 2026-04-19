import { getAppDomain } from "./urls";

export function getWorkspace(): { name: string; domain: string } {
  return { name: "Tiberius", domain: getAppDomain() };
}
