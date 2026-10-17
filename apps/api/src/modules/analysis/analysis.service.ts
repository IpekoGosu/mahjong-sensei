import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import {
    GameMode,
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
        windowSize: RollingWindowSize,
        mode: GameMode = '3p'
    ): Promise<RollingWindowStats> {
        const roomFilter = mode === '3p'
            ? { contains: '3인' }
            : { not: { contains: '3인' } }

        const participants = await this.prisma.gameParticipant.findMany({
            where: {
                player: { accountId },
                game: {
                    roomType: roomFilter
                }
            },
            include: {
                game: {
                    include: {
                        rounds: {
                            include: {
                                roundMetrics: true
                            }
                        }
                    }
                }
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

        const lastRank = mode === '3p' ? 3 : 4

        for (const p of participants) {
            totalRank += p.finalRank
            if (p.finalRank <= 2) {
                topTwoCount++
            }
            if (p.finalRank === lastRank) {
                lastPlaceCount++
            }
            totalLuck += p.luckScore
            totalSkill += p.skillScore

            const quadrant: PerformanceQuadrant = this.metricCalc.classifyQuadrant(p.luckScore, p.skillScore)

            // Compute per-game round metrics for player's seat
            let totalShanten = 0
            let myRoundsCount = 0
            let dealInCount = 0
            let winCount = 0

            for (const round of p.game.rounds) {
                const metric = round.roundMetrics.find((m) => m.seat === p.seat)
                if (metric) {
                    totalShanten += metric.startShanten
                    myRoundsCount++
                    if (metric.dealInScore > 0) {
                        dealInCount++
                    }
                    /*_ GEMINI THINKING _*/
                    // 화료 여부는 RoundMetric의 isWin 플래그를 기준으로 정확하게 판정
                    if (metric.isWin) {
                        winCount++
                    }
                }
            }

            const avgShanten = myRoundsCount > 0 ? Number((totalShanten / myRoundsCount).toFixed(1)) : 3.5

            games.push({
                gameId: p.gameId,
                timestamp: p.game.gameDate.getTime(),
                rank: p.finalRank,
                finalScore: p.finalScore,
                luckScore: p.luckScore,
                skillScore: p.skillScore,
                quadrant,
                averageStartingShanten: avgShanten,
                dealInCount,
                winCount
            })

            luckTrend.push(p.luckScore)
            rankTrend.push(p.finalRank)
        }

        const count = participants.length
        return {
            windowSize,
            gameMode: mode,
            totalGames: count,
            averageRank: Number((totalRank / count).toFixed(2)),
            topTwoRate: Number(((topTwoCount / count) * 100).toFixed(1)),
            lastPlaceRate: Number(((lastPlaceCount / count) * 100).toFixed(1)),
            averageLuckScore: Number((totalLuck / count).toFixed(1)),
            averageSkillScore: Number((totalSkill / count).toFixed(1)),
            luckTrend: [...luckTrend].reverse(),
            rankTrend: [...rankTrend].reverse(),
            games
        }
    }
}
