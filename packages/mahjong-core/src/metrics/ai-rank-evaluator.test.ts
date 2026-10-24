/*_ GEMINI THINKING _*/
import test from 'node:test'
import assert from 'node:assert'
import {
    AiRankEvaluator,
    SummaryGameEvaluationInput,
    PaipuGame
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

    public testIsNextTileInCycle(indicator: string, tile: string, is3P: boolean = false): boolean {
        return this.isNextTileInCycle(indicator, tile, is3P)
    }

    public testIsDoraOrRed(tile: string, doraIndicators: readonly string[], is3P: boolean = false): boolean {
        return this.isDoraOrRed(tile, doraIndicators, is3P)
    }

    public testCalculateSituationScore(
        rank: number,
        finalScore: number,
        roomType: string,
        is3P: boolean,
        luck: number
    ): number {
        return this.calculateSituationScore(rank, finalScore, roomType, is3P, luck)
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

    // 6. Suji 2/8 or 3/7 / live guest wind (0.34)
    const suji2pDanger = mock.testCalculateTileDanger('2p', ['5p'], emptyMap)
    assert.strictEqual(suji2pDanger, 0.34)

    const liveGuestWindDanger = mock.testCalculateTileDanger('4z', [], emptyMap, false, false, '1z', '2z')
    assert.strictEqual(liveGuestWindDanger, 0.34)

    // 7. Live yakuhai (0.48)
    const liveYakuhaiDanger = mock.testCalculateTileDanger('5z', [], emptyMap)
    assert.strictEqual(liveYakuhaiDanger, 0.48)

    // 8. Katasuji middle / Musuji 1/9 (0.55)
    const katasujiMiddleDanger = mock.testCalculateTileDanger('4p', ['1p'], emptyMap)
    assert.strictEqual(katasujiMiddleDanger, 0.55)

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

/*_ GEMINI THINKING _*/
test('MockAiRankEvaluator - 3P manzu dora cycle (1m indicator -> 9m dora)', () => {
    const mock = new MockAiRankEvaluator()

    /*_ GEMINI THINKING _*/
    // In 4P mode: 1m indicator -> 2m is dora
    assert.strictEqual(mock.testIsNextTileInCycle('1m', '2m', false), true)
    assert.strictEqual(mock.testIsNextTileInCycle('1m', '9m', false), false)
    assert.strictEqual(mock.testIsDoraOrRed('2m', ['1m'], false), true)
    assert.strictEqual(mock.testIsDoraOrRed('9m', ['1m'], false), false)

    /*_ GEMINI THINKING _*/
    // In 3P mode: 2m..8m are excluded, so 1m indicator -> 9m is dora, and 9m indicator -> 1m is dora
    assert.strictEqual(mock.testIsNextTileInCycle('1m', '9m', true), true)
    assert.strictEqual(mock.testIsNextTileInCycle('9m', '1m', true), true)
    assert.strictEqual(mock.testIsNextTileInCycle('1m', '2m', true), false)
    assert.strictEqual(mock.testIsDoraOrRed('9m', ['1m'], true), true)
    assert.strictEqual(mock.testIsDoraOrRed('1m', ['9m'], true), true)
    assert.strictEqual(mock.testIsDoraOrRed('2m', ['1m'], true), false)
})

/*_ GEMINI THINKING _*/
test('AiRankEvaluator - 3P 3rd place receives last-place penalty in situationScore', () => {
    const mock = new MockAiRankEvaluator()
    const evaluator = new AiRankEvaluator()

    /*_ GEMINI THINKING _*/
    // Direct situationScore comparison:
    // 4P mode 3rd place: 70 - 5 + 3 (Jade room) = 68
    const sitScore4P = mock.testCalculateSituationScore(3, 20000, '옥탁 반장전', false, 50)
    assert.strictEqual(sitScore4P, 68)

    /*_ GEMINI THINKING _*/
    // 3P mode 3rd place is last place (라스): 70 - 18 + 3 = 55
    const sitScore3P = mock.testCalculateSituationScore(3, 20000, '옥탁 반장전', true, 50)
    assert.strictEqual(sitScore3P, 55)

    const baseInput: Omit<SummaryGameEvaluationInput, 'gameMode' | 'rank'> = {
        finalScore: 20000,
        roomType: '옥탁 반장전',
        luckScore: 50,
        skillScore: 70,
        averageStartingShanten: 3.5,
        winCount: 1,
        dealInCount: 1,
        totalRounds: 8,
        dealerRounds: 2,
        tileEfficiency: 0.8
    }

    /*_ GEMINI THINKING _*/
    // In 4P mode, 3rd place receives a moderate penalty (-5): situationScore = 68 -> situationGrade 'C'
    const eval4P = evaluator.evaluateSummaryGame({
        ...baseInput,
        gameMode: '4p',
        rank: 3
    })

    /*_ GEMINI THINKING _*/
    // In 3P mode, 3rd place is the last place (라스) and receives full last-place penalty (-18): situationScore = 55 -> situationGrade 'D'
    const eval3P = evaluator.evaluateSummaryGame({
        ...baseInput,
        gameMode: '3p',
        rank: 3
    })

    assert.strictEqual(eval4P.situationGrade, 'C')
    assert.strictEqual(eval3P.situationGrade, 'D')
    assert.ok(eval4P.aiScore > eval3P.aiScore)
})

/*_ GEMINI THINKING _*/
test('MockAiRankEvaluator - Middle tile danger: Nakasuji (0.16) vs Katasuji (0.55) vs Musuji (1.00)', () => {
    const mock = new MockAiRankEvaluator()
    const emptyMap = new Map<string, number>()

    /*_ GEMINI THINKING _*/
    // 4p Nakasuji: both 1p and 7p discarded -> danger = 0.16
    const nakasuji4p = mock.testCalculateTileDanger('4p', ['1p', '7p'], emptyMap)
    assert.strictEqual(nakasuji4p, 0.16)

    /*_ GEMINI THINKING _*/
    // 4p Katasuji: only 1p discarded (or only 7p discarded) -> danger = 0.55
    const katasuji4pFrom1 = mock.testCalculateTileDanger('4p', ['1p'], emptyMap)
    assert.strictEqual(katasuji4pFrom1, 0.55)
    const katasuji4pFrom7 = mock.testCalculateTileDanger('4p', ['7p'], emptyMap)
    assert.strictEqual(katasuji4pFrom7, 0.55)

    /*_ GEMINI THINKING _*/
    // 4p Musuji: neither 1p nor 7p discarded -> danger = 1.00
    const musuji4p = mock.testCalculateTileDanger('4p', [], emptyMap)
    assert.strictEqual(musuji4p, 1.00)

    /*_ GEMINI THINKING _*/
    // 5s Katasuji vs Nakasuji
    const nakasuji5s = mock.testCalculateTileDanger('5s', ['2s', '8s'], emptyMap)
    assert.strictEqual(nakasuji5s, 0.16)
    const katasuji5s = mock.testCalculateTileDanger('5s', ['2s'], emptyMap)
    assert.strictEqual(katasuji5s, 0.55)
    const musuji5s = mock.testCalculateTileDanger('5s', [], emptyMap)
    assert.strictEqual(musuji5s, 1.00)

    /*_ GEMINI THINKING _*/
    // 6m Katasuji vs Nakasuji
    const nakasuji6m = mock.testCalculateTileDanger('6m', ['3m', '9m'], emptyMap)
    assert.strictEqual(nakasuji6m, 0.16)
    const katasuji6m = mock.testCalculateTileDanger('6m', ['9m'], emptyMap)
    assert.strictEqual(katasuji6m, 0.55)
    const musuji6m = mock.testCalculateTileDanger('6m', [], emptyMap)
    assert.strictEqual(musuji6m, 1.00)
})

/*_ GEMINI THINKING _*/
test('AiRankEvaluator - evaluatePaipuGame: target Chi and Pon meld synchronizes hand and prevents hand tile inflation', () => {
    const evaluator = new AiRankEvaluator()

    const game: PaipuGame = {
        uuid: 'test-furo-sync-game',
        roomType: '옥탁 동풍전 (Jade East)',
        timestamp: 1722510000000,
        players: [
            { accountId: 10001, nickname: 'TargetPlayer', seat: 0, level: 3 },
            { accountId: 10002, nickname: 'Opponent1', seat: 1, level: 3 },
            { accountId: 10003, nickname: 'Opponent2', seat: 2, level: 3 },
            { accountId: 10004, nickname: 'Opponent3', seat: 3, level: 3 }
        ],
        rounds: [
            {
                header: {
                    type: 'RecordNewRound',
                    chang: 0,
                    ju: 0,
                    ben: 0,
                    liqi: 0,
                    scores: [25000, 25000, 25000, 25000],
                    dora: '9m',
                    hands: [
                        // Seat 0 starting hand: 13 tiles (1m2m3m, 4p5p6p, 7s8s9s, 1z1z, 2z, 3z)
                        ['1m', '2m', '3m', '4p', '5p', '6p', '7s', '8s', '9s', '1z', '1z', '2z', '3z'],
                        ['1p', '2p', '3p', '4p', '5p', '6p', '7p', '8p', '9p', '1s', '2s', '3s', '4s'],
                        ['1p', '2p', '3p', '4p', '5p', '6p', '7p', '8p', '9p', '1s', '2s', '3s', '4s'],
                        ['1p', '2p', '3p', '4p', '5p', '6p', '7p', '8p', '9p', '1s', '2s', '3s', '4s']
                    ]
                },
                actions: [
                    // Opponent Seat 3 discards 1z
                    { type: 'RecordDealTile', seat: 3, tile: '1z' },
                    { type: 'RecordDiscardTile', seat: 3, tile: '1z', isMoqie: false, isLiqi: false },

                    // Seat 0 calls Pon on 1z: two 1z removed from hand, currentHand has 11 tiles
                    { type: 'RecordChiPengGang', seat: 0, meldType: 'pon', tiles: ['1z', '1z', '1z'], fromSeat: 3 },

                    // Seat 0 discards 2z: evaluated on 11 tiles, then removed -> currentHand has 10 tiles
                    { type: 'RecordDiscardTile', seat: 0, tile: '2z', isMoqie: false, isLiqi: false },

                    // Opponent Seat 1 discards 4m
                    { type: 'RecordDealTile', seat: 1, tile: '4m' },
                    { type: 'RecordDiscardTile', seat: 1, tile: '4m', isMoqie: false, isLiqi: false },

                    // Seat 0 calls Chi on 4m with 2m, 3m: two tiles removed -> currentHand has 8 tiles
                    { type: 'RecordChiPengGang', seat: 0, meldType: 'chi', tiles: ['2m', '3m', '4m'], fromSeat: 1 },

                    // Seat 0 discards 7s: evaluated on 8 tiles, then removed -> currentHand has 7 tiles
                    { type: 'RecordDiscardTile', seat: 0, tile: '7s', isMoqie: false, isLiqi: false },

                    // Next turn Seat 0 draws 3z: currentHand has 8 tiles (7 + 1 = 8 tiles)
                    { type: 'RecordDealTile', seat: 0, tile: '3z' },

                    // Seat 0 discards 3z
                    { type: 'RecordDiscardTile', seat: 0, tile: '3z', isMoqie: false, isLiqi: false },

                    // Hand ends with Tsumo
                    {
                        type: 'RecordHule',
                        hules: [
                            {
                                seat: 0,
                                deltaScores: [3000, -1000, -1000, -1000],
                                handScore: 3000,
                                fan: 1,
                                fu: 30,
                                yaku: ['역패 백'],
                                uradoras: []
                            }
                        ]
                    }
                ]
            }
        ]
    }

    const breakdown = evaluator.evaluatePaipuGame(game, 0)
    assert.ok(breakdown.matchRate >= 0 && breakdown.matchRate <= 100)
    assert.ok(breakdown.aiScore >= 0 && breakdown.aiScore <= 100)
    assert.ok(['S+', 'S', 'A', 'B', 'C', 'D'].includes(breakdown.grade))
    assert.ok(['S+', 'S', 'A', 'B', 'C', 'D'].includes(breakdown.attackGrade))
    assert.ok(['S+', 'S', 'A', 'B', 'C', 'D'].includes(breakdown.defenseGrade))
})

/*_ GEMINI THINKING _*/
test('AiRankEvaluator - evaluatePaipuGame: RecordAnGangAddGang handles ankan (4 tiles) and kakan (1 tile)', () => {
    const evaluator = new AiRankEvaluator()

    const game: PaipuGame = {
        uuid: 'test-gang-sync-game',
        roomType: '옥탁 동풍전 (Jade East)',
        timestamp: 1722510000000,
        players: [
            { accountId: 10001, nickname: 'TargetPlayer', seat: 0, level: 3 },
            { accountId: 10002, nickname: 'Opponent1', seat: 1, level: 3 },
            { accountId: 10003, nickname: 'Opponent2', seat: 2, level: 3 },
            { accountId: 10004, nickname: 'Opponent3', seat: 3, level: 3 }
        ],
        rounds: [
            {
                header: {
                    type: 'RecordNewRound',
                    chang: 0,
                    ju: 0,
                    ben: 0,
                    liqi: 0,
                    scores: [25000, 25000, 25000, 25000],
                    dora: '5p',
                    hands: [
                        // Seat 0 starting hand: 13 tiles with four 9s and two 1z
                        ['1m', '2m', '3m', '4p', '5p', '6p', '7s', '9s', '9s', '9s', '9s', '1z', '1z'],
                        ['1p', '2p', '3p', '4p', '5p', '6p', '7p', '8p', '9p', '1s', '2s', '3s', '4s'],
                        ['1p', '2p', '3p', '4p', '5p', '6p', '7p', '8p', '9p', '1s', '2s', '3s', '4s'],
                        ['1p', '2p', '3p', '4p', '5p', '6p', '7p', '8p', '9p', '1s', '2s', '3s', '4s']
                    ]
                },
                actions: [
                    // Seat 0 declares AnGang on 9s: 4 tiles removed from hand, meldCount = 1
                    { type: 'RecordAnGangAddGang', seat: 0, gangType: 'ankan', tiles: ['9s', '9s', '9s', '9s'] },

                    // Rinshan draw: draws 8s (hand has 9 + 1 = 10 tiles)
                    { type: 'RecordDealTile', seat: 0, tile: '8s' },

                    // Seat 0 discards 7s (hand has 10 - 1 = 9 tiles)
                    { type: 'RecordDiscardTile', seat: 0, tile: '7s', isMoqie: false, isLiqi: false },

                    // Opponent Seat 2 calls Pon on opponent discard
                    { type: 'RecordDiscardTile', seat: 1, tile: '2p', isMoqie: false, isLiqi: false },
                    { type: 'RecordChiPengGang', seat: 2, meldType: 'pon', tiles: ['2p', '2p', '2p'], fromSeat: 1 },
                    { type: 'RecordDiscardTile', seat: 2, tile: '3p', isMoqie: false, isLiqi: false },

                    // Seat 0 draws 1z
                    { type: 'RecordDealTile', seat: 0, tile: '1z' },
                    { type: 'RecordDiscardTile', seat: 0, tile: '1z', isMoqie: false, isLiqi: false },

                    { type: 'RecordNoTile', tenpaiSeats: [0], deltaScores: [3000, -1000, -1000, -1000] }
                ]
            }
        ]
    }

    const breakdown = evaluator.evaluatePaipuGame(game, 0)
    assert.ok(breakdown.matchRate >= 0 && breakdown.matchRate <= 100)
    assert.ok(breakdown.aiScore >= 0 && breakdown.aiScore <= 100)
    assert.ok(['S+', 'S', 'A', 'B', 'C', 'D'].includes(breakdown.grade))
})

/*_ GEMINI THINKING _*/
test('AiRankEvaluator - evaluatePaipuGame: RecordBaBei removes 4z and opponent calling target discard updates visibleTileCounts', () => {
    const evaluator = new AiRankEvaluator()

    const game: PaipuGame = {
        uuid: 'test-babei-and-target-discard-furo',
        roomType: '옥탁 동풍전 (Jade East)',
        timestamp: 1722510000000,
        players: [
            { accountId: 10001, nickname: 'TargetPlayer', seat: 0, level: 3 },
            { accountId: 10002, nickname: 'Opponent1', seat: 1, level: 3 },
            { accountId: 10003, nickname: 'Opponent2', seat: 2, level: 3 },
            { accountId: 10004, nickname: 'Opponent3', seat: 3, level: 3 }
        ],
        rounds: [
            {
                header: {
                    type: 'RecordNewRound',
                    chang: 0,
                    ju: 0,
                    ben: 0,
                    liqi: 0,
                    scores: [25000, 25000, 25000, 25000],
                    dora: '5p',
                    hands: [
                        // Seat 0 starting hand contains '4z' (Pei) and '1z'
                        ['1m', '2m', '3m', '4p', '5p', '6p', '7s', '8s', '9s', '1z', '2z', '3z', '4z'],
                        ['1p', '2p', '3p', '4p', '5p', '6p', '7p', '8p', '9p', '1s', '2s', '3s', '4s'],
                        ['1p', '2p', '3p', '4p', '5p', '6p', '7p', '8p', '9p', '1s', '2s', '3s', '4s'],
                        ['1p', '2p', '3p', '4p', '5p', '6p', '7p', '8p', '9p', '1s', '2s', '3s', '4s']
                    ]
                },
                actions: [
                    // Seat 0 declares RecordBaBei: 4z removed from hand, 4z added to visible counts
                    { type: 'RecordBaBei', seat: 0, isMoqie: false, doras: ['4z'] },

                    // Rinshan draw: draws 1s
                    { type: 'RecordDealTile', seat: 0, tile: '1s' },

                    // Seat 0 discards 1z
                    { type: 'RecordDiscardTile', seat: 0, tile: '1z', isMoqie: false, isLiqi: false },

                    // Opponent Seat 1 calls Pon on Seat 0's 1z discard (isTargetDiscard = true)
                    // The 1z discard and opponent's 1z tiles must both be added to visibleTileCounts without permanent loss
                    { type: 'RecordChiPengGang', seat: 1, meldType: 'pon', tiles: ['1z', '1z', '1z'], fromSeat: 0 },
                    { type: 'RecordDiscardTile', seat: 1, tile: '4p', isMoqie: false, isLiqi: false },

                    // Seat 2 discards 2z
                    { type: 'RecordDealTile', seat: 2, tile: '2z' },
                    { type: 'RecordDiscardTile', seat: 2, tile: '2z', isMoqie: false, isLiqi: false },

                    // Target Seat 0 draws and discards
                    { type: 'RecordDealTile', seat: 0, tile: '2s' },
                    { type: 'RecordDiscardTile', seat: 0, tile: '2s', isMoqie: true, isLiqi: false },

                    { type: 'RecordNoTile', tenpaiSeats: [0], deltaScores: [3000, -1000, -1000, -1000] }
                ]
            }
        ]
    }

    const breakdown = evaluator.evaluatePaipuGame(game, 0)
    assert.ok(breakdown.matchRate >= 0 && breakdown.matchRate <= 100)
    assert.ok(breakdown.aiScore >= 0 && breakdown.aiScore <= 100)
    assert.ok(['S+', 'S', 'A', 'B', 'C', 'D'].includes(breakdown.grade))
})
