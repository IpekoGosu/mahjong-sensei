import test from 'node:test'
import assert from 'node:assert'
import { ShantenCalculator } from './shanten'
import { MetricCalculator } from './metrics'

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
