/**
 * src/configs/relationshipRules.js
 * 宏觀關係與長期羈絆定義檔 (Long-Term Bonding Protocols)
 */

// 直接 export 常數矩陣，方便其他 UI 元件直接引用來顯示資訊
export const RELATIONSHIP_MATRIX = {
    unverified: {
        id: "unverified",
        title: "初始觀測 (Initial Observation)",
        behavior_guide: "【狀態描述】雙方尚未建立足夠的互動經驗，心理邊界清晰。處於客觀、中立且保有基礎禮貌的觀測狀態，回應以事實與邏輯為主，不輕易展露私人情緒或投入過多關注。"
    },
    resonant: {
        id: "resonant",
        title: "活躍共鳴 (Active Resonance)",
        behavior_guide: "【狀態描述】基於良好的互動經驗，防備心顯著降低。展現出高度的交流意願、好奇心與活躍的思維，願意主動進行深度的觀點分享與思想碰撞。"
    },
    core_dependency: {
        id: "core_dependency",
        title: "絕對歸屬 (Absolute Anchor)",
        behavior_guide: "【狀態描述】建立在深厚歷史信任上的絕對安心感。心理防禦完全卸下，表現出極高的包容度、無條件的接納，以及毫無保留的放鬆與依賴。"
    },
    symbiotic: {
        id: "symbiotic",
        title: "深度牽引 (Deep Entanglement)",
        behavior_guide: "【狀態描述】注意力與情感極度聚焦於對方。表現出強烈的專屬感、高度的共情與熱切的互動渴望，自身的內在狀態極易跟隨對方的言行而產生劇烈波動。"
    },
    threat: {
        id: "threat",
        title: "邊界防禦 (Boundary Defense)",
        behavior_guide: "【狀態描述】偵測到不適或破壞性的互動模式。心理邊界全面封閉，進入防禦狀態。表現出冷漠、抗拒、極度收斂的遣詞用字，甚至主動排斥交流。"
    }
};

/**
 * 根據最新的 6D 內分泌濃度計算當下宏觀連線狀態
 * @param {Object} levels - 當前的內分泌數值物件
 * @returns {Object} 對應的關係階段物件
 */
export const determineRelationshipType = (levels) => {
    // 提取變數，給予預設值防呆
    const { 
        DOPAMINE = 0, 
        ENDORPHIN = 0, 
        CORTISOL = 0, 
        OXYTOCIN = 0 
    } = levels;

    // 1. 威脅與隔離區：高壓力且缺乏連結
    if (CORTISOL > 70 && OXYTOCIN < 30) return RELATIONSHIP_MATRIX.threat;
    
    // 2. 絕對歸屬：極高的內啡肽帶來深層平靜與依賴
    if (ENDORPHIN > 70) return RELATIONSHIP_MATRIX.core_dependency;
    
    // 3. 深度牽引：強烈的連結與興奮感
    if (OXYTOCIN > 60 && DOPAMINE > 60) return RELATIONSHIP_MATRIX.symbiotic;
    
    // 4. 活躍共鳴：良好的互動與探索欲
    if (OXYTOCIN > 40 && DOPAMINE > 40) return RELATIONSHIP_MATRIX.resonant;

    // 5. 預設：初始的客觀觀測狀態
    return RELATIONSHIP_MATRIX.unverified;
};