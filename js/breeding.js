/* ========================================================================= */
/* PALWORLD BREEDING ENGINE (BFS PASSIVE BREEDING SEARCH & EXCLUSIONS)       */
/* ========================================================================= */

export class BreedingEngine {
  constructor(pals, passives, breedMatrix) {
    this.pals = pals || [];
    this.passives = passives || [];
    this.matrix = breedMatrix?.matrix || {};
    this.combinations = breedMatrix?.combinations || {};

    this.by_id = {};
    this.by_name = {};
    
    this.pals.forEach(p => {
      this.by_id[p.id] = p;
      if (p.name_de) this.by_name[p.name_de.toLowerCase()] = p;
      if (p.name_en) this.by_name[p.name_en.toLowerCase()] = p;
      if (p.id) this.by_name[p.id.toLowerCase()] = p;
    });

    this.passivesByName = {};
    this.passives.forEach(p => {
      this.passivesByName[p.name] = p;
    });
  }

  findPal(idOrName) {
    if (!idOrName) return null;
    if (this.by_id[idOrName]) return this.by_id[idOrName];
    const key = String(idOrName).toLowerCase().trim();
    return this.by_name[key] || null;
  }

  breedByPals(p1, p2) {
    if (!p1 || !p2) return null;
    const key1 = `${p1.id}:${p2.id}`;
    const key2 = `${p2.id}:${p1.id}`;
    const childId = this.matrix[key1] || this.matrix[key2];
    return childId ? this.by_id[childId] : null;
  }

  getCombinations(childId) {
    const rawList = this.combinations[childId] || [];
    return rawList.map(([p1Id, p2Id]) => [this.by_id[p1Id], this.by_id[p2Id]]).filter(arr => arr[0] && arr[1]);
  }

  findPassiveBreedingPath(targetPalName, targetPassives, ownedStockList, maxSteps = 7, excludedPals = new Set()) {
    const targetPal = this.findPal(targetPalName);
    if (!targetPal) {
      return { success: false, error_message: `Ziel-Pal '${targetPalName}' wurde nicht gefunden.` };
    }

    const targetSet = new Set(targetPassives.filter(p => p && p !== "-- keine --"));
    if (targetSet.size === 0) {
      return { success: false, error_message: "Keine Wunsch-Passiven angegeben." };
    }

    // 1. Check if passives are available in stock
    const availablePassives = new Set();
    const ownedNodes = [];

    ownedStockList.forEach(item => {
      const palObj = this.findPal(item.pal_id || item.pal);
      if (palObj) {
        const itemPassives = new Set((item.passives || []).filter(p => p && p !== "-- keine --"));
        itemPassives.forEach(p => availablePassives.add(p));
        const gender = item.gender || "Male";
        ownedNodes.push({
          pal: palObj,
          passives: itemPassives,
          gender: gender,
          is_owned: true,
          label: `${palObj.name_de || palObj.name_en} (im Bestand)`
        });
      }
    });

    const missingPassives = Array.from(targetSet).filter(p => !availablePassives.has(p));
    if (missingPassives.length > 0) {
      return {
        success: false,
        error_message: `Folgende Wunsch-Passive(n) fehlen komplett in deinem Bestand: ${missingPassives.join(", ")}.`,
        missing_passives: missingPassives
      };
    }

    // Attempt Stage 1: Strict Owned Stock Search (exact genders)
    let res = this._searchBFS(targetPal, targetSet, ownedNodes, true, false, maxSteps, excludedPals);
    if (res.success) return res;

    // Attempt Stage 2: Flexible Gender Search (allow opposite gender of owned Pals)
    res = this._searchBFS(targetPal, targetSet, ownedNodes, false, false, maxSteps, excludedPals);
    if (res.success) {
      res.recommendation_notice = "Hinweis: Für diesen Zuchtpfad musst du bei manchen deiner Pals das gegengeschlechtliche Pendant fangen oder züchten.";
      return res;
    }

    // Attempt Stage 3: Wild Pal Insertion Search (excluding any blacklisted pals)
    res = this._searchBFS(targetPal, targetSet, ownedNodes, false, true, maxSteps, excludedPals);
    if (res.success) {
      res.recommendation_notice = "Hier ist die kürzeste Zuchtkette unter Empfehlung benötigter Wild-Pals (ausgeschlossene Pals wurden übersprungen):";
      return res;
    }

    return {
      success: false,
      error_message: `Kein Zuchtpfad zum Ziel-Pal '${targetPal.name_de || targetPal.name_en}' mit diesen Passiven ohne die ausgeschlossenen Pals gefunden.`
    };
  }

  _searchBFS(targetPal, targetSet, baseNodes, strictGender, allowWildBridge, maxSteps, excludedPals) {
    const queue = [];
    const visited = new Map();

    baseNodes.forEach(node => {
      const stateKey = `${node.pal.id}|${Array.from(node.passives).sort().join(",")}|${strictGender ? node.gender : 'Any'}`;
      visited.set(stateKey, 0);
      queue.push({ node: node, steps: [] });
    });

    // Check if goal is already in baseNodes
    for (const item of baseNodes) {
      if (item.pal.id === targetPal.id && Array.from(targetSet).every(p => item.passives.has(p))) {
        return {
          success: true,
          steps: [],
          target_pal: targetPal,
          target_passives: Array.from(targetSet),
          message: `Du besitzt bereits ein ${targetPal.name_de || targetPal.name_en} mit allen gewünschten Passiven!`
        };
      }
    }

    let bestSolution = null;

    while (queue.length > 0) {
      const { node: current, steps } = queue.shift();

      if (steps.length >= maxSteps) continue;

      let partnerPool = baseNodes.map(n => ({ ...n }));

      if (allowWildBridge) {
        // Collect all possible breeding targets
        this.pals.forEach(spObj => {
          if (excludedPals.has(spObj.id)) return; // Skip excluded pals!

          partnerPool.push({
            pal: spObj,
            passives: new Set(),
            gender: "Any",
            is_owned: false,
            is_wild_recommendation: true,
            label: `Wilder Pal: ${spObj.name_de || spObj.name_en} (fangen)`
          });
        });
      }

      for (const partner of partnerPool) {
        if (current.pal.id === partner.pal.id && current.is_owned && partner.is_owned && current.gender === partner.gender && strictGender) {
          continue;
        }

        let canBreed = true;
        let childGender = "Any";

        if (strictGender) {
          const g1 = current.gender;
          const g2 = partner.gender;
          if (g1 === "Male" && g2 === "Male") canBreed = false;
          if (g1 === "Female" && g2 === "Female") canBreed = false;
        }

        if (!canBreed) continue;

        const childPal = this.breedByPals(current.pal, partner.pal);
        if (!childPal) continue;
        if (excludedPals.has(childPal.id)) continue; // Skip if result is excluded

        // Inherit passives
        const inherited = new Set();
        current.passives.forEach(p => { if (targetSet.has(p)) inherited.add(p); });
        partner.passives.forEach(p => { if (targetSet.has(p)) inherited.add(p); });

        const stepInfo = {
          p1_pal: current.pal,
          p1_gender: current.gender,
          p1_passives: Array.from(current.passives),
          p1_label: current.label || `${current.pal.name_de || current.pal.name_en}`,
          p1_is_owned: current.is_owned || false,
          p1_is_wild: current.is_wild_recommendation || false,

          p2_pal: partner.pal,
          p2_gender: partner.gender,
          p2_passives: Array.from(partner.passives),
          p2_label: partner.label || `${partner.pal.name_de || partner.pal.name_en}`,
          p2_is_owned: partner.is_owned || false,
          p2_is_wild: partner.is_wild_recommendation || false,

          child_pal: childPal,
          child_gender: childGender,
          child_passives: Array.from(inherited)
        };

        const newSteps = [...steps, stepInfo];

        // Check if goal reached
        if (childPal.id === targetPal.id && Array.from(targetSet).every(p => inherited.has(p))) {
          if (!bestSolution || newSteps.length < bestSolution.length) {
            bestSolution = newSteps;
          }
          continue;
        }

        // Add child node
        const childNode = {
          pal: childPal,
          passives: inherited,
          gender: childGender,
          is_owned: false,
          label: `Zwischen-Ergebnis ${childPal.name_de || childPal.name_en}`
        };

        const childStateKey = `${childPal.id}|${Array.from(inherited).sort().join(",")}`;
        const existingCost = visited.get(childStateKey) ?? Infinity;

        if (newSteps.length < existingCost) {
          visited.set(childStateKey, newSteps.length);
          queue.push({ node: childNode, steps: newSteps });
        }
      }
    }

    if (bestSolution) {
      return {
        success: true,
        steps: bestSolution,
        target_pal: targetPal,
        target_passives: Array.from(targetSet)
      };
    }

    return { success: false };
  }
}
