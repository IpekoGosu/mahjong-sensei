import test from 'node:test'
import assert from 'node:assert'
import { ShantenCalculator } from './shanten'
import { MetricCalculator } from './metrics'
import { LuckEvaluator } from './metrics/luck-evaluator'
import { MajsoulRoundRecord } from './parser/types'
import { TileConverter } from './tiles'

test('ShantenCalculator - Tenpai and Agari tests', () => {
    const calc = new ShantenCalculator()

    // Complete hand (Agari): 123m 456p 789s 11z 222z -> shanten = -1
    const agariHand = [
        '1m', '2m', '3m',
        '4p', '5p', '6p',
        '7s', '8s', '9s',
        '1z', '1z',
        '2z', '2z', '2z'
    ]
    assert.strictEqual(calc.calculate(agariHand), -1)

    // Tenpai hand (0-shanten): 123m 456p 789s 11z 22z
    const tenpaiHand = [
        '1m', '2m', '3m',
        '4p', '5p', '6p',
        '7s', '8s', '9s',
        '1z', '1z',
        '2z', '2z', '3z'
    ]
    assert.strictEqual(calc.calculate(tenpaiHand), 0)

    // Chitoitsu Tenpai: 7 pairs minus 1
    const chitoiTenpai = [
        '1m', '1m', '3m', '3m', '5m', '5m',
        '2p', '2p', '4p', '4p', '6p', '6p',
        '7s'
    ]
    assert.strictEqual(calc.calculate(chitoiTenpai), 0)

    // Kokushi Tenpai: 12 unique yaojuu with 1 pair
    const kokushiTenpai = [
        '1m', '9m', '1p', '9p', '1s', '9s',
        '1z', '2z', '3z', '4z', '5z', '6z', '1m'
    ]
    assert.strictEqual(calc.calculate(kokushiTenpai), 0)
})

test('MetricCalculator - Quadrant and Luck Score tests', () => {
    const metricCalc = new MetricCalculator()

    const skillfulWin = metricCalc.classifyQuadrant(65, 75)
    assert.strictEqual(skillfulWin, 'SKILLFUL_WIN')

    const unluckyLoss = metricCalc.classifyQuadrant(30, 65)
    assert.strictEqual(unluckyLoss, 'UNLUCKY_LOSS')

    const slumpLoss = metricCalc.classifyQuadrant(35, 40)
    assert.strictEqual(slumpLoss, 'SLUMP_LOSS')

    const luckyFluke = metricCalc.classifyQuadrant(80, 42)
    assert.strictEqual(luckyFluke, 'LUCKY_FLUKE')

    const luckScore = metricCalc.calculateRoundLuckScore({
        startingHand: ['1m', '2m', '3m', '4p', '5p', '6p', '7s', '8s', '9s', '1z', '1z', '2z', '2z', '3z'],
        doraIndicators: ['5m'],
        drawCount: 10,
        effectiveDrawCount: 5,
        uradoraCount: 1,
        unavoidableDamage: 0
    })
    assert.ok(luckScore > 50)
})

test('ShantenCalculator - 3P (Sanma) mode shanten tests', () => {
    const calc = new ShantenCalculator()

    // 1. Manzu sequences: in 4P mode (123m 456p 789s 222p 11p) is Agari (-1),
    // but in 3P mode 123m cannot form a sequence -> 1-shanten
    const handWithManzuSequence = [
        '1m', '2m', '3m',
        '4p', '5p', '6p',
        '7s', '8s', '9s',
        '2p', '2p', '2p',
        '1p', '1p'
    ]
    assert.strictEqual(calc.calculate(handWithManzuSequence, false), -1)
    assert.strictEqual(calc.calculate(handWithManzuSequence, true), 1)

    // 2. 1m and 9m can form triplets in 3P mode -> Agari (-1)
    const handWith1mTriplet = [
        '1m', '1m', '1m',
        '4p', '5p', '6p',
        '7s', '8s', '9s',
        '2p', '2p', '2p',
        '1p', '1p'
    ]
    assert.strictEqual(calc.calculate(handWith1mTriplet, true), -1)

    const handWith9mTriplet = [
        '9m', '9m', '9m',
        '4p', '5p', '6p',
        '7s', '8s', '9s',
        '2p', '2p', '2p',
        '1p', '1p'
    ]
    assert.strictEqual(calc.calculate(handWith9mTriplet, true), -1)

    // 3. 1m and 9m can form pairs (head) in 3P mode -> Agari (-1)
    const handWith1mPair = [
        '1m', '1m',
        '4p', '5p', '6p',
        '7s', '8s', '9s',
        '1p', '2p', '3p',
        '2s', '3s', '4s'
    ]
    assert.strictEqual(calc.calculate(handWith1mPair, true), -1)

    const handWith9mPair = [
        '9m', '9m',
        '4p', '5p', '6p',
        '7s', '8s', '9s',
        '1p', '2p', '3p',
        '2s', '3s', '4s'
    ]
    assert.strictEqual(calc.calculate(handWith9mPair, true), -1)

    // 4. Manzu partial sequences (taatsu) are not allowed in 3P mode:
    // Penchan: 1m 2m with 3 complete melds + 2 isolated honors (13 tiles)
    const penchanHand = [
        '1m', '2m',
        '4p', '5p', '6p',
        '7s', '8s', '9s',
        '1p', '2p', '3p',
        '1z', '2z'
    ]
    // In 4P: 3 melds + 1 taatsu (1m-2m) = 1-shanten
    assert.strictEqual(calc.calculate(penchanHand, false), 1)
    // In 3P: 3 melds + 0 taatsu = 2-shanten
    assert.strictEqual(calc.calculate(penchanHand, true), 2)

    // Kanchan: 1m 3m with 3 complete melds + 2 isolated honors (13 tiles)
    const kanchanHand = [
        '1m', '3m',
        '4p', '5p', '6p',
        '7s', '8s', '9s',
        '1p', '2p', '3p',
        '1z', '2z'
    ]
    assert.strictEqual(calc.calculate(kanchanHand, false), 1)
    assert.strictEqual(calc.calculate(kanchanHand, true), 2)

    // calculateRegular with counts
    const countsPenchan = TileConverter.handToCountArray(penchanHand)
    assert.strictEqual(calc.calculateRegular(countsPenchan, false), 1)
    assert.strictEqual(calc.calculateRegular(countsPenchan, true), 2)

    // 5. Chitoitsu in 3P mode ignores 2m..8m pairs
    const chitoiWith2mHand = [
        '1m', '1m',
        '2m', '2m',
        '1p', '1p',
        '9p', '9p',
        '1s', '1s',
        '9s', '9s',
        '1z', '1z'
    ]
    const countsChitoi2m = TileConverter.handToCountArray(chitoiWith2mHand)
    assert.strictEqual(calc.calculateChitoitsu(countsChitoi2m, false), -1)
    assert.strictEqual(calc.calculateChitoitsu(countsChitoi2m, true), 1)
})

class MockLuckEvaluator extends LuckEvaluator {
    public testCountDora(hand: readonly string[], indicators: readonly string[], is3P: boolean = false): number {
        return this.countDora(hand, indicators, is3P)
    }

    public testGetNextDoraTile(indicator: string, is3P: boolean = false): string {
        return this.getNextDoraTile(indicator, is3P)
    }
}

test('LuckEvaluator - RecordBaBei (Kita) removes 4z and increments dora count', () => {
    const luckEval = new LuckEvaluator()

    const roundWithKita: MajsoulRoundRecord = {
        header: {
            type: 'RecordNewRound',
            chang: 0,
            ju: 0,
            ben: 0,
            liqi: 0,
            scores: [35000, 35000, 35000, 0],
            dora: '8p',
            hands: [
                // Seat 0 starting hand contains '4z' (Pei) and tenpai with 4p5p6p 7s8s9s 1p2p3p 2s2s
                ['4z', '4p', '5p', '6p', '7s', '8s', '9s', '1p', '2p', '3p', '2s', '2s', '1s'],
                ['1p', '9p', '1s', '9s', '1z', '2z', '3z', '5z', '6z', '7z', '1m', '9m', '2p'],
                ['1p', '9p', '1s', '9s', '1z', '2z', '3z', '5z', '6z', '7z', '1m', '9m', '3p'],
                []
            ]
        },
        actions: [
            // Seat 0 draws a tile before declaring RecordBaBei (14 tiles: 4z, 4p5p6p, 7s8s9s, 1p2p3p, 2s2s2s, 1s)
            {
                type: 'RecordDealTile',
                seat: 0,
                tile: '2s'
            },
            // Seat 0 declares Kita (RecordBaBei) with 4z (13 tiles: 4p5p6p, 7s8s9s, 1p2p3p, 2s2s2s, 1s)
            {
                type: 'RecordBaBei',
                seat: 0,
                isMoqie: false
            },
            // Seat 0 receives replacement tile (rinshan draw, 14 tiles: 4p5p6p, 7s8s9s, 1p2p3p, 2s2s2s, 1s1s)
            {
                type: 'RecordDealTile',
                seat: 0,
                tile: '1s'
            },
            // Seat 0 wins
            {
                type: 'RecordHule',
                hules: [
                    {
                        seat: 0,
                        deltaScores: [8000, -4000, -4000, 0],
                        handScore: 8000,
                        fan: 3,
                        fu: 30,
                        yaku: ['멘젠쯔모', '키타 1'],
                        uradoras: []
                    }
                ]
            }
        ]
    }

    const metric = luckEval.evaluateRound(roundWithKita, 0)
    // Starting dora was 0 (no 5p/red dora), after RecordBaBei it increments to 1
    assert.strictEqual(metric.startingDoraCount, 1)
    assert.strictEqual(metric.isWin, true)
    assert.ok(metric.luckScore > 0)
})

test('LuckEvaluator - 3P dora indicator 1m makes 9m dora', () => {
    const mockEval = new MockLuckEvaluator()

    // 4P mode: 1m indicator -> 2m dora
    assert.strictEqual(mockEval.testGetNextDoraTile('1m', false), '2m')
    assert.strictEqual(mockEval.testCountDora(['9m', '9m', '2m'], ['1m'], false), 1)

    // 3P mode: 1m indicator -> 9m dora (2m..8m do not exist)
    assert.strictEqual(mockEval.testGetNextDoraTile('1m', true), '9m')
    assert.strictEqual(mockEval.testCountDora(['9m', '9m', '1m'], ['1m'], true), 2)

    // Verify via round evaluation in 3P game (empty hands[3] indicates 3P mode)
    const round3P: MajsoulRoundRecord = {
        header: {
            type: 'RecordNewRound',
            chang: 0,
            ju: 0,
            ben: 0,
            liqi: 0,
            scores: [35000, 35000, 35000, 0],
            dora: '1m',
            hands: [
                ['9m', '9m', '4p', '5p', '6p', '7s', '8s', '9s', '1p', '2p', '3p', '2s', '2s'],
                ['1p', '9p', '1s', '9s', '1z', '2z', '3z', '5z', '6z', '7z', '1m', '9m', '2p'],
                ['1p', '9p', '1s', '9s', '1z', '2z', '3z', '5z', '6z', '7z', '1m', '9m', '3p'],
                []
            ]
        },
        actions: []
    }

    const metric = mockEval.evaluateRound(round3P, 0)
    assert.strictEqual(metric.startingDoraCount, 2)
})

test('LuckEvaluator - RecordBaBei on 13-tile hand does not distort shanten or effective draws', () => {
    const luckEval = new LuckEvaluator()

    const round: MajsoulRoundRecord = {
        header: {
            type: 'RecordNewRound',
            chang: 0,
            ju: 0,
            ben: 0,
            liqi: 0,
            scores: [35000, 35000, 35000, 0],
            dora: '8p',
            hands: [
                // 13 tiles: 4z, 4p5p6p, 7s8s9s, 1p2p3p, 2s2s, 1s (1-shanten)
                ['4z', '4p', '5p', '6p', '7s', '8s', '9s', '1p', '2p', '3p', '2s', '2s', '1s'],
                ['1p', '9p', '1s', '9s', '1z', '2z', '3z', '5z', '6z', '7z', '1m', '9m', '2p'],
                ['1p', '9p', '1s', '9s', '1z', '2z', '3z', '5z', '6z', '7z', '1m', '9m', '3p'],
                []
            ]
        },
        actions: [
            // Declares Kita before drawing: hand drops to 12 tiles (shanten should NOT recalculate)
            {
                type: 'RecordBaBei',
                seat: 0,
                isMoqie: false
            },
            // Draws ineffective replacement tile '9m' (hand is 13 tiles, shanten is still 1)
            {
                type: 'RecordDealTile',
                seat: 0,
                tile: '9m'
            }
        ]
    }

    const metric = luckEval.evaluateRound(round, 0)
    // Hand started at 1-shanten and after ineffective draw is still 1-shanten.
    // effectiveDraws should be 0, drawEfficiencyRatio = 0 / 1 = 0.
    assert.strictEqual(metric.drawEfficiencyRatio, 0)
})
