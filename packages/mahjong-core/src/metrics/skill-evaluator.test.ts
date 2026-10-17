import test from 'node:test'
import assert from 'node:assert'
import { SeatIndex } from '@mahjong-sensei/types'
import { MajsoulRoundRecord } from '../parser/types'
import { SkillEvaluator } from './skill-evaluator'

/*_ GEMINI THINKING _*/
class MockSkillEvaluator extends SkillEvaluator {
    public testCalculateDiscardSafety(
        tile: string,
        activeRiichiSeats: ReadonlySet<SeatIndex>,
        playerDiscards: ReadonlyMap<SeatIndex, readonly string[]>,
        visibleTileCounts: ReadonlyMap<string, number>
    ): number {
        return this.calculateDiscardSafety(tile, activeRiichiSeats, playerDiscards, visibleTileCounts)
    }

    public testEvaluateSafetyAgainstPlayer(
        tile: string,
        opponentDiscards: readonly string[],
        visibleTileCounts: ReadonlyMap<string, number>
    ): number {
        return this.evaluateSafetyAgainstPlayer(tile, opponentDiscards, visibleTileCounts)
    }
}

test('SkillEvaluator - evaluateSafetyAgainstPlayer: Genbutsu safety', () => {
    const evaluator = new MockSkillEvaluator()
    const emptyVisible = new Map<string, number>()

    // Direct discard in opponent's kawa
    assert.strictEqual(evaluator.testEvaluateSafetyAgainstPlayer('1m', ['1m'], emptyVisible), 1.0)
    assert.strictEqual(evaluator.testEvaluateSafetyAgainstPlayer('5p', ['9m', '5p', '1z'], emptyVisible), 1.0)
    assert.strictEqual(evaluator.testEvaluateSafetyAgainstPlayer('7z', ['7z'], emptyVisible), 1.0)

    // Red dora normalization
    assert.strictEqual(evaluator.testEvaluateSafetyAgainstPlayer('0m', ['5m'], emptyVisible), 1.0)
    assert.strictEqual(evaluator.testEvaluateSafetyAgainstPlayer('5m', ['0m'], emptyVisible), 1.0)
})

test('SkillEvaluator - evaluateSafetyAgainstPlayer: Honor tiles (z)', () => {
    const evaluator = new MockSkillEvaluator()
    const emptyDiscards: readonly string[] = []

    // >= 3 visible copies: 0.95
    const visible3 = new Map<string, number>([['1z', 3], ['2z', 4]])
    assert.strictEqual(evaluator.testEvaluateSafetyAgainstPlayer('1z', emptyDiscards, visible3), 0.95)
    assert.strictEqual(evaluator.testEvaluateSafetyAgainstPlayer('2z', emptyDiscards, visible3), 0.95)

    // 2 visible copies: 0.75
    const visible2 = new Map<string, number>([['3z', 2]])
    assert.strictEqual(evaluator.testEvaluateSafetyAgainstPlayer('3z', emptyDiscards, visible2), 0.75)

    // < 2 visible copies: 0.40
    const visible1 = new Map<string, number>([['4z', 1]])
    const visible0 = new Map<string, number>()
    assert.strictEqual(evaluator.testEvaluateSafetyAgainstPlayer('4z', emptyDiscards, visible1), 0.40)
    assert.strictEqual(evaluator.testEvaluateSafetyAgainstPlayer('5z', emptyDiscards, visible0), 0.40)

    // Genbutsu takes precedence over visible count
    assert.strictEqual(evaluator.testEvaluateSafetyAgainstPlayer('5z', ['5z'], visible0), 1.0)
})

test('SkillEvaluator - evaluateSafetyAgainstPlayer: Terminals (1, 9)', () => {
    const evaluator = new MockSkillEvaluator()
    const emptyVisible = new Map<string, number>()

    // 1m with/without suji 4m
    assert.strictEqual(evaluator.testEvaluateSafetyAgainstPlayer('1m', ['4m'], emptyVisible), 0.85)
    assert.strictEqual(evaluator.testEvaluateSafetyAgainstPlayer('1m', [], emptyVisible), 0.45)

    // 9p with/without suji 6p
    assert.strictEqual(evaluator.testEvaluateSafetyAgainstPlayer('9p', ['6p'], emptyVisible), 0.85)
    assert.strictEqual(evaluator.testEvaluateSafetyAgainstPlayer('9p', [], emptyVisible), 0.45)
})

test('SkillEvaluator - evaluateSafetyAgainstPlayer: (2, 8)', () => {
    const evaluator = new MockSkillEvaluator()
    const emptyVisible = new Map<string, number>()

    // 2s with/without suji 5s
    assert.strictEqual(evaluator.testEvaluateSafetyAgainstPlayer('2s', ['5s'], emptyVisible), 0.75)
    assert.strictEqual(evaluator.testEvaluateSafetyAgainstPlayer('2s', [], emptyVisible), 0.35)

    // 8m with/without suji 5m (and with red five 0m)
    assert.strictEqual(evaluator.testEvaluateSafetyAgainstPlayer('8m', ['5m'], emptyVisible), 0.75)
    assert.strictEqual(evaluator.testEvaluateSafetyAgainstPlayer('8m', ['0m'], emptyVisible), 0.75)
    assert.strictEqual(evaluator.testEvaluateSafetyAgainstPlayer('8m', [], emptyVisible), 0.35)
})

test('SkillEvaluator - evaluateSafetyAgainstPlayer: (3, 7)', () => {
    const evaluator = new MockSkillEvaluator()
    const emptyVisible = new Map<string, number>()

    // 3s with/without suji 6s
    assert.strictEqual(evaluator.testEvaluateSafetyAgainstPlayer('3s', ['6s'], emptyVisible), 0.70)
    assert.strictEqual(evaluator.testEvaluateSafetyAgainstPlayer('3s', [], emptyVisible), 0.30)

    // 7p with/without suji 4p
    assert.strictEqual(evaluator.testEvaluateSafetyAgainstPlayer('7p', ['4p'], emptyVisible), 0.70)
    assert.strictEqual(evaluator.testEvaluateSafetyAgainstPlayer('7p', [], emptyVisible), 0.30)
})

test('SkillEvaluator - evaluateSafetyAgainstPlayer: Middle tiles (4, 5, 6)', () => {
    const evaluator = new MockSkillEvaluator()
    const emptyVisible = new Map<string, number>()

    // 4m: double suji (1m and 7m), single suji (1m or 7m), musuji (neither)
    assert.strictEqual(evaluator.testEvaluateSafetyAgainstPlayer('4m', ['1m', '7m'], emptyVisible), 0.80)
    assert.strictEqual(evaluator.testEvaluateSafetyAgainstPlayer('4m', ['1m'], emptyVisible), 0.50)
    assert.strictEqual(evaluator.testEvaluateSafetyAgainstPlayer('4m', ['7m'], emptyVisible), 0.50)
    assert.strictEqual(evaluator.testEvaluateSafetyAgainstPlayer('4m', [], emptyVisible), 0.20)

    // 5p: double suji (2p and 8p), single suji (2p or 8p), musuji (neither)
    assert.strictEqual(evaluator.testEvaluateSafetyAgainstPlayer('5p', ['2p', '8p'], emptyVisible), 0.80)
    assert.strictEqual(evaluator.testEvaluateSafetyAgainstPlayer('5p', ['2p'], emptyVisible), 0.50)
    assert.strictEqual(evaluator.testEvaluateSafetyAgainstPlayer('5p', ['8p'], emptyVisible), 0.50)
    assert.strictEqual(evaluator.testEvaluateSafetyAgainstPlayer('5p', [], emptyVisible), 0.20)

    // Red five 0p behaves as 5p
    assert.strictEqual(evaluator.testEvaluateSafetyAgainstPlayer('0p', ['2p', '8p'], emptyVisible), 0.80)
    assert.strictEqual(evaluator.testEvaluateSafetyAgainstPlayer('0p', [], emptyVisible), 0.20)

    // 6s: double suji (3s and 9s), single suji (3s or 9s), musuji (neither)
    assert.strictEqual(evaluator.testEvaluateSafetyAgainstPlayer('6s', ['3s', '9s'], emptyVisible), 0.80)
    assert.strictEqual(evaluator.testEvaluateSafetyAgainstPlayer('6s', ['3s'], emptyVisible), 0.50)
    assert.strictEqual(evaluator.testEvaluateSafetyAgainstPlayer('6s', ['9s'], emptyVisible), 0.50)
    assert.strictEqual(evaluator.testEvaluateSafetyAgainstPlayer('6s', [], emptyVisible), 0.20)
})

test('SkillEvaluator - calculateDiscardSafety: Single and multiple Riichi opponents', () => {
    const evaluator = new MockSkillEvaluator()
    const emptyVisible = new Map<string, number>()

    const discardsMap = new Map<SeatIndex, readonly string[]>([
        [0, []],
        [1, ['1m', '9m']],      // Seat 1 discarded 1m (Genbutsu for 1m)
        [2, ['6p']],            // Seat 2 discarded 6p (Suji for 9p, but 1m is musuji)
        [3, []]
    ])

    // Empty Riichi seats returns 1.0
    const emptyRiichi = new Set<SeatIndex>()
    assert.strictEqual(evaluator.testCalculateDiscardSafety('1m', emptyRiichi, discardsMap, emptyVisible), 1.0)

    // Single Riichi opponent (Seat 1): 1m is Genbutsu (1.0)
    const singleRiichi = new Set<SeatIndex>([1])
    assert.strictEqual(evaluator.testCalculateDiscardSafety('1m', singleRiichi, discardsMap, emptyVisible), 1.0)

    // Multiple Riichi opponents (Seat 1 and Seat 2):
    // 1m is Genbutsu against Seat 1 (1.0), but terminal without suji against Seat 2 (0.45)
    // Minimum safety must be selected (0.45)
    const dualRiichi = new Set<SeatIndex>([1, 2])
    assert.strictEqual(evaluator.testCalculateDiscardSafety('1m', dualRiichi, discardsMap, emptyVisible), 0.45)
})

test('SkillEvaluator - evaluateRound: foldAccuracyRate computation under Riichi', () => {
    const evaluator = new SkillEvaluator()

    const roundRecord: MajsoulRoundRecord = {
        header: {
            type: 'RecordNewRound',
            chang: 0,
            ju: 0,
            ben: 0,
            liqi: 0,
            scores: [25000, 25000, 25000, 25000],
            dora: '1p',
            hands: [
                ['1m', '2m', '3m', '4m', '5m', '6m', '7m', '8m', '9m', '1s', '2s', '3s', '4s'],
                ['1p', '2p', '3p', '4p', '5p', '6p', '7p', '8p', '9p', '1s', '2s', '3s', '4s'],
                ['1p', '2p', '3p', '4p', '5p', '6p', '7p', '8p', '9p', '1s', '2s', '3s', '4s'],
                ['1p', '2p', '3p', '4p', '5p', '6p', '7p', '8p', '9p', '1s', '2s', '3s', '4s']
            ]
        },
        actions: [
            // Seat 1 declares Riichi and discards 4m
            { type: 'RecordDealTile', seat: 1, tile: '4m' },
            { type: 'RecordDiscardTile', seat: 1, tile: '4m', isMoqie: false, isLiqi: true },

            // Seat 0 draws 1m (Suji because Seat 1 discarded 4m -> safety 0.85) and discards it
            { type: 'RecordDealTile', seat: 0, tile: '1m' },
            { type: 'RecordDiscardTile', seat: 0, tile: '1m', isMoqie: false, isLiqi: false },

            // Seat 1 discards 2s
            { type: 'RecordDealTile', seat: 1, tile: '2s' },
            { type: 'RecordDiscardTile', seat: 1, tile: '2s', isMoqie: true, isLiqi: false },

            // Seat 0 draws 2s (Genbutsu because Seat 1 discarded 2s -> safety 1.0) and discards it
            { type: 'RecordDealTile', seat: 0, tile: '2s' },
            { type: 'RecordDiscardTile', seat: 0, tile: '2s', isMoqie: true, isLiqi: false },

            // Round finishes in Ryukyoku
            { type: 'RecordNoTile', tenpaiSeats: [1], deltaScores: [-1000, 3000, -1000, -1000] }
        ]
    }

    const metric = evaluator.evaluateRound(roundRecord, 0)
    // 2 post-riichi discards: 1m (0.85) + 2s (1.0) = 1.85 / 2 = 0.925 -> 0.93
    assert.strictEqual(metric.foldAccuracyRate, 0.93)
})

test('SkillEvaluator - evaluateSafetyAgainstPlayer: Kabe / No-Chance suited tile safety', () => {
    const evaluator = new MockSkillEvaluator()
    const emptyDiscards: readonly string[] = []

    // 1m with 4 copies of 3m visible (Kabe): boosted from 0.45 to 0.85
    const visible3m4 = new Map<string, number>([['3m', 4]])
    assert.strictEqual(evaluator.testEvaluateSafetyAgainstPlayer('1m', emptyDiscards, visible3m4), 0.85)

    // 2m with 4 copies of 3m visible (Kabe): boosted from 0.35 to 0.85
    assert.strictEqual(evaluator.testEvaluateSafetyAgainstPlayer('2m', emptyDiscards, visible3m4), 0.85)

    // 1m with only 3 copies of 3m visible: not Kabe, normal terminal safety (0.45)
    const visible3m3 = new Map<string, number>([['3m', 3]])
    assert.strictEqual(evaluator.testEvaluateSafetyAgainstPlayer('1m', emptyDiscards, visible3m3), 0.45)
    assert.strictEqual(evaluator.testEvaluateSafetyAgainstPlayer('2m', emptyDiscards, visible3m3), 0.35)

    // 8p with 4 copies of 7p visible (Kabe): boosted from 0.35 to 0.85
    const visible7p4 = new Map<string, number>([['7p', 4]])
    assert.strictEqual(evaluator.testEvaluateSafetyAgainstPlayer('8p', emptyDiscards, visible7p4), 0.85)

    // 9p with 4 copies of 7p visible (Kabe): boosted from 0.45 to 0.85
    assert.strictEqual(evaluator.testEvaluateSafetyAgainstPlayer('9p', emptyDiscards, visible7p4), 0.85)

    // 8p with 3 copies of 7p visible: not Kabe, normal safety (0.35)
    const visible7p3 = new Map<string, number>([['7p', 3]])
    assert.strictEqual(evaluator.testEvaluateSafetyAgainstPlayer('8p', emptyDiscards, visible7p3), 0.35)
    assert.strictEqual(evaluator.testEvaluateSafetyAgainstPlayer('9p', emptyDiscards, visible7p3), 0.45)

    // 1s with 4 copies of 2s visible (Kabe): boosted to 0.85
    const visible2s4 = new Map<string, number>([['2s', 4]])
    assert.strictEqual(evaluator.testEvaluateSafetyAgainstPlayer('1s', emptyDiscards, visible2s4), 0.85)

    // 9s with 4 copies of 8s visible (Kabe): boosted to 0.85
    const visible8s4 = new Map<string, number>([['8s', 4]])
    assert.strictEqual(evaluator.testEvaluateSafetyAgainstPlayer('9s', emptyDiscards, visible8s4), 0.85)

    // Genbutsu takes precedence over Kabe (1.0 > 0.85)
    assert.strictEqual(evaluator.testEvaluateSafetyAgainstPlayer('1m', ['1m'], visible3m4), 1.0)
})

test('SkillEvaluator - evaluateRound: Post-Riichi Genbutsu / Awase-uchi evaluated as 1.0 safety', () => {
    const evaluator = new SkillEvaluator()

    const roundRecord: MajsoulRoundRecord = {
        header: {
            type: 'RecordNewRound',
            chang: 0,
            ju: 0,
            ben: 0,
            liqi: 0,
            scores: [25000, 25000, 25000, 25000],
            dora: '1p',
            hands: [
                ['1m', '2m', '3m', '4m', '5m', '6m', '7m', '8m', '9m', '1s', '2s', '3s', '4s'],
                ['1p', '2p', '3p', '4p', '5p', '6p', '7p', '8p', '9p', '1s', '2s', '3s', '4s'],
                ['1p', '2p', '3p', '4p', '5p', '6p', '7p', '8p', '9p', '1s', '2s', '3s', '4s'],
                ['1p', '2p', '3p', '4p', '5p', '6p', '7p', '8p', '9p', '1s', '2s', '3s', '4s']
            ]
        },
        actions: [
            // Seat 1 declares Riichi and discards 4m
            { type: 'RecordDealTile', seat: 1, tile: '4m' },
            { type: 'RecordDiscardTile', seat: 1, tile: '4m', isMoqie: false, isLiqi: true },

            // Seat 2 discards 8s (normally musuji against Seat 1, but discarded AFTER Riichi -> Genbutsu)
            { type: 'RecordDealTile', seat: 2, tile: '8s' },
            { type: 'RecordDiscardTile', seat: 2, tile: '8s', isMoqie: false, isLiqi: false },

            // Seat 0 draws 8s and discards 8s (awase-uchi / post-riichi genbutsu)
            { type: 'RecordDealTile', seat: 0, tile: '8s' },
            { type: 'RecordDiscardTile', seat: 0, tile: '8s', isMoqie: true, isLiqi: false },

            // Round finishes in Ryukyoku
            { type: 'RecordNoTile', tenpaiSeats: [1], deltaScores: [-1000, 3000, -1000, -1000] }
        ]
    }

    const metric = evaluator.evaluateRound(roundRecord, 0)
    // 8s discarded by Seat 2 after Seat 1 Riichi must be evaluated as 1.0 Genbutsu safety for Seat 0
    assert.strictEqual(metric.foldAccuracyRate, 1.0)
})

test('SkillEvaluator - evaluateRound: foldAccuracyRate reflected in skillScore', () => {
    const evaluator = new SkillEvaluator()

    const baseHeader = {
        type: 'RecordNewRound' as const,
        chang: 0,
        ju: 0,
        ben: 0,
        liqi: 0,
        scores: [25000, 25000, 25000, 25000] as const,
        dora: '1p',
        hands: [
            ['1m', '2m', '3m', '4m', '5m', '6m', '7m', '8m', '9m', '1s', '2s', '3s', '4s'],
            ['1p', '2p', '3p', '4p', '5p', '6p', '7p', '8p', '9p', '1s', '2s', '3s', '4s'],
            ['1p', '2p', '3p', '4p', '5p', '6p', '7p', '8p', '9p', '1s', '2s', '3s', '4s'],
            ['1p', '2p', '3p', '4p', '5p', '6p', '7p', '8p', '9p', '1s', '2s', '3s', '4s']
        ] as const
    }

    // Round with high fold accuracy: discards 4m (Genbutsu, safety 1.0)
    const safeRound: MajsoulRoundRecord = {
        header: baseHeader,
        actions: [
            { type: 'RecordDealTile', seat: 1, tile: '4m' },
            { type: 'RecordDiscardTile', seat: 1, tile: '4m', isMoqie: false, isLiqi: true },
            { type: 'RecordDealTile', seat: 0, tile: '4m' },
            { type: 'RecordDiscardTile', seat: 0, tile: '4m', isMoqie: true, isLiqi: false },
            { type: 'RecordNoTile', tenpaiSeats: [1], deltaScores: [-1000, 3000, -1000, -1000] }
        ]
    }

    // Round with poor fold accuracy: discards 5p (musuji middle tile, safety 0.20)
    const dangerRound: MajsoulRoundRecord = {
        header: baseHeader,
        actions: [
            { type: 'RecordDealTile', seat: 1, tile: '4m' },
            { type: 'RecordDiscardTile', seat: 1, tile: '4m', isMoqie: false, isLiqi: true },
            { type: 'RecordDealTile', seat: 0, tile: '5p' },
            { type: 'RecordDiscardTile', seat: 0, tile: '5p', isMoqie: true, isLiqi: false },
            { type: 'RecordNoTile', tenpaiSeats: [1], deltaScores: [-1000, 3000, -1000, -1000] }
        ]
    }

    const metricSafe = evaluator.evaluateRound(safeRound, 0)
    const metricDanger = evaluator.evaluateRound(dangerRound, 0)

    assert.strictEqual(metricSafe.foldAccuracyRate, 1.0)
    assert.strictEqual(metricDanger.foldAccuracyRate, 0.2)
    assert.ok(metricSafe.skillScore > metricDanger.skillScore)
    // Safe: 50 + 16 (efficiency) + 10 (defense) = 76
    // Danger: 50 + 16 (efficiency) - 22 (defense) = 44
    assert.strictEqual(metricSafe.skillScore, 76)
    assert.strictEqual(metricDanger.skillScore, 44)
})

test('SkillEvaluator - evaluateRound: Duplicate Dora indicators counted in visibleTileCounts', () => {
    const evaluator = new SkillEvaluator()

    const roundRecord: MajsoulRoundRecord = {
        header: {
            type: 'RecordNewRound',
            chang: 0,
            ju: 0,
            ben: 0,
            liqi: 0,
            scores: [25000, 25000, 25000, 25000],
            dora: '9m',
            hands: [
                // Hand has no 1z
                ['1m', '2m', '3m', '4m', '5m', '6m', '7m', '8m', '9m', '1s', '2s', '3s', '4s'],
                ['1p', '2p', '3p', '4p', '5p', '6p', '7p', '8p', '9p', '1s', '2s', '3s', '4s'],
                ['1p', '2p', '3p', '4p', '5p', '6p', '7p', '8p', '9p', '1s', '2s', '3s', '4s'],
                ['1p', '2p', '3p', '4p', '5p', '6p', '7p', '8p', '9p', '1s', '2s', '3s', '4s']
            ]
        },
        actions: [
            // Seat 1 reveals two duplicate '1z' dora indicators via doras array
            { type: 'RecordDealTile', seat: 1, tile: '5p', doras: ['1z', '1z'] },
            { type: 'RecordDiscardTile', seat: 1, tile: '5p', isMoqie: false, isLiqi: true },

            // Seat 0 draws 1z and discards it.
            // With both duplicate doras counted (2) plus drawn 1z (1), visible copies of 1z is 3 -> honor safety 0.95 (instead of 0.75)
            { type: 'RecordDealTile', seat: 0, tile: '1z' },
            { type: 'RecordDiscardTile', seat: 0, tile: '1z', isMoqie: true, isLiqi: false },

            { type: 'RecordNoTile', tenpaiSeats: [1], deltaScores: [-1000, 3000, -1000, -1000] }
        ]
    }

    const metric = evaluator.evaluateRound(roundRecord, 0)
    assert.strictEqual(metric.foldAccuracyRate, 0.95)
})

test('SkillEvaluator - evaluateRound: RecordChiPengGang called tile matching and targetSeat hand sync', () => {
    const evaluator = new SkillEvaluator()

    const roundRecord: MajsoulRoundRecord = {
        header: {
            type: 'RecordNewRound',
            chang: 0,
            ju: 0,
            ben: 0,
            liqi: 0,
            scores: [25000, 25000, 25000, 25000],
            dora: '9m',
            hands: [
                // Seat 0 starting hand: has two 1z
                ['1m', '2m', '3m', '4p', '5p', '6p', '7s', '8s', '9s', '1z', '1z', '2z', '3z'],
                ['1p', '2p', '3p', '4p', '5p', '6p', '7p', '8p', '9p', '1s', '2s', '3s', '4s'],
                ['1p', '2p', '3p', '4p', '5p', '6p', '7p', '8p', '9p', '1s', '2s', '3s', '4s'],
                ['1p', '2p', '3p', '4p', '5p', '6p', '7p', '8p', '9p', '1s', '2s', '3s', '4s']
            ]
        },
        actions: [
            // Seat 3 discards 1z
            { type: 'RecordDealTile', seat: 3, tile: '1z' },
            { type: 'RecordDiscardTile', seat: 3, tile: '1z', isMoqie: false, isLiqi: false },

            // Seat 0 calls Pon on 1z: meld contains ['1z', '1z', '1z']
            // Hand tiles (two 1z) must be removed from currentHand, keeping currentHand valid
            { type: 'RecordChiPengGang', seat: 0, meldType: 'pon', tiles: ['1z', '1z', '1z'], fromSeat: 3 },

            // Seat 0 discards 2z
            { type: 'RecordDiscardTile', seat: 0, tile: '2z', isMoqie: false, isLiqi: false },

            // Opponent Seat 1 declares Riichi
            { type: 'RecordDealTile', seat: 1, tile: '4m' },
            { type: 'RecordDiscardTile', seat: 1, tile: '4m', isMoqie: false, isLiqi: true },

            // Seat 2 calls Chi on Seat 1's 4m with called tile at index 1: ['3m', '4m', '5m']
            // Only 3m and 5m should be added to visibleTileCounts (4m was already added as discard)
            { type: 'RecordChiPengGang', seat: 2, meldType: 'chi', tiles: ['3m', '4m', '5m'], fromSeat: 1 },

            { type: 'RecordNoTile', tenpaiSeats: [1], deltaScores: [-1000, 3000, -1000, -1000] }
        ]
    }

    const metric = evaluator.evaluateRound(roundRecord, 0)
    assert.strictEqual(metric.dealInMistakeRate, 0.0)
    assert.ok(metric.tileEfficiencyRate > 0)
})
