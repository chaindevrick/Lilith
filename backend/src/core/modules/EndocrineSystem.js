/**
 * src/core/modules/EndocrineSystem.js
 * 純數學與化學代謝引擎 (半衰期與拮抗矩陣)
 */
export class EndocrineSystem {
    constructor() {
        this.DECAY_RATES = {
            DOPAMINE: 0.15, ENDORPHIN: 0.01, CORTISOL: 0.05, 
            OXYTOCIN: 0.005, ADRENALINE: 0.8, NOREPINEPHRINE: 0.08
        };

        this.INTERACTION_MATRIX = {
            DOPAMINE: { CORTISOL: 0.6, OXYTOCIN: -0.2 },
            CORTISOL: { OXYTOCIN: 0.8 },
            NOREPINEPHRINE: { CORTISOL: 0.3, DOPAMINE: -0.4 }
        };
    }

    processMetabolism(currentLevels, stimuli, deltaT) {
        let baseConcentrations = {};

        for (const [chem, lambda] of Object.entries(this.DECAY_RATES)) {
            let level = currentLevels[chem] || 0;
            let input = stimuli[chem] || 0;
            baseConcentrations[chem] = Math.max(0, Math.min(100, (level * Math.exp(-lambda * deltaT)) + input));
        }

        let finalConcentrations = {};
        for (const [targetChem, baseValue] of Object.entries(baseConcentrations)) {
            let multiplier = 1.0;
            if (this.INTERACTION_MATRIX[targetChem]) {
                for (const [sourceChem, weight] of Object.entries(this.INTERACTION_MATRIX[targetChem])) {
                    let sourceRatio = baseConcentrations[sourceChem] / 100;
                    multiplier *= Math.max(0, 1 - (weight * sourceRatio));
                }
            }
            finalConcentrations[targetChem] = Math.max(0, Math.min(100, baseValue * multiplier));
        }
        return finalConcentrations;
    }
}