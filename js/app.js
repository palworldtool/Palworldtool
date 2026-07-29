/* ========================================================================= */
/* PALWORLD WEB APP MAIN CONTROLLER & APPLICATION LOGIC                      */
/* ========================================================================= */

import { BreedingEngine } from './breeding.js';
import { ProfileManager } from './profiles.js';
import { UIRenderer, getChevronSVG } from './ui.js';

class PalworldWebApp {
  constructor() {
    this.engine = null;
    this.profileMgr = new ProfileManager();
    this.ui = null;
    
    // State for Passive Breeding Calculator
    this.targetPal = null;
    this.targetPassives = [null, null, null, null];
    this.ownedStock = [];
    this.excludedPals = new Set();
    
    this.init();
  }

  async init() {
    try {
      const [palsRes, passivesRes, matrixRes] = await Promise.all([
        fetch('data/pals.json'),
        fetch('data/passives.json'),
        fetch('data/breed_matrix.json')
      ]);

      const pals = await palsRes.json();
      const passives = await passivesRes.json();
      const matrix = await matrixRes.json();

      this.engine = new BreedingEngine(pals, passives, matrix);
      this.ui = new UIRenderer(this.engine, this.profileMgr);

      this.setupNavigation();
      this.setupMyPalsTab();
      this.setupBreedablePalsTab();
      this.setupPairCalcTab();
      this.setupPassiveCalcTab();
      this.setupPassivesOverviewTab();

      // Render initial view
      this.renderCurrentTab("view-my-pals");
    } catch (err) {
      console.error("Failed to initialize Palworld Web App:", err);
    }
  }

  setupNavigation() {
    const navBtns = document.querySelectorAll(".nav-tab-btn");
    navBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        const targetViewId = btn.dataset.view;
        if (!targetViewId) return;

        navBtns.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");

        document.querySelectorAll(".tab-view").forEach(v => v.classList.remove("active"));
        const targetView = document.getElementById(targetViewId);
        if (targetView) targetView.classList.add("active");

        this.renderCurrentTab(targetViewId);
      });
    });
  }

  renderCurrentTab(viewId) {
    if (viewId === "view-my-pals") {
      const searchVal = (document.getElementById("my-pals-search")?.value || "").toLowerCase().trim();
      const isDisplayMode = document.getElementById("my-pals-mode-toggle")?.checked || false;
      const container = document.getElementById("my-pals-grid");
      this.ui.renderMyPalsGrid(container, searchVal, isDisplayMode, () => this.updatePalsCountBadge());
      this.updatePalsCountBadge();
    } else if (viewId === "view-breedable-pals") {
      this.renderBreedablePals();
    } else if (viewId === "view-pair-calc") {
      this.renderPairCalc();
    } else if (viewId === "view-passive-calc") {
      this.renderPassiveCalcUI();
    } else if (viewId === "view-passives-overview") {
      this.renderPassivesOverview();
    }
  }

  updatePalsCountBadge() {
    const badge = document.getElementById("my-pals-count-badge");
    const active = this.profileMgr.getActiveProfileData();
    const count = (active.owned_pals || []).length;
    if (badge) badge.textContent = `${count} Pals im Bestand`;
  }

  setupMyPalsTab() {
    const search = document.getElementById("my-pals-search");
    const toggle = document.getElementById("my-pals-mode-toggle");

    if (search) search.addEventListener("input", () => this.renderCurrentTab("view-my-pals"));
    if (toggle) toggle.addEventListener("change", () => this.renderCurrentTab("view-my-pals"));
  }

  setupBreedablePalsTab() {
    const search = document.getElementById("breedable-search");
    if (search) search.addEventListener("input", () => this.renderBreedablePals());
  }

  renderBreedablePals() {
    const container = document.getElementById("breedable-grid");
    const searchVal = (document.getElementById("breedable-search")?.value || "").toLowerCase().trim();
    if (!container) return;

    container.innerHTML = "";

    const activeProfile = this.profileMgr.getActiveProfileData();
    const ownedList = activeProfile.owned_pals || [];
    const ownedIds = new Set(ownedList.map(i => i.CharacterID));

    if (ownedIds.size === 0) {
      container.innerHTML = `<div style="color: #565f89; margin: 30px; text-align: center; font-size: 1.1rem;">Markiere zuerst Pals im Tab 'Meine Pals', um züchtbare Kombinationen zu sehen.</div>`;
      return;
    }

    const breedableMap = new Map();
    this.engine.pals.forEach(child => {
      const combos = this.engine.getCombinations(child.id);
      const possibleCombos = combos.filter(([p1, p2]) => {
        const hasP1 = ownedIds.has(p1.id);
        const hasP2 = ownedIds.has(p2.id);
        return hasP1 && hasP2;
      });

      if (possibleCombos.length > 0) {
        const nameDe = (child.name_de || "").toLowerCase();
        const nameEn = (child.name_en || "").toLowerCase();
        if (!searchVal || nameDe.includes(searchVal) || nameEn.includes(searchVal)) {
          breedableMap.set(child, possibleCombos);
        }
      }
    });

    if (breedableMap.size === 0) {
      container.innerHTML = `<div style="color: #565f89; margin: 30px; text-align: center;">Keine züchtbaren Kombinationen aus deinem aktuellen Bestand gefunden.</div>`;
      return;
    }

    breedableMap.forEach((combos, childPal) => {
      const box = document.createElement("div");
      box.className = "glass-box";

      const header = document.createElement("div");
      header.className = "section-box-header";

      const titleGroup = document.createElement("div");
      titleGroup.style.display = "flex";
      titleGroup.style.alignItems = "center";
      titleGroup.style.gap = "10px";

      const icon = document.createElement("img");
      icon.className = "pal-avatar";
      icon.src = this.ui.getPalIconPath(childPal.id);

      const title = document.createElement("span");
      title.className = "view-title";
      title.textContent = childPal.name_de || childPal.name_en;

      titleGroup.appendChild(icon);
      titleGroup.appendChild(title);

      const countBadge = document.createElement("span");
      countBadge.className = "count-badge";
      countBadge.textContent = `${combos.length} Kombinationen`;

      header.appendChild(titleGroup);
      header.appendChild(countBadge);
      box.appendChild(header);

      const comboGrid = document.createElement("div");
      comboGrid.className = "cards-grid";

      combos.slice(0, 8).forEach(([p1, p2]) => {
        const card = document.createElement("div");
        card.className = "pal-card";

        const p1Img = document.createElement("img");
        p1Img.className = "pal-avatar";
        p1Img.src = this.ui.getPalIconPath(p1.id);

        const plus = document.createElement("span");
        plus.textContent = " + ";
        plus.style.color = "#8c52ff";
        plus.style.fontWeight = "bold";

        const p2Img = document.createElement("img");
        p2Img.className = "pal-avatar";
        p2Img.src = this.ui.getPalIconPath(p2.id);

        const text = document.createElement("span");
        text.style.fontSize = "0.8rem";
        text.style.fontWeight = "bold";
        text.textContent = `${p1.name_de || p1.name_en} & ${p2.name_de || p2.name_en}`;

        card.appendChild(p1Img);
        card.appendChild(plus);
        card.appendChild(p2Img);
        card.appendChild(text);

        comboGrid.appendChild(card);
      });

      box.appendChild(comboGrid);
      container.appendChild(box);
    });
  }

  setupPairCalcTab() {}

  renderPairCalc() {
    const parent1Slot = document.getElementById("pair-parent1-slot");
    const parent2Slot = document.getElementById("pair-parent2-slot");

    if (parent1Slot) {
      parent1Slot.onclick = () => {
        this.ui.openPalModal((pal) => {
          parent1Slot.dataset.palId = pal.id;
          parent1Slot.innerHTML = `<img src="${this.ui.getPalIconPath(pal.id)}" class="pal-avatar"><span>${pal.name_de || pal.name_en}</span>`;
          this.calculatePairResult();
        }, "Elternteil 1 wählen");
      };
    }

    if (parent2Slot) {
      parent2Slot.onclick = () => {
        this.ui.openPalModal((pal) => {
          parent2Slot.dataset.palId = pal.id;
          parent2Slot.innerHTML = `<img src="${this.ui.getPalIconPath(pal.id)}" class="pal-avatar"><span>${pal.name_de || pal.name_en}</span>`;
          this.calculatePairResult();
        }, "Elternteil 2 wählen");
      };
    }
  }

  calculatePairResult() {
    const p1Id = document.getElementById("pair-parent1-slot")?.dataset?.palId;
    const p2Id = document.getElementById("pair-parent2-slot")?.dataset?.palId;
    const childSlot = document.getElementById("pair-child-slot");

    if (p1Id && p2Id && childSlot) {
      const p1 = this.engine.by_id[p1Id];
      const p2 = this.engine.by_id[p2Id];
      const child = this.engine.breedByPals(p1, p2);

      if (child) {
        childSlot.innerHTML = `<img src="${this.ui.getPalIconPath(child.id)}" class="pal-avatar"><span style="color: #8c52ff; font-weight: bold;">${child.name_de || child.name_en}</span>`;
      } else {
        childSlot.innerHTML = `<span style="color: #eb4d4b;">Kein Ergebnis</span>`;
      }
    }
  }

  setupPassiveCalcTab() {
    const targetCard = document.getElementById("passive-calc-target-slot");
    const btnSync = document.getElementById("btn-passive-sync-inventory");
    const btnAddPal = document.getElementById("btn-passive-add-pal");
    const btnClearStock = document.getElementById("btn-passive-clear-stock");
    const btnCalculate = document.getElementById("btn-calculate-passive-breeding");

    if (targetCard) {
      targetCard.addEventListener("click", () => {
        this.ui.openPalModal((pal) => {
          this.targetPal = pal;
          this.renderPassiveCalcUI();
        }, "Ziel-Pal auswählen");
      });
    }

    for (let i = 0; i < 4; i++) {
      const pill = document.getElementById(`target-passive-slot-${i + 1}`);
      if (pill) {
        pill.addEventListener("click", () => {
          this.ui.openPassiveModal((passive) => {
            this.targetPassives[i] = passive;
            this.renderPassiveCalcUI();
          }, `Wunsch-Passive ${i + 1} wählen`);
        });
      }
    }

    const stockSearch = document.getElementById("passive-stock-search");
    if (stockSearch) {
      stockSearch.addEventListener("input", () => this.renderPassiveCalcUI());
    }

    if (btnSync) {
      btnSync.addEventListener("click", () => {
        const activeProfile = this.profileMgr.getActiveProfileData();
        const owned = activeProfile.owned_pals || [];

        this.ownedStock = owned.map(item => ({
          pal_id: item.CharacterID,
          gender: item.Gender,
          passives: []
        }));

        this.renderPassiveCalcUI();
      });
    }

    if (btnAddPal) {
      btnAddPal.addEventListener("click", () => {
        this.ui.openPalModal((pal) => {
          this.ownedStock.push({
            pal_id: pal.id,
            gender: "Male",
            passives: []
          });
          this.renderPassiveCalcUI();
        }, "Pal zum Bestand hinzufügen");
      });
    }

    if (btnClearStock) {
      btnClearStock.addEventListener("click", () => {
        this.ownedStock = [];
        this.renderPassiveCalcUI();
      });
    }

    if (btnCalculate) {
      btnCalculate.addEventListener("click", () => {
        this.runPassiveBreedingCalculation();
      });
    }
  }

  renderPassiveCalcUI() {
    const targetSlot = document.getElementById("passive-calc-target-slot");
    if (targetSlot) {
      if (this.targetPal) {
        targetSlot.classList.add("filled");
        targetSlot.innerHTML = `
          <img src="${this.ui.getPalIconPath(this.targetPal.id)}" class="pal-avatar">
          <span class="target-slot-name">${this.targetPal.name_de || this.targetPal.name_en}</span>
          <span class="target-slot-clear">&times;</span>
        `;
        targetSlot.querySelector(".target-slot-clear").onclick = (e) => {
          e.stopPropagation();
          this.targetPal = null;
          this.renderPassiveCalcUI();
        };
      } else {
        targetSlot.classList.remove("filled");
        targetSlot.innerHTML = `
          <span class="target-slot-icon">+</span>
          <span class="target-slot-name">Ziel-Pal wählen</span>
        `;
      }
    }

    for (let i = 0; i < 4; i++) {
      const pill = document.getElementById(`target-passive-slot-${i + 1}`);
      const passive = this.targetPassives[i];
      if (pill) {
        pill.className = "passive-pill";
        if (passive) {
          pill.classList.add("filled", `tier-${passive.stars}`);
          pill.innerHTML = `<span>${passive.name}</span> <span class="pill-clear">&times;</span>`;
          pill.querySelector(".pill-clear").onclick = (e) => {
            e.stopPropagation();
            this.targetPassives[i] = null;
            this.renderPassiveCalcUI();
          };
        } else {
          pill.innerHTML = `<span>+ Passive ${i + 1}</span>`;
        }
      }
    }

    const stockContainer = document.getElementById("passive-stock-rows");
    const stockSearchVal = (document.getElementById("passive-stock-search")?.value || "").toLowerCase().trim();

    if (stockContainer) {
      stockContainer.innerHTML = "";

      if (this.ownedStock.length === 0) {
        stockContainer.innerHTML = `<div style="color: #565f89; text-align: center; padding: 15px;">Keine Pals im Bestand für den Passiv-Rechner. Klicke oben auf 'Aus Bestand synchronisieren' oder 'Pal hinzufügen'.</div>`;
      } else {
        this.ownedStock.forEach((item, index) => {
          const pal = this.engine.by_id[item.pal_id];
          if (!pal) return;

          const palNameDe = (pal.name_de || "").toLowerCase();
          const palNameEn = (pal.name_en || "").toLowerCase();
          const genderText = (item.gender || "").toLowerCase();
          const passivesText = (item.passives || []).join(" ").toLowerCase();

          // Filter by search term
          if (stockSearchVal) {
            const matches = palNameDe.includes(stockSearchVal) || 
                            palNameEn.includes(stockSearchVal) || 
                            genderText.includes(stockSearchVal) || 
                            passivesText.includes(stockSearchVal);
            if (!matches) return;
          }

          const row = document.createElement("div");
          row.className = "owned-row";

          const avatar = document.createElement("img");
          avatar.className = "pal-avatar";
          avatar.src = this.ui.getPalIconPath(pal.id);

          const name = document.createElement("span");
          name.style.fontWeight = "bold";
          name.style.minWidth = "120px";
          name.textContent = pal.name_de || pal.name_en;

          const genderGroup = document.createElement("div");
          genderGroup.className = "gender-toggles";

          const maleBtn = document.createElement("button");
          maleBtn.className = `gender-btn male ${item.gender === "Male" ? "active" : ""}`;
          maleBtn.textContent = "Male";
          maleBtn.onclick = () => {
            item.gender = "Male";
            this.renderPassiveCalcUI();
          };

          const femaleBtn = document.createElement("button");
          femaleBtn.className = `gender-btn female ${item.gender === "Female" ? "active" : ""}`;
          femaleBtn.textContent = "Female";
          femaleBtn.onclick = () => {
            item.gender = "Female";
            this.renderPassiveCalcUI();
          };

          genderGroup.appendChild(maleBtn);
          genderGroup.appendChild(femaleBtn);

          const passiveGroup = document.createElement("div");
          passiveGroup.style.display = "flex";
          passiveGroup.style.gap = "6px";
          passiveGroup.style.flex = "1";

          for (let pIdx = 0; pIdx < 4; pIdx++) {
            const pName = item.passives[pIdx];
            const pObj = pName ? this.engine.passivesByName[pName] : null;

            const pPill = document.createElement("div");
            pPill.className = "passive-pill";

            if (pObj) {
              pPill.classList.add("filled", `tier-${pObj.stars}`);
              pPill.innerHTML = `<span>${pObj.name}</span> <span class="pill-clear">&times;</span>`;
              pPill.querySelector(".pill-clear").onclick = (e) => {
                e.stopPropagation();
                item.passives[pIdx] = null;
                this.renderPassiveCalcUI();
              };
            } else {
              pPill.innerHTML = `<span>+ Passiv</span>`;
              pPill.onclick = () => {
                const quicks = this.targetPassives.filter(Boolean);
                this.ui.openPassiveModal((selected) => {
                  item.passives[pIdx] = selected.name;
                  this.renderPassiveCalcUI();
                }, "Passive wählen", quicks);
              };
            }

            passiveGroup.appendChild(pPill);
          }

          const deleteBtn = document.createElement("button");
          deleteBtn.className = "btn-danger";
          deleteBtn.textContent = "Löschen";
          deleteBtn.onclick = () => {
            this.ownedStock.splice(index, 1);
            this.renderPassiveCalcUI();
          };

          row.appendChild(avatar);
          row.appendChild(name);
          row.appendChild(genderGroup);
          row.appendChild(passiveGroup);
          row.appendChild(deleteBtn);

          stockContainer.appendChild(row);
        });
      }
    }
  }

  runPassiveBreedingCalculation() {
    const resultsContainer = document.getElementById("passive-results-container");
    if (!resultsContainer) return;

    if (!this.targetPal) {
      alert("Bitte wähle zuerst einen Ziel-Pal aus!");
      return;
    }

    const activePassives = this.targetPassives.filter(p => p !== null).map(p => p.name);
    if (activePassives.length === 0) {
      alert("Bitte wähle mindestens eine Wunsch-Passive aus!");
      return;
    }

    const res = this.engine.findPassiveBreedingPath(
      this.targetPal.name_de || this.targetPal.name_en,
      activePassives,
      this.ownedStock,
      7,
      this.excludedPals
    );

    resultsContainer.innerHTML = "";

    // Render Excluded Pals Bar if any are blacklisted
    if (this.excludedPals.size > 0) {
      const exclBar = document.createElement("div");
      exclBar.style.display = "flex";
      exclBar.style.alignItems = "center";
      exclBar.style.gap = "8px";
      exclBar.style.flexWrap = "wrap";
      exclBar.style.background = "rgba(235, 77, 75, 0.12)";
      exclBar.style.border = "1px solid rgba(235, 77, 75, 0.3)";
      exclBar.style.borderRadius = "8px";
      exclBar.style.padding = "8px 14px";
      exclBar.style.marginBottom = "14px";

      const label = document.createElement("span");
      label.style.fontSize = "0.85rem";
      label.style.fontWeight = "bold";
      label.style.color = "#eb4d4b";
      label.textContent = "Ausgeschlossene Wild-Pals:";
      exclBar.appendChild(label);

      this.excludedPals.forEach(palId => {
        const pal = this.engine.by_id[palId];
        if (!pal) return;

        const pill = document.createElement("div");
        pill.style.background = "rgba(235, 77, 75, 0.25)";
        pill.style.border = "1px solid #eb4d4b";
        pill.style.color = "#ffffff";
        pill.style.padding = "3px 10px";
        pill.style.borderRadius = "12px";
        pill.style.fontSize = "0.8rem";
        pill.style.fontWeight = "bold";
        pill.style.display = "inline-flex";
        pill.style.alignItems = "center";
        pill.style.gap = "6px";
        pill.style.cursor = "pointer";

        pill.innerHTML = `<span>${pal.name_de || pal.name_en}</span> &times;`;
        pill.onclick = () => {
          this.excludedPals.delete(palId);
          this.runPassiveBreedingCalculation();
        };

        exclBar.appendChild(pill);
      });

      const resetBtn = document.createElement("button");
      resetBtn.className = "btn-secondary";
      resetBtn.style.padding = "2px 8px";
      resetBtn.style.fontSize = "0.75rem";
      resetBtn.textContent = "Alle Ausschlüsse aufheben";
      resetBtn.onclick = () => {
        this.excludedPals.clear();
        this.runPassiveBreedingCalculation();
      };
      exclBar.appendChild(resetBtn);

      resultsContainer.appendChild(exclBar);
    }

    if (!res.success) {
      resultsContainer.innerHTML += `
        <div style="background: rgba(235, 77, 75, 0.15); border: 1px solid #eb4d4b; border-radius: 8px; padding: 15px; color: #ffffff;">
          <strong>Zuchtpfad konnte nicht berechnet werden:</strong><br>${res.error_message}
        </div>
      `;
      return;
    }

    if (res.message) {
      resultsContainer.innerHTML += `
        <div style="background: rgba(46, 204, 113, 0.15); border: 1px solid #2ecc71; border-radius: 8px; padding: 15px; color: #ffffff;">
          ${res.message}
        </div>
      `;
      return;
    }

    // Recommendation Banner if fallback was used
    if (res.recommendation_notice) {
      const notice = document.createElement("div");
      notice.style.background = "rgba(140, 82, 255, 0.18)";
      notice.style.border = "1px solid #8c52ff";
      notice.style.borderRadius = "8px";
      notice.style.padding = "12px 16px";
      notice.style.marginBottom = "14px";
      notice.style.color = "#ffffff";
      notice.style.fontSize = "0.92rem";
      notice.style.fontWeight = "600";
      notice.innerHTML = `💡 <strong>Empfehlung für vollständige Zuchtkette:</strong> ${res.recommendation_notice}`;
      resultsContainer.appendChild(notice);
    }

    res.steps.forEach((step, idx) => {
      const card = document.createElement("div");
      card.className = "step-card";
      card.style.background = "rgba(20, 22, 31, 0.8)";
      card.style.border = "1px solid rgba(255, 255, 255, 0.1)";
      card.style.borderRadius = "10px";
      card.style.padding = "14px 18px";
      card.style.display = "flex";
      card.style.flexDirection = "column";
      card.style.gap = "10px";
      card.style.marginBottom = "12px";

      // Step Header (Step Number & RNG Warning Badge)
      const headerRow = document.createElement("div");
      headerRow.style.display = "flex";
      headerRow.style.justifyContent = "space-between";
      headerRow.style.alignItems = "center";
      headerRow.style.width = "100%";

      const stepLabel = document.createElement("div");
      stepLabel.className = "step-label";
      stepLabel.style.fontWeight = "bold";
      stepLabel.style.color = "#8c52ff";
      stepLabel.style.fontSize = "1rem";
      stepLabel.textContent = `Schritt ${idx + 1}`;

      // RNG Warning Badge
      const inheritedCount = (step.child_passives || []).length;
      const rngBadge = document.createElement("div");
      rngBadge.style.borderRadius = "12px";
      rngBadge.style.padding = "4px 12px";
      rngBadge.style.fontSize = "0.78rem";
      rngBadge.style.fontWeight = "bold";

      if (inheritedCount >= 4) {
        rngBadge.style.background = "rgba(241, 196, 15, 0.2)";
        rngBadge.style.border = "1px solid #f1c40f";
        rngBadge.style.color = "#f1c40f";
        rngBadge.textContent = `⚠️ Hohes RNG: ${inheritedCount} Passives müssen vererbt werden (~10% Chance)`;
      } else if (inheritedCount === 3) {
        rngBadge.style.background = "rgba(0, 242, 254, 0.15)";
        rngBadge.style.border = "1px solid #00f2fe";
        rngBadge.style.color = "#00f2fe";
        rngBadge.textContent = `⚡ Mittleres RNG: ${inheritedCount} Passives zu vererben (~25% Chance)`;
      } else {
        rngBadge.style.background = "rgba(46, 204, 113, 0.15)";
        rngBadge.style.border = "1px solid #2ecc71";
        rngBadge.style.color = "#2ecc71";
        rngBadge.textContent = `✅ Geringes RNG: ${inheritedCount} Passives zu vererben (~50-80% Chance)`;
      }

      headerRow.appendChild(stepLabel);
      headerRow.appendChild(rngBadge);
      card.appendChild(headerRow);

      // Main Step Flow Row (Parent 1 + Parent 2 -> Child)
      const flowRow = document.createElement("div");
      flowRow.style.display = "flex";
      flowRow.style.alignItems = "center";
      flowRow.style.gap = "12px";
      flowRow.style.flexWrap = "wrap";
      flowRow.style.width = "100%";

      // Parent 1 Pill with Contributed Passives
      const p1Pill = this._createStepPalPill(step.p1_pal, step.p1_gender, step.p1_is_owned, step.p1_is_wild, step.p1_passives);

      const plus = document.createElement("span");
      plus.style.color = "#8c52ff";
      plus.style.fontWeight = "bold";
      plus.style.fontSize = "1.3rem";
      plus.textContent = "+";

      // Parent 2 Pill with Contributed Passives
      const p2Pill = this._createStepPalPill(step.p2_pal, step.p2_gender, step.p2_is_owned, step.p2_is_wild, step.p2_passives);

      const arrow = document.createElement("span");
      arrow.style.color = "#00f2fe";
      arrow.style.fontWeight = "bold";
      arrow.style.fontSize = "1.3rem";
      arrow.textContent = "➔";

      // Child Pill
      const childPill = document.createElement("div");
      childPill.style.display = "flex";
      childPill.style.alignItems = "center";
      childPill.style.gap = "10px";
      childPill.style.background = "rgba(0, 242, 254, 0.12)";
      childPill.style.border = "1px solid #00f2fe";
      childPill.style.borderRadius = "8px";
      childPill.style.padding = "8px 14px";
      childPill.style.flex = "1";
      childPill.style.minWidth = "220px";

      const passivesListText = (step.child_passives || []).join(", ") || "Keine";

      childPill.innerHTML = `
        <img src="${this.ui.getPalIconPath(step.child_pal.id)}" class="step-icon" style="width:40px; height:40px; border-radius:50%;">
        <div>
          <div style="font-weight:700; font-size:0.95rem; color:#00f2fe;">${step.child_pal.name_de || step.child_pal.name_en}</div>
          <div style="font-size:0.78rem; color:#ffe000; font-weight:bold;">🎯 Ergebnis-Traits: ${passivesListText}</div>
        </div>
      `;

      flowRow.appendChild(p1Pill);
      flowRow.appendChild(plus);
      flowRow.appendChild(p2Pill);
      flowRow.appendChild(arrow);
      flowRow.appendChild(childPill);
      card.appendChild(flowRow);

      // Smart Sorted Alternative Parent Pairs Selector
      const altCombos = this.engine.getCombinations(step.child_pal.id);
      if (altCombos.length > 1) {
        const altWrapper = document.createElement("div");
        altWrapper.style.width = "100%";
        altWrapper.style.marginTop = "4px";
        altWrapper.style.display = "flex";
        altWrapper.style.alignItems = "center";
        altWrapper.style.gap = "8px";

        const altLabel = document.createElement("span");
        altLabel.style.fontSize = "0.8rem";
        altLabel.style.color = "#8c52ff";
        altLabel.style.fontWeight = "bold";
        altLabel.textContent = `🔄 Anderes Elternpaar für ${step.child_pal.name_de || step.child_pal.name_en} wählen (${altCombos.length} Optionen):`;

        const altSelect = document.createElement("select");
        altSelect.style.background = "rgba(140, 82, 255, 0.15)";
        altSelect.style.border = "1px solid #8c52ff";
        altSelect.style.color = "#ffffff";
        altSelect.style.borderRadius = "6px";
        altSelect.style.padding = "4px 8px";
        altSelect.style.fontSize = "0.82rem";
        altSelect.style.cursor = "pointer";
        altSelect.style.flex = "1";

        // Categorize & Smart Sort Alternatives
        const ownedIds = new Set(this.ownedStock.map(i => i.pal_id));

        const groupBothOwned = [];
        const groupOneOwned = [];
        const groupWilds = [];

        altCombos.forEach(([ap1, ap2], cIdx) => {
          const has1 = ownedIds.has(ap1.id);
          const has2 = ownedIds.has(ap2.id);
          const item = { ap1, ap2, cIdx };

          if (has1 && has2) groupBothOwned.push(item);
          else if (has1 || has2) groupOneOwned.push(item);
          else groupWilds.push(item);
        });

        // Add Options to Select with Category Group Headers
        const addOptionGroup = (label, items, iconPrefix) => {
          if (items.length === 0) return;
          const optGroup = document.createElement("optgroup");
          optGroup.label = label;

          items.forEach(({ ap1, ap2, cIdx }) => {
            const opt = document.createElement("option");
            opt.value = cIdx;
            const name1 = ap1.name_de || ap1.name_en;
            const name2 = ap2.name_de || ap2.name_en;
            opt.textContent = `${iconPrefix} ${name1} + ${name2}`;
            if ((ap1.id === step.p1_pal.id && ap2.id === step.p2_pal.id) || (ap1.id === step.p2_pal.id && ap2.id === step.p1_pal.id)) {
              opt.selected = true;
            }
            optGroup.appendChild(opt);
          });
          altSelect.appendChild(optGroup);
        };

        addOptionGroup("🌟 Beide aus deinem Bestand", groupBothOwned, "🌟");
        addOptionGroup("🐾 Bestand + Wild-Pal", groupOneOwned, "🐾");
        addOptionGroup("🌐 Theoretische Wild-Paare", groupWilds, "🌐");

        altSelect.onchange = (e) => {
          const selectedIdx = parseInt(e.target.value, 10);
          const [newP1, newP2] = altCombos[selectedIdx];
          step.p1_pal = newP1;
          step.p2_pal = newP2;
          this.runPassiveBreedingCalculation();
        };

        altWrapper.appendChild(altLabel);
        altWrapper.appendChild(altSelect);
        card.appendChild(altWrapper);
      }

      resultsContainer.appendChild(card);
    });
  }

  _createStepPalPill(pal, gender, isOwned, isWild, passivesContributed = []) {
    const pill = document.createElement("div");
    pill.style.display = "flex";
    pill.style.alignItems = "center";
    pill.style.gap = "8px";
    pill.style.background = isOwned ? "rgba(46, 204, 113, 0.15)" : isWild ? "rgba(241, 196, 15, 0.18)" : "rgba(255, 255, 255, 0.05)";
    pill.style.border = isOwned ? "1px solid #2ecc71" : isWild ? "1px solid #f1c40f" : "1px solid rgba(255, 255, 255, 0.1)";
    pill.style.borderRadius = "8px";
    pill.style.padding = "6px 12px";
    pill.style.flex = "1";
    pill.style.minWidth = "200px";

    const genderSymbol = gender === 'Male' ? '♂' : gender === 'Female' ? '♀' : '♂/♀';
    const subtitleText = isOwned ? '✔ Im Bestand' : isWild ? '⭐ Wild-Pal (benötigt)' : 'Zwischen-Ergebnis';
    const subtitleColor = isOwned ? '#2ecc71' : isWild ? '#f1c40f' : '#a4b0be';

    const passivesText = passivesContributed.length > 0 ? passivesContributed.join(", ") : "Keine Passiven";

    pill.innerHTML = `
      <img src="${this.ui.getPalIconPath(pal.id)}" class="step-icon" style="width:38px; height:38px; border-radius:50%;">
      <div>
        <div style="font-weight:700; font-size:0.9rem;">${pal.name_de || pal.name_en} (${genderSymbol})</div>
        <div style="font-size:0.75rem; color:${subtitleColor};">${subtitleText}</div>
        <div style="font-size:0.72rem; color:#8c52ff; font-weight:bold;">Bringt mit: ${passivesText}</div>
      </div>
    `;

    if (isWild) {
      const excludeBtn = document.createElement("button");
      excludeBtn.style.background = "rgba(235, 77, 75, 0.2)";
      excludeBtn.style.border = "1px solid #eb4d4b";
      excludeBtn.style.color = "#eb4d4b";
      excludeBtn.style.borderRadius = "4px";
      excludeBtn.style.fontSize = "0.7rem";
      excludeBtn.style.fontWeight = "bold";
      excludeBtn.style.padding = "2px 6px";
      excludeBtn.style.cursor = "pointer";
      excludeBtn.style.marginLeft = "4px";
      excludeBtn.textContent = "🚫 Hab ich nicht";
      excludeBtn.title = `Klicken, um ${pal.name_de || pal.name_en} einzuschränken.`;

      excludeBtn.onclick = (e) => {
        e.stopPropagation();
        this.excludedPals.add(pal.id);
        this.runPassiveBreedingCalculation();
      };

      pill.appendChild(excludeBtn);
    }

    return pill;
  }

  /* ========================================================================= */
  /* PASSIVES OVERVIEW TAB (3-COLUMN GRID WITH ALL PASSIVES)                   */
  /* ========================================================================= */
  setupPassivesOverviewTab() {
    const search = document.getElementById("passives-overview-search");
    if (search) search.addEventListener("input", () => this.renderPassivesOverview());

    const filterBtns = document.querySelectorAll("#passives-overview-filters .opgg-filter-btn");
    filterBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        filterBtns.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        this.renderPassivesOverview();
      });
    });
  }

  renderPassivesOverview() {
    const container = document.getElementById("passives-overview-grid");
    const searchVal = (document.getElementById("passives-overview-search")?.value || "").toLowerCase().trim();
    const activeBtn = document.querySelector("#passives-overview-filters .opgg-filter-btn.active");
    const tierNum = parseInt(activeBtn?.dataset?.tier || "0", 10);

    if (!container) return;
    container.innerHTML = "";

    const filtered = this.engine.passives.filter(p => {
      if (tierNum !== 0 && p.stars !== tierNum) return false;

      const name = (p.name || "").toLowerCase();
      const desc = (p.description || "").toLowerCase();

      return !searchVal || name.includes(searchVal) || desc.includes(searchVal);
    });

    const badge = document.getElementById("passives-overview-count");
    if (badge) badge.textContent = `${filtered.length} Passives`;

    filtered.forEach(passive => {
      const card = document.createElement("div");
      card.className = "passive-grid-card";

      // Palworld In-Game Badge
      const badgeEl = document.createElement("div");
      badgeEl.className = `palworld-passive-badge tier-${passive.stars || 1}`;
      
      const nameSpan = document.createElement("span");
      nameSpan.textContent = passive.name;

      const chevrons = document.createElement("span");
      chevrons.className = "badge-chevrons";
      chevrons.innerHTML = getChevronSVG(passive.stars || 1);

      badgeEl.appendChild(nameSpan);
      badgeEl.appendChild(chevrons);

      // Description below badge
      const desc = document.createElement("div");
      desc.className = "passive-grid-desc";
      desc.textContent = passive.description;

      card.appendChild(badgeEl);
      card.appendChild(desc);

      container.appendChild(card);
    });
  }
}

// Start application when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  window.app = new PalworldWebApp();
});
