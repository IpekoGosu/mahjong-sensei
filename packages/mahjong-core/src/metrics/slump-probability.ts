/*_ GEMINI THINKING _*/
import { GameMode, SlumpStatus, SlumpSeverityResult } from '@mahjong-sensei/types'
import { normalCdf } from '../tier-benchmark'

export interface SlumpBaseline {
    readonly expectedAverageRank?: number
    readonly rankVariance?: number
    readonly lastPlaceRate?: number
    readonly firstPlaceRate?: number
}

export interface SlumpCalculationInput {
    readonly gameMode: GameMode
    readonly ranks: readonly number[]
    readonly baseline?: SlumpBaseline
    readonly horizonGames?: number
}

export class SlumpProbabilityCalculator {
    /*_ GEMINI THINKING _*/
    public calculateSlumpSeverity(input: SlumpCalculationInput): SlumpSeverityResult {
        const ranks = input.ranks
        const n = ranks.length

        if (n === 0) {
            return {
                percentile: 50.0,
                occurrenceProbability: 1.0,
                zScore: 0,
                status: 'NORMAL',
                message: '대국 데이터가 충분하지 않습니다.'
            }
        }

        const is3P = input.gameMode === '3p'
        const defaultBaselineMean = is3P ? 2.0 : 2.5
        const defaultBaselineVariance = is3P ? 2 / 3 : 1.25
        const defaultLastPlaceRate = is3P ? 1 / 3 : 0.25
        const defaultTopPlaceRate = is3P ? 1 / 3 : 0.25
        const lastRank = is3P ? 3 : 4

        const baselineMean = input.baseline?.expectedAverageRank ?? defaultBaselineMean
        const baselineVariance = input.baseline?.rankVariance ?? defaultBaselineVariance
        const baselineLastRate = input.baseline?.lastPlaceRate ?? defaultLastPlaceRate
        const baselineTopRate = input.baseline?.firstPlaceRate ?? defaultTopPlaceRate

        const { mean, variance } = this.calculateMeanAndVariance(ranks)
        const z = this.calculateZScore(mean, variance, n, baselineMean, baselineVariance)
        const zScore = Number(z.toFixed(2))

        const cdf = normalCdf(z)
        const rawPercentile = cdf * 100
        const percentile = rawPercentile < 0.1
            ? Math.max(0.01, Number(rawPercentile.toFixed(2)))
            : Number(rawPercentile.toFixed(1))

        const kLast = ranks.filter((r) => r === lastRank).length
        const kTop = ranks.filter((r) => r === 1).length

        const lastPlacePValue = Number(
            this.calculateBinomialPValue(n, kLast, baselineLastRate, 'greater_equal').toFixed(4)
        )
        const topPlacePValue = Number(
            this.calculateBinomialPValue(n, kTop, baselineTopRate, 'less_equal').toFixed(4)
        )

        const horizon = input.horizonGames ?? 2000
        const occurrenceProbability = this.calculateSurvivalProbability(cdf, n, horizon)

        const status = this.determineStatus(zScore, percentile, lastPlacePValue, topPlacePValue)
        const message = this.buildMessage(
            status,
            percentile,
            occurrenceProbability,
            lastPlacePValue,
            topPlacePValue
        )

        return {
            percentile,
            occurrenceProbability,
            zScore,
            status,
            message,
            lastPlacePValue,
            topPlacePValue,
            sampleMean: Number(mean.toFixed(2)),
            sampleVariance: Number(variance.toFixed(3))
        }
    }

    /*_ GEMINI THINKING _*/
    protected calculateMeanAndVariance(ranks: readonly number[]): { mean: number; variance: number } {
        const n = ranks.length
        if (n === 0) {
            return { mean: 0, variance: 0 }
        }

        let sum = 0
        for (const r of ranks) {
            sum += r
        }
        const mean = sum / n

        if (n === 1) {
            return { mean, variance: 0 }
        }

        let varianceSum = 0
        for (const r of ranks) {
            const diff = r - mean
            varianceSum += diff * diff
        }
        const variance = varianceSum / (n - 1)

        return { mean, variance }
    }

    /*_ GEMINI THINKING _*/
    protected calculateZScore(
        sampleMean: number,
        sampleVariance: number,
        sampleSize: number,
        baselineMean: number,
        baselineVariance: number
    ): number {
        if (sampleSize <= 0) {
            return 0
        }

        // 표본 분산이 너무 작거나 0인 경우(동일 순위 연속 등) 베이스라인 분산으로 보정
        const effectiveVariance = sampleVariance > 0.05 ? sampleVariance : baselineVariance
        const standardError = Math.sqrt(effectiveVariance / sampleSize)

        if (standardError <= 0) {
            return 0
        }

        // 마작에서는 평균 순위 수치가 높을수록 나쁜 성적(불운)이므로 (baselineMean - sampleMean) / SE 로 산출
        // 결과적으로 성적이 나쁠수록 음수(-) Z-Score가 산출됨
        return (baselineMean - sampleMean) / standardError
    }

    /*_ GEMINI THINKING _*/
    protected calculateBinomialPValue(
        n: number,
        k: number,
        p: number,
        direction: 'greater_equal' | 'less_equal'
    ): number {
        if (n <= 0) {
            return 1
        }
        if (p <= 0) {
            if (direction === 'greater_equal') {
                return k <= 0 ? 1 : 0
            }
            return 1
        }
        if (p >= 1) {
            if (direction === 'less_equal') {
                return k >= n ? 1 : 0
            }
            return 1
        }

        if (direction === 'greater_equal') {
            if (k <= 0) {
                return 1
            }
            if (k > n) {
                return 0
            }
            let cumulative = 0
            for (let j = k; j <= n; j++) {
                cumulative += this.calculateBinomialPmf(n, j, p)
            }
            return Math.min(1, Math.max(0, cumulative))
        } else {
            if (k < 0) {
                return 0
            }
            if (k >= n) {
                return 1
            }
            let cumulative = 0
            for (let j = 0; j <= k; j++) {
                cumulative += this.calculateBinomialPmf(n, j, p)
            }
            return Math.min(1, Math.max(0, cumulative))
        }
    }

    /*_ GEMINI THINKING _*/
    protected calculateBinomialPmf(n: number, k: number, p: number): number {
        if (k < 0 || k > n) {
            return 0
        }
        if (k === 0) {
            return Math.pow(1 - p, n)
        }
        if (k === n) {
            return Math.pow(p, n)
        }

        let logComb = 0
        for (let i = 1; i <= k; i++) {
            logComb += Math.log(n - k + i) - Math.log(i)
        }
        const logProb = logComb + k * Math.log(p) + (n - k) * Math.log(1 - p)
        return Math.exp(logProb)
    }

    /*_ GEMINI THINKING _*/
    protected calculateSurvivalProbability(
        singleWindowPValue: number,
        windowSize: number,
        horizonGames: number
    ): number {
        if (windowSize <= 0 || horizonGames <= 0) {
            return 1.0
        }

        // Z >= 0 (평균 이상의 호조/정상)인 경우 조우 확률은 사실상 100%
        if (singleWindowPValue >= 0.5) {
            return 1.0
        }

        const windowsCount = Math.max(1, Math.floor(horizonGames / windowSize))
        // 단일 윈도우에서 이 정도 불운을 겪을 확률이 singleWindowPValue일 때,
        // windowsCount번의 독립 윈도우 중 한 번이라도 조우할 확률 = 1 - (1 - singleWindowPValue)^windowsCount
        const probNeverEncounter = Math.pow(1 - singleWindowPValue, windowsCount)
        const encounterProb = 1 - probNeverEncounter

        return Number(Math.max(0, Math.min(1, encounterProb)).toFixed(3))
    }

    /*_ GEMINI THINKING _*/
    protected determineStatus(
        zScore: number,
        percentile: number,
        lastPlacePValue: number,
        topPlacePValue: number
    ): SlumpStatus {
        if (zScore <= -3.0 || percentile <= 0.15) {
            return 'HELL_MODE'
        }

        if (
            zScore <= -1.96 ||
            percentile <= 2.5 ||
            (zScore <= -1.75 && (lastPlacePValue <= 0.02 || topPlacePValue <= 0.02))
        ) {
            return 'SEVERE_HARFUKA'
        }

        if (zScore <= -1.0 || percentile <= 16.0) {
            return 'MILD_SLUMP'
        }

        return 'NORMAL'
    }

    /*_ GEMINI THINKING _*/
    protected buildMessage(
        status: SlumpStatus,
        percentile: number,
        occurrenceProbability: number,
        lastPlacePValue: number,
        topPlacePValue: number
    ): string {
        const occPct = (occurrenceProbability * 100).toFixed(1)

        let detailRemarks = ''
        if (lastPlacePValue <= 0.05) {
            detailRemarks += ` 최근 라스 집중 확률은 ${(lastPlacePValue * 100).toFixed(1)}%로 극심한 억까를 겪고 있습니다.`
        } else if (topPlacePValue <= 0.05) {
            detailRemarks += ` 탑 획득 확률 역시 ${(topPlacePValue * 100).toFixed(1)}%로 억제되어 있습니다.`
        }

        switch (status) {
            case 'HELL_MODE':
                return `통계학적으로 상위 ${percentile}%에 해당하는 극단적인 억까 구간(지옥 모드)입니다. 2,000판 중 우연히 겪을 확률이 ${occPct}%에 불과하므로, 자책하지 마시고 잠시 휴식을 취하며 멘탈을 회복하세요.${detailRemarks}`
            case 'SEVERE_HARFUKA':
                return `상위 ${percentile}% 수준의 심각한 하후카(불운 구간)를 통과하고 있습니다. 2,000판 중 약 ${occPct}% 확률로 마주치는 시련이며, 실력 저하가 아닌 통계적 편차의 영향이 큽니다.${detailRemarks}`
            case 'MILD_SLUMP':
                return `가벼운 하후카 구간입니다 (상위 ${percentile}%). 마작에서 흔히 발생하는 단기 분산의 파도이니 평정심을 유지하며 타패 효율에 집중하세요.${detailRemarks}`
            case 'NORMAL':
            default:
                return `정상적인 분산 범위 내에서 순항 중입니다 (상위 ${percentile}%). 운에 흔들리지 않는 견고한 타패를 유지하고 있습니다.`
        }
    }
}
