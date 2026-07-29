/* ========================================================================= */
/* PALWORLD PROFILES MANAGER (LOCALSTORAGE & JSON EXPORT/IMPORT)             */
/* ========================================================================= */

const STORAGE_KEY = "palworld_tool_profiles_v1";

export class ProfileManager {
  constructor() {
    this.data = this.loadFromStorage();
  }

  loadFromStorage() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch (e) {
        console.error("Error loading profiles from localStorage:", e);
      }
    }
    return {
      active_profile: "Standard",
      profiles: {
        Standard: {
          owned_pals: [],
          passive_breeding_data: {
            target_pal_id: "",
            target_passives: [],
            owned_stock: []
          }
        }
      }
    };
  }

  saveToStorage() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
  }

  getActiveProfileName() {
    return this.data.active_profile || "Standard";
  }

  getProfileNames() {
    return Object.keys(this.data.profiles || {});
  }

  getActiveProfileData() {
    const active = this.getActiveProfileName();
    if (!this.data.profiles[active]) {
      this.data.profiles[active] = { owned_pals: [], passive_breeding_data: {} };
    }
    return this.data.profiles[active];
  }

  setActiveProfile(name) {
    if (this.data.profiles[name]) {
      this.data.active_profile = name;
      this.saveToStorage();
    }
  }

  createProfile(name) {
    if (!name || this.data.profiles[name]) return false;
    this.data.profiles[name] = {
      owned_pals: [],
      passive_breeding_data: { target_pal_id: "", target_passives: [], owned_stock: [] }
    };
    this.data.active_profile = name;
    this.saveToStorage();
    return true;
  }

  deleteProfile(name) {
    if (name === "Standard" || !this.data.profiles[name]) return false;
    delete this.data.profiles[name];
    this.data.active_profile = "Standard";
    this.saveToStorage();
    return true;
  }

  saveActiveProfileState(ownedPals, passiveBreedingData) {
    const activeData = this.getActiveProfileData();
    if (ownedPals !== undefined) activeData.owned_pals = ownedPals;
    if (passiveBreedingData !== undefined) activeData.passive_breeding_data = passiveBreedingData;
    this.saveToStorage();
  }

  exportProfileJSON() {
    const jsonStr = JSON.stringify(this.data, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Palworld_Profiles_Backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  importProfileJSON(jsonStr) {
    try {
      const parsed = JSON.parse(jsonStr);
      if (parsed && parsed.profiles) {
        this.data = parsed;
        this.saveToStorage();
        return true;
      }
    } catch (e) {
      console.error("Invalid JSON profile file:", e);
    }
    return false;
  }
}
