/*_ GEMINI THINKING _*/
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
    /*_ GEMINI THINKING _*/
    // Hand started at 1-shanten and after ineffective draw is still 1-shanten.
    // effectiveDraws should be 0, drawEfficiencyRatio = 0 / 1 = 0.
    assert.strictEqual(metric.drawEfficiencyRatio, 0)
})

/*_ GEMINI THINKING _*/
class MockShantenCalculator extends ShantenCalculator {
    public testCountPartials(counts: readonly number[], is3P: boolean = false): number {
        return this.countPartials(counts, is3P)
    }

    public testSearchMelds(
        counts: number[],
        index: number,
        pairs: number,
        melds: number,
        state: { bestShanten: number },
        is3P: boolean = false,
        meldCount: number = 0,
        originalCounts?: readonly number[],
        headIndex: number = -1
    ): void {
        this.searchMelds(counts, index, pairs, melds, state, is3P, meldCount, originalCounts, headIndex)
    }
}

/*_ GEMINI THINKING _*/
test('MockShantenCalculator - countPartials on overlapping shapes', () => {
    const mock = new MockShantenCalculator()

    /*_ GEMINI THINKING _*/
    // 1m 2m 2m 4m should extract 2 partials ([1m, 2m] + [2m, 4m]), not 1 partial ([2m, 2m])
    const counts1224m = TileConverter.handToCountArray(['1m', '2m', '2m', '4m'])
    const partials1224m = mock.testCountPartials(counts1224m)
    assert.strictEqual(partials1224m, 2)

    /*_ GEMINI THINKING _*/
    // 2p 3p 3p 4p 4p 5p should extract 3 partials ([2p, 3p] + [3p, 4p] + [4p, 5p])
    const counts233445p = TileConverter.handToCountArray(['2p', '3p', '3p', '4p', '4p', '5p'])
    const partials233445p = mock.testCountPartials(counts233445p)
    assert.strictEqual(partials233445p, 3)
})

/*_ GEMINI THINKING _*/
test('ShantenCalculator - 1m 2m 2m 4m hand shanten evaluation', () => {
    const calc = new ShantenCalculator()

    /*_ GEMINI THINKING _*/
    // Hand with 1m 2m 2m 4m + 2 melds + 1 pair + 1 isolated tile: 1-shanten
    // 2 melds (567p, 234s) + 1 pair (99s) + 2 partials from 1224m = 5 blocks -> 1-shanten
    const handWith2Melds = [
        '1m', '2m', '2m', '4m',
        '5p', '6p', '7p',
        '2s', '3s', '4s',
        '9s', '9s',
        '7z'
    ]
    assert.strictEqual(calc.calculate(handWith2Melds), 1)

    /*_ GEMINI THINKING _*/
    // Hand with 1m 2m 2m 4m + 3 melds (2 in hand + 1 open meld) + 1 pair: 0-shanten (tenpai)
    const handWith3Melds = [
        '1m', '2m', '2m', '4m',
        '5p', '6p', '7p',
        '2s', '3s', '4s',
        '9s', '9s'
    ]
    assert.strictEqual(calc.calculate(handWith3Melds, false, 1), 0)
})

/*_ GEMINI THINKING _*/
test('ShantenCalculator - 4 identical tiles phantom 5th-tile tanki prevention', () => {
    const calc = new ShantenCalculator()

    /*_ GEMINI THINKING _*/
    // 1m 1m 1m 1m 2p 3p 4p 2s 3s 4s 5z 5z 5z (13 tiles)
    // 1m triplet + 234p seq + 234s seq + 5z triplet = 4 melds
    // Remaining tile is 1m, but all 4 copies of 1m are exhausted in hand.
    // Cannot wait on a 5th copy of 1m for tanki head, so cannot be 0-shanten (tenpai).
    // Must be 1-shanten, and cannot be -1 agari.
    const phantomHand = [
        '1m', '1m', '1m', '1m',
        '2p', '3p', '4p',
        '2s', '3s', '4s',
        '5z', '5z', '5z'
    ]
    const shanten = calc.calculate(phantomHand)
    assert.strictEqual(shanten, 1)
    assert.notStrictEqual(shanten, 0)
    assert.notStrictEqual(shanten, -1)

    /*_ GEMINI THINKING _*/
    // Hand with 4 identical tiles as 2 pairs without another head candidate
    // e.g. 1m 1m 1m 1m 2p 3p 4p 2s 3s 4s 7z
    const fourIdenticalNoHead = [
        '1m', '1m', '1m', '1m',
        '2p', '3p', '4p',
        '2s', '3s', '4s',
        '7z'
    ]
    const shantenNoHead = calc.calculate(fourIdenticalNoHead)
    assert.ok(shantenNoHead >= 1)
})

/*_ GEMINI THINKING _*/
test('ShantenCalculator - Issue #52: 4 identical tiles Chitoitsu calculation edge cases', () => {
    const calc = new ShantenCalculator()

    /*_ GEMINI THINKING _*/
    // 1. 4 identical tiles in 1 kind + 5 pairs (14 tiles, 6 kinds)
    // 1m 1m 1m 1m, 3p 3p, 5p 5p, 7p 7p, 9s 9s, 1z 1z
    // Even though there are 6 pair shapes, 1m quadruple cannot form 2 pairs for Chitoitsu.
    // Chitoitsu requires 7 distinct tile kinds (pairs=6, kinds=6).
    // shanten = 6 - pairs + Math.max(0, 7 - kinds) = 6 - 6 + 1 = 1-shanten.
    const hand4OfAKindWith5Pairs = [
        '1m', '1m', '1m', '1m',
        '3p', '3p',
        '5p', '5p',
        '7p', '7p',
        '9s', '9s',
        '1z', '1z'
    ]
    const countsHand1 = TileConverter.handToCountArray(hand4OfAKindWith5Pairs)
    assert.strictEqual(calc.calculateChitoitsu(countsHand1), 1)
    assert.strictEqual(calc.calculate(hand4OfAKindWith5Pairs), 1)

    /*_ GEMINI THINKING _*/
    // 2. 4 identical tiles in 1 kind + 4 pairs + 1 isolated tile (13 tiles, 6 kinds)
    // 1m 1m 1m 1m, 3p 3p, 5p 5p, 7p 7p, 9s 9s, 1z
    // pairs=5, kinds=6 -> shanten = 6 - 5 + (7 - 6) = 2-shanten.
    const hand4OfAKindWith4Pairs1Isolated = [
        '1m', '1m', '1m', '1m',
        '3p', '3p',
        '5p', '5p',
        '7p', '7p',
        '9s', '9s',
        '1z'
    ]
    const countsHand2 = TileConverter.handToCountArray(hand4OfAKindWith4Pairs1Isolated)
    assert.strictEqual(calc.calculateChitoitsu(countsHand2), 2)
    assert.strictEqual(calc.calculate(hand4OfAKindWith4Pairs1Isolated), 2)

    /*_ GEMINI THINKING _*/
    // 3. 4 identical tiles in 2 kinds + 3 pairs (14 tiles, 5 kinds)
    // 1m 1m 1m 1m, 2m 2m 2m 2m, 3p 3p, 4p 4p, 5s 5s
    // pairs=5, kinds=5 -> shanten = 6 - 5 + (7 - 5) = 1 + 2 = 3-shanten.
    const handTwo4OfAKindWith3Pairs = [
        '1m', '1m', '1m', '1m',
        '2m', '2m', '2m', '2m',
        '3p', '3p',
        '4p', '4p',
        '5s', '5s'
    ]
    const countsHand3 = TileConverter.handToCountArray(handTwo4OfAKindWith3Pairs)
    assert.strictEqual(calc.calculateChitoitsu(countsHand3), 3)

    /*_ GEMINI THINKING _*/
    // 4. 4 identical tiles in 2 kinds + 2 pairs + 1 isolated tile (13 tiles, 5 kinds)
    // 1m 1m 1m 1m, 9m 9m 9m 9m, 1p 1p, 9p 9p, 5s
    // pairs=4, kinds=5 -> shanten = 6 - 4 + (7 - 5) = 2 + 2 = 4-shanten.
    const handTwo4OfAKindWith2Pairs1Isolated = [
        '1m', '1m', '1m', '1m',
        '9m', '9m', '9m', '9m',
        '1p', '1p',
        '9p', '9p',
        '5s'
    ]
    const countsHand4 = TileConverter.handToCountArray(handTwo4OfAKindWith2Pairs1Isolated)
    assert.strictEqual(calc.calculateChitoitsu(countsHand4), 4)

    /*_ GEMINI THINKING _*/
    // 5. 4 identical tiles in 3 kinds + 1 pair (14 tiles, 4 kinds, non-connecting terminals)
    // 1m 1m 1m 1m, 9m 9m 9m 9m, 1p 1p 1p 1p, 9s 9s
    // pairs=4, kinds=4 -> shanten = 6 - 4 + (7 - 4) = 2 + 3 = 5-shanten.
    const handThree4OfAKindWith1Pair = [
        '1m', '1m', '1m', '1m',
        '9m', '9m', '9m', '9m',
        '1p', '1p', '1p', '1p',
        '9s', '9s'
    ]
    const countsHand5 = TileConverter.handToCountArray(handThree4OfAKindWith1Pair)
    assert.strictEqual(calc.calculateChitoitsu(countsHand5), 5)

    /*_ GEMINI THINKING _*/
    // 6. Complete Chitoitsu Agari with 7 distinct pairs (14 tiles) -> shanten = -1
    const pureChitoitsuAgari = [
        '1m', '1m',
        '3m', '3m',
        '5m', '5m',
        '2p', '2p',
        '4p', '4p',
        '6s', '6s',
        '8s', '8s'
    ]
    const countsHand6 = TileConverter.handToCountArray(pureChitoitsuAgari)
    assert.strictEqual(calc.calculateChitoitsu(countsHand6), -1)
    assert.strictEqual(calc.calculate(pureChitoitsuAgari), -1)

    /*_ GEMINI THINKING _*/
    // 7. Chitoitsu Tenpai with 6 distinct pairs + 1 isolated tile (13 tiles, 7 kinds) -> shanten = 0
    const pureChitoitsuTenpai = [
        '1m', '1m',
        '3m', '3m',
        '5m', '5m',
        '2p', '2p',
        '4p', '4p',
        '6s', '6s',
        '8s'
    ]
    const countsHand7 = TileConverter.handToCountArray(pureChitoitsuTenpai)
    assert.strictEqual(calc.calculateChitoitsu(countsHand7), 0)
    assert.strictEqual(calc.calculate(pureChitoitsuTenpai), 0)
})

/*_ GEMINI THINKING _*/
test('ShantenCalculator - Issue #52: 4 identical tiles Chitoitsu vs Regular minimum shanten selection', () => {
    const calc = new ShantenCalculator()

    /*_ GEMINI THINKING _*/
    // 1. 4 identical tiles in 1m + 4 pairs + 2 isolated tiles (14 tiles, 7 kinds)
    // 1m 1m 1m 1m, 2m 2m, 3m 3m, 4m 4m, 5m 5m, 6m, 7m
    // Chitoitsu: pairs=5, kinds=7 -> 6 - 5 + 0 = 1-shanten.
    // Regular: [1m 1m](head) + [1m 2m 3m] x 2 + [4m 5m 6m] + [4m 5m 7m] -> discarding 7m leaves 4m-5m ryanmen tenpai (0-shanten).
    // calculate() must choose min(1, 0) = 0.
    const handChitoi1VsRegular0 = [
        '1m', '1m', '1m', '1m',
        '2m', '2m',
        '3m', '3m',
        '4m', '4m',
        '5m', '5m',
        '6m',
        '7m'
    ]
    const counts1 = TileConverter.handToCountArray(handChitoi1VsRegular0)
    assert.strictEqual(calc.calculateChitoitsu(counts1), 1)
    assert.strictEqual(calc.calculateRegular(counts1), 0)
    assert.strictEqual(calc.calculate(handChitoi1VsRegular0), 0)

    /*_ GEMINI THINKING _*/
    // 2. 4 identical tiles in 1m + 5 pairs forming Ryanpeiko Agari (14 tiles, 6 kinds)
    // 1m 1m 1m 1m, 2m 2m, 3m 3m, 4s 4s, 5s 5s, 6s 6s
    // Chitoitsu: pairs=6, kinds=6 -> 6 - 6 + (7 - 6) = 1-shanten.
    // Regular: [1m 1m](head) + [1m 2m 3m] x 2 + [4s 5s 6s] x 2 -> -1 (Agari).
    // calculate() must choose min(1, -1) = -1.
    const handRyanpeikoAgari = [
        '1m', '1m', '1m', '1m',
        '2m', '2m',
        '3m', '3m',
        '4s', '4s',
        '5s', '5s',
        '6s', '6s'
    ]
    const counts2 = TileConverter.handToCountArray(handRyanpeikoAgari)
    assert.strictEqual(calc.calculateChitoitsu(counts2), 1)
    assert.strictEqual(calc.calculateRegular(counts2), -1)
    assert.strictEqual(calc.calculate(handRyanpeikoAgari), -1)

    /*_ GEMINI THINKING _*/
    // 3. 4 identical tiles in 3 kinds + 1 pair forming 4 identical sequences (14 tiles, 4 kinds)
    // 1m 1m 1m 1m, 2m 2m 2m 2m, 3m 3m 3m 3m, 5s 5s
    // Chitoitsu: pairs=4, kinds=4 -> 6 - 4 + (7 - 4) = 5-shanten.
    // Regular: [5s 5s](head) + [1m 2m 3m] x 4 -> -1 (Agari).
    // calculate() must choose min(5, -1) = -1.
    const handFourSequencesAgari = [
        '1m', '1m', '1m', '1m',
        '2m', '2m', '2m', '2m',
        '3m', '3m', '3m', '3m',
        '5s', '5s'
    ]
    const counts3 = TileConverter.handToCountArray(handFourSequencesAgari)
    assert.strictEqual(calc.calculateChitoitsu(counts3), 5)
    assert.strictEqual(calc.calculateRegular(counts3), -1)
    assert.strictEqual(calc.calculate(handFourSequencesAgari), -1)

    /*_ GEMINI THINKING _*/
    // 4. 4 identical tiles in 3 kinds + 4m isolated (13 tiles, 4 kinds)
    // 1m 1m 1m 1m, 2m 2m 2m 2m, 3m 3m 3m 3m, 4m
    // Chitoitsu: pairs=3, kinds=4 -> 6 - 3 + (7 - 4) = 6-shanten.
    // Regular: [1m 1m](head) + [1m 2m 3m] x 2 + [2m 3m 4m] + remaining [2m 3m] waiting on 1m or 4m.
    // Even though 1m is exhausted (4 in hand), 4m has remaining tiles in wall, making it a valid tenpai (0-shanten).
    // calculate() must choose min(6, 0) = 0.
    const handFourOfAKindTenpai = [
        '1m', '1m', '1m', '1m',
        '2m', '2m', '2m', '2m',
        '3m', '3m', '3m', '3m',
        '4m'
    ]
    const counts4 = TileConverter.handToCountArray(handFourOfAKindTenpai)
    assert.strictEqual(calc.calculateChitoitsu(counts4), 6)
    assert.strictEqual(calc.calculateRegular(counts4), 0)
    assert.strictEqual(calc.calculate(handFourOfAKindTenpai), 0)
})

/*_ GEMINI THINKING _*/
test('ShantenCalculator - Issue #52: 3P (Sanma) 4 identical tiles Chitoitsu consistency', () => {
    const calc = new ShantenCalculator()

    /*_ GEMINI THINKING _*/
    // 1. 3P mode with 1m quadruple + 5 pairs (14 tiles, 6 kinds)
    // 1m 1m 1m 1m, 9m 9m, 1p 1p, 9p 9p, 1s 1s, 9s 9s
    // 1m 4-of-a-kind cannot be treated as 2 pairs; requires 7 kinds.
    // pairs=6, kinds=6 -> shanten = 6 - 6 + (7 - 6) = 1-shanten.
    const hand3P1mQuad = [
        '1m', '1m', '1m', '1m',
        '9m', '9m',
        '1p', '1p',
        '9p', '9p',
        '1s', '1s',
        '9s', '9s'
    ]
    const counts3P1 = TileConverter.handToCountArray(hand3P1mQuad)
    assert.strictEqual(calc.calculateChitoitsu(counts3P1, true), 1)
    assert.strictEqual(calc.calculate(hand3P1mQuad, true), 1)

    /*_ GEMINI THINKING _*/
    // 2. 3P mode with 9m quadruple + 5 pairs (14 tiles, 6 kinds)
    // 1m 1m, 9m 9m 9m 9m, 1p 1p, 9p 9p, 1s 1s, 9s 9s
    // pairs=6, kinds=6 -> 1-shanten.
    const hand3P9mQuad = [
        '1m', '1m',
        '9m', '9m', '9m', '9m',
        '1p', '1p',
        '9p', '9p',
        '1s', '1s',
        '9s', '9s'
    ]
    const counts3P2 = TileConverter.handToCountArray(hand3P9mQuad)
    assert.strictEqual(calc.calculateChitoitsu(counts3P2, true), 1)
    assert.strictEqual(calc.calculate(hand3P9mQuad, true), 1)

    /*_ GEMINI THINKING _*/
    // 3. 3P mode with both 1m and 9m quadruples + 3 pairs (14 tiles, 5 kinds)
    // 1m 1m 1m 1m, 9m 9m 9m 9m, 1p 1p, 9p 9p, 1s 1s
    // pairs=5, kinds=5 -> shanten = 6 - 5 + (7 - 5) = 1 + 2 = 3-shanten.
    const hand3PBothQuads = [
        '1m', '1m', '1m', '1m',
        '9m', '9m', '9m', '9m',
        '1p', '1p',
        '9p', '9p',
        '1s', '1s'
    ]
    const counts3P3 = TileConverter.handToCountArray(hand3PBothQuads)
    assert.strictEqual(calc.calculateChitoitsu(counts3P3, true), 3)

    /*_ GEMINI THINKING _*/
    // 4. 3P mode ignores middle manzu (2m..8m) pairs even if erroneously present in tile array
    // 1m 1m, 2m 2m, 9m 9m, 1p 1p, 9p 9p, 1s 1s, 9s 9s (14 tiles)
    // In 4P mode: 7 distinct pairs -> -1 (Agari).
    // In 3P mode: 2m is filtered out, leaving pairs=6, kinds=6 -> 1-shanten.
    const handWith2mPair = [
        '1m', '1m',
        '2m', '2m',
        '9m', '9m',
        '1p', '1p',
        '9p', '9p',
        '1s', '1s',
        '9s', '9s'
    ]
    const counts3P4 = TileConverter.handToCountArray(handWith2mPair)
    assert.strictEqual(calc.calculateChitoitsu(counts3P4, false), -1)
    assert.strictEqual(calc.calculateChitoitsu(counts3P4, true), 1)
})

/*_ GEMINI THINKING _*/
test('ShantenCalculator - Issue #52: Kokushi Musou 13-sided wait and defect tenpai edge cases', () => {
    const calc = new ShantenCalculator()

    /*_ GEMINI THINKING _*/
    // 1. Kokushi Musou 13-sided wait tenpai: 13 distinct terminals and honors (13 tiles)
    // uniqueYaojuu=13, hasYaojuuPair=false -> shanten = 13 - 13 - 0 = 0 (Tenpai).
    const kokushi13Wait = [
        '1m', '9m',
        '1p', '9p',
        '1s', '9s',
        '1z', '2z', '3z', '4z', '5z', '6z', '7z'
    ]
    const counts1 = TileConverter.handToCountArray(kokushi13Wait)
    assert.strictEqual(calc.calculateKokushi(counts1), 0)
    assert.strictEqual(calc.calculate(kokushi13Wait), 0)

    /*_ GEMINI THINKING _*/
    // 2. Kokushi Musou 1-tile defect single wait tenpai: 12 distinct terminals/honors + 1 pair (13 tiles)
    // 7z missing, 1m has pair.
    // uniqueYaojuu=12, hasYaojuuPair=true -> shanten = 13 - 12 - 1 = 0 (Tenpai).
    const kokushiSingleWait = [
        '1m', '1m',
        '9m',
        '1p', '9p',
        '1s', '9s',
        '1z', '2z', '3z', '4z', '5z', '6z'
    ]
    const counts2 = TileConverter.handToCountArray(kokushiSingleWait)
    assert.strictEqual(calc.calculateKokushi(counts2), 0)
    assert.strictEqual(calc.calculate(kokushiSingleWait), 0)

    /*_ GEMINI THINKING _*/
    // 3. Kokushi Musou 1-tile defect without pair: 12 distinct terminals/honors + 1 simple tile (13 tiles)
    // 7z missing, no yaojuu pair (5p middle tile).
    // uniqueYaojuu=12, hasYaojuuPair=false -> shanten = 13 - 12 - 0 = 1-shanten.
    const kokushi1DefectNoPair = [
        '1m', '9m',
        '1p', '9p',
        '1s', '9s',
        '1z', '2z', '3z', '4z', '5z', '6z',
        '5p'
    ]
    const counts3 = TileConverter.handToCountArray(kokushi1DefectNoPair)
    assert.strictEqual(calc.calculateKokushi(counts3), 1)
    assert.strictEqual(calc.calculate(kokushi1DefectNoPair), 1)

    /*_ GEMINI THINKING _*/
    // 4. Kokushi Musou completed Agari: 13 distinct terminals/honors + 1 pair (14 tiles)
    // uniqueYaojuu=13, hasYaojuuPair=true -> shanten = 13 - 13 - 1 = -1 (Agari).
    const kokushiAgari = [
        '1m', '1m',
        '9m',
        '1p', '9p',
        '1s', '9s',
        '1z', '2z', '3z', '4z', '5z', '6z', '7z'
    ]
    const counts4 = TileConverter.handToCountArray(kokushiAgari)
    assert.strictEqual(calc.calculateKokushi(counts4), -1)
    assert.strictEqual(calc.calculate(kokushiAgari), -1)

    /*_ GEMINI THINKING _*/
    // 5. Kokushi Musou with 4 identical copies of 1m: 10 distinct yaojuu tiles (13 tiles)
    // 1m quadruple counts as only 1 unique yaojuu and 1 pair (cannot count as 2 pairs).
    // uniqueYaojuu=10, hasYaojuuPair=true -> shanten = 13 - 10 - 1 = 2-shanten.
    const kokushi4OfAKind = [
        '1m', '1m', '1m', '1m',
        '9m',
        '1p', '9p',
        '1s', '9s',
        '1z', '2z', '3z', '4z'
    ]
    const counts5 = TileConverter.handToCountArray(kokushi4OfAKind)
    assert.strictEqual(calc.calculateKokushi(counts5), 2)
    assert.strictEqual(calc.calculate(kokushi4OfAKind), 2)
})
