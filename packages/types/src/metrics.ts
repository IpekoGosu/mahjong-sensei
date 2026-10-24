import { SeatIndex } from './paipu'

export type GameMode = '4p' | '3p'

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
    readonly isWin?: boolean
}

export interface RoundSkillMetric {
    readonly roundIndex: number
    readonly seat: SeatIndex
    readonly tileEfficiencyRate: number
    readonly dealInMistakeRate: number
    readonly foldAccuracyRate: number
    readonly skillScore: number
}

export type AiGrade = 'S+' | 'S' | 'A' | 'B' | 'C' | 'D'

export interface AiEvaluationBreakdown {
    readonly grade: AiGrade
    readonly aiScore: number
    readonly matchRate: number
    readonly attackGrade: AiGrade
    readonly defenseGrade: AiGrade
    readonly situationGrade: AiGrade
    readonly summaryComment: string
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
    readonly roomType?: string
    readonly aiEvaluation?: AiEvaluationBreakdown
}

export interface StyleDiagnosis {
    readonly title: string
    readonly description: string
    readonly attackType: string
    readonly defenseType: string
    readonly luckRemark?: string
    readonly skillRemark?: string
}

export interface StyleEvaluationInput {
    readonly gameMode: GameMode
    readonly winRate: number
    readonly dealInRate: number
    readonly riichiRate: number
    readonly furoRate: number
    readonly damatenRate: number
    readonly initiativeRate: number
    readonly uradoraRate: number
    readonly negativeRate?: number
    readonly averageRank?: number
    readonly topTwoRate?: number
    readonly averageLuckScore?: number
    readonly averageSkillScore?: number
}

export type SlumpStatus = 'NORMAL' | 'MILD_SLUMP' | 'SEVERE_HARFUKA' | 'HELL_MODE'

export interface SlumpSeverityResult {
    readonly percentile: number // 예: 0.6 (상위 0.6% 수준의 불운)
    readonly occurrenceProbability: number // 2000판 중 우연히 겪을 확률 (0~1)
    readonly zScore: number // 음수일수록 불운
    readonly status: SlumpStatus
    readonly message: string // 한글 안내 문구
    readonly lastPlacePValue?: number
    readonly topPlacePValue?: number
    readonly sampleMean?: number
    readonly sampleVariance?: number
}

export interface RollingWindowStats {
    readonly windowSize: RollingWindowSize
    readonly gameMode?: GameMode
    readonly totalGames: number
    readonly averageRank: number
    readonly topTwoRate: number
    readonly lastPlaceRate: number
    readonly negativeRate?: number
    readonly averageLuckScore: number
    readonly averageSkillScore: number
    readonly luckTrend: readonly number[]
    readonly rankTrend: readonly number[]
    readonly games: readonly GameMetricSummary[]
    readonly winRate?: number
    readonly dealInRate?: number
    readonly riichiRate?: number
    readonly furoRate?: number
    readonly damatenRate?: number
    readonly initiativeRate?: number
    readonly uradoraRate?: number
    readonly styleDiagnosis?: StyleDiagnosis
    readonly slumpSeverity?: SlumpSeverityResult
}

export type TierKey = 'NOVICE_ADEPT' | 'EXPERT' | 'MASTER' | 'SAINT'

export interface TierBenchmarkDistribution {
    readonly tier: TierKey
    readonly tierLabel: string
    readonly mode: GameMode
    readonly avgLuckScore: number
    readonly luckStdDev: number
    readonly avgSkillScore: number
    readonly skillStdDev: number
    readonly avgDealInRate: number
    readonly avgWinRate: number
    readonly startingShantenBaseline: number
}

export interface TierComparisonResult {
    readonly mode: GameMode
    readonly tier: TierKey
    readonly tierLabel: string
    readonly benchmark: TierBenchmarkDistribution
    readonly playerLuck: number
    readonly playerSkill: number
    readonly luckDelta: number
    readonly skillDelta: number
    readonly luckPercentile: number
    readonly skillPercentile: number
    readonly allTiers: readonly TierBenchmarkDistribution[]
}

export interface GenerateShareCardParams {
    readonly nickname: string
    readonly mode: GameMode
    readonly tierLabel: string
    readonly luckScore: number
    readonly skillScore: number
    readonly winRate: number
    readonly dealInRate: number
    readonly quadrant?: string | undefined
}

export type MistakeCategory =
    | 'SHANTEN_RETREAT'
    | 'UKEIRE_LOSS'
    | 'RECKLESS_PUSH_DEAL_IN'
    | 'DANGEROUS_MUSUJI_PUSH'

export interface CriticalMistakeHighlight {
    readonly roundIndex: number
    readonly turnNumber: number
    readonly discardedTile: string
    readonly optimalTile: string
    readonly prevShanten: number
    readonly afterShanten: number
    readonly optimalUkeire: number
    readonly actualUkeire: number
    readonly mistakeCategory: MistakeCategory
    readonly severityScore: number
    readonly coachingMessageKo: string
}

export interface GameCoachingReport {
    readonly gameId: string
    readonly targetSeat: SeatIndex
    readonly is3P: boolean
    readonly quadrant: PerformanceQuadrant
    readonly criticalMistakes: readonly CriticalMistakeHighlight[]
    readonly overallSummaryKo: string
    readonly actionableAdviceKo: readonly string[]
}

