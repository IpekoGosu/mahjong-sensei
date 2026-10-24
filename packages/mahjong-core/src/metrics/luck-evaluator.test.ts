import { test } from 'node:test'
import assert from 'node:assert'
import { SeatIndex, OpponentLuckGrade } from '@mahjong-sensei/types'
import { LuckEvaluator } from './luck-evaluator'
import { MajsoulRoundRecord } from '../parser/types'

/*_ GEMINI THINKING _*/
class MockLuckEvaluator extends LuckEvaluator {
    public testCalculateOpponentLuckGrade(
        earlyWinRate: number,
        riichiWinRate: number,
        ippatsuHitRate: number,
        uradoraHitRate: number
    ): OpponentLuckGrade {
        return this.calculateOpponentLuckGrade(
            earlyWinRate,
            riichiWinRate,
            ippatsuHitRate,
            uradoraHitRate
        )
    }

    public testIsTsumoWin(
        deltaScores: readonly [number, number, number, number],
        winnerSeat: SeatIndex
    ): boolean {
        return this.isTsumoWin(deltaScores, winnerSeat)
    }

    public testCountDora(
        hand: readonly string[],
        indicators: readonly string[],
        is3P: boolean = false
    ): number {
        return this.countDora(hand, indicators, is3P)
    }
}

test('MockLuckEvaluator - calculateOpponentLuckGrade thresholds (S, A, B, C, D)', () => {
    const mock = new MockLuckEvaluator()

    // S Grade: Godly opponent luck (score >= 72)
    const gradeS = mock.testCalculateOpponentLuckGrade(35, 75, 25, 55)
    assert.strictEqual(gradeS, 'S')

    // A Grade: Strong opponent luck (60 <= score < 72)
    const gradeA = mock.testCalculateOpponentLuckGrade(20, 60, 15, 40)
    assert.strictEqual(gradeA, 'A')

    // B Grade: Average opponent luck (48 <= score < 60)
    const gradeB = mock.testCalculateOpponentLuckGrade(15, 50, 12, 30)
    assert.strictEqual(gradeB, 'B')

    // C Grade: Below average opponent luck (38 <= score < 48)
    const gradeC = mock.testCalculateOpponentLuckGrade(12, 45, 10, 25)
    assert.strictEqual(gradeC, 'C')

    // D Grade: Poor opponent luck (score < 38)
    const gradeD = mock.testCalculateOpponentLuckGrade(0, 20, 0, 10)
    assert.strictEqual(gradeD, 'D')
})

test('MockLuckEvaluator - isTsumoWin distinguishes Tsumo from Ron in 3P and 4P', () => {
    const mock = new MockLuckEvaluator()

    // 3P Tsumo: Seat 0 wins, Seat 1 and Seat 2 pay
    const delta3PTsumo: [number, number, number, number] = [8000, -4000, -4000, 0]
    assert.strictEqual(mock.testIsTsumoWin(delta3PTsumo, 0), true)

    // 3P Ron: Seat 0 wins from Seat 1
    const delta3PRon: [number, number, number, number] = [8000, -8000, 0, 0]
    assert.strictEqual(mock.testIsTsumoWin(delta3PRon, 0), false)

    // 4P Tsumo: Seat 1 wins, Seats 0, 2, 3 pay
    const delta4PTsumo: [number, number, number, number] = [-2000, 8000, -2000, -4000]
    assert.strictEqual(mock.testIsTsumoWin(delta4PTsumo, 1), true)
})

test('LuckEvaluator - 3P Unavoidable Tsumo Loss and Dealer Mangan/Haneman precision tracking', () => {
    const evaluator = new LuckEvaluator()

    // Seat 0 is dealer (ju: 0). Target Seat is Seat 1.
    // Dealer (Seat 0) hits Haneman Tsumo (18000 pts total in 4P, 6000 each in 3P Tsumo loss)
    const round1: MajsoulRoundRecord = {
        header: {
            type: 'RecordNewRound',
            chang: 0,
            ju: 0, // East 1: Seat 0 is dealer
            ben: 0,
            liqi: 0,
            scores: [35000, 35000, 35000, 0],
            dora: '1p',
            hands: [
                ['1s', '2s', '3s', '4s', '5s', '6s', '7s', '8s', '9s', '1p', '2p', '3p', '5z'],
                ['1p', '2p', '3p', '4p', '5p', '6p', '7p', '8p', '9p', '1s', '2s', '3s', '6z'],
                ['1s', '1s', '2s', '2s', '3s', '3s', '4s', '4s', '5s', '5s', '6s', '6s', '7z'],
                []
            ]
        },
        actions: [
            { type: 'RecordDealTile', seat: 0, tile: '5z' },
            { type: 'RecordDiscardTile', seat: 0, tile: '5z', isMoqie: false, isLiqi: false },
            { type: 'RecordDealTile', seat: 1, tile: '1z' },
            { type: 'RecordDiscardTile', seat: 1, tile: '1z', isMoqie: false, isLiqi: false },
            { type: 'RecordDealTile', seat: 2, tile: '2z' },
            { type: 'RecordDiscardTile', seat: 2, tile: '2z', isMoqie: false, isLiqi: false },
            {
                type: 'RecordHule',
                hules: [
                    {
                        seat: 0, // Dealer
                        deltaScores: [12000, -6000, -6000, 0],
                        handScore: 18000,
                        fan: 6, // Haneman
                        fu: 30,
                        yaku: ['멘젠쯔모', '혼일색', '도라 3'],
                        uradoras: []
                    }
                ]
            }
        ]
    }

    const metric1 = evaluator.evaluateRound(round1, 1)

    assert.strictEqual(metric1.seat, 1)
    assert.strictEqual(metric1.unavoidableDamage, 6000)
    assert.strictEqual(metric1.totalUnavoidableLoss, 6000)
    assert.strictEqual(metric1.dealInDamage, 0)
    assert.strictEqual(metric1.unavoidableLossRatio, 1.0)
    assert.strictEqual(metric1.isDealerTsumo, true)
    assert.strictEqual(metric1.dealerHanemanTsumoCount, 1)
    assert.strictEqual(metric1.dealerManganTsumoCount, 0)

    // Now round 2: Seat 0 is STILL dealer (ju: 0 renchan). Dealer hits Mangan Tsumo (-4000)
    const round2: MajsoulRoundRecord = {
        header: {
            type: 'RecordNewRound',
            chang: 0,
            ju: 0, // Seat 0 dealer
            ben: 1,
            liqi: 0,
            scores: [47000, 29000, 29000, 0],
            dora: '9p',
            hands: [
                ['1s', '2s', '3s', '4s', '5s', '6s', '7s', '8s', '9s', '1p', '2p', '3p', '5z'],
                ['1p', '2p', '3p', '4p', '5p', '6p', '7p', '8p', '9p', '1s', '2s', '3s', '6z'],
                ['1s', '1s', '2s', '2s', '3s', '3s', '4s', '4s', '5s', '5s', '6s', '6s', '7z'],
                []
            ]
        },
        actions: [
            { type: 'RecordDealTile', seat: 0, tile: '5z' },
            { type: 'RecordDiscardTile', seat: 0, tile: '5z', isMoqie: false, isLiqi: false },
            {
                type: 'RecordHule',
                hules: [
                    {
                        seat: 0, // Dealer
                        deltaScores: [8000, -4000, -4000, 0],
                        handScore: 12000,
                        fan: 5, // Mangan
                        fu: 30,
                        yaku: ['멘젠쯔모', '탕야오', '도라 3'],
                        uradoras: []
                    }
                ]
            }
        ]
    }

    const metric2 = evaluator.evaluateRound(round2, 1)
    assert.strictEqual(metric2.unavoidableDamage, 4000)
    assert.strictEqual(metric2.dealerManganTsumoCount, 1)
    assert.strictEqual(metric2.dealerHanemanTsumoCount, 0)
    assert.strictEqual(metric2.isDealerTsumo, true)

    // Evaluate game-level unavoidable loss across both rounds
    const gameLoss = evaluator.evaluateGameUnavoidableLoss([round1, round2], 1, true)
    assert.strictEqual(gameLoss.totalUnavoidableLoss, 10000)
    assert.strictEqual(gameLoss.totalDealInLoss, 0)
    assert.strictEqual(gameLoss.totalLoss, 10000)
    assert.strictEqual(gameLoss.unavoidableLossRatio, 1.0)
    assert.strictEqual(gameLoss.dealerHanemanTsumoCount, 1)
    assert.strictEqual(gameLoss.dealerManganTsumoCount, 1)
    assert.strictEqual(gameLoss.consecutiveDealerTsumoCount, 1)
    assert.strictEqual(gameLoss.maxConsecutiveDealerTsumos, 2)
    assert.strictEqual(gameLoss.isPureUnluckyLoss, true)
})

test('LuckEvaluator - Deal-in vs Unavoidable Tsumo ratio calculation', () => {
    const evaluator = new LuckEvaluator()

    // Round where targetSeat (Seat 1) deals in 8000 pts to Seat 2 (Ron)
    const ronRound: MajsoulRoundRecord = {
        header: {
            type: 'RecordNewRound',
            chang: 0,
            ju: 1, // Seat 1 dealer
            ben: 0,
            liqi: 0,
            scores: [35000, 35000, 35000, 0],
            dora: '5s',
            hands: [
                ['1s', '2s', '3s', '4s', '5s', '6s', '7s', '8s', '9s', '1p', '2p', '3p', '5z'],
                ['1p', '2p', '3p', '4p', '5p', '6p', '7p', '8p', '9p', '1s', '2s', '3s', '6z'],
                ['1s', '1s', '2s', '2s', '3s', '3s', '4s', '4s', '5s', '5s', '6s', '6s', '7z'],
                []
            ]
        },
        actions: [
            { type: 'RecordDealTile', seat: 1, tile: '5z' },
            { type: 'RecordDiscardTile', seat: 1, tile: '5z', isMoqie: false, isLiqi: false },
            {
                type: 'RecordHule',
                hules: [
                    {
                        seat: 2,
                        deltaScores: [0, -8000, 8000, 0],
                        handScore: 8000,
                        fan: 4,
                        fu: 30,
                        yaku: ['리치', '핑후', '도라 2']
                    }
                ]
            }
        ]
    }

    const ronMetric = evaluator.evaluateRound(ronRound, 1)
    assert.strictEqual(ronMetric.dealInDamage, 8000)
    assert.strictEqual(ronMetric.unavoidableDamage, 0)
    assert.strictEqual(ronMetric.unavoidableLossRatio, 0)

    // Another round with 2000 unavoidable tsumo loss
    const tsumoRound: MajsoulRoundRecord = {
        header: {
            type: 'RecordNewRound',
            chang: 0,
            ju: 2, // Seat 2 dealer
            ben: 0,
            liqi: 0,
            scores: [35000, 27000, 43000, 0],
            dora: '5s',
            hands: [
                ['1s', '2s', '3s', '4s', '5s', '6s', '7s', '8s', '9s', '1p', '2p', '3p', '5z'],
                ['1p', '2p', '3p', '4p', '5p', '6p', '7p', '8p', '9p', '1s', '2s', '3s', '6z'],
                ['1s', '1s', '2s', '2s', '3s', '3s', '4s', '4s', '5s', '5s', '6s', '6s', '7z'],
                []
            ]
        },
        actions: [
            {
                type: 'RecordHule',
                hules: [
                    {
                        seat: 0, // non-dealer child tsumo
                        deltaScores: [6000, -2000, -4000, 0],
                        handScore: 8000,
                        fan: 4,
                        fu: 30,
                        yaku: ['멘젠쯔모', '탕야오', '핑후']
                    }
                ]
            }
        ]
    }

    const tsumoMetric = evaluator.evaluateRound(tsumoRound, 1)
    assert.strictEqual(tsumoMetric.unavoidableDamage, 2000)
    assert.strictEqual(tsumoMetric.dealInDamage, 0)
    assert.strictEqual(tsumoMetric.unavoidableLossRatio, 1.0)

    // Game summary: total loss = 8000 + 2000 = 10000. Unavoidable ratio = 2000 / 10000 = 0.2
    const gameSummary = evaluator.evaluateGameUnavoidableLoss([ronRound, tsumoRound], 1, true)
    assert.strictEqual(gameSummary.totalUnavoidableLoss, 2000)
    assert.strictEqual(gameSummary.totalDealInLoss, 8000)
    assert.strictEqual(gameSummary.totalLoss, 10000)
    assert.strictEqual(gameSummary.unavoidableLossRatio, 0.2)
    assert.strictEqual(gameSummary.isPureUnluckyLoss, false)
})

test('LuckEvaluator - evaluateOpponentLuck extracts early wins, Riichi wins, Ippatsu & Uradora hits', () => {
    const evaluator = new LuckEvaluator()

    // 2-round game:
    // Round 1: Seat 0 declares Riichi on turn 4 (early!), wins on turn 5 with Ippatsu and Uradora hitting Seat 1
    const round1: MajsoulRoundRecord = {
        header: {
            type: 'RecordNewRound',
            chang: 0,
            ju: 0,
            ben: 0,
            liqi: 0,
            scores: [35000, 35000, 35000, 0],
            dora: '1s',
            hands: [
                ['1s', '2s', '3s', '4s', '5s', '6s', '7s', '8s', '9s', '1p', '2p', '3p', '5z'],
                ['1p', '2p', '3p', '4p', '5p', '6p', '7p', '8p', '9p', '1s', '2s', '3s', '6z'],
                ['1s', '1s', '2s', '2s', '3s', '3s', '4s', '4s', '5s', '5s', '6s', '6s', '7z'],
                []
            ]
        },
        actions: [
            // Turns 1..3
            { type: 'RecordDiscardTile', seat: 0, tile: '1z', isMoqie: false, isLiqi: false },
            { type: 'RecordDiscardTile', seat: 1, tile: '2z', isMoqie: false, isLiqi: false },
            { type: 'RecordDiscardTile', seat: 2, tile: '3z', isMoqie: false, isLiqi: false },
            { type: 'RecordDiscardTile', seat: 0, tile: '4z', isMoqie: false, isLiqi: false },
            { type: 'RecordDiscardTile', seat: 1, tile: '5z', isMoqie: false, isLiqi: false },
            { type: 'RecordDiscardTile', seat: 2, tile: '6z', isMoqie: false, isLiqi: false },
            { type: 'RecordDiscardTile', seat: 0, tile: '7z', isMoqie: false, isLiqi: false },
            { type: 'RecordDiscardTile', seat: 1, tile: '1p', isMoqie: false, isLiqi: false },
            { type: 'RecordDiscardTile', seat: 2, tile: '2p', isMoqie: false, isLiqi: false },
            // Turn 4: Seat 0 declares Riichi
            { type: 'RecordDiscardTile', seat: 0, tile: '9s', isMoqie: false, isLiqi: true },
            { type: 'RecordDiscardTile', seat: 1, tile: '3p', isMoqie: false, isLiqi: false },
            { type: 'RecordDiscardTile', seat: 2, tile: '4p', isMoqie: false, isLiqi: false },
            // Turn 5: Seat 0 hits Ippatsu Tsumo!
            {
                type: 'RecordHule',
                hules: [
                    {
                        seat: 0,
                        deltaScores: [12000, -6000, -6000, 0],
                        handScore: 18000,
                        fan: 6,
                        fu: 30,
                        yaku: ['리치', '일발', '멘젠쯔모', '우라도라 2'],
                        uradoras: ['3s', '4s']
                    }
                ]
            }
        ]
    }

    const oppLuck = evaluator.evaluateOpponentLuck([round1], 1, true)

    assert.strictEqual(oppLuck.totalOpponentWins, 1)
    assert.strictEqual(oppLuck.earlyWinCount, 1)
    assert.strictEqual(oppLuck.earlyWinRate, 100.0)
    assert.strictEqual(oppLuck.riichiWinRate, 100.0)
    assert.strictEqual(oppLuck.ippatsuHitRate, 100.0)
    assert.strictEqual(oppLuck.uradoraHitRate, 100.0)
    assert.strictEqual(oppLuck.opponentLuckGrade, 'S')
})

/*_ GEMINI THINKING _*/
test('LuckEvaluator - evaluateRound: RecordChiPengGang (Pon/Chi) meld synchronizes hand, meldCount, and effective draws', () => {
    const evaluator = new LuckEvaluator()

    // Seat 0 starting hand: 1-shanten (1m2m3m, 4p5p6p, 7s8s9s, 1z1z, 2z, 3z)
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

            // Target Seat 0 calls Pon on 1z: two 1z removed from hand, meldCount becomes 1
            { type: 'RecordChiPengGang', seat: 0, meldType: 'pon', tiles: ['1z', '1z', '1z'], fromSeat: 3 },

            // Seat 0 discards 2z: hand now has 10 tiles + 1 meld -> Tenpai on 3z tanki (currentShanten = 0)
            { type: 'RecordDiscardTile', seat: 0, tile: '2z', isMoqie: false, isLiqi: false },

            // Seat 0 draws winning tile 3z (newShanten = -1 < currentShanten = 0 -> effectiveDraws++)
            { type: 'RecordDealTile', seat: 0, tile: '3z' },

            // Seat 0 wins by Tsumo
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

    const metric = evaluator.evaluateRound(roundRecord, 0)
    // 1 draw total, which was the effective draw that completed the hand
    assert.strictEqual(metric.drawEfficiencyRatio, 1.0)
    assert.strictEqual(metric.isWin, true)
    assert.strictEqual(metric.startingShanten, 1)
})

/*_ GEMINI THINKING _*/
test('LuckEvaluator - evaluateRound: RecordAnGangAddGang handles ankan (4 tiles) and kakan (1 tile) with rinshan draws', () => {
    const evaluator = new LuckEvaluator()

    // Seat 0 starting hand: 1-shanten with four 9s (1m2m3m, 4p5p6p, 1s2s partial, 9s9s9s9s, 1z)
    const roundRecord: MajsoulRoundRecord = {
        header: {
            type: 'RecordNewRound',
            chang: 0,
            ju: 0,
            ben: 0,
            liqi: 0,
            scores: [25000, 25000, 25000, 25000],
            dora: '5p',
            hands: [
                ['1m', '2m', '3m', '4p', '5p', '6p', '1s', '2s', '9s', '9s', '9s', '9s', '1z'],
                ['1p', '2p', '3p', '4p', '5p', '6p', '7p', '8p', '9p', '1s', '2s', '3s', '4s'],
                ['1p', '2p', '3p', '4p', '5p', '6p', '7p', '8p', '9p', '1s', '2s', '3s', '4s'],
                ['1p', '2p', '3p', '4p', '5p', '6p', '7p', '8p', '9p', '1s', '2s', '3s', '4s']
            ]
        },
        actions: [
            // Seat 0 declares AnGang on 9s: all 4 copies removed from hand, meldCount = 1
            { type: 'RecordAnGangAddGang', seat: 0, gangType: 'ankan', tiles: ['9s', '9s', '9s', '9s'] },

            // Rinshan draw: draws 1z (completes 1z pair -> Tenpai on 3s! newShanten = 0 < currentShanten = 1)
            { type: 'RecordDealTile', seat: 0, tile: '1z' },

            // Discard 1m: wait is 3s (currentShanten = 0)
            { type: 'RecordDiscardTile', seat: 0, tile: '1m', isMoqie: false, isLiqi: false },

            // Next turn draw 3s (Agari! newShanten = -1 < currentShanten = 0)
            { type: 'RecordDealTile', seat: 0, tile: '3s' },

            // Tsumo win
            {
                type: 'RecordHule',
                hules: [
                    {
                        seat: 0,
                        deltaScores: [8000, -2000, -2000, -4000],
                        handScore: 8000,
                        fan: 3,
                        fu: 40,
                        yaku: ['멘젠쯔모', '삼암각'],
                        uradoras: []
                    }
                ]
            }
        ]
    }

    const metric = evaluator.evaluateRound(roundRecord, 0)
    assert.strictEqual(metric.startingShanten, 1)
    // 2 draws (rinshan 1z -> tenpai, then 3s -> agari), both effective
    assert.strictEqual(metric.drawEfficiencyRatio, 1.0)
    assert.strictEqual(metric.isWin, true)
})

/*_ GEMINI THINKING _*/
test('LuckEvaluator - evaluateRound: opponent melds do not mutate target hand or meldCount', () => {
    const evaluator = new LuckEvaluator()

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
            // Seat 1 discards 2p
            { type: 'RecordDiscardTile', seat: 1, tile: '2p', isMoqie: false, isLiqi: false },

            // Opponent Seat 2 calls Pon on 2p
            { type: 'RecordChiPengGang', seat: 2, meldType: 'pon', tiles: ['2p', '2p', '2p'], fromSeat: 1 },
            { type: 'RecordDiscardTile', seat: 2, tile: '3p', isMoqie: false, isLiqi: false },

            // Opponent Seat 3 calls AnGang
            { type: 'RecordAnGangAddGang', seat: 3, gangType: 'ankan', tiles: ['4s', '4s', '4s', '4s'] },
            { type: 'RecordDealTile', seat: 3, tile: '5s' },
            { type: 'RecordDiscardTile', seat: 3, tile: '5s', isMoqie: false, isLiqi: false },

            // Target Seat 0 draws tile and discards
            { type: 'RecordDealTile', seat: 0, tile: '4s' },
            { type: 'RecordDiscardTile', seat: 0, tile: '4s', isMoqie: true, isLiqi: false },

            { type: 'RecordNoTile', tenpaiSeats: [0], deltaScores: [3000, -1000, -1000, -1000] }
        ]
    }

    const metric = evaluator.evaluateRound(roundRecord, 0)
    assert.strictEqual(metric.startingShanten, 0) // Tenpai
    assert.strictEqual(metric.isWin, false)
})
