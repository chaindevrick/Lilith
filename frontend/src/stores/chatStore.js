import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useChatStore = defineStore('chat', () => {
    const totalTokens = ref(0);
    
    const endocrineState = ref({
        DOPAMINE: 40, ENDORPHIN: 0, CORTISOL: 10,
        OXYTOCIN: 0, ADRENALINE: 0, NOREPINEPHRINE: 30
    });

    const updateEndocrine = (levels) => {
        if (levels) {
            endocrineState.value = { ...endocrineState.value, ...levels };
        }
    };

    return { totalTokens, endocrineState, updateEndocrine };
});