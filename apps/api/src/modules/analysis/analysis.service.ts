import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import {
    GameMode,
    RollingWindowSize,
    RollingWindowStats,
    GameMetricSummary,
    PerformanceQuadrant
} from '@mahjong-sensei/types'
import { MetricCalculator, AiRankEvaluator, StyleEvaluator } from '@mahjong-sensei/mahjong-core'

export type ParticipantWithGameRounds = {
    readonly id: string
    readonly gameId: string
    readonly playerId: string
    readonly seat: number
    readonly finalScore: number
    readonly finalRank: number
    readonly luckScore: number
    readonly skillScore: number
    readonly game: {
        readonly id: string
        readonly roomType: string
        readonly gameDate: Date
        readonly rounds: readonly {
            readonly id: string
            readonly roundIndex: number
            readonly roundMetrics: readonly {
                readonly seat: number
                readonly startShanten: number
                readonly startDoraCount: number
                readonly drawLuckRatio: number
                readonly uradoraHits: number
                readonly dealInScore: number
                readonly tsumoLossScore: number
                readonly tileEfficiency: number
                readonly luckScore: number
                readonly skillScore: number
                readonly isWin: boolean
                readonly isRiichi: boolean
                readonly isFuro: boolean
                readonly isDamaten: boolean
                readonly isInitiative: boolean
            }[]
        }[]
    }
}

@Injectable()
export class AnalysisService {
    private readonly metricCalc: MetricCalculator = new MetricCalculator()
    private readonly aiRankEvaluator: AiRankEvaluator = new AiRankEvaluator()
    private readonly styleEvaluator: StyleEvaluator = new StyleEvaluator()

    public constructor(private readonly prisma: PrismaService) {}

    protected async fetchParticipants(
        accountId: number,
        roomFilter: { readonly contains: string } | { readonly not: { readonly contains: string } },
        windowSize: RollingWindowSize
    ): Promise<readonly ParticipantWithGameRounds[]> {
        return this.prisma.gameParticipant.findMany({
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
    }

    public async getRollingStats(
        accountId: number,
        windowSize: RollingWindowSize,
        mode: GameMode = '3p'
    ): Promise<RollingWindowStats> {
        const roomFilter = mode === '3p'
            ? { contains: '3인' }
            : { not: { contains: '3인' } }

        const participants = await this.fetchParticipants(accountId, roomFilter, windowSize)

        if (participants.length === 0) {
            return {
                windowSize,
                gameMode: mode,
                totalGames: 0,
                averageRank: 0,
                topTwoRate: 0,
                lastPlaceRate: 0,
                averageLuckScore: 0,
                averageSkillScore: 0,
                luckTrend: [],
                rankTrend: [],
                games: [],
                winRate: 0,
                dealInRate: 0,
                riichiRate: 0,
                furoRate: 0,
                damatenRate: 0,
                initiativeRate: 0,
                uradoraRate: 0
            }
        }

        let totalRank = 0
        let topTwoCount = 0
        let lastPlaceCount = 0
        let totalLuck = 0
        let totalSkill = 0

        let windowTotalRounds = 0
        let windowWinCount = 0
        let windowDealInCount = 0
        let windowRiichiCount = 0
        let windowFuroCount = 0
        let windowDamatenCount = 0
        let windowInitiativeCount = 0
        let windowUradoraHitsCount = 0
        let windowRiichiWinCount = 0

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
                    windowTotalRounds++

                    if (metric.dealInScore > 0) {
                        dealInCount++
                        windowDealInCount++
                    }
                    /*_ GEMINI THINKING _*/
                    // 화료 여부는 RoundMetric의 isWin 플래그를 기준으로 정확하게 판정
                    if (metric.isWin) {
                        winCount++
                        windowWinCount++
                        if (metric.isRiichi) {
                            windowRiichiWinCount++
                        }
                    }
                    if (metric.isRiichi) {
                        windowRiichiCount++
                        if (metric.isInitiative) {
                            windowInitiativeCount++
                        }
                    }
                    if (metric.isFuro) {
                        windowFuroCount++
                    }
                    if (metric.isDamaten) {
                        windowDamatenCount++
                    }
                    if (metric.uradoraHits > 0) {
                        windowUradoraHitsCount++
                    }
                }
            }

            const avgShanten = myRoundsCount > 0 ? Number((totalShanten / myRoundsCount).toFixed(2)) : 3.5

            /*_ GEMINI THINKING _*/
            // 단일 라운드만 저장된 합성 대국(rounds.length <= 1 또는 myRoundsCount <= 1)의 경우
            // roomType을 참조하여 동풍전은 4국, 반장전은 8국을 표준 분모로 사용하여 공수 평점 극단화 방지
            const effectiveTotalRounds = (p.game.rounds.length > 1 && myRoundsCount > 1)
                ? p.game.rounds.length
                : (p.game.roomType?.includes('동풍') ? 4 : 8)

            const aiEvaluation = this.aiRankEvaluator.evaluateSummaryGame({
                rank: p.finalRank,
                finalScore: p.finalScore,
                roomType: p.game.roomType,
                gameMode: mode,
                luckScore: p.luckScore,
                skillScore: p.skillScore,
                averageStartingShanten: avgShanten,
                winCount,
                dealInCount,
                totalRounds: effectiveTotalRounds
            })

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
                winCount,
                roomType: p.game.roomType,
                aiEvaluation
            })

            luckTrend.push(p.luckScore)
            rankTrend.push(p.finalRank)
        }

        const count = participants.length
        const averageRank = Number((totalRank / count).toFixed(2))
        const topTwoRate = Number(((topTwoCount / count) * 100).toFixed(1))
        const lastPlaceRate = Number(((lastPlaceCount / count) * 100).toFixed(1))
        const averageLuckScore = Number((totalLuck / count).toFixed(1))
        const averageSkillScore = Number((totalSkill / count).toFixed(1))

        const winRate = windowTotalRounds > 0
            ? Number(((windowWinCount / windowTotalRounds) * 100).toFixed(1))
            : 0

        const dealInRate = windowTotalRounds > 0
            ? Number(((windowDealInCount / windowTotalRounds) * 100).toFixed(1))
            : 0

        const riichiRate = windowTotalRounds > 0
            ? Number(((windowRiichiCount / windowTotalRounds) * 100).toFixed(1))
            : 0

        const furoRate = windowTotalRounds > 0
            ? Number(((windowFuroCount / windowTotalRounds) * 100).toFixed(1))
            : 0

        const damatenRate = windowWinCount > 0
            ? Number(((windowDamatenCount / windowWinCount) * 100).toFixed(1))
            : 0

        const initiativeRate = windowRiichiCount > 0
            ? Number(((windowInitiativeCount / windowRiichiCount) * 100).toFixed(1))
            : 0

        const uradoraRate = windowRiichiWinCount > 0
            ? Number(((windowUradoraHitsCount / windowRiichiWinCount) * 100).toFixed(1))
            : 0

        const styleDiagnosis = this.styleEvaluator.evaluateStyle({
            gameMode: mode,
            winRate,
            dealInRate,
            riichiRate,
            furoRate,
            damatenRate,
            initiativeRate,
            uradoraRate,
            negativeRate: lastPlaceRate,
            averageRank,
            topTwoRate,
            averageLuckScore,
            averageSkillScore
        })

        return {
            windowSize,
            gameMode: mode,
            totalGames: count,
            averageRank,
            topTwoRate,
            lastPlaceRate,
            averageLuckScore,
            averageSkillScore,
            luckTrend: [...luckTrend].reverse(),
            rankTrend: [...rankTrend].reverse(),
            games,
            winRate,
            dealInRate,
            riichiRate,
            furoRate,
            damatenRate,
            initiativeRate,
            uradoraRate,
            styleDiagnosis
        }
    }
}
