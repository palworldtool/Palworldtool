/* ========================================================================= */
/* PALWORLD WEB APP UI RENDERER & MODAL COMPONENTS                          */
/* ========================================================================= */

export function getChevronSVG(stars) {
  if (stars === 4) {
    // 3 Stacked Chevrons with Plus Sign Centered DIRECTLY UNDERNEATH
    return `<svg width="14" height="22" viewBox="0 0 14 22" fill="none" style="vertical-align: middle;" xmlns="http://www.w3.org/2000/svg">
      <path d="M2 5L7 1L12 5" stroke="#00f2fe" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M2 9L7 5L12 9" stroke="#00f2fe" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M2 13L7 9L12 13" stroke="#00f2fe" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M4 18H10M7 15V21" stroke="#00f2fe" stroke-width="2" stroke-linecap="round"/>
    </svg>`;
  } else if (stars === 3) {
    return `<svg width="14" height="16" viewBox="0 0 14 16" fill="none" style="vertical-align: middle;" xmlns="http://www.w3.org/2000/svg">
      <path d="M2 6L7 1L12 6" stroke="#ffe000" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M2 10L7 5L12 10" stroke="#ffe000" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M2 14L7 9L12 14" stroke="#ffe000" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
  } else if (stars === 2) {
    return `<svg width="14" height="12" viewBox="0 0 14 12" fill="none" style="vertical-align: middle;" xmlns="http://www.w3.org/2000/svg">
      <path d="M2 6L7 1L12 6" stroke="#ffe000" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M2 10L7 5L12 10" stroke="#ffe000" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
  } else {
    return `<svg width="14" height="8" viewBox="0 0 14 8" fill="none" style="vertical-align: middle;" xmlns="http://www.w3.org/2000/svg">
      <path d="M2 6L7 1L12 6" stroke="#a0a8b6" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
  }
}

export class UIRenderer {
  constructor(engine, profileMgr) {
    this.engine = engine;
    this.profileMgr = profileMgr;
    
    this.palModalCallback = null;
    this.passiveModalCallback = null;
    
    this.initModals();
  }

  getPalIconPath(palId) {
    return `assets/pals/${palId}.webp`;
  }

  initModals() {
    const palModal = document.getElementById("pal-selection-modal");
    const palSearch = document.getElementById("pal-modal-search");
    const palClose = document.getElementById("pal-modal-close");

    if (palClose) {
      palClose.addEventListener("click", () => this.closePalModal());
    }
    if (palSearch) {
      palSearch.addEventListener("input", () => this.renderPalModalGrid());
    }
    if (palModal) {
      palModal.addEventListener("click", (e) => {
        if (e.target === palModal) this.closePalModal();
      });
    }

    const passiveModal = document.getElementById("passive-selection-modal");
    const passiveSearch = document.getElementById("passive-modal-search");
    const passiveClose = document.getElementById("passive-modal-close");

    if (passiveClose) {
      passiveClose.addEventListener("click", () => this.closePassiveModal());
    }
    if (passiveSearch) {
      passiveSearch.addEventListener("input", () => this.renderPassiveModalGrid());
    }
    if (passiveModal) {
      passiveModal.addEventListener("click", (e) => {
        if (e.target === passiveModal) this.closePassiveModal();
      });
    }

    const filterBtns = document.querySelectorAll("#passive-modal-filters .filter-btn");
    filterBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        filterBtns.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        this.renderPassiveModalGrid();
      });
    });
  }

  openPalModal(callback, title = "Pal auswählen") {
    this.palModalCallback = callback;
    const modal = document.getElementById("pal-selection-modal");
    const titleEl = document.getElementById("pal-modal-title");
    const searchEl = document.getElementById("pal-modal-search");

    if (titleEl) titleEl.textContent = title;
    if (searchEl) searchEl.value = "";

    this.renderPalModalGrid();
    if (modal) modal.classList.add("active");
  }

  closePalModal() {
    const modal = document.getElementById("pal-selection-modal");
    if (modal) modal.classList.remove("active");
    this.palModalCallback = null;
  }

  renderPalModalGrid() {
    const grid = document.getElementById("pal-modal-grid");
    const searchVal = (document.getElementById("pal-modal-search")?.value || "").toLowerCase().trim();
    if (!grid) return;

    grid.innerHTML = "";

    const filtered = this.engine.pals.filter(p => {
      const nameDe = (p.name_de || "").toLowerCase();
      const nameEn = (p.name_en || "").toLowerCase();
      const palId = (p.id || "").toLowerCase();
      return !searchVal || nameDe.includes(searchVal) || nameEn.includes(searchVal) || palId.includes(searchVal);
    });

    filtered.forEach(pal => {
      const card = document.createElement("div");
      card.className = "pal-card";
      card.style.cursor = "pointer";

      const icon = document.createElement("img");
      icon.className = "pal-avatar";
      icon.src = this.getPalIconPath(pal.id);
      icon.onerror = () => { icon.src = ""; icon.style.background = "#2f3542"; };

      const info = document.createElement("div");
      info.className = "pal-info";

      const name = document.createElement("div");
      name.className = "pal-name";
      name.textContent = pal.name_de || pal.name_en;

      info.appendChild(name);
      card.appendChild(icon);
      card.appendChild(info);

      card.addEventListener("click", () => {
        if (this.palModalCallback) this.palModalCallback(pal);
        this.closePalModal();
      });

      grid.appendChild(card);
    });
  }

  openPassiveModal(callback, title = "Passive auswählen") {
    this.passiveModalCallback = callback;
    const modal = document.getElementById("passive-selection-modal");
    const titleEl = document.getElementById("passive-modal-title");
    const searchEl = document.getElementById("passive-modal-search");

    if (titleEl) titleEl.textContent = title;
    if (searchEl) searchEl.value = "";

    this.renderPassiveModalGrid();
    if (modal) modal.classList.add("active");
  }

  closePassiveModal() {
    const modal = document.getElementById("passive-selection-modal");
    if (modal) modal.classList.remove("active");
    this.passiveModalCallback = null;
  }

  renderPassiveModalGrid() {
    const grid = document.getElementById("passive-modal-grid");
    const searchVal = (document.getElementById("passive-modal-search")?.value || "").toLowerCase().trim();
    const activeFilterBtn = document.querySelector("#passive-modal-filters .filter-btn.active");
    const tierNum = parseInt(activeFilterBtn?.dataset?.tier || "0", 10);

    if (!grid) return;
    grid.innerHTML = "";

    const filtered = this.engine.passives.filter(p => {
      if (tierNum !== 0 && p.stars !== tierNum) return false;
      const name = (p.name || "").toLowerCase();
      const desc = (p.description || "").toLowerCase();
      return !searchVal || name.includes(searchVal) || desc.includes(searchVal);
    });

    filtered.forEach(passive => {
      const card = document.createElement("div");
      card.className = `passive-modal-card tier-${passive.stars || 1}`;

      const header = document.createElement("div");
      header.className = "passive-modal-card-header";

      const title = document.createElement("span");
      title.className = "passive-modal-card-title";
      title.textContent = passive.name;

      const chevrons = document.createElement("span");
      chevrons.className = "badge-chevrons";
      chevrons.innerHTML = getChevronSVG(passive.stars || 1);

      header.appendChild(title);
      header.appendChild(chevrons);

      const desc = document.createElement("div");
      desc.className = "passive-modal-card-desc";
      desc.textContent = passive.description;

      card.appendChild(header);
      card.appendChild(desc);

      card.addEventListener("click", () => {
        if (this.passiveModalCallback) this.passiveModalCallback(passive);
        this.closePassiveModal();
      });

      grid.appendChild(card);
    });
  }

  renderMyPalsGrid(container, searchVal, isDisplayMode, onSaveCallback) {
    if (!container) return;
    container.innerHTML = "";

    const activeProfile = this.profileMgr.getActiveProfileData();
    const ownedMap = new Map();
    (activeProfile.owned_pals || []).forEach(item => {
      if (!ownedMap.has(item.CharacterID)) ownedMap.set(item.CharacterID, new Set());
      ownedMap.get(item.CharacterID).add(item.Gender);
    });

    const filtered = this.engine.pals.filter(p => {
      const nameDe = (p.name_de || "").toLowerCase();
      const nameEn = (p.name_en || "").toLowerCase();
      const palId = (p.id || "").toLowerCase();
      const matchesSearch = !searchVal || nameDe.includes(searchVal) || nameEn.includes(searchVal) || palId.includes(searchVal);
      
      const genders = ownedMap.get(p.id);
      const isChecked = genders && (genders.has("Male") || genders.has("Female"));
      const matchesMode = !isDisplayMode || isChecked;

      return matchesSearch && matchesMode;
    });

    filtered.forEach(pal => {
      const card = document.createElement("div");
      card.className = "pal-card";

      const avatar = document.createElement("img");
      avatar.className = "pal-avatar";
      avatar.src = this.getPalIconPath(pal.id);
      avatar.onerror = () => { avatar.src = ""; avatar.style.background = "#2f3542"; };

      const info = document.createElement("div");
      info.className = "pal-info";

      const name = document.createElement("div");
      name.className = "pal-name";
      name.textContent = pal.name_de || pal.name_en;

      const toggles = document.createElement("div");
      toggles.className = "gender-toggles";

      const genders = ownedMap.get(pal.id) || new Set();

      const maleBtn = document.createElement("button");
      maleBtn.className = `gender-btn male ${genders.has("Male") ? "active" : ""}`;
      maleBtn.textContent = "Male";

      const femaleBtn = document.createElement("button");
      femaleBtn.className = `gender-btn female ${genders.has("Female") ? "active" : ""}`;
      femaleBtn.textContent = "Female";

      if (!isDisplayMode) {
        maleBtn.addEventListener("click", () => {
          if (genders.has("Male")) genders.delete("Male"); else genders.add("Male");
          this.updateOwnedState(pal.id, genders, onSaveCallback);
          maleBtn.classList.toggle("active", genders.has("Male"));
        });

        femaleBtn.addEventListener("click", () => {
          if (genders.has("Female")) genders.delete("Female"); else genders.add("Female");
          this.updateOwnedState(pal.id, genders, onSaveCallback);
          femaleBtn.classList.toggle("active", genders.has("Female"));
        });
      }

      toggles.appendChild(maleBtn);
      toggles.appendChild(femaleBtn);

      info.appendChild(name);
      info.appendChild(toggles);

      card.appendChild(avatar);
      card.appendChild(info);

      container.appendChild(card);
    });
  }

  updateOwnedState(palId, genderSet, onSaveCallback) {
    const activeProfile = this.profileMgr.getActiveProfileData();
    let owned = (activeProfile.owned_pals || []).filter(item => item.CharacterID !== palId);

    if (genderSet.has("Male")) owned.push({ CharacterID: palId, Gender: "Male" });
    if (genderSet.has("Female")) owned.push({ CharacterID: palId, Gender: "Female" });

    activeProfile.owned_pals = owned;
    this.profileMgr.saveToStorage();
    if (onSaveCallback) onSaveCallback();
  }
}
