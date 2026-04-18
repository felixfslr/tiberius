import { getSettings, saveSettings, type Settings } from "@/shared/storage";
import { sendTestConnection } from "@/shared/messages";

const form = document.getElementById("settings-form") as HTMLFormElement;
const statusEl = document.getElementById("status") as HTMLSpanElement;
const toggleKey = document.getElementById("toggle-key") as HTMLButtonElement;
const testBtn = document.getElementById("test-btn") as HTMLButtonElement;
const apiKeyInput = form.elements.namedItem("apiKey") as HTMLInputElement;

async function load() {
  const s = await getSettings();
  (form.elements.namedItem("apiBaseUrl") as HTMLInputElement).value = s.apiBaseUrl;
  (form.elements.namedItem("agentId") as HTMLInputElement).value = s.agentId;
  apiKeyInput.value = s.apiKey;
  const radios = form.elements.namedItem("behavior") as RadioNodeList;
  radios.forEach((el) => {
    const input = el as HTMLInputElement;
    input.checked = input.value === s.behavior;
  });
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const fd = new FormData(form);
  const patch: Settings = {
    apiBaseUrl: String(fd.get("apiBaseUrl") ?? "").trim(),
    agentId: String(fd.get("agentId") ?? "").trim(),
    apiKey: String(fd.get("apiKey") ?? "").trim(),
    behavior: (String(fd.get("behavior") ?? "auto_insert") as Settings["behavior"]),
  };
  await saveSettings(patch);
  flash("Saved.", "ok");
});

toggleKey.addEventListener("click", () => {
  if (apiKeyInput.type === "password") {
    apiKeyInput.type = "text";
    toggleKey.textContent = "hide";
  } else {
    apiKeyInput.type = "password";
    toggleKey.textContent = "show";
  }
});

testBtn.addEventListener("click", async () => {
  testBtn.disabled = true;
  flash("Testing…", "");
  const res = await sendTestConnection();
  testBtn.disabled = false;
  if (res.ok) flash("Connection ok.", "ok");
  else flash(`${res.error.code}: ${res.error.message}`, "err");
});

function flash(msg: string, cls: "ok" | "err" | "") {
  statusEl.textContent = msg;
  statusEl.className = cls;
}

load();
