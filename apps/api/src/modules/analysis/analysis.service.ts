import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import {
    RollingWindowSize,
    RollingWindowStats,
    GameMetricSummary,
    PerformanceQuadrant
} from '@mahjong-sensei/types'
import { MetricCalculator } from '@mahjong-sensei/mahjong-core'

@Injectable()
export class AnalysisService {
    private readonly metricCalc: MetricCalculator = new MetricCalculator()

    public constructor(private readonly prisma: PrismaService) {}

    public async getRollingStats(
        accountId: number,
        windowSize: RollingWindowSize
    ): Promise<RollingWindowStats> {
        const participants = await this.prisma.gameParticipant.findMany({
            where: {
                player: { accountId }
            },
            include: {
                game: true
            },
            orderBy: {
                game: { gameDate: 'desc' }
            },
            take: windowSize
        })

        if (participants.length === 0) {
            return {
                windowSize,
                totalGames: 0,
                averageRank: 0,
                topTwoRate: 0,
                lastPlaceRate: 0,
                averageLuckScore: 0,
                averageSkillScore: 0,
                luckTrend: [],
                rankTrend: [],
                games: []
            }
        }

        let totalRank = 0
        let topTwoCount = 0
        let lastPlaceCount = 0
        let totalLuck = 0
        let totalSkill = 0

        const games: GameMetricSummary[] = []
        const luckTrend: number[] = []
        const rankTrend: number[] = []

        for (const p of participants) {
            totalRank += p.finalRank
            if (p.finalRank <= 2) {
                topTwoCount++
            }
            if (p.finalRank === 4) {
                lastPlaceCount++
            }
            totalLuck += p.luckScore
            totalSkill += p.skillScore

            const quadrant: PerformanceQuadrant = this.metricCalc.classifyQuadrant(p.luckScore, p.skillScore)

            games.push({
                gameId: p.gameId,
                timestamp: p.game.gameDate.getTime(),
                rank: p.finalRank,
                finalScore: p.finalScore,
                luckScore: p.luckScore,
                skillScore: p.skillScore,
                quadrant,
                averageStartingShanten: 3.4,
                dealInCount: 1,
                winCount: 2
            })

            luckTrend.push(p.luckScore)
            rankTrend.push(p.finalRank)
        }

        const count = participants.length
        return {
            windowSize,
            totalGames: count,
            averageRank: Number((totalRank / count).toFixed(2)),
            topTwoRate: Number(((topTwoCount / count) * 100).toFixed(1)),
            lastPlaceRate: Number(((lastPlaceCount / count) * 100).toFixed(1)),
            averageLuckScore: Number((totalLuck / count).toFixed(1)),
            averageSkillScore: Number((totalSkill / count).toFixed(1)),
            luckTrend,
            rankTrend,
            games
        }
    }
}
