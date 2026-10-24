/*_ GEMINI THINKING _*/
import test from 'node:test'
import assert from 'node:assert'
import { SlumpProbabilityCalculator, SlumpCalculationInput } from './slump-probability'
import { SlumpStatus } from '@mahjong-sensei/types'

class MockSlumpProbabilityCalculator extends SlumpProbabilityCalculator {
    public testCalculateMeanAndVariance(ranks: readonly number[]): { mean: number; variance: number } {
        return this.calculateMeanAndVariance(ranks)
    }

    public testCalculateZScore(
        sampleMean: number,
        sampleVariance: number,
        sampleSize: number,
        baselineMean: number,
        baselineVariance: number
    ): number {
        return this.calculateZScore(sampleMean, sampleVariance, sampleSize, baselineMean, baselineVariance)
    }

    public testCalculateBinomialPValue(
        n: number,
        k: number,
        p: number,
        direction: 'greater_equal' | 'less_equal'
    ): number {
        return this.calculateBinomialPValue(n, k, p, direction)
    }

    public testCalculateSurvivalProbability(
        singleWindowPValue: number,
        windowSize: number,
        horizonGames: number
    ): number {
        return this.calculateSurvivalProbability(singleWindowPValue, windowSize, horizonGames)
    }

    public testDetermineStatus(
        zScore: number,
        percentile: number,
        lastPlacePValue: number,
        topPlacePValue: number
    ): SlumpStatus {
        return this.determineStatus(zScore, percentile, lastPlacePValue, topPlacePValue)
    }

    public testBuildMessage(
        status: SlumpStatus,
        percentile: number,
        occurrenceProbability: number,
        lastPlacePValue: number,
        topPlacePValue: number
    ): string {
        return this.buildMessage(status, percentile, occurrenceProbability, lastPlacePValue, topPlacePValue)
    }
}

test('SlumpProbabilityCalculator - Empty ranks returns neutral fallback', () => {
    const calc = new SlumpProbabilityCalculator()
    const result = calc.calculateSlumpSeverity({
        gameMode: '4p',
        ranks: []
    })

    assert.strictEqual(result.status, 'NORMAL')
    assert.strictEqual(result.zScore, 0)
    assert.strictEqual(result.percentile, 50.0)
    assert.strictEqual(result.occurrenceProbability, 1.0)
    assert.ok(result.message.includes('충분하지 않습니다'))
})

test('SlumpProbabilityCalculator - Mock mean and variance computation', () => {
    const mock = new MockSlumpProbabilityCalculator()

    const empty = mock.testCalculateMeanAndVariance([])
    assert.strictEqual(empty.mean, 0)
    assert.strictEqual(empty.variance, 0)

    const single = mock.testCalculateMeanAndVariance([3])
    assert.strictEqual(single.mean, 3)
    assert.strictEqual(single.variance, 0)

    // Sample ranks: [1, 2, 3, 4] -> mean = 2.5, sample variance = 5 / 3 = 1.6666...
    const sample = mock.testCalculateMeanAndVariance([1, 2, 3, 4])
    assert.strictEqual(sample.mean, 2.5)
    assert.ok(Math.abs(sample.variance - 1.6666) < 0.01)
})

test('SlumpProbabilityCalculator - Mock Z-Score handles identical ranks without division by zero', () => {
    const mock = new MockSlumpProbabilityCalculator()

    // 10 consecutive 4th places in 4P (baselineMean = 2.5, baselineVariance = 1.25)
    const z = mock.testCalculateZScore(4.0, 0, 10, 2.5, 1.25)
    assert.ok(z < -4.0, `Expected extreme negative z-score, got ${z}`)

    // Normal expectation
    const zZero = mock.testCalculateZScore(2.5, 1.25, 10, 2.5, 1.25)
    assert.strictEqual(zZero, 0)

    // Good run (mean = 1.5 in 4P)
    const zGood = mock.testCalculateZScore(1.5, 1.0, 10, 2.5, 1.25)
    assert.ok(zGood > 2.0, `Expected positive z-score for good run, got ${zGood}`)
})

test('SlumpProbabilityCalculator - Mock binomial p-value calculation', () => {
    const mock = new MockSlumpProbabilityCalculator()

    // 10 games, 0 successes with p = 0.25, direction 'less_equal'
    const pZero = mock.testCalculateBinomialPValue(10, 0, 0.25, 'less_equal')
    const expectedPZero = Math.pow(0.75, 10)
    assert.ok(Math.abs(pZero - expectedPZero) < 0.0001)

    // 10 games, 10 successes with p = 0.25, direction 'greater_equal'
    const pTen = mock.testCalculateBinomialPValue(10, 10, 0.25, 'greater_equal')
    const expectedPTen = Math.pow(0.25, 10)
    assert.ok(Math.abs(pTen - expectedPTen) < 0.0001)

    // Edge cases
    assert.strictEqual(mock.testCalculateBinomialPValue(0, 0, 0.25, 'greater_equal'), 1)
    assert.strictEqual(mock.testCalculateBinomialPValue(10, -1, 0.25, 'less_equal'), 0)
    assert.strictEqual(mock.testCalculateBinomialPValue(10, 11, 0.25, 'greater_equal'), 0)
    assert.strictEqual(mock.testCalculateBinomialPValue(10, 0, 0, 'greater_equal'), 1)
    assert.strictEqual(mock.testCalculateBinomialPValue(10, 5, 0, 'greater_equal'), 0)
    assert.strictEqual(mock.testCalculateBinomialPValue(10, 10, 1, 'less_equal'), 1)
})

test('SlumpProbabilityCalculator - Survival probability in 2,000 games', () => {
    const mock = new MockSlumpProbabilityCalculator()

    // Normal or better run: survival prob = 1.0
    const normalProb = mock.testCalculateSurvivalProbability(0.5, 10, 2000)
    assert.strictEqual(normalProb, 1.0)

    // Single window p-value = 0.01 in 10-game window (200 windows in 2000 games)
    // 1 - (1 - 0.01)^200 = 1 - 0.99^200 ≈ 0.866
    const prob01 = mock.testCalculateSurvivalProbability(0.01, 10, 2000)
    assert.ok(Math.abs(prob01 - 0.866) < 0.01, `Expected ~0.866, got ${prob01}`)

    // Extremely rare slump: p-value = 0.0001
    // 1 - (1 - 0.0001)^200 ≈ 1 - 0.9802 = 0.020
    const probRare = mock.testCalculateSurvivalProbability(0.0001, 10, 2000)
    assert.ok(Math.abs(probRare - 0.02) < 0.005, `Expected ~0.02, got ${probRare}`)
})

test('SlumpProbabilityCalculator - 4P Normal run evaluation', () => {
    const calc = new SlumpProbabilityCalculator()
    const input: SlumpCalculationInput = {
        gameMode: '4p',
        ranks: [1, 2, 3, 4, 1, 2, 3, 4, 2, 3] // mean = 2.5
    }

    const result = calc.calculateSlumpSeverity(input)
    assert.strictEqual(result.status, 'NORMAL')
    assert.strictEqual(result.zScore, 0)
    assert.strictEqual(result.percentile, 50.0)
    assert.strictEqual(result.occurrenceProbability, 1.0)
    assert.ok(result.message.includes('정상적인 분산 범위'))
})

test('SlumpProbabilityCalculator - 4P Mild slump evaluation', () => {
    const calc = new SlumpProbabilityCalculator()
    // 10 games with average rank ~2.9: [3, 4, 3, 2, 4, 3, 2, 3, 4, 1]
    const input: SlumpCalculationInput = {
        gameMode: '4p',
        ranks: [3, 4, 3, 2, 4, 3, 2, 3, 4, 1]
    }

    const result = calc.calculateSlumpSeverity(input)
    assert.strictEqual(result.status, 'MILD_SLUMP')
    assert.ok(result.zScore < 0)
    assert.ok(result.percentile < 15.0)
    assert.ok(result.message.includes('가벼운 하후카 구간'))
})

test('SlumpProbabilityCalculator - 4P Severe Harfuka evaluation', () => {
    const calc = new SlumpProbabilityCalculator()
    // 10 games with average rank 3.2: [4, 4, 2, 4, 3, 3, 4, 2, 4, 2]
    const input: SlumpCalculationInput = {
        gameMode: '4p',
        ranks: [4, 4, 2, 4, 3, 3, 4, 2, 4, 2]
    }

    const result = calc.calculateSlumpSeverity(input)
    assert.strictEqual(result.status, 'SEVERE_HARFUKA')
    assert.ok(result.zScore <= -1.96)
    assert.ok(result.percentile <= 2.5)
    assert.ok(result.message.includes('심각한 하후카'))
})

test('SlumpProbabilityCalculator - 4P Extreme Hell Mode evaluation', () => {
    const calc = new SlumpProbabilityCalculator()
    // 10 consecutive 4th places: worst possible 10-game stretch
    const input: SlumpCalculationInput = {
        gameMode: '4p',
        ranks: [4, 4, 4, 4, 4, 4, 4, 4, 4, 4]
    }

    const result = calc.calculateSlumpSeverity(input)
    assert.strictEqual(result.status, 'HELL_MODE')
    assert.ok(result.zScore <= -2.8)
    assert.ok(result.percentile <= 0.3)
    assert.ok(result.occurrenceProbability < 0.25)
    assert.ok(result.message.includes('지옥 모드'))
})

test('SlumpProbabilityCalculator - 3P Mode Slump evaluation (3rd place is last)', () => {
    const calc = new SlumpProbabilityCalculator()
    // 3P mode: baseline mean is 2.0, last place is 3.
    // 10 games with seven 3rd places and three 2nd places (mean = 2.7)
    const input: SlumpCalculationInput = {
        gameMode: '3p',
        ranks: [3, 3, 3, 2, 3, 3, 2, 3, 3, 2]
    }

    const result = calc.calculateSlumpSeverity(input)
    assert.ok(result.status === 'SEVERE_HARFUKA' || result.status === 'HELL_MODE')
    assert.ok(result.zScore < -2.0)
    assert.strictEqual(result.sampleMean, 2.7)
    assert.ok(result.lastPlacePValue !== undefined && result.lastPlacePValue < 0.05)
    assert.ok(result.message.includes('최근 라스 집중 확률'))
})

test('SlumpProbabilityCalculator - Custom player baseline support', () => {
    const calc = new SlumpProbabilityCalculator()
    // High-dan expert player expecting avg rank 2.20 in 4P
    const input: SlumpCalculationInput = {
        gameMode: '4p',
        ranks: [3, 3, 2, 3, 4, 3, 2, 3, 3, 2], // mean = 2.80
        baseline: {
            expectedAverageRank: 2.20,
            rankVariance: 1.10,
            lastPlaceRate: 0.18,
            firstPlaceRate: 0.30
        }
    }

    const result = calc.calculateSlumpSeverity(input)
    // Compared to 2.20 baseline, mean 2.80 is a severe deviation
    assert.ok(result.zScore <= -1.96)
    assert.ok(result.status === 'SEVERE_HARFUKA' || result.status === 'HELL_MODE')
})
