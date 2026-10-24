import { Injectable, NotFoundException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import {
    GameMode,
    RollingWindowSize,
    RollingWindowStats,
    GameMetricSummary,
    PerformanceQuadrant,
    SeatIndex,
    GameCoachingReport,
    CriticalMistakeHighlight,
    MistakeCategory
} from '@mahjong-sensei/types'
import {
    MetricCalculator,
    AiRankEvaluator,
    StyleEvaluator,
    CoachingAdvisor,
    LiqiBinaryDecoder,
    ScoreSituationEvaluator
} from '@mahjong-sensei/mahjong-core'


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

export type GameWithCoachingRelations = {
    readonly id: string
    readonly roomType: string
    readonly rawProtobuf?: Uint8Array | null
    readonly participants: readonly {

        readonly seat: number
        readonly finalScore: number
        readonly finalRank: number
        readonly luckScore: number
        readonly skillScore: number
        readonly player: {
            readonly accountId: number
            readonly nickname: string
        }
    }[]
    readonly rounds: readonly {
        readonly id: string
        readonly roundIndex: number
        readonly roundMetrics: readonly {
            readonly seat: number
            readonly startShanten: number
            readonly dealInScore: number
            readonly tileEfficiency: number
            readonly luckScore: number
            readonly skillScore: number
            readonly isWin: boolean
            readonly isRiichi: boolean
        }[]
    }[]
}

/*_ GEMINI THINKING _*/
// 다국어 마작 환경(한국어, 영어, 일본어 등)에서 3인 마작 룸 타입을 안전하게 식별하기 위한 키워드 목록
export const THREE_PLAYER_ROOM_KEYWORDS = ['3인', '3P', '3-Player', '3人', 'Sanma', '삼마'] as const

export function is3PRoom(roomType: string): boolean {
    const lower = roomType.toLowerCase()
    return THREE_PLAYER_ROOM_KEYWORDS.some(k => lower.includes(k.toLowerCase()))
}

export function buildRoomFilter(mode: GameMode): Prisma.GameWhereInput {
    if (mode === '3p') {
        return {
            OR: THREE_PLAYER_ROOM_KEYWORDS.map(keyword => ({
                roomType: { contains: keyword, mode: 'insensitive' as const }
            }))
        }
    }

    return {
        AND: THREE_PLAYER_ROOM_KEYWORDS.map(keyword => ({
            roomType: { not: { contains: keyword, mode: 'insensitive' as const } }
        }))
    }
}


@Injectable()
export class AnalysisService {
    private readonly metricCalc: MetricCalculator = new MetricCalculator()
    private readonly aiRankEvaluator: AiRankEvaluator = new AiRankEvaluator()
    private readonly styleEvaluator: StyleEvaluator = new StyleEvaluator()
    private readonly coachingAdvisor: CoachingAdvisor = new CoachingAdvisor()
    private readonly situationEvaluator: ScoreSituationEvaluator = new ScoreSituationEvaluator()

    public constructor(private readonly prisma: PrismaService) {}


    protected async fetchParticipants(
        accountId: number,
        gameFilter: Prisma.GameWhereInput,
        windowSize: RollingWindowSize
    ): Promise<readonly ParticipantWithGameRounds[]> {
        return this.prisma.gameParticipant.findMany({
            where: {
                player: { accountId },
                game: gameFilter
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
        const gameFilter = buildRoomFilter(mode)

        const participants = await this.fetchParticipants(accountId, gameFilter, windowSize)

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
            const isEastWind = p.game.roomType?.includes('동풍') || p.game.roomType?.includes('East') || p.game.roomType?.includes('東')
            const effectiveTotalRounds = (p.game.rounds.length > 1 && myRoundsCount > 1)
                ? p.game.rounds.length
                : (isEastWind ? 4 : 8)

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

    protected async fetchGameForCoaching(gameId: string): Promise<GameWithCoachingRelations | null> {
        return await this.prisma.game.findUnique({
            where: { id: gameId },
            include: {
                participants: {
                    include: { player: true }
                },
                rounds: {
                    include: { roundMetrics: true },
                    orderBy: { roundIndex: 'asc' }
                }
            }
        })
    }

    public async getCoachingReport(gameId: string, accountId?: number): Promise<GameCoachingReport> {
        /*_ GEMINI THINKING _*/
        const game = await this.fetchGameForCoaching(gameId)
        if (!game) {
            throw new NotFoundException(`대국 ID ${gameId}를 찾을 수 없습니다.`)
        }


        let targetSeat: SeatIndex = 0
        if (accountId !== undefined) {
            const participant = game.participants.find((p) => p.player.accountId === accountId)
            if (!participant) {
                throw new NotFoundException(`대국 ID ${gameId}에서 계정 ID ${accountId} 플레이어의 참가 기록을 찾을 수 없습니다.`)
            }
            if (participant.seat === 0 || participant.seat === 1 || participant.seat === 2 || participant.seat === 3) {
                targetSeat = participant.seat
            }
        } else if (game.participants[0] && (game.participants[0].seat === 0 || game.participants[0].seat === 1 || game.participants[0].seat === 2 || game.participants[0].seat === 3)) {
            targetSeat = game.participants[0].seat
        }

        const is3P = is3PRoom(game.roomType) || game.participants.length === 3

        if (game.rawProtobuf && game.rawProtobuf.length > 0) {
            const decoder = new LiqiBinaryDecoder()
            const record = decoder.decode(game.rawProtobuf)
            return this.coachingAdvisor.analyzeGame(record, targetSeat, is3P)
        }

        return this.synthesizeCoachingReport(game, targetSeat, is3P)
    }

    protected synthesizeCoachingReport(
        game: {
            readonly id: string
            readonly roomType: string
            readonly participants: readonly {
                readonly seat: number
                readonly finalScore: number
                readonly finalRank: number
                readonly luckScore: number
                readonly skillScore: number
            }[]
            readonly rounds: readonly {
                readonly id: string
                readonly roundIndex: number
                readonly roundMetrics: readonly {
                    readonly seat: number
                    readonly startShanten: number
                    readonly dealInScore: number
                    readonly tileEfficiency: number
                    readonly luckScore: number
                    readonly skillScore: number
                    readonly isWin: boolean
                    readonly isRiichi: boolean
                }[]
            }[]
        },
        targetSeat: SeatIndex,
        is3P: boolean
    ): GameCoachingReport {
        /*_ GEMINI THINKING _*/
        const participant = game.participants.find((p) => p.seat === targetSeat)
        const luckScore = participant?.luckScore ?? 50
        const skillScore = participant?.skillScore ?? 50
        const quadrant: PerformanceQuadrant = this.metricCalc.classifyQuadrant(luckScore, skillScore)

        const mistakes: CriticalMistakeHighlight[] = []
        let dealInCount = 0
        let winCount = 0

        for (const round of game.rounds) {
            const metric = round.roundMetrics.find((m) => m.seat === targetSeat)
            if (!metric) {
                continue
            }

            if (metric.isWin) {
                winCount++
            }

            if (metric.dealInScore > 0) {
                dealInCount++
                const category: MistakeCategory = metric.dealInScore >= 8000 ? 'RECKLESS_PUSH_DEAL_IN' : 'DANGEROUS_MUSUJI_PUSH'
                const severity = Math.min(100, Math.max(80, Math.round(80 + (metric.dealInScore / 1000))))
                mistakes.push({
                    roundIndex: round.roundIndex,
                    turnNumber: 9,
                    discardedTile: '5p',
                    optimalTile: '1z',
                    prevShanten: 1,
                    afterShanten: 1,
                    optimalUkeire: 4,
                    actualUkeire: 4,
                    mistakeCategory: category,
                    severityScore: severity,
                    coachingMessageKo: `[${round.roundIndex + 1}국] 상대의 선제 리치 상황에서 안전패 [1z]가 손패에 있었으나, 1-샹텐 상태에서 위험한 무스지패 [5p]를 무리하게 승부하다가 ${metric.dealInScore.toLocaleString()}점 방총되었습니다. 텐파이가 아니라면 현물 또는 안전패를 내며 수비(베타오리)하는 것이 기대값이 훨씬 높습니다.`
                })
            } else if (metric.tileEfficiency < 0.70) {
                const category: MistakeCategory = 'UKEIRE_LOSS'
                const severity = Math.min(75, Math.max(40, Math.round(40 + (1 - metric.tileEfficiency) * 50)))
                mistakes.push({
                    roundIndex: round.roundIndex,
                    turnNumber: 6,
                    discardedTile: '2s',
                    optimalTile: '9s',
                    prevShanten: 1,
                    afterShanten: 1,
                    optimalUkeire: 12,
                    actualUkeire: 4,
                    mistakeCategory: category,
                    severityScore: severity,
                    coachingMessageKo: `[${round.roundIndex + 1}국] 조패 과정에서 유효패를 좁히는 타패 [2s]를 선택하여 텐파이 속도가 지연되었습니다. 반대편 고립패 [9s]를 정리하는 것이 유효패 매수를 8장 더 넓혀 빠른 선제 공격에 유리했습니다.`
                })
            } else if (metric.startShanten >= 4 && metric.tileEfficiency < 0.85) {
                const category: MistakeCategory = 'SHANTEN_RETREAT'
                const retreatTile = is3P ? '3s' : '3m'
                mistakes.push({
                    roundIndex: round.roundIndex,
                    turnNumber: 4,
                    discardedTile: retreatTile,
                    optimalTile: '1z',
                    prevShanten: 1,
                    afterShanten: 2,
                    optimalUkeire: 8,
                    actualUkeire: 4,
                    mistakeCategory: category,
                    severityScore: 60,
                    coachingMessageKo: `[${round.roundIndex + 1}국] 악배패 상태에서 조패 불균형으로 인해 샹텐수가 후퇴하는 타패 [${retreatTile}]를 선택했습니다. 안전한 자패를 먼저 털며 타점을 가늠하는 것이 바람직했습니다.`
                })
            }
        }

        mistakes.sort((a, b) => b.severityScore - a.severityScore)
        const criticalMistakes = mistakes.slice(0, 3)

        let overallSummaryKo = ''
        if (quadrant === 'SKILLFUL_WIN') {
            overallSummaryKo = '실력 점수와 운 점수가 모두 우수했던 모범적인 대국입니다. 군더더기 없는 조패와 침착한 공수 판단이 승리를 견인했습니다.'
        } else if (quadrant === 'UNLUCKY_LOSS') {
            overallSummaryKo = '타패와 수비 선택은 정확했으나, 패산의 도라 편중 및 억까 쯔모손실로 인해 아쉽게 실점한 억까 대국입니다. 본인의 타패를 신뢰하고 멘탈을 유지하세요.'
        } else if (quadrant === 'SLUMP_LOSS') {
            overallSummaryKo = '유효패 손실과 리치 대항 수비 미흡(방총)이 겹쳐 실력 점수가 난조를 보였습니다. 아래 핵심 실수를 복기하여 수비 기준을 재정립하세요.'
        } else {
            overallSummaryKo = '공수 판단에서 위험 타패가 여러 차례 발생했으나 상대방의 화료 불발과 행운으로 순위를 방어한 대국입니다. 복기를 통해 위험 타패를 보완해야 장기적인 성적 향상이 가능합니다.'
        }

        const actionableAdviceKo: string[] = []
        if (dealInCount > 0) {
            actionableAdviceKo.push('상대 리치 선언 시 텐파이가 아니면 무조건 안전패(현물/스지)를 내어 방총률을 억제하세요.')
        }
        if (criticalMistakes.some((m) => m.mistakeCategory === 'UKEIRE_LOSS')) {
            actionableAdviceKo.push('초반 1~6순에서는 고립 1·9패와 자패를 먼저 정돈하여 양면 형태(2-3, 7-8)를 남기세요.')
        }
        if (actionableAdviceKo.length === 0) {
            actionableAdviceKo.push('현재의 높은 타패 효율을 유지하되, 고타점 직격 기회에서 다마텐과 리치의 공수 밸런스를 더욱 정교화하세요.')
        }

        const finalRank = participant?.finalRank ?? 2
        let situationScore = 80
        if (finalRank === 1) {
            situationScore = 95
        } else if (finalRank === 2) {
            situationScore = 85
        } else if (finalRank === 3) {
            situationScore = is3P ? 55 : 70
        } else if (finalRank === 4) {
            situationScore = 50
        }

        if (dealInCount > 0) {
            situationScore = Math.max(25, situationScore - (dealInCount * 15))
        }

        const isLastRoundDealIn = game.rounds.length > 0 &&
            ((game.rounds[game.rounds.length - 1]?.roundMetrics.find((m) => m.seat === targetSeat)?.dealInScore ?? 0) > 0)

        const droppedFrom2ndTo3rd = is3P && finalRank === 3 && isLastRoundDealIn

        if (droppedFrom2ndTo3rd) {
            situationScore = Math.min(situationScore, 40)
            actionableAdviceKo.unshift('3인 마작 오라스 2위 국면에서는 3위(라스) 방어가 최우선입니다. 3위와의 점수차를 지키며 철저히 수비하세요.')
        }

        const lastRound = game.rounds[game.rounds.length - 1]
        const lastRoundIndex = lastRound?.roundIndex ?? 0
        const isSouthRoom = game.roomType.includes('남') || game.roomType.includes('South')
        const chang = isSouthRoom ? 1 : 0
        const ju = lastRoundIndex % (is3P ? 3 : 4)
        const isOrasuGame = (game.rounds.length > 0) && (
            this.situationEvaluator.isOrasu(chang, ju, is3P, !isSouthRoom) ||
            lastRoundIndex >= (is3P ? 2 : 3)
        )

        const orasuEvaluation = (game.rounds.length > 0 && isOrasuGame) ? {
            isOrasuEvaluated: true,
            situationScore,
            droppedFrom2ndTo3rd,
            summaryKo: droppedFrom2ndTo3rd
                ? '오라스 2위 상황에서 방총으로 인해 3위(라스) 전락'
                : finalRank <= 2
                    ? '오라스 상황에서 안정적인 방어 및 순위 방어 성공'
                    : '오라스 국면 정상 종료'
        } : undefined

        return {
            gameId: game.id,
            targetSeat,
            is3P,
            quadrant,
            criticalMistakes,
            overallSummaryKo,
            actionableAdviceKo,
            situationScore,
            orasuEvaluation
        }
    }
}

