/* ========================================================================= */
/* PALWORLD BREEDING ENGINE (GENDER VALIDATION & PRAGMATIC SHORTEST PATH)    */
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
    const key1 = `${p1.id}_${p2.id}`;
    const key2 = `${p2.id}_${p1.id}`;
    const childId = this.matrix[key1] || this.matrix[key2];
    return childId ? this.by_id[childId] : null;
  }

  getCombinations(childId) {
    const rawList = this.combinations[childId] || [];
    return rawList.map(item => {
      const p1 = this.by_id[item.p1];
      const p2 = this.by_id[item.p2];
      return (p1 && p2) ? [p1, p2] : null;
    }).filter(Boolean);
  }

  findPassiveBreedingPath(targetPalName, targetPassives, ownedStockList = [], maxSteps = 3) {
    const targetPal = this.findPal(targetPalName);
    if (!targetPal) {
      return { success: false, error_message: `Ziel-Pal '${targetPalName}' wurde nicht gefunden.` };
    }

    const targetSet = new Set(targetPassives.filter(p => p && p !== "-- keine --"));
    if (targetSet.size === 0) {
      return { success: false, error_message: "Keine Wunsch-Passiven angegeben." };
    }

    const targetPassivesList = Array.from(targetSet);

    // Build base nodes from owned stock
    const ownedNodes = [];
    const coveredPassives = new Set();

    ownedStockList.forEach(item => {
      const palObj = this.findPal(item.pal_id || item.pal);
      if (palObj) {
        const itemPassives = new Set((item.passives || []).filter(p => p && p !== "-- keine --"));
        itemPassives.forEach(p => { if (targetSet.has(p)) coveredPassives.add(p); });
        ownedNodes.push({
          pal: palObj,
          passives: itemPassives,
          gender: item.gender || "Any",
          is_owned: true,
          label: `${palObj.name_de || palObj.name_en} (im Bestand)`
        });
      }
    });

    // Virtual Wild Carriers for any missing passives
    const missingPassives = targetPassivesList.filter(p => !coveredPassives.has(p));
    const starterWildPals = ["ChickenPal", "PinkCat", "SheepBall", "Carbunclo", "CuteFox"];

    missingPassives.forEach((passive, idx) => {
      const palId = starterWildPals[idx % starterWildPals.length];
      const carrierPal = this.by_id[palId] || this.pals[0];
      const pSet = new Set([passive]);
      ownedNodes.push({
        pal: carrierPal,
        passives: pSet,
        gender: "Any",
        is_owned: false,
        is_wild_carrier: true,
        label: `Wildfang ${carrierPal.name_de || carrierPal.name_en} (mit ${passive})`
      });
    });

    // Run BFS Search with Gender Strictness & Shortest Practical Path logic
    const res = this._searchBFS(targetPal, targetSet, ownedNodes, maxSteps);
    if (res.success) {
      if (missingPassives.length > 0 && ownedStockList.length === 0) {
        res.recommendation_notice = "Optimale 1–2 Schritte Zuchtkette (Fehlende Passiv-Träger über Wildfang):";
      } else if (missingPassives.length > 0) {
        res.recommendation_notice = "Zuchtkette kombiniert deinen Bestand mit benötigten Wild-Pals:";
      } else {
        res.recommendation_notice = "Kürzester Zuchtweg aus deinem Bestand (Geschlechter berücksichtigt):";
      }
      return res;
    }

    return {
      success: false,
      error_message: `Kein praxistauglicher Zuchtpfad zum Ziel-Pal '${targetPal.name_de || targetPal.name_en}' mit diesen Passiven gefunden.`
    };
  }

  _searchBFS(targetPal, targetSet, baseNodes, maxSteps = 3) {
    const queue = [];
    const visited = new Map();

    baseNodes.forEach(node => {
      const stateKey = `${node.pal.id}|${Array.from(node.passives).sort().join(",")}`;
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

      // Build partner pool
      const partnerPool = baseNodes.map(n => ({ ...n }));

      // Add all wild pals as potential breeding partners
      this.pals.forEach(spObj => {
        partnerPool.push({
          pal: spObj,
          passives: new Set(),
          gender: "Any",
          is_owned: false,
          is_wild_recommendation: true,
          label: `Wilder Pal: ${spObj.name_de || spObj.name_en}`
        });
      });

      for (const partner of partnerPool) {
        // 🚨 CRITICAL BUGFIX: Strict Gender Check
        if (current.is_owned && partner.is_owned) {
          const g1 = current.gender;
          const g2 = partner.gender;
          if (g1 === "Male" && g2 === "Male") continue; // ❌ Invalid! Two males!
          if (g1 === "Female" && g2 === "Female") continue; // ❌ Invalid! Two females!
          if (current.pal.id === partner.pal.id && g1 === g2) continue; // Same Pal same gender
        }

        const childPal = this.breedByPals(current.pal, partner.pal);
        if (!childPal) continue;

        // Inherit passives relevant to targetSet
        const p1Passives = Array.from(current.passives).filter(p => targetSet.has(p));
        const p2Passives = Array.from(partner.passives).filter(p => targetSet.has(p));
        
        const inherited = new Set([...p1Passives, ...p2Passives]);

        const stepInfo = {
          p1_pal: current.pal,
          p1_gender: current.gender || "Any",
          p1_passives: p1Passives,
          p1_label: current.label || `${current.pal.name_de || current.pal.name_en}`,
          p1_is_owned: current.is_owned || false,
          p1_is_wild: current.is_wild_carrier || current.is_wild_recommendation || false,

          p2_pal: partner.pal,
          p2_gender: partner.gender || "Any",
          p2_passives: p2Passives,
          p2_label: partner.label || `${partner.pal.name_de || partner.pal.name_en}`,
          p2_is_owned: partner.is_owned || false,
          p2_is_wild: partner.is_wild_carrier || partner.is_wild_recommendation || false,

          child_pal: childPal,
          child_passives: Array.from(inherited),
          inherited_count: inherited.size,
          target_total: targetSet.size
        };

        const newSteps = [...steps, stepInfo];

        // Check if goal reached
        if (childPal.id === targetPal.id && Array.from(targetSet).every(p => inherited.has(p))) {
          if (!bestSolution || newSteps.length < bestSolution.length) {
            bestSolution = newSteps;
          }
          continue;
        }

        // Add child node to queue if steps < maxSteps
        if (newSteps.length < maxSteps) {
          const childNode = {
            pal: childPal,
            passives: inherited,
            gender: "Any",
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
