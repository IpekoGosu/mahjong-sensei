import { SeatIndex } from './paipu'

export type RollingWindowSize = 10 | 30 | 50

export type PerformanceQuadrant =
    | 'SKILLFUL_WIN' // 1사분면: 실력 좋음 + 운 좋음
    | 'UNLUCKY_LOSS' // 2사분면: 실력 좋음 + 억까 (불운)
    | 'SLUMP_LOSS'   // 3사분면: 실력 저하 + 불운
    | 'LUCKY_FLUKE'  // 4사분면: 실력 부족 + 운빨 승리

export interface RoundLuckMetric {
    readonly roundIndex: number
    readonly seat: SeatIndex
    readonly startingShanten: number
    readonly startingDoraCount: number
    readonly drawEfficiencyRatio: number
    readonly uradoraCount: number
    readonly unavoidableDamage: number
    readonly luckScore: number
}

export interface RoundSkillMetric {
    readonly roundIndex: number
    readonly seat: SeatIndex
    readonly tileEfficiencyRate: number
    readonly dealInMistakeRate: number
    readonly foldAccuracyRate: number
    readonly skillScore: number
}

export interface GameMetricSummary {
    readonly gameId: string
    readonly timestamp: number
    readonly rank: number
    readonly finalScore: number
    readonly luckScore: number
    readonly skillScore: number
    readonly quadrant: PerformanceQuadrant
    readonly averageStartingShanten: number
    readonly dealInCount: number
    readonly winCount: number
}

export interface RollingWindowStats {
    readonly windowSize: RollingWindowSize
    readonly totalGames: number
    readonly averageRank: number
    readonly topTwoRate: number
    readonly lastPlaceRate: number
    readonly averageLuckScore: number
    readonly averageSkillScore: number
    readonly luckTrend: readonly number[]
    readonly rankTrend: readonly number[]
    readonly games: readonly GameMetricSummary[]
}
