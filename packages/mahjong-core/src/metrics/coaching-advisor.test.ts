import test from 'node:test'
import assert from 'node:assert'
import {
    CoachingAdvisor,
    OptimalDiscardResult,
    MistakeCategory,
    MistakeFeedbackParams
} from './coaching-advisor'
import { MajsoulRoundRecord, MajsoulGameRecord } from '../parser/types'
import { ShantenCalculator } from '../shanten'

/*_ GEMINI THINKING _*/
class MockCoachingAdvisor extends CoachingAdvisor {
    public testCalculateUkeire(
        hand: readonly string[],
        visibleCounts: ReadonlyMap<string, number>,
        is3P: boolean,
        meldCount: number = 0
    ): number {
        return this.calculateUkeire(hand, visibleCounts, is3P, meldCount)
    }

    public testFindOptimalDiscard(
        hand: readonly string[],
        visibleCounts: ReadonlyMap<string, number>,
        is3P: boolean,
        safeTiles?: ReadonlySet<string>,
        meldCount: number = 0,
        doraIndicators: readonly string[] = [],
        turnNumber: number = 1,
        roundWind?: string,
        seatWind?: string
    ): OptimalDiscardResult {
        return this.findOptimalDiscard(
            hand,
            visibleCounts,
            is3P,
            safeTiles,
            meldCount,
            doraIndicators,
            turnNumber,
            roundWind,
            seatWind
        )
    }

    public testGetTileDoraValue(
        tile: string,
        doraIndicators: readonly string[],
        is3P: boolean
    ): number {
        return this.getTileDoraValue(tile, doraIndicators, is3P)
    }

    public testGetDiscardPreference(
        tile: string,
        hand: readonly string[],
        is3P: boolean,
        roundWind?: string,
        seatWind?: string,
        turnNumber: number = 1
    ): number {
        return this.getDiscardPreference(tile, hand, is3P, roundWind, seatWind, turnNumber)
    }

    public testSyncRevealedDoras(
        doras: readonly string[] | undefined,
        doraIndicators: string[],
        visibleCounts: Map<string, number>,
        seenDoraCount: number
    ): number {
        return this.syncRevealedDoras(doras, doraIndicators, visibleCounts, seenDoraCount)
    }

    public testBuildMistakeFeedback(
        categoryOrParams: MistakeCategory | MistakeFeedbackParams,
        turnNumber?: number,
        discardedTile?: string,
        optimalTile?: string,
        prevShanten?: number,
        afterShanten?: number,
        optimalUkeire?: number,
        actualUkeire?: number
    ): string {
        return this.buildMistakeFeedback(
            categoryOrParams,
            turnNumber,
            discardedTile,
            optimalTile,
            prevShanten,
            afterShanten,
            optimalUkeire,
            actualUkeire
        )
    }
}

test('MockCoachingAdvisor - calculateUkeire: 4P vs 3P mode tile acceptance', () => {
    const advisor = new MockCoachingAdvisor()
    const emptyVisible = new Map<string, number>()

    // 4P tenpai hand waiting on 1s and 4s (ryanmen wait)
    // hand: 123m 456p 789s 1z1z 23s (13 tiles)
    const ryanmenHand = [
        '1m', '2m', '3m',
        '4p', '5p', '6p',
        '7s', '8s', '9s',
        '1z', '1z',
        '2s', '3s'
    ]

    // Both 1s (4 copies) and 4s (4 copies) are live -> total 8
    const ukeire4P = advisor.testCalculateUkeire(ryanmenHand, emptyVisible, false)
    assert.strictEqual(ukeire4P, 8)

    // If 1 copy of 1s is visible on board, remaining 1s is 3 -> total 7
    const visibleWith1s = new Map<string, number>([['1s', 1]])
    const ukeireWithVisible = advisor.testCalculateUkeire(ryanmenHand, visibleWith1s, false)
    assert.strictEqual(ukeireWithVisible, 7)

    // Hand with 1m, 3m:
    // In 4P: kanchan wait on 2m is Tenpai waiting for 2m (4 copies live) -> ukeire is 4
    const kanchanHand2m = [
        '1p', '2p', '3p',
        '4p', '5p', '6p',
        '7s', '8s', '9s',
        '1z', '1z',
        '1m', '3m'
    ]
    const kanchan4P = advisor.testCalculateUkeire(kanchanHand2m, emptyVisible, false)
    assert.strictEqual(kanchan4P, 4)

    // In 3P (Sanma), tiles 2m-8m do not exist in the deck (2m has 0 copies).
    // The hand is 1-shanten, accepting 1m (3 copies live) and 1z (2 copies live) to form pairs/triplets -> 5
    const kanchan3P = advisor.testCalculateUkeire(kanchanHand2m, emptyVisible, true)
    assert.strictEqual(kanchan3P, 5)
})

test('MockCoachingAdvisor - findOptimalDiscard: detects maximum ukeire discard', () => {
    const advisor = new MockCoachingAdvisor()
    const emptyVisible = new Map<string, number>()

    // 14-tile hand:
    // 123m 456p 789s 1z1z 2s3s + isolated 9p
    // Discarding 9p leaves 0-shanten tenpai waiting on 1s/4s (ukeire = 8)
    const hand = [
        '1m', '2m', '3m',
        '4p', '5p', '6p',
        '7s', '8s', '9s',
        '1z', '1z',
        '2s', '3s',
        '9p'
    ]

    const optimal = advisor.testFindOptimalDiscard(hand, emptyVisible, false)
    assert.strictEqual(optimal.tile, '9p')
    assert.strictEqual(optimal.shanten, 0)
    assert.strictEqual(optimal.ukeire, 8)
})

test('MockCoachingAdvisor - findOptimalDiscard: defensive folding prioritizes Genbutsu safe tile', () => {
    const advisor = new MockCoachingAdvisor()
    const emptyVisible = new Map<string, number>()

    // 14-tile hand with 1-shanten:
    // 123m 456p 1z (safe genbutsu) 2s3s (ryanmen) 7s9s (kanchan) + 9m (isolated)
    const hand = [
        '1m', '2m', '3m',
        '4p', '5p', '6p',
        '1z',
        '2s', '3s',
        '7s', '9s',
        '9m'
    ]

    const safeTiles = new Set<string>(['1z'])
    const optimal = advisor.testFindOptimalDiscard(hand, emptyVisible, false, safeTiles)
    assert.strictEqual(optimal.tile, '1z')
})

test('MockCoachingAdvisor - buildMistakeFeedback: formats feedback for all 4 categories', () => {
    const advisor = new MockCoachingAdvisor()

    const retreatMsg = advisor.testBuildMistakeFeedback({
        category: 'SHANTEN_RETREAT',
        turnNumber: 3,
        discardedTile: '2s',
        optimalTile: '9p',
        prevShanten: 0,
        afterShanten: 1,
        optimalUkeire: 8,
        actualUkeire: 4
    })
    assert.ok(retreatMsg.includes('후퇴했습니다'))
    assert.ok(retreatMsg.includes('[2s]'))
    assert.ok(retreatMsg.includes('[9p]'))

    const ukeireMsg = advisor.testBuildMistakeFeedback({
        category: 'UKEIRE_LOSS',
        turnNumber: 5,
        discardedTile: '2s',
        optimalTile: '9s',
        prevShanten: 1,
        afterShanten: 1,
        optimalUkeire: 12,
        actualUkeire: 4
    })
    assert.ok(ukeireMsg.includes('유효패'))
    assert.ok(ukeireMsg.includes('8장 더 넓었습니다'))

    const dealInMsg = advisor.testBuildMistakeFeedback({
        category: 'RECKLESS_PUSH_DEAL_IN',
        turnNumber: 10,
        discardedTile: '5p',
        optimalTile: '1z',
        prevShanten: 1,
        afterShanten: 1,
        optimalUkeire: 4,
        actualUkeire: 4
    })
    assert.ok(dealInMsg.includes('방총되었습니다'))
    assert.ok(dealInMsg.includes('수비(베타오리)'))

    const musujiMsg = advisor.testBuildMistakeFeedback({
        category: 'DANGEROUS_MUSUJI_PUSH',
        turnNumber: 8,
        discardedTile: '5s',
        optimalTile: '1z',
        prevShanten: 2,
        afterShanten: 2,
        optimalUkeire: 6,
        actualUkeire: 6
    })
    assert.ok(musujiMsg.includes('위험한 무스지'))
    assert.ok(musujiMsg.includes('안전패 [1z]'))
})

test('CoachingAdvisor - analyzeRound: SHANTEN_RETREAT detection when player breaks ready tenpai', () => {
    const advisor = new CoachingAdvisor()

    const roundRecord: MajsoulRoundRecord = {
        header: {
            type: 'RecordNewRound',
            chang: 0,
            ju: 0,
            ben: 0,
            liqi: 0,
            scores: [25000, 25000, 25000, 25000],
            dora: '1z',
            hands: [
                ['1m', '2m', '3m', '4p', '5p', '6p', '7s', '8s', '9s', '1z', '1z', '2s', '3s'],
                ['1p', '2p', '3p', '4p', '5p', '6p', '7p', '8p', '9p', '1s', '2s', '3s', '4s'],
                ['1p', '2p', '3p', '4p', '5p', '6p', '7p', '8p', '9p', '1s', '2s', '3s', '4s'],
                ['1p', '2p', '3p', '4p', '5p', '6p', '7p', '8p', '9p', '1s', '2s', '3s', '4s']
            ]
        },
        actions: [
            // Seat 0 draws 9p (now has 14 tiles, 0-shanten tenpai)
            { type: 'RecordDealTile', seat: 0, tile: '9p' },
            // Seat 0 mistakenly discards 2s (breaks ryanmen wait, turns hand into 1-shanten)
            { type: 'RecordDiscardTile', seat: 0, tile: '2s', isMoqie: false, isLiqi: false },
            { type: 'RecordNoTile', tenpaiSeats: [], deltaScores: [0, 0, 0, 0] }
        ]
    }

    const mistakes = advisor.analyzeRound(roundRecord, 0, 0, false)
    assert.strictEqual(mistakes.length, 1)

    const mistake = mistakes[0]
    assert.ok(mistake)
    assert.strictEqual(mistake.mistakeCategory, 'SHANTEN_RETREAT')
    assert.strictEqual(mistake.discardedTile, '2s')
    assert.strictEqual(mistake.optimalTile, '9p')
    assert.strictEqual(mistake.prevShanten, 0)
    assert.strictEqual(mistake.afterShanten, 1)
    assert.strictEqual(mistake.severityScore, 75)
})

test('CoachingAdvisor - analyzeRound: UKEIRE_LOSS detection on suboptimal taatsu discard', () => {
    const advisor = new CoachingAdvisor()

    // 13-tile hand with 2 taatsus:
    // 123p 456p 1z1z (pair) 2s3s (ryanmen) 7m9m (kanchan) + 9s (isolated)
    // Draw 8s: hand has 14 tiles.
    // Optimal: discard 9s (leaves 2s3s and 7m9m, wide ukeire)
    // Mistake: discard 2s (breaks ryanmen, leaving only kanchan, massive ukeire loss)
    const roundRecord: MajsoulRoundRecord = {
        header: {
            type: 'RecordNewRound',
            chang: 0,
            ju: 0,
            ben: 0,
            liqi: 0,
            scores: [25000, 25000, 25000, 25000],
            dora: '5z',
            hands: [
                ['1p', '2p', '3p', '4p', '5p', '6p', '1z', '1z', '2s', '3s', '7m', '9m', '9s'],
                ['1p', '2p', '3p', '4p', '5p', '6p', '7p', '8p', '9p', '1s', '2s', '3s', '4s'],
                ['1p', '2p', '3p', '4p', '5p', '6p', '7p', '8p', '9p', '1s', '2s', '3s', '4s'],
                ['1p', '2p', '3p', '4p', '5p', '6p', '7p', '8p', '9p', '1s', '2s', '3s', '4s']
            ]
        },
        actions: [
            { type: 'RecordDealTile', seat: 0, tile: '1z' },
            { type: 'RecordDiscardTile', seat: 0, tile: '2s', isMoqie: false, isLiqi: false },
            { type: 'RecordNoTile', tenpaiSeats: [], deltaScores: [0, 0, 0, 0] }
        ]
    }

    const mistakes = advisor.analyzeRound(roundRecord, 0, 0, false)
    assert.strictEqual(mistakes.length, 1)

    const mistake = mistakes[0]
    assert.ok(mistake)
    assert.strictEqual(mistake.mistakeCategory, 'UKEIRE_LOSS')
    assert.strictEqual(mistake.discardedTile, '2s')
    assert.ok(mistake.optimalUkeire - mistake.actualUkeire >= 4)
})

test('CoachingAdvisor - analyzeRound: Post-Riichi RECKLESS_PUSH_DEAL_IN scenario', () => {
    const advisor = new CoachingAdvisor()

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
                // Seat 0 starting hand has Genbutsu 1z and dangerous musuji 5p (1-shanten: 123m 456m 789m 1s 4s 1z 5p)
                ['1m', '2m', '3m', '4m', '5m', '6m', '7m', '8m', '9m', '1s', '4s', '1z', '5p'],
                ['1p', '2p', '3p', '4p', '5p', '6p', '7p', '8p', '9p', '1s', '2s', '3s', '4s'],
                ['1p', '2p', '3p', '4p', '5p', '6p', '7p', '8p', '9p', '1s', '2s', '3s', '4s'],
                ['1p', '2p', '3p', '4p', '5p', '6p', '7p', '8p', '9p', '1s', '2s', '3s', '4s']
            ]
        },
        actions: [
            // Seat 1 discards 1z in round
            { type: 'RecordDealTile', seat: 1, tile: '1z' },
            { type: 'RecordDiscardTile', seat: 1, tile: '1z', isMoqie: false, isLiqi: false },

            // Seat 1 declares Riichi
            { type: 'RecordDealTile', seat: 1, tile: '4m' },
            { type: 'RecordDiscardTile', seat: 1, tile: '4m', isMoqie: false, isLiqi: true },

            // Seat 0 draws 3s, has Genbutsu 1z, but pushes dangerous musuji 5p
            { type: 'RecordDealTile', seat: 0, tile: '3s' },
            { type: 'RecordDiscardTile', seat: 0, tile: '5p', isMoqie: false, isLiqi: false },

            // Seat 1 Rons Seat 0 for 8000 points
            {
                type: 'RecordHule',
                hules: [
                    {
                        seat: 1,
                        deltaScores: [-8000, 8000, 0, 0],
                        handScore: 8000,
                        fan: 4,
                        fu: 30,
                        yaku: ['Riichi', 'Dora 3']
                    }
                ]
            }
        ]
    }

    const mistakes = advisor.analyzeRound(roundRecord, 0, 0, false)
    assert.strictEqual(mistakes.length, 1)

    const mistake = mistakes[0]
    assert.ok(mistake)
    assert.strictEqual(mistake.mistakeCategory, 'RECKLESS_PUSH_DEAL_IN')
    assert.strictEqual(mistake.discardedTile, '5p')
    assert.strictEqual(mistake.optimalTile, '1z')
    assert.ok(mistake.severityScore >= 85)
})

test('CoachingAdvisor - analyzeRound: Post-Riichi DANGEROUS_MUSUJI_PUSH without deal-in', () => {
    const advisor = new CoachingAdvisor()

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
                ['1m', '2m', '3m', '4m', '5m', '6m', '7m', '8m', '9m', '1s', '2s', '1z', '5s'],
                ['1p', '2p', '3p', '4p', '5p', '6p', '7p', '8p', '9p', '1s', '2s', '3s', '4s'],
                ['1p', '2p', '3p', '4p', '5p', '6p', '7p', '8p', '9p', '1s', '2s', '3s', '4s'],
                ['1p', '2p', '3p', '4p', '5p', '6p', '7p', '8p', '9p', '1s', '2s', '3s', '4s']
            ]
        },
        actions: [
            // Seat 2 discards 1z
            { type: 'RecordDealTile', seat: 2, tile: '1z' },
            { type: 'RecordDiscardTile', seat: 2, tile: '1z', isMoqie: false, isLiqi: false },

            // Seat 1 declares Riichi and discards 2z
            { type: 'RecordDealTile', seat: 1, tile: '2z' },
            { type: 'RecordDiscardTile', seat: 1, tile: '2z', isMoqie: false, isLiqi: true },

            // Seat 3 awase-uchi discards 1z (now 1z is post-riichi awase-uchi genbutsu)
            { type: 'RecordDealTile', seat: 3, tile: '1z' },
            { type: 'RecordDiscardTile', seat: 3, tile: '1z', isMoqie: false, isLiqi: false },

            // Seat 0 draws 9m. Holds safe tile 1z. Pushes unpassed musuji 5s.
            { type: 'RecordDealTile', seat: 0, tile: '9m' },
            { type: 'RecordDiscardTile', seat: 0, tile: '5s', isMoqie: false, isLiqi: false },

            { type: 'RecordNoTile', tenpaiSeats: [1], deltaScores: [-1000, 3000, -1000, -1000] }
        ]
    }

    const mistakes = advisor.analyzeRound(roundRecord, 0, 0, false)
    assert.strictEqual(mistakes.length, 1)

    const mistake = mistakes[0]
    assert.ok(mistake)
    assert.strictEqual(mistake.mistakeCategory, 'DANGEROUS_MUSUJI_PUSH')
    assert.strictEqual(mistake.discardedTile, '5s')
    assert.strictEqual(mistake.optimalTile, '1z')
    assert.ok(mistake.severityScore >= 70)
})

test('CoachingAdvisor - analyzeRound: 3P RecordBaBei removes 4z and maintains valid hand tracking', () => {
    const advisor = new CoachingAdvisor()

    const roundRecord: MajsoulRoundRecord = {
        header: {
            type: 'RecordNewRound',
            chang: 0,
            ju: 0,
            ben: 0,
            liqi: 0,
            scores: [35000, 35000, 35000, 0],
            dora: '1p',
            hands: [
                ['1p', '2p', '3p', '4p', '5p', '6p', '7s', '8s', '9s', '1z', '1z', '2s', '4z'],
                ['1p', '2p', '3p', '4p', '5p', '6p', '7s', '8s', '9s', '1z', '1z', '2s', '3s'],
                ['1p', '2p', '3p', '4p', '5p', '6p', '7s', '8s', '9s', '1z', '1z', '2s', '3s'],
                []
            ]
        },
        actions: [
            // Seat 0 calls Kita (RecordBaBei) removing 4z from hand
            { type: 'RecordBaBei', seat: 0, isMoqie: false },
            // Seat 0 draws replacement tile 3s
            { type: 'RecordDealTile', seat: 0, tile: '3s' },
            // Seat 0 discards 1z
            { type: 'RecordDiscardTile', seat: 0, tile: '1z', isMoqie: false, isLiqi: false },
            { type: 'RecordNoTile', tenpaiSeats: [0], deltaScores: [2000, -1000, -1000, 0] }
        ]
    }

    const mistakes = advisor.analyzeRound(roundRecord, 0, 0, true)
    assert.ok(Array.isArray(mistakes))
})

test('CoachingAdvisor - analyzeGame: generates GameCoachingReport capping top 3 mistakes', () => {
    const advisor = new CoachingAdvisor()

    const sampleGame: MajsoulGameRecord = {
        uuid: 'game_test_coaching_report_123',
        roomType: '사인가와전',
        timestamp: 1718000000,
        players: [
            { accountId: 1001, nickname: 'Alice', seat: 0, level: 1 },
            { accountId: 1002, nickname: 'Bob', seat: 1, level: 1 },
            { accountId: 1003, nickname: 'Charlie', seat: 2, level: 1 },
            { accountId: 1004, nickname: 'Dave', seat: 3, level: 1 }
        ],
        rounds: [
            // Round 1: SHANTEN_RETREAT
            {
                header: {
                    type: 'RecordNewRound',
                    chang: 0,
                    ju: 0,
                    ben: 0,
                    liqi: 0,
                    scores: [25000, 25000, 25000, 25000],
                    dora: '1z',
                    hands: [
                        ['1m', '2m', '3m', '4p', '5p', '6p', '7s', '8s', '9s', '1z', '1z', '2s', '3s'],
                        ['1p', '2p', '3p', '4p', '5p', '6p', '7p', '8p', '9p', '1s', '2s', '3s', '4s'],
                        ['1p', '2p', '3p', '4p', '5p', '6p', '7p', '8p', '9p', '1s', '2s', '3s', '4s'],
                        ['1p', '2p', '3p', '4p', '5p', '6p', '7p', '8p', '9p', '1s', '2s', '3s', '4s']
                    ]
                },
                actions: [
                    { type: 'RecordDealTile', seat: 0, tile: '9p' },
                    { type: 'RecordDiscardTile', seat: 0, tile: '2s', isMoqie: false, isLiqi: false },
                    { type: 'RecordNoTile', tenpaiSeats: [], deltaScores: [0, 0, 0, 0] }
                ]
            },
            // Round 2: RECKLESS_PUSH_DEAL_IN
            {
                header: {
                    type: 'RecordNewRound',
                    chang: 0,
                    ju: 1,
                    ben: 0,
                    liqi: 0,
                    scores: [25000, 25000, 25000, 25000],
                    dora: '9m',
                    hands: [
                        ['1m', '2m', '3m', '4m', '5m', '6m', '7m', '8m', '9m', '1s', '4s', '1z', '5p'],
                        ['1p', '2p', '3p', '4p', '5p', '6p', '7p', '8p', '9p', '1s', '2s', '3s', '4s'],
                        ['1p', '2p', '3p', '4p', '5p', '6p', '7p', '8p', '9p', '1s', '2s', '3s', '4s'],
                        ['1p', '2p', '3p', '4p', '5p', '6p', '7p', '8p', '9p', '1s', '2s', '3s', '4s']
                    ]
                },
                actions: [
                    { type: 'RecordDealTile', seat: 1, tile: '1z' },
                    { type: 'RecordDiscardTile', seat: 1, tile: '1z', isMoqie: false, isLiqi: false },
                    { type: 'RecordDealTile', seat: 1, tile: '4m' },
                    { type: 'RecordDiscardTile', seat: 1, tile: '4m', isMoqie: false, isLiqi: true },
                    { type: 'RecordDealTile', seat: 0, tile: '3s' },
                    { type: 'RecordDiscardTile', seat: 0, tile: '5p', isMoqie: false, isLiqi: false },
                    {
                        type: 'RecordHule',
                        hules: [
                            {
                                seat: 1,
                                deltaScores: [-8000, 8000, 0, 0],
                                handScore: 8000,
                                fan: 4,
                                fu: 30,
                                yaku: ['Riichi', 'Dora 3']
                            }
                        ]
                    }
                ]
            }
        ]
    }

    const report = advisor.analyzeGame(sampleGame, 0, false)
    assert.strictEqual(report.gameId, 'game_test_coaching_report_123')
    assert.strictEqual(report.targetSeat, 0)
    assert.strictEqual(report.is3P, false)
    assert.ok(report.criticalMistakes.length <= 3)
    assert.ok(report.criticalMistakes.length >= 2)

    // Sorted by severityScore descending
    let sortIdx = 0
    while (sortIdx < report.criticalMistakes.length - 1) {
        const m1 = report.criticalMistakes[sortIdx]
        const m2 = report.criticalMistakes[sortIdx + 1]
        if (m1 && m2) {
            assert.ok(m1.severityScore >= m2.severityScore)
        }
        sortIdx++
    }

    // Top mistake should be RECKLESS_PUSH_DEAL_IN (highest severity)
    assert.strictEqual(report.criticalMistakes[0]?.mistakeCategory, 'RECKLESS_PUSH_DEAL_IN')

    assert.ok(report.overallSummaryKo.length > 0)
    assert.ok(report.actionableAdviceKo.length > 0)
    assert.ok(report.actionableAdviceKo.some((a) => a.includes('현물') || a.includes('방총')))
})

test('CoachingAdvisor - analyzeRound: open melds shanten and ukeire accuracy without +2 inflation', () => {
    const advisor = new CoachingAdvisor()
    const calc = new ShantenCalculator()

    // 10-tile hand with 1 open meld (e.g. called chi on 123m)
    // hand: 456p 789s 11z 23s (waiting on 1s/4s)
    const tenpai1MeldHand = [
        '4p', '5p', '6p',
        '7s', '8s', '9s',
        '1z', '1z',
        '2s', '3s'
    ]
    // With meldCount = 1, shanten must be 0 (tenpai), NOT inflated to 2
    assert.strictEqual(calc.calculate(tenpai1MeldHand, false, 1), 0)

    // Analyze a round where targetSeat (0) calls Chi with red five 0p
    // Starting hand: 123m 4p 0p 789s 11z 23s 9m (13 tiles)
    // Seat 3 discards 6p -> Seat 0 calls Chi on 6p with 4p and 0p
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
                ['1m', '2m', '3m', '4p', '0p', '7s', '8s', '9s', '1z', '1z', '2s', '3s', '9m'],
                ['1p', '2p', '3p', '4p', '5p', '6p', '7p', '8p', '9p', '1s', '2s', '3s', '4s'],
                ['1p', '2p', '3p', '4p', '5p', '6p', '7p', '8p', '9p', '1s', '2s', '3s', '4s'],
                ['1p', '2p', '3p', '4p', '5p', '6p', '7p', '8p', '9p', '1s', '2s', '3s', '4s']
            ]
        },
        actions: [
            // Opponent Seat 1 declares Riichi
            { type: 'RecordDealTile', seat: 1, tile: '1z' },
            { type: 'RecordDiscardTile', seat: 1, tile: '1z', isMoqie: false, isLiqi: true },

            // Seat 3 discards 6p
            { type: 'RecordDealTile', seat: 3, tile: '6p' },
            { type: 'RecordDiscardTile', seat: 3, tile: '6p', isMoqie: false, isLiqi: false },

            // Seat 0 calls Chi with 4p, 0p
            { type: 'RecordChiPengGang', seat: 0, meldType: 'chi', tiles: ['4p', '0p', '6p'], fromSeat: 3 },

            // Seat 0 discards 9m (now 10-tile hand: 123m 789s 11z 23s, 0-shanten Tenpai!)
            { type: 'RecordDiscardTile', seat: 0, tile: '9m', isMoqie: false, isLiqi: false },

            // Seat 2 discards 2z
            { type: 'RecordDealTile', seat: 2, tile: '2z' },
            { type: 'RecordDiscardTile', seat: 2, tile: '2z', isMoqie: false, isLiqi: false },

            // Seat 3 discards 2z
            { type: 'RecordDealTile', seat: 3, tile: '2z' },
            { type: 'RecordDiscardTile', seat: 3, tile: '2z', isMoqie: false, isLiqi: false },

            // Seat 0 draws 5m (musuji against Seat 1).
            // Seat 0 is in Tenpai (0-shanten). Pushing 5m should NOT trigger DANGEROUS_MUSUJI_PUSH
            // because prevShanten is 0!
            { type: 'RecordDealTile', seat: 0, tile: '5m' },
            { type: 'RecordDiscardTile', seat: 0, tile: '5m', isMoqie: false, isLiqi: false },

            { type: 'RecordNoTile', tenpaiSeats: [0, 1], deltaScores: [1500, 1500, -1500, -1500] }
        ]
    }

    const mistakes = advisor.analyzeRound(roundRecord, 0, 0, false)
    // Tenpai push must not be flagged as DANGEROUS_MUSUJI_PUSH
    const musujiMistakes = mistakes.filter((m) => m.mistakeCategory === 'DANGEROUS_MUSUJI_PUSH')
    assert.strictEqual(musujiMistakes.length, 0)
})

test('CoachingAdvisor - analyzeRound: post-Riichi mandatory tsumogiri and Damaten deal-in non-penalty', () => {
    const advisor = new CoachingAdvisor()

    // Scenario A: Target player declares Riichi, then is forced to tsumogiri and deals in
    const riichiTsumogiriRound: MajsoulRoundRecord = {
        header: {
            type: 'RecordNewRound',
            chang: 0,
            ju: 0,
            ben: 0,
            liqi: 0,
            scores: [25000, 25000, 25000, 25000],
            dora: '9m',
            hands: [
                ['1m', '2m', '3m', '4m', '5m', '6m', '7m', '8m', '9m', '1s', '2s', '1z', '1z'],
                ['1p', '2p', '3p', '4p', '5p', '6p', '7p', '8p', '9p', '1s', '2s', '3s', '4s'],
                ['1p', '2p', '3p', '4p', '5p', '6p', '7p', '8p', '9p', '1s', '2s', '3s', '4s'],
                ['1p', '2p', '3p', '4p', '5p', '6p', '7p', '8p', '9p', '1s', '2s', '3s', '4s']
            ]
        },
        actions: [
            // Opponent 1 declares Riichi
            { type: 'RecordDealTile', seat: 1, tile: '9p' },
            { type: 'RecordDiscardTile', seat: 1, tile: '9p', isMoqie: false, isLiqi: true },

            // Seat 0 draws 3s, enters Tenpai and declares Riichi discarding 1z
            { type: 'RecordDealTile', seat: 0, tile: '3s' },
            { type: 'RecordDiscardTile', seat: 0, tile: '1z', isMoqie: false, isLiqi: true },

            // Seat 2 discards 8p
            { type: 'RecordDealTile', seat: 2, tile: '8p' },
            { type: 'RecordDiscardTile', seat: 2, tile: '8p', isMoqie: false, isLiqi: false },

            // Seat 3 discards 8p
            { type: 'RecordDealTile', seat: 3, tile: '8p' },
            { type: 'RecordDiscardTile', seat: 3, tile: '8p', isMoqie: false, isLiqi: false },

            // Opponent 1 draws and discards 8p
            { type: 'RecordDealTile', seat: 1, tile: '8p' },
            { type: 'RecordDiscardTile', seat: 1, tile: '8p', isMoqie: true, isLiqi: false },

            // Seat 0 draws dangerous 5p, must tsumogiri under Riichi rules
            { type: 'RecordDealTile', seat: 0, tile: '5p' },
            { type: 'RecordDiscardTile', seat: 0, tile: '5p', isMoqie: true, isLiqi: false },

            // Seat 1 rons Seat 0 on 5p
            {
                type: 'RecordHule',
                hules: [
                    {
                        seat: 1,
                        deltaScores: [-8000, 8000, 0, 0],
                        handScore: 8000,
                        fan: 4,
                        fu: 30,
                        yaku: ['Riichi', 'Dora 3']
                    }
                ]
            }
        ]
    }

    const mistakesA = advisor.analyzeRound(riichiTsumogiriRound, 0, 0, false)
    assert.strictEqual(mistakesA.length, 0)

    // Scenario B: Opponent deals in via Damaten (no Riichi declared)
    const damatenRound: MajsoulRoundRecord = {
        header: {
            type: 'RecordNewRound',
            chang: 0,
            ju: 0,
            ben: 0,
            liqi: 0,
            scores: [25000, 25000, 25000, 25000],
            dora: '9m',
            hands: [
                ['1m', '2m', '3m', '4m', '5m', '6m', '7m', '8m', '9m', '1s', '4s', '1z', '5p'],
                ['1p', '2p', '3p', '4p', '5p', '6p', '7p', '8p', '9p', '1s', '2s', '3s', '4s'],
                ['1p', '2p', '3p', '4p', '5p', '6p', '7p', '8p', '9p', '1s', '2s', '3s', '4s'],
                ['1p', '2p', '3p', '4p', '5p', '6p', '7p', '8p', '9p', '1s', '2s', '3s', '4s']
            ]
        },
        actions: [
            // No one declared Riichi
            { type: 'RecordDealTile', seat: 0, tile: '3s' },
            { type: 'RecordDiscardTile', seat: 0, tile: '5p', isMoqie: false, isLiqi: false },
            {
                type: 'RecordHule',
                hules: [
                    {
                        seat: 1,
                        deltaScores: [-8000, 8000, 0, 0],
                        handScore: 8000,
                        fan: 4,
                        fu: 30,
                        yaku: ['Tanyao', 'Dora 3']
                    }
                ]
            }
        ]
    }

    const mistakesB = advisor.analyzeRound(damatenRound, 0, 0, false)
    const recklessB = mistakesB.filter((m) => m.mistakeCategory === 'RECKLESS_PUSH_DEAL_IN')
    assert.strictEqual(recklessB.length, 0)
})

test('CoachingAdvisor - analyzeRound: defensive optimalUkeire consistency with chosenOptimalTile', () => {
    const advisor = new CoachingAdvisor()

    // 1-shanten hand with safe tile 1z and dangerous musuji 9s
    // Opponent Seat 1 declared Riichi and discarded 1z
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
                ['1m', '2m', '3m', '4m', '5m', '6m', '7m', '8m', '9m', '1s', '4s', '1z', '9s'],
                ['1p', '2p', '3p', '4p', '5p', '6p', '7p', '8p', '9p', '1s', '2s', '3s', '4s'],
                ['1p', '2p', '3p', '4p', '5p', '6p', '7p', '8p', '9p', '1s', '2s', '3s', '4s'],
                ['1p', '2p', '3p', '4p', '5p', '6p', '7p', '8p', '9p', '1s', '2s', '3s', '4s']
            ]
        },
        actions: [
            { type: 'RecordDealTile', seat: 1, tile: '1z' },
            { type: 'RecordDiscardTile', seat: 1, tile: '1z', isMoqie: false, isLiqi: false },
            { type: 'RecordDealTile', seat: 1, tile: '4m' },
            { type: 'RecordDiscardTile', seat: 1, tile: '4m', isMoqie: false, isLiqi: true },

            { type: 'RecordDealTile', seat: 0, tile: '3s' },
            { type: 'RecordDiscardTile', seat: 0, tile: '9s', isMoqie: false, isLiqi: false },

            {
                type: 'RecordHule',
                hules: [
                    {
                        seat: 1,
                        deltaScores: [-8000, 8000, 0, 0],
                        handScore: 8000,
                        fan: 4,
                        fu: 30,
                        yaku: ['Riichi', 'Dora 3']
                    }
                ]
            }
        ]
    }

    const mistakes = advisor.analyzeRound(roundRecord, 0, 0, false)
    assert.strictEqual(mistakes.length, 1)

    const mistake = mistakes[0]
    assert.ok(mistake)
    assert.strictEqual(mistake.mistakeCategory, 'RECKLESS_PUSH_DEAL_IN')
    assert.strictEqual(mistake.optimalTile, '1z')

    // Mock advisor to check ukeire of 1z discard
    const mockAdvisor = new MockCoachingAdvisor()
    const emptyVisible = new Map<string, number>([['1z', 1], ['4m', 1]])
    // Hand after discarding 1z: ['1m', '2m', '3m', '4m', '5m', '6m', '7m', '8m', '9m', '1s', '4s', '9s', '3s']
    const handAfter1z = ['1m', '2m', '3m', '4m', '5m', '6m', '7m', '8m', '9m', '1s', '4s', '9s', '3s']
    const expectedUkeire1z = mockAdvisor.testCalculateUkeire(handAfter1z, emptyVisible, false, 0)

    assert.strictEqual(mistake.optimalUkeire, expectedUkeire1z)
})

test('MockCoachingAdvisor - findOptimalDiscard: red dora preservation (0p vs 5p)', () => {
    const advisor = new MockCoachingAdvisor()
    const emptyVisible = new Map<string, number>()

    // Hand: 123m 456m 789m 11z 4p 0p 5p
    // Removing 5p leaves: 123m 456m 789m 11z 4p 0p (tenpai waiting on 3p, 6p with red dora 0p)
    // Removing 0p leaves: 123m 456m 789m 11z 4p 5p (tenpai waiting on 3p, 6p without red dora)
    // Both 5p and 0p give shanten = 0, ukeire = 8.
    // 0p is red dora (doraValue = 1), 5p is normal (doraValue = 0).
    // advisor must choose 5p to preserve red dora 0p, even if 0p is placed first in array.
    const handWithRedDoraFirst = [
        '1m', '2m', '3m',
        '4m', '5m', '6m',
        '7m', '8m', '9m',
        '1z', '1z',
        '0p', '5p', '4p'
    ]

    const optimal = advisor.testFindOptimalDiscard(handWithRedDoraFirst, emptyVisible, false)
    assert.strictEqual(optimal.tile, '5p')
    assert.strictEqual(optimal.shanten, 0)
    assert.strictEqual(optimal.ukeire, 8)
})

test('MockCoachingAdvisor - findOptimalDiscard: regular dora indicator preservation', () => {
    const advisor = new MockCoachingAdvisor()
    const emptyVisible = new Map<string, number>()

    // Hand: 123m 456m 789s 111z + isolated 2p (dora, indicator 1p) + isolated 3s (non-dora)
    // Discarding 2p leaves tenpai waiting on 3s (tanki, ukeire = 3).
    // Discarding 3s leaves tenpai waiting on 2p (tanki, ukeire = 3).
    // Indicator is 1p -> 2p is dora (doraValue = 1). 3s is non-dora (doraValue = 0).
    // advisor must choose non-dora 3s to preserve dora 2p.
    const hand = [
        '1m', '2m', '3m',
        '4m', '5m', '6m',
        '7s', '8s', '9s',
        '1z', '1z', '1z',
        '2p', '3s'
    ]

    const optimal = advisor.testFindOptimalDiscard(
        hand,
        emptyVisible,
        false,
        undefined,
        0,
        ['1p']
    )
    assert.strictEqual(optimal.tile, '3s')
})

test('MockCoachingAdvisor - findOptimalDiscard: double dora preservation (red + indicator dora)', () => {
    const advisor = new MockCoachingAdvisor()
    const emptyVisible = new Map<string, number>()

    // Indicator is 4s -> 5s is dora.
    // Hand has 0s (red 5s: 1 red + 1 indicator = 2 doras) and 5s (1 indicator dora = 1 dora).
    // Hand: 123m 456m 789m 11z 4s 0s 5s
    // Both 0s and 5s have same shanten & ukeire.
    // 5s has 1 dora, 0s has 2 doras.
    // advisor must discard 5s, preserving double dora 0s.
    const hand = [
        '1m', '2m', '3m',
        '4m', '5m', '6m',
        '7m', '8m', '9m',
        '1z', '1z',
        '4s', '0s', '5s'
    ]

    const optimal = advisor.testFindOptimalDiscard(
        hand,
        emptyVisible,
        false,
        undefined,
        0,
        ['4s']
    )
    assert.strictEqual(optimal.tile, '5s')
})

test('MockCoachingAdvisor - findOptimalDiscard: early-game isolated guest wind vs middle tile heuristic', () => {
    const advisor = new MockCoachingAdvisor()
    const emptyVisible = new Map<string, number>()

    // Hand: 123m 456m 789p 111s (4 blocks) + isolated 3z (West wind) + isolated 5s (middle tile)
    // In East round, seat 0 (East): 3z is guest wind (otakaze).
    // Discarding 3z leaves tenpai tanki on 5s (ukeire = 3).
    // Discarding 5s leaves tenpai tanki on 3z (ukeire = 3).
    // advisor must discard isolated guest wind 3z and keep middle tile 5s.
    const hand = [
        '1m', '2m', '3m',
        '4m', '5m', '6m',
        '7p', '8p', '9p',
        '1s', '1s', '1s',
        '3z', '5s'
    ]

    const optimal = advisor.testFindOptimalDiscard(
        hand,
        emptyVisible,
        false,
        undefined,
        0,
        [],
        1,
        '1z',
        '1z'
    )
    assert.strictEqual(optimal.tile, '3z')
})

test('MockCoachingAdvisor - findOptimalDiscard: isolated terminal (1/9) vs middle tile heuristic', () => {
    const advisor = new MockCoachingAdvisor()
    const emptyVisible = new Map<string, number>()

    // Hand: 123m 456m 789p 111s + isolated 9m (terminal) + isolated 4s (middle tile)
    // Discarding 9m leaves tenpai tanki on 4s (ukeire = 3).
    // Discarding 4s leaves tenpai tanki on 9m (ukeire = 3).
    // advisor must discard terminal 9m and keep middle tile 4s.
    const hand = [
        '1m', '2m', '3m',
        '4m', '5m', '6m',
        '7p', '8p', '9p',
        '1s', '1s', '1s',
        '9m', '4s'
    ]

    const optimal = advisor.testFindOptimalDiscard(hand, emptyVisible, false)
    assert.strictEqual(optimal.tile, '9m')
})

test('MockCoachingAdvisor - findOptimalDiscard: isolated guest wind vs isolated dragon heuristic', () => {
    const advisor = new MockCoachingAdvisor()
    const emptyVisible = new Map<string, number>()

    // Hand: 123m 456m 789p 111s + isolated 2z (South, guest in East round) + isolated 7z (Chun dragon)
    // Discarding 2z leaves tenpai tanki on 7z.
    // Discarding 7z leaves tenpai tanki on 2z.
    // In East round with East seat: 2z is guest wind (preference 100), 7z is dragon (preference 90).
    // advisor must discard guest wind 2z before dragon 7z.
    const hand = [
        '1m', '2m', '3m',
        '4m', '5m', '6m',
        '7p', '8p', '9p',
        '1s', '1s', '1s',
        '2z', '7z'
    ]

    const optimal = advisor.testFindOptimalDiscard(
        hand,
        emptyVisible,
        false,
        undefined,
        0,
        [],
        2,
        '1z',
        '1z'
    )
    assert.strictEqual(optimal.tile, '2z')
})

test('MockCoachingAdvisor - findOptimalDiscard: 3P (Sanma) dora indicator 1m preserves 9m dora', () => {
    const advisor = new MockCoachingAdvisor()
    const emptyVisible = new Map<string, number>()

    // 3P mode: indicator 1m makes 9m dora.
    // Hand has 9m (dora) and 1s (non-dora).
    // Both give same shanten & ukeire.
    // advisor must choose non-dora 1s and preserve 9m dora.
    const hand = [
        '1p', '2p', '3p',
        '4p', '5p', '6p',
        '7s', '8s', '9s',
        '1z', '1z', '1z',
        '9m', '1s'
    ]

    const optimal = advisor.testFindOptimalDiscard(
        hand,
        emptyVisible,
        true,
        undefined,
        0,
        ['1m']
    )
    assert.strictEqual(optimal.tile, '1s')
})

test('MockCoachingAdvisor - getDiscardPreference: hierarchy verification', () => {
    const advisor = new MockCoachingAdvisor()
    const hand = ['1z', '5z', '1m', '2m', '5m', '9p', '5s', '5s']

    // Isolated guest wind (1z with roundWind='2z', seatWind='3z') -> 100 in early game
    const guestWindPref = advisor.testGetDiscardPreference('1z', hand, false, '2z', '3z', 1)
    // Isolated dragon (5z) -> 92 in early game
    const dragonPref = advisor.testGetDiscardPreference('5z', hand, false, '2z', '3z', 1)
    // Isolated terminal (9p) -> 84 in early game
    const terminalPref = advisor.testGetDiscardPreference('9p', hand, false, '2z', '3z', 1)
    // 5s is part of pair -> lower preference
    const pairPref = advisor.testGetDiscardPreference('5s', hand, false, '2z', '3z', 1)

    assert.ok(guestWindPref > dragonPref)
    assert.ok(dragonPref > terminalPref)
    assert.ok(terminalPref > pairPref)
})

test('CoachingAdvisor - analyzeRound: optimal discard correctly prioritizes non-dora in full round', () => {
    const advisor = new CoachingAdvisor()

    // Round where dora is 1m (dora is 2m).
    // Seat 0 holds 123p 456p 789s 111z (4 completed sets) + 2m (dora) + 3s (non-dora).
    // Both 2m and 3s yield 0-shanten tenpai tanki with ukeire = 3.
    // Seat 0 discards non-dora 3s.
    // Discarding 3s was the optimal choice preserving dora 2m, so no mistake flagged.
    const roundRecord: MajsoulRoundRecord = {
        header: {
            type: 'RecordNewRound',
            chang: 0,
            ju: 0,
            ben: 0,
            liqi: 0,
            scores: [25000, 25000, 25000, 25000],
            dora: '1m',
            hands: [
                ['1p', '2p', '3p', '4p', '5p', '6p', '7s', '8s', '9s', '1z', '1z', '1z', '2m'],
                ['1p', '2p', '3p', '4p', '5p', '6p', '7p', '8p', '9p', '1s', '2s', '3s', '4s'],
                ['1p', '2p', '3p', '4p', '5p', '6p', '7p', '8p', '9p', '1s', '2s', '3s', '4s'],
                ['1p', '2p', '3p', '4p', '5p', '6p', '7p', '8p', '9p', '1s', '2s', '3s', '4s']
            ]
        },
        actions: [
            { type: 'RecordDealTile', seat: 0, tile: '3s' },
            { type: 'RecordDiscardTile', seat: 0, tile: '3s', isMoqie: false, isLiqi: false },
            { type: 'RecordNoTile', tenpaiSeats: [0], deltaScores: [0, 0, 0, 0] }
        ]
    }

    const mistakes = advisor.analyzeRound(roundRecord, 0, 0, false)
    assert.strictEqual(mistakes.length, 0)
})

test('MockCoachingAdvisor - 3P (Sanma) Kita North (4z) is preserved as dora and preferred over middle tiles', () => {
    const advisor = new MockCoachingAdvisor()
    const hand = ['1p', '2p', '3p', '4p', '5p', '6p', '7s', '8s', '9s', '1s', '2s', '4z', '5s']

    // 4z in 3P has dora value 1 (Kita dora)
    const doraVal4z = advisor.testGetTileDoraValue('4z', ['1m'], true)
    assert.strictEqual(doraVal4z, 1)

    // 4z in 4P has dora value 0 (normal guest wind)
    const doraVal4z4P = advisor.testGetTileDoraValue('4z', ['1m'], false)
    assert.strictEqual(doraVal4z4P, 0)

    // In 3P, isolated 4z has lower discard preference (25) than isolated middle simple tiles (40+)
    const pref4z3P = advisor.testGetDiscardPreference('4z', hand, true, '1z', '2z', 1)
    assert.strictEqual(pref4z3P, 25)

    // findOptimalDiscard in 3P chooses to discard isolated 9m rather than Kita 4z when ukeire is equal
    const optimal3P = advisor.testFindOptimalDiscard(
        ['1p', '2p', '3p', '4p', '5p', '6p', '7s', '8s', '9s', '1z', '1z', '4z', '9m'],
        new Map(),
        true,
        undefined,
        0,
        [],
        1,
        '1z',
        '2z'
    )
    // 4z must not be chosen for discard because it is a Kita dora (9m discarded instead)
    assert.strictEqual(optimal3P.tile, '9m')
    assert.notStrictEqual(optimal3P.tile, '4z')
})

test('CoachingAdvisor - syncRevealedDoras handles duplicate kan dora indicators (2-fan dora)', () => {
    const advisor = new MockCoachingAdvisor()
    const doraIndicators: string[] = ['1m']
    const visibleCounts = new Map<string, number>([['1m', 1]])

    // Kan reveals another 1m (identical dora indicator, total 2x 1m)
    const newSeenCount = advisor.testSyncRevealedDoras(['1m', '1m'], doraIndicators, visibleCounts, 1)
    assert.strictEqual(newSeenCount, 2)
    assert.strictEqual(doraIndicators.length, 2)
    assert.strictEqual(doraIndicators[0], '1m')
    assert.strictEqual(doraIndicators[1], '1m')

    // 2m has dora value 2 because 1m indicator appears twice!
    const doraVal2m = advisor.testGetTileDoraValue('2m', doraIndicators, false)
    assert.strictEqual(doraVal2m, 2)
})

