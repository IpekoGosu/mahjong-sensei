import test from 'node:test'
import assert from 'node:assert'
import {
    AiRankEvaluator,
    SummaryGameEvaluationInput
} from './ai-rank-evaluator'
import { AiGrade } from '@mahjong-sensei/types'
import { SAMPLE_MAJSOUL_GAME } from '../sample-data/sample-paipu'

class MockAiRankEvaluator extends AiRankEvaluator {
    public testCalculateKanMultiplier(kanCount: number, visibleDoraCount: number): number {
        return this.calculateKanMultiplier(kanCount, visibleDoraCount)
    }

    public testCalculateTileDanger(
        tile: string,
        opponentKawa: readonly string[],
        visibleTileCounts: ReadonlyMap<string, number>,
        isDora: boolean = false,
        threateningSeatIsDealer: boolean = false,
        roundWind: string = '1z',
        seatWind: string = '2z'
    ): number {
        return this.calculateTileDanger(
            tile,
            opponentKawa,
            visibleTileCounts,
            isDora,
            threateningSeatIsDealer,
            roundWind,
            seatWind
        )
    }

    public testCalculatePlacementModifiers(
        scores: readonly number[],
        targetSeat: number,
        roundIndex: number,
        matchLength: 'east' | 'south'
    ): { readonly placementPushModifier: number, readonly placementFoldModifier: number } {
        return this.calculatePlacementModifiers(scores, targetSeat, roundIndex, matchLength)
    }

    public testCalculateDealerBonus(isDealer: boolean): { readonly attackMultiplier: number, readonly renchanBonusEv: number } {
        return this.calculateDealerBonus(isDealer)
    }

    public testComputeGradeFromScore(score: number): AiGrade {
        return this.computeGradeFromScore(score)
    }
}

test('MockAiRankEvaluator - Dealer weighting', () => {
    const mock = new MockAiRankEvaluator()

    // Dealer has 1.5x attack multiplier + 1200 EV renchan bonus
    const dealerBonus = mock.testCalculateDealerBonus(true)
    assert.strictEqual(dealerBonus.attackMultiplier, 1.5)
    assert.strictEqual(dealerBonus.renchanBonusEv, 1200)

    // Non-dealer has 1.0x attack multiplier and 0 renchan bonus
    const nonDealerBonus = mock.testCalculateDealerBonus(false)
    assert.strictEqual(nonDealerBonus.attackMultiplier, 1.0)
    assert.strictEqual(nonDealerBonus.renchanBonusEv, 0)

    // Opponent dealer has 1.4x defense danger weight
    const dangerAgainstNonDealer = mock.testCalculateTileDanger('5p', [], new Map(), false, false)
    const dangerAgainstDealer = mock.testCalculateTileDanger('5p', [], new Map(), false, true)
    assert.strictEqual(dangerAgainstNonDealer, 1.00)
    assert.strictEqual(dangerAgainstDealer, 1.40)
})

test('MockAiRankEvaluator - East vs South Orasu placement pressure', () => {
    const mock = new MockAiRankEvaluator()

    const scoresWithBigLead = [38000, 24000, 20000, 18000]

    // In East-wind match at round 3 (Orasu: remainingRounds = 1):
    // Protecting a 14000 pt lead: pushModifier = 0.75, foldModifier = 1.85
    const eastOrasuMods = mock.testCalculatePlacementModifiers(scoresWithBigLead, 0, 3, 'east')
    assert.strictEqual(eastOrasuMods.placementPushModifier, 0.75)
    assert.strictEqual(eastOrasuMods.placementFoldModifier, 1.85)

    // In South-wind match at round 3 (East 4, not Orasu: remainingRounds = 5):
    // Neutral placement modifiers (1.0, 1.0)
    const southMidGameMods = mock.testCalculatePlacementModifiers(scoresWithBigLead, 0, 3, 'south')
    assert.strictEqual(southMidGameMods.placementPushModifier, 1.0)
    assert.strictEqual(southMidGameMods.placementFoldModifier, 1.0)

    // In South-wind match at round 7 (South 4, All-Last Orasu: remainingRounds = 1):
    // Heavy fold defense (0.75, 1.85)
    const southOrasuMods = mock.testCalculatePlacementModifiers(scoresWithBigLead, 0, 7, 'south')
    assert.strictEqual(southOrasuMods.placementPushModifier, 0.75)
    assert.strictEqual(southOrasuMods.placementFoldModifier, 1.85)

    // Trailing last-place player in East Orasu: chasing to avoid last place
    const chaseLastMods = mock.testCalculatePlacementModifiers(scoresWithBigLead, 3, 3, 'east')
    assert.strictEqual(chaseLastMods.placementPushModifier, 1.35)
    assert.strictEqual(chaseLastMods.placementFoldModifier, 0.80)
})

test('MockAiRankEvaluator - Kan danger multiplier', () => {
    const mock = new MockAiRankEvaluator()

    // Baseline: 0 kans, 0 visible doras -> 1.0
    assert.strictEqual(mock.testCalculateKanMultiplier(0, 0), 1.0)

    // 1 kan, 2 doras: 1 + 0.25*1 + 0.12*2 = 1.49
    assert.strictEqual(mock.testCalculateKanMultiplier(1, 2), 1.49)

    // 2 kans, 4 doras: 1 + 0.25*2 + 0.12*4 = 1.98
    assert.strictEqual(mock.testCalculateKanMultiplier(2, 4), 1.98)
})

test('MockAiRankEvaluator - Fine-grained tile danger hierarchy', () => {
    const mock = new MockAiRankEvaluator()
    const emptyMap = new Map<string, number>()

    // 1. Genbutsu (0.00)
    const genbutsuDanger = mock.testCalculateTileDanger('5p', ['5p'], emptyMap)
    assert.strictEqual(genbutsuDanger, 0.00)

    // 2. 4-visible / No-Chance Kabe (0.05)
    const fourVisMap = new Map<string, number>()
    fourVisMap.set('5p', 4)
    const fourVisDanger = mock.testCalculateTileDanger('5p', [], fourVisMap)
    assert.strictEqual(fourVisDanger, 0.05)

    // 3. 2-cut honor (0.10)
    const honor2CutMap = new Map<string, number>()
    honor2CutMap.set('1z', 2)
    const honor2CutDanger = mock.testCalculateTileDanger('1z', [], honor2CutMap)
    assert.strictEqual(honor2CutDanger, 0.10)

    // 4. Nakasuji / 1-cut honor (0.16)
    const nakasujiDanger = mock.testCalculateTileDanger('4p', ['1p', '7p'], emptyMap)
    assert.strictEqual(nakasujiDanger, 0.16)

    const honor1CutMap = new Map<string, number>()
    honor1CutMap.set('1z', 1)
    const honor1CutDanger = mock.testCalculateTileDanger('1z', [], honor1CutMap)
    assert.strictEqual(honor1CutDanger, 0.16)

    // 5. Suji terminal (0.24)
    const sujiTerminalDanger = mock.testCalculateTileDanger('1p', ['4p'], emptyMap)
    assert.strictEqual(sujiTerminalDanger, 0.24)

    // 6. Suji middle / live guest wind (0.34)
    const sujiMiddleDanger = mock.testCalculateTileDanger('4p', ['1p'], emptyMap)
    assert.strictEqual(sujiMiddleDanger, 0.34)

    const liveGuestWindDanger = mock.testCalculateTileDanger('4z', [], emptyMap, false, false, '1z', '2z')
    assert.strictEqual(liveGuestWindDanger, 0.34)

    // 7. Live yakuhai (0.48)
    const liveYakuhaiDanger = mock.testCalculateTileDanger('5z', [], emptyMap)
    assert.strictEqual(liveYakuhaiDanger, 0.48)

    // 8. Musuji 1/9 (0.55)
    const musuji19Danger = mock.testCalculateTileDanger('1p', [], emptyMap)
    assert.strictEqual(musuji19Danger, 0.55)

    // 9. Musuji 2/8 (0.72)
    const musuji28Danger = mock.testCalculateTileDanger('2p', [], emptyMap)
    assert.strictEqual(musuji28Danger, 0.72)

    // 10. Musuji 3/7 (0.88)
    const musuji37Danger = mock.testCalculateTileDanger('3p', [], emptyMap)
    assert.strictEqual(musuji37Danger, 0.88)

    // 11. Musuji 4/5/6 (1.00)
    const musuji456Danger = mock.testCalculateTileDanger('5p', [], emptyMap)
    assert.strictEqual(musuji456Danger, 1.00)

    // 12. Dora multiplier (1.25x)
    const doraMusujiDanger = mock.testCalculateTileDanger('5p', [], emptyMap, true)
    assert.strictEqual(doraMusujiDanger, 1.25)

    // 13. Red five ('0p')
    const redFiveDanger = mock.testCalculateTileDanger('0p', [], emptyMap, false)
    assert.strictEqual(redFiveDanger, 1.25)
})

test('AiRankEvaluator - Paipu game evaluation', () => {
    const evaluator = new AiRankEvaluator()
    const breakdown = evaluator.evaluatePaipuGame(SAMPLE_MAJSOUL_GAME, 0)

    assert.ok(breakdown.aiScore >= 0 && breakdown.aiScore <= 100)
    assert.ok(breakdown.matchRate >= 0 && breakdown.matchRate <= 100)
    assert.ok(['S+', 'S', 'A', 'B', 'C', 'D'].includes(breakdown.grade))
    assert.ok(['S+', 'S', 'A', 'B', 'C', 'D'].includes(breakdown.attackGrade))
    assert.ok(['S+', 'S', 'A', 'B', 'C', 'D'].includes(breakdown.defenseGrade))
    assert.ok(['S+', 'S', 'A', 'B', 'C', 'D'].includes(breakdown.situationGrade))
    assert.ok(breakdown.summaryComment.length > 0)
})

test('AiRankEvaluator - Summary game evaluation across S+ to D grades', () => {
    const evaluator = new AiRankEvaluator()

    // S+ Grade: aiScore >= 95
    const inputSPlus: SummaryGameEvaluationInput = {
        rank: 1,
        finalScore: 48000,
        roomType: '옥탁 반장전',
        gameMode: '4p',
        luckScore: 65,
        skillScore: 98,
        averageStartingShanten: 2.8,
        winCount: 4,
        dealInCount: 0,
        totalRounds: 8,
        dealerRounds: 3,
        tileEfficiency: 0.98
    }
    const resultSPlus = evaluator.evaluateSummaryGame(inputSPlus)
    assert.strictEqual(resultSPlus.grade, 'S+')
    assert.ok(resultSPlus.aiScore >= 95)

    // S Grade: aiScore >= 90 && aiScore < 95
    const inputS: SummaryGameEvaluationInput = {
        rank: 1,
        finalScore: 36000,
        roomType: '옥탁 동풍전',
        gameMode: '4p',
        luckScore: 55,
        skillScore: 88,
        averageStartingShanten: 3.2,
        winCount: 2,
        dealInCount: 0,
        totalRounds: 6,
        dealerRounds: 2,
        tileEfficiency: 0.90
    }
    const resultS = evaluator.evaluateSummaryGame(inputS)
    assert.ok(['S', 'S+'].includes(resultS.grade))
    assert.ok(resultS.aiScore >= 90)

    // A Grade: aiScore >= 80 && aiScore < 90
    const inputA: SummaryGameEvaluationInput = {
        rank: 2,
        finalScore: 28000,
        roomType: '금탁 반장전',
        gameMode: '4p',
        luckScore: 50,
        skillScore: 78,
        averageStartingShanten: 3.4,
        winCount: 1,
        dealInCount: 1,
        totalRounds: 8,
        dealerRounds: 2,
        tileEfficiency: 0.82
    }
    const resultA = evaluator.evaluateSummaryGame(inputA)
    assert.strictEqual(resultA.grade, 'A')
    assert.ok(resultA.aiScore >= 80 && resultA.aiScore < 90)

    // B Grade: aiScore >= 70 && aiScore < 80
    const inputB: SummaryGameEvaluationInput = {
        rank: 3,
        finalScore: 21000,
        roomType: '은탁 반장전',
        gameMode: '4p',
        luckScore: 48,
        skillScore: 65,
        averageStartingShanten: 3.6,
        winCount: 1,
        dealInCount: 1,
        totalRounds: 8,
        dealerRounds: 2,
        tileEfficiency: 0.74
    }
    const resultB = evaluator.evaluateSummaryGame(inputB)
    assert.strictEqual(resultB.grade, 'B')
    assert.ok(resultB.aiScore >= 70 && resultB.aiScore < 80)

    // C Grade: aiScore >= 60 && aiScore < 70
    const inputC: SummaryGameEvaluationInput = {
        rank: 3,
        finalScore: 18000,
        roomType: '은탁 반장전',
        gameMode: '4p',
        luckScore: 46,
        skillScore: 58,
        averageStartingShanten: 3.8,
        winCount: 0,
        dealInCount: 1,
        totalRounds: 8,
        dealerRounds: 2,
        tileEfficiency: 0.68
    }
    const resultC = evaluator.evaluateSummaryGame(inputC)
    assert.strictEqual(resultC.grade, 'C')
    assert.ok(resultC.aiScore >= 60 && resultC.aiScore < 70)

    // D Grade: aiScore < 60
    const inputD: SummaryGameEvaluationInput = {
        rank: 4,
        finalScore: -5000,
        roomType: '동탁 반장전',
        gameMode: '4p',
        luckScore: 35,
        skillScore: 30,
        averageStartingShanten: 4.2,
        winCount: 0,
        dealInCount: 4,
        totalRounds: 8,
        dealerRounds: 2,
        tileEfficiency: 0.45
    }
    const resultD = evaluator.evaluateSummaryGame(inputD)
    assert.strictEqual(resultD.grade, 'D')
    assert.ok(resultD.aiScore < 60)
})
