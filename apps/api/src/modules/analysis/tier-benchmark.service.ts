/*_ GEMINI THINKING _*/
import { Injectable } from '@nestjs/common'
import {
    GameMode,
    TierKey,
    TierBenchmarkDistribution,
    TierComparisonResult,
    GenerateShareCardParams
} from '@mahjong-sensei/types'
import {
    TIER_BENCHMARKS,
    resolveTierKey,
    normalCdf,
    calculatePercentile,
    escapeXml,
    generateShareCardSvg
} from '@mahjong-sensei/mahjong-core'

export type {
    TierKey,
    TierBenchmarkDistribution,
    TierComparisonResult,
    GenerateShareCardParams
}

@Injectable()
export class TierBenchmarkService {
    private readonly distributions = TIER_BENCHMARKS

    public constructor() {}

    public getTierComparison(
        mode: GameMode,
        tier: string,
        playerLuck: number,
        playerSkill: number
    ): TierComparisonResult {
        /*_ GEMINI THINKING _*/
        const resolvedTier = this.resolveTierKey(tier)
        const validMode: GameMode = mode === '3p' ? '3p' : '4p'
        const tierGroup = this.distributions[validMode]
        const benchmark = tierGroup[resolvedTier]

        const luckDelta = Math.round((playerLuck - benchmark.avgLuckScore) * 10) / 10
        const skillDelta = Math.round((playerSkill - benchmark.avgSkillScore) * 10) / 10

        const luckPercentile = this.calculatePercentile(playerLuck, benchmark.avgLuckScore, benchmark.luckStdDev)
        const skillPercentile = this.calculatePercentile(playerSkill, benchmark.avgSkillScore, benchmark.skillStdDev)

        const allTiers: readonly TierBenchmarkDistribution[] = [
            tierGroup.NOVICE_ADEPT,
            tierGroup.EXPERT,
            tierGroup.MASTER,
            tierGroup.SAINT
        ]

        return {
            mode: validMode,
            tier: resolvedTier,
            tierLabel: benchmark.tierLabel,
            benchmark,
            playerLuck,
            playerSkill,
            luckDelta,
            skillDelta,
            luckPercentile,
            skillPercentile,
            allTiers
        }
    }

    public generateShareCardSvg(params: GenerateShareCardParams): string {
        /*_ GEMINI THINKING _*/
        return generateShareCardSvg(params)
    }

    protected resolveTierKey(tier: string): TierKey {
        /*_ GEMINI THINKING _*/
        return resolveTierKey(tier)
    }

    protected normalCdf(z: number): number {
        /*_ GEMINI THINKING _*/
        return normalCdf(z)
    }

    protected calculatePercentile(value: number, mean: number, stdDev: number): number {
        /*_ GEMINI THINKING _*/
        return calculatePercentile(value, mean, stdDev)
    }

    protected escapeXml(unsafe: string): string {
        /*_ GEMINI THINKING _*/
        return escapeXml(unsafe)
    }
}
