/*_ GEMINI THINKING _*/
import test from 'node:test'
import assert from 'node:assert'
import {
    TierBenchmarkService,
    TierKey,
    TierComparisonResult
} from './tier-benchmark.service'

class MockTierBenchmarkService extends TierBenchmarkService {
    public constructor() {
        super()
    }

    public testCalculatePercentile(value: number, mean: number, stdDev: number): number {
        return this.calculatePercentile(value, mean, stdDev)
    }

    public testEscapeXml(unsafe: string): string {
        return this.escapeXml(unsafe)
    }

    public testResolveTierKey(tier: string): TierKey {
        return this.resolveTierKey(tier)
    }
}

test('MockTierBenchmarkService - resolveTierKey', () => {
    /*_ GEMINI THINKING _*/
    const service = new MockTierBenchmarkService()

    // Novice / Adept (작사)
    assert.strictEqual(service.testResolveTierKey('NOVICE_ADEPT'), 'NOVICE_ADEPT')
    assert.strictEqual(service.testResolveTierKey('adept'), 'NOVICE_ADEPT')
    assert.strictEqual(service.testResolveTierKey('novice'), 'NOVICE_ADEPT')
    assert.strictEqual(service.testResolveTierKey('작사'), 'NOVICE_ADEPT')
    assert.strictEqual(service.testResolveTierKey('  작사 2단  '), 'NOVICE_ADEPT')

    // Expert (작걸)
    assert.strictEqual(service.testResolveTierKey('EXPERT'), 'EXPERT')
    assert.strictEqual(service.testResolveTierKey('expert'), 'EXPERT')
    assert.strictEqual(service.testResolveTierKey('작걸'), 'EXPERT')
    assert.strictEqual(service.testResolveTierKey('작걸 3단'), 'EXPERT')

    // Master (작호)
    assert.strictEqual(service.testResolveTierKey('MASTER'), 'MASTER')
    assert.strictEqual(service.testResolveTierKey('master'), 'MASTER')
    assert.strictEqual(service.testResolveTierKey('작호'), 'MASTER')
    assert.strictEqual(service.testResolveTierKey('  작호 1단 '), 'MASTER')

    // Saint (작성)
    assert.strictEqual(service.testResolveTierKey('SAINT'), 'SAINT')
    assert.strictEqual(service.testResolveTierKey('saint'), 'SAINT')
    assert.strictEqual(service.testResolveTierKey('작성'), 'SAINT')

    // Fallback default
    assert.strictEqual(service.testResolveTierKey('unknown_tier'), 'EXPERT')
    assert.strictEqual(service.testResolveTierKey(''), 'EXPERT')
})

test('MockTierBenchmarkService - calculatePercentile', () => {
    /*_ GEMINI THINKING _*/
    const service = new MockTierBenchmarkService()

    // Exactly at the mean -> 50.0%
    const atMean = service.testCalculatePercentile(50.0, 50.0, 10.0)
    assert.strictEqual(atMean, 50.0)

    // 1 standard deviation above mean -> ~84.1%
    const plusOneStd = service.testCalculatePercentile(60.0, 50.0, 10.0)
    assert.strictEqual(plusOneStd, 84.1)

    // 1 standard deviation below mean -> ~15.9%
    const minusOneStd = service.testCalculatePercentile(40.0, 50.0, 10.0)
    assert.strictEqual(minusOneStd, 15.9)

    // 2 standard deviations above mean -> ~97.7%
    const plusTwoStd = service.testCalculatePercentile(70.0, 50.0, 10.0)
    assert.strictEqual(plusTwoStd, 97.7)

    // 2 standard deviations below mean -> ~2.3%
    const minusTwoStd = service.testCalculatePercentile(30.0, 50.0, 10.0)
    assert.strictEqual(minusTwoStd, 2.3)

    // Extreme high value -> capped at 99.9%
    const extremeHigh = service.testCalculatePercentile(120.0, 50.0, 10.0)
    assert.strictEqual(extremeHigh, 99.9)

    // Extreme low value -> capped at 0.1%
    const extremeLow = service.testCalculatePercentile(-20.0, 50.0, 10.0)
    assert.strictEqual(extremeLow, 0.1)

    // Zero std dev edge case
    assert.strictEqual(service.testCalculatePercentile(55.0, 50.0, 0), 100)
    assert.strictEqual(service.testCalculatePercentile(45.0, 50.0, 0), 0)
})

test('MockTierBenchmarkService - escapeXml', () => {
    /*_ GEMINI THINKING _*/
    const service = new MockTierBenchmarkService()

    const plain = 'Normal Player Name 123'
    assert.strictEqual(service.testEscapeXml(plain), 'Normal Player Name 123')

    const dangerous = '<script>alert("xss & hack")</script>\'test\''
    const escaped = service.testEscapeXml(dangerous)
    assert.strictEqual(escaped, '&lt;script&gt;alert(&quot;xss &amp; hack&quot;)&lt;/script&gt;&apos;test&apos;')
    assert.strictEqual(escaped.includes('<'), false)
    assert.strictEqual(escaped.includes('>'), false)
    assert.strictEqual(escaped.includes('"'), false)
})

test('TierBenchmarkService - getTierComparison (4p mode)', () => {
    /*_ GEMINI THINKING _*/
    const service = new TierBenchmarkService()

    const comparison: TierComparisonResult = service.getTierComparison('4p', 'MASTER', 52.0, 72.0)

    assert.strictEqual(comparison.mode, '4p')
    assert.strictEqual(comparison.tier, 'MASTER')
    assert.strictEqual(comparison.tierLabel, '작호 (Master)')
    assert.strictEqual(comparison.benchmark.startingShantenBaseline, 3.50)
    assert.strictEqual(comparison.benchmark.avgLuckScore, 50.0)
    assert.strictEqual(comparison.benchmark.avgSkillScore, 68.0)

    // Deltas: luck 52.0 - 50.0 = 2.0, skill 72.0 - 68.0 = 4.0
    assert.strictEqual(comparison.luckDelta, 2.0)
    assert.strictEqual(comparison.skillDelta, 4.0)

    // Percentiles should be > 50
    assert.strictEqual(comparison.luckPercentile > 50, true)
    assert.strictEqual(comparison.skillPercentile > 50, true)

    // All tiers baseline
    assert.strictEqual(comparison.allTiers.length, 4)
    for (const tier of comparison.allTiers) {
        assert.strictEqual(tier.mode, '4p')
        assert.strictEqual(tier.startingShantenBaseline, 3.50)
    }
})

test('TierBenchmarkService - getTierComparison (3p mode)', () => {
    /*_ GEMINI THINKING _*/
    const service = new TierBenchmarkService()

    const comparison = service.getTierComparison('3p', '작성', 48.0, 85.0)

    assert.strictEqual(comparison.mode, '3p')
    assert.strictEqual(comparison.tier, 'SAINT')
    assert.strictEqual(comparison.tierLabel, '작성 (Saint)')
    assert.strictEqual(comparison.benchmark.startingShantenBaseline, 3.25)
    assert.strictEqual(comparison.benchmark.avgSkillScore, 82.0)

    // Deltas: luck 48.0 - 50.0 = -2.0, skill 85.0 - 82.0 = 3.0
    assert.strictEqual(comparison.luckDelta, -2.0)
    assert.strictEqual(comparison.skillDelta, 3.0)

    // Percentiles
    assert.strictEqual(comparison.luckPercentile < 50, true)
    assert.strictEqual(comparison.skillPercentile > 50, true)

    // All tiers baseline
    assert.strictEqual(comparison.allTiers.length, 4)
    for (const tier of comparison.allTiers) {
        assert.strictEqual(tier.mode, '3p')
        assert.strictEqual(tier.startingShantenBaseline, 3.25)
    }
})

test('TierBenchmarkService - generateShareCardSvg', () => {
    /*_ GEMINI THINKING _*/
    const service = new TierBenchmarkService()

    const svgOutput = service.generateShareCardSvg({
        nickname: '<Special> & "Master"',
        mode: '4p',
        tierLabel: '작호 (Master)',
        luckScore: 65.4,
        skillScore: 78.2,
        winRate: 24.5,
        dealInRate: 11.2,
        quadrant: 'SKILLFUL_WIN'
    })

    // Must be valid SVG structure
    assert.strictEqual(svgOutput.startsWith('<svg xmlns="http://www.w3.org/2000/svg"'), true)
    assert.strictEqual(svgOutput.endsWith('</svg>'), true)
    assert.strictEqual(svgOutput.includes('viewBox="0 0 1200 630"'), true)

    // Nickname special characters must be escaped
    assert.strictEqual(svgOutput.includes('&lt;Special&gt; &amp; &quot;Master&quot;'), true)
    assert.strictEqual(svgOutput.includes('<Special>'), false)

    // Formatted stats presence
    assert.strictEqual(svgOutput.includes('65.4'), true)
    assert.strictEqual(svgOutput.includes('78.2'), true)
    assert.strictEqual(svgOutput.includes('24.5%'), true)
    assert.strictEqual(svgOutput.includes('11.2%'), true)
    assert.strictEqual(svgOutput.includes('4인마 (4P)'), true)
    assert.strictEqual(svgOutput.includes('SKILLFUL_WIN'), true)

    // Quadrant variations
    const unluckySvg = service.generateShareCardSvg({
        nickname: 'UnluckyPlayer',
        mode: '3p',
        tierLabel: '작걸 (Expert)',
        luckScore: 32.1,
        skillScore: 75.0,
        winRate: 28.0,
        dealInRate: 14.0,
        quadrant: 'UNLUCKY_LOSS'
    })
    assert.strictEqual(unluckySvg.includes('UNLUCKY_LOSS'), true)
    assert.strictEqual(unluckySvg.includes('3인마 (3P)'), true)

    const slumpSvg = service.generateShareCardSvg({
        nickname: 'SlumpPlayer',
        mode: '4p',
        tierLabel: '작사 (Adept)',
        luckScore: 35.0,
        skillScore: 40.0,
        winRate: 18.0,
        dealInRate: 17.0,
        quadrant: 'SLUMP_LOSS'
    })
    assert.strictEqual(slumpSvg.includes('SLUMP_LOSS'), true)

    const flukeSvg = service.generateShareCardSvg({
        nickname: 'FlukePlayer',
        mode: '4p',
        tierLabel: '작걸 (Expert)',
        luckScore: 80.0,
        skillScore: 45.0,
        winRate: 26.0,
        dealInRate: 16.0,
        quadrant: 'LUCKY_FLUKE'
    })
    assert.strictEqual(flukeSvg.includes('LUCKY_FLUKE'), true)
})

test('TierBenchmarkService - low rate boundary without distortion (0 < rate <= 1.0%)', () => {
    /*_ GEMINI THINKING _*/
    const service = new TierBenchmarkService()

    // Testing rates <= 1.0% that were previously distorted by > 1 heuristic
    const svgOutput = service.generateShareCardSvg({
        nickname: 'IronWall',
        mode: '4p',
        tierLabel: '작성 (Saint)',
        luckScore: 50.0,
        skillScore: 85.0,
        winRate: 1.0,
        dealInRate: 0.8,
        quadrant: 'SKILLFUL_WIN'
    })

    assert.strictEqual(svgOutput.includes('1.0%'), true)
    assert.strictEqual(svgOutput.includes('0.8%'), true)
    assert.strictEqual(svgOutput.includes('100.0%'), false)
    assert.strictEqual(svgOutput.includes('80.0%'), false)
})

test('TierBenchmarkService - quadrant fallback from coordinates when omitted or invalid', () => {
    /*_ GEMINI THINKING _*/
    const service = new TierBenchmarkService()

    // 1. Skill >= 50, Luck >= 50 -> SKILLFUL_WIN
    const q1Svg = service.generateShareCardSvg({
        nickname: 'Player1',
        mode: '4p',
        tierLabel: '작호',
        luckScore: 70.0,
        skillScore: 80.0,
        winRate: 25.0,
        dealInRate: 10.0
    })
    assert.strictEqual(q1Svg.includes('SKILLFUL_WIN'), true)
    assert.strictEqual(q1Svg.includes('실력 &amp; 운의 조화로운 승리'), true)

    // 2. Skill >= 50, Luck < 50 -> UNLUCKY_LOSS
    const q2Svg = service.generateShareCardSvg({
        nickname: 'Player2',
        mode: '4p',
        tierLabel: '작호',
        luckScore: 30.0,
        skillScore: 80.0,
        winRate: 22.0,
        dealInRate: 11.0,
        quadrant: ''
    })
    assert.strictEqual(q2Svg.includes('UNLUCKY_LOSS'), true)
    assert.strictEqual(q2Svg.includes('억까 패배 (멘탈 케어)'), true)

    // 3. Skill < 50, Luck < 50 -> SLUMP_LOSS
    const q3Svg = service.generateShareCardSvg({
        nickname: 'Player3',
        mode: '4p',
        tierLabel: '작사',
        luckScore: 30.0,
        skillScore: 40.0,
        winRate: 15.0,
        dealInRate: 18.0,
        quadrant: 'unknown_quadrant'
    })
    assert.strictEqual(q3Svg.includes('SLUMP_LOSS'), true)
    assert.strictEqual(q3Svg.includes('슬럼프 / 틸트 경고'), true)

    // 4. Skill < 50, Luck >= 50 -> LUCKY_FLUKE
    const q4Svg = service.generateShareCardSvg({
        nickname: 'Player4',
        mode: '4p',
        tierLabel: '작걸',
        luckScore: 75.0,
        skillScore: 40.0,
        winRate: 28.0,
        dealInRate: 16.0
    })
    assert.strictEqual(q4Svg.includes('LUCKY_FLUKE'), true)
    assert.strictEqual(q4Svg.includes('운빨 승리 (복기 추천)'), true)
})
