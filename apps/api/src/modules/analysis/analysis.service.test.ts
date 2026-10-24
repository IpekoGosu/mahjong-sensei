/*_ GEMINI THINKING _*/
import test from 'node:test'
import assert from 'node:assert'
import { Prisma } from '@prisma/client'
import { NotFoundException } from '@nestjs/common'
import {
    AnalysisService,
    ParticipantWithGameRounds,
    GameWithCoachingRelations,
    is3PRoom,
    buildRoomFilter,
    THREE_PLAYER_ROOM_KEYWORDS
} from './analysis.service'
import { PrismaService } from '../../prisma/prisma.service'
import { SeatIndex, RollingWindowSize } from '@mahjong-sensei/types'
import { SAMPLE_MAJSOUL_GAME, LiqiBinaryDecoder } from '@mahjong-sensei/mahjong-core'

class MockPrismaService extends PrismaService {
    public constructor() {
        super()
    }
}

class MockAnalysisService extends AnalysisService {
    public mockParticipants: readonly ParticipantWithGameRounds[] = []
    public mockGame: GameWithCoachingRelations | null = null
    public lastGameFilter: Prisma.GameWhereInput | null = null

    public constructor() {
        super(new MockPrismaService())
    }

    protected override async fetchParticipants(
        _accountId: number,
        gameFilter: Prisma.GameWhereInput,
        _windowSize: RollingWindowSize
    ): Promise<readonly ParticipantWithGameRounds[]> {
        this.lastGameFilter = gameFilter
        return this.mockParticipants
    }

    protected override async fetchGameForCoaching(_gameId: string): Promise<GameWithCoachingRelations | null> {
        return this.mockGame
    }
}


test('AnalysisService - Return zero defaults when no games found for account', async () => {
    const service = new MockAnalysisService()
    service.mockParticipants = []

    const stats = await service.getRollingStats(99999, 10, '3p')

    assert.strictEqual(stats.totalGames, 0)
    assert.strictEqual(stats.averageRank, 0)
    assert.strictEqual(stats.winRate, 0)
    assert.strictEqual(stats.dealInRate, 0)
    assert.strictEqual(stats.riichiRate, 0)
    assert.strictEqual(stats.furoRate, 0)
    assert.strictEqual(stats.damatenRate, 0)
    assert.strictEqual(stats.initiativeRate, 0)
    assert.strictEqual(stats.uradoraRate, 0)
    assert.strictEqual(stats.games.length, 0)
    assert.strictEqual(stats.slumpSeverity?.status, 'NORMAL')
    assert.strictEqual(stats.slumpSeverity?.zScore, 0)
    assert.strictEqual(stats.slumpSeverity?.percentile, 50.0)
})

test('AnalysisService - Aggregate window metrics, compute rates, and evaluate style', async () => {
    const service = new MockAnalysisService()

    // 10 games mock with specific style indicators
    const mockGames: ParticipantWithGameRounds[] = []
    let i = 0
    while (i < 10) {
        const isWin = i < 3 // 3 wins out of 10 = 30% win rate
        const isRiichi = i === 0 || i === 1 // 2 riichi out of 10 = 20%
        const isDamaten = i === 2 // 1 dama win out of 3 wins = 33.3% dama rate
        const isFuro = i >= 3 && i <= 5 // 3 furo = 30%
        const isDealIn = i === 9 // 1 deal in = 10%
        const isInitiative = i === 0 // 1 initiative out of 2 riichi = 50%
        const uradoraHits = i === 0 ? 1 : 0 // 1 uradora hit on riichi win = 50%

        mockGames.push({
            id: `p-${i}`,
            gameId: `game-3p-${i}`,
            playerId: 'player-1',
            seat: 0 as SeatIndex,
            finalScore: isWin ? 38000 : 25000,
            finalRank: isWin ? 1 : (isDealIn ? 3 : 2),
            luckScore: isWin ? 65 : 45,
            skillScore: isDealIn ? 40 : 60,
            game: {
                id: `game-3p-${i}`,
                roomType: '3인 옥탁 동풍전',
                gameDate: new Date(1720000000000 + i * 3600000),
                rounds: [
                    {
                        id: `round-${i}-0`,
                        roundIndex: 0,
                        roundMetrics: [
                            {
                                seat: 0 as SeatIndex,
                                startShanten: 3.0,
                                startDoraCount: 1,
                                drawLuckRatio: 0.30,
                                uradoraHits,
                                dealInScore: isDealIn ? 8000 : 0,
                                tsumoLossScore: 0,
                                tileEfficiency: 0.85,
                                luckScore: isWin ? 65 : 45,
                                skillScore: isDealIn ? 40 : 60,
                                isWin,
                                isRiichi,
                                isFuro,
                                isDamaten,
                                isInitiative
                            }
                        ]
                    }
                ]
            }
        })
        i++
    }

    service.mockParticipants = mockGames

    const stats = await service.getRollingStats(10001, 10, '3p')

    assert.strictEqual(stats.totalGames, 10)
    assert.strictEqual(stats.gameMode, '3p')
    assert.strictEqual(stats.winRate, 30.0)
    assert.strictEqual(stats.dealInRate, 10.0)
    assert.strictEqual(stats.riichiRate, 20.0)
    assert.strictEqual(stats.furoRate, 30.0)
    assert.strictEqual(stats.damatenRate, 33.3)
    assert.strictEqual(stats.initiativeRate, 50.0)
    assert.strictEqual(stats.uradoraRate, 50.0)

    // Check Style Diagnosis presence and fields
    assert.ok(stats.styleDiagnosis !== undefined)
    assert.ok(stats.styleDiagnosis.title.length > 0)
    assert.ok(stats.styleDiagnosis.description.length > 0)
    assert.ok(stats.styleDiagnosis.attackType.length > 0)
    assert.ok(stats.styleDiagnosis.defenseType.length > 0)
    assert.strictEqual(stats.styleDiagnosis.defenseType, '철벽 수비')
    assert.strictEqual(stats.styleDiagnosis.skillRemark, '3마 상위 5% 철벽 수비')

    // Check Slump Severity presence
    assert.ok(stats.slumpSeverity !== undefined)
    assert.strictEqual(stats.slumpSeverity.status, 'NORMAL')
    assert.ok(stats.slumpSeverity.message.length > 0)
})

test('AnalysisService - Computes slumpSeverity for severe bad run in rolling window', async () => {
    const service = new MockAnalysisService()
    // 10 games with nine 3rd places and one 2nd place in 3P
    const mockGames: ParticipantWithGameRounds[] = []
    let i = 0
    while (i < 10) {
        mockGames.push({
            id: `p-${i}`,
            gameId: `game-slump-${i}`,
            playerId: 'player-1',
            seat: 0 as SeatIndex,
            finalScore: 15000,
            finalRank: i === 0 ? 2 : 3,
            luckScore: 20,
            skillScore: 50,
            game: {
                id: `game-slump-${i}`,
                roomType: '3인 옥탁 동풍전',
                gameDate: new Date(1720000000000 + i * 3600000),
                rounds: []
            }
        })
        i++
    }
    service.mockParticipants = mockGames

    const stats = await service.getRollingStats(10001, 10, '3p')
    assert.ok(stats.slumpSeverity !== undefined)
    assert.ok(stats.slumpSeverity.status === 'SEVERE_HARFUKA' || stats.slumpSeverity.status === 'HELL_MODE')
    assert.ok(stats.slumpSeverity.zScore < -2.0)
    assert.ok(stats.slumpSeverity.percentile < 5.0)
    assert.ok(stats.slumpSeverity.occurrenceProbability < 1.0)
})

test('AnalysisService - Aggregate 100 games rolling window with slump and trend tracking', async () => {
    const service = new MockAnalysisService()

    const mockGames: ParticipantWithGameRounds[] = []
    let i = 0
    while (i < 100) {
        // First 30 games simulate a slump (low luck, low skill -> SLUMP_LOSS, 3rd rank)
        // Next 70 games simulate normal/strong play
        const isSlump = i < 30
        const luckScore = isSlump ? 35 : 55
        const skillScore = isSlump ? 38 : 65
        const finalRank = isSlump ? 3 : (i % 2 === 0 ? 1 : 2)
        const isWin = !isSlump && (i % 3 === 0)
        const isDealIn = isSlump && (i % 2 === 0)

        mockGames.push({
            id: `p-${i}`,
            gameId: `game-100-${i}`,
            playerId: 'player-1',
            seat: 0 as SeatIndex,
            finalScore: isSlump ? 15000 : 35000,
            finalRank,
            luckScore,
            skillScore,
            game: {
                id: `game-100-${i}`,
                roomType: '3인 옥탁 동풍전',
                gameDate: new Date(1720000000000 + i * 3600000),
                rounds: [
                    {
                        id: `round-100-${i}-0`,
                        roundIndex: 0,
                        roundMetrics: [
                            {
                                seat: 0 as SeatIndex,
                                startShanten: 3.2,
                                startDoraCount: isSlump ? 0 : 2,
                                drawLuckRatio: 0.25,
                                uradoraHits: isWin ? 1 : 0,
                                dealInScore: isDealIn ? 8000 : 0,
                                tsumoLossScore: 0,
                                tileEfficiency: isSlump ? 0.65 : 0.88,
                                luckScore,
                                skillScore,
                                isWin,
                                isRiichi: !isSlump,
                                isFuro: false,
                                isDamaten: false,
                                isInitiative: !isSlump
                            }
                        ]
                    }
                ]
            }
        })
        i++
    }

    service.mockParticipants = mockGames

    const stats = await service.getRollingStats(10001, 100, '3p')

    assert.strictEqual(stats.windowSize, 100)
    assert.strictEqual(stats.totalGames, 100)
    assert.strictEqual(stats.gameMode, '3p')
    assert.strictEqual(stats.luckTrend.length, 100)
    assert.strictEqual(stats.rankTrend.length, 100)
    assert.strictEqual(stats.games.length, 100)

    // Check that slump games were classified as SLUMP_LOSS
    const slumpGames = stats.games.filter((g) => g.quadrant === 'SLUMP_LOSS')
    assert.strictEqual(slumpGames.length, 30)

    // Check last place rate calculation
    assert.strictEqual(stats.lastPlaceRate, 30.0)
    assert.ok(stats.averageRank > 0)
    assert.ok(stats.winRate !== undefined && stats.winRate > 0)
    assert.ok(stats.dealInRate !== undefined && stats.dealInRate > 0)
    assert.ok(stats.styleDiagnosis !== undefined)
})

test('AnalysisService - Zero denominator fallbacks for damaten, initiative, and uradora rates', async () => {
    const service = new MockAnalysisService()

    const mockGames: ParticipantWithGameRounds[] = [
        {
            id: 'p-0',
            gameId: 'game-1',
            playerId: 'player-1',
            seat: 0 as SeatIndex,
            finalScore: 20000,
            finalRank: 3,
            luckScore: 30,
            skillScore: 40,
            game: {
                id: 'game-1',
                roomType: '4인 왕탁 동풍전',
                gameDate: new Date(1720000000000),
                rounds: [
                    {
                        id: 'round-1-0',
                        roundIndex: 0,
                        roundMetrics: [
                            {
                                seat: 0 as SeatIndex,
                                startShanten: 4.0,
                                startDoraCount: 0,
                                drawLuckRatio: 0.10,
                                uradoraHits: 0,
                                dealInScore: 0,
                                tsumoLossScore: 0,
                                tileEfficiency: 0.60,
                                luckScore: 30,
                                skillScore: 40,
                                isWin: false,
                                isRiichi: false,
                                isFuro: true,
                                isDamaten: false,
                                isInitiative: false
                            }
                        ]
                    }
                ]
            }
        }
    ]

    service.mockParticipants = mockGames

    const stats = await service.getRollingStats(10001, 10, '4p')

    assert.strictEqual(stats.totalGames, 1)
    assert.strictEqual(stats.winRate, 0)
    assert.strictEqual(stats.riichiRate, 0)
    assert.strictEqual(stats.damatenRate, 0)
    assert.strictEqual(stats.initiativeRate, 0)
    assert.strictEqual(stats.uradoraRate, 0)
})

test('AnalysisService - getCoachingReport throws NotFoundException when game missing', async () => {
    const service = new MockAnalysisService()
    service.mockGame = null

    await assert.rejects(
        async () => await service.getCoachingReport('missing-game-id'),
        NotFoundException
    )
})

test('AnalysisService - getCoachingReport generates synthetic coaching report for games without rawProtobuf', async () => {
    const service = new MockAnalysisService()
    service.mockGame = {
        id: 'synthetic-game-1',
        roomType: '4인 옥탁 반장전',
        rawProtobuf: null,
        participants: [
            {
                seat: 0,
                finalScore: 12000,
                finalRank: 4,
                luckScore: 35.0,
                skillScore: 42.0,
                player: { accountId: 10001, nickname: '마작수련생' }
            }
        ],
        rounds: [
            {
                id: 'round-1',
                roundIndex: 0,
                roundMetrics: [
                    {
                        seat: 0,
                        startShanten: 3.0,
                        dealInScore: 12000,
                        tileEfficiency: 0.85,
                        luckScore: 30,
                        skillScore: 40,
                        isWin: false,
                        isRiichi: false
                    }
                ]
            },
            {
                id: 'round-2',
                roundIndex: 1,
                roundMetrics: [
                    {
                        seat: 0,
                        startShanten: 2.0,
                        dealInScore: 0,
                        tileEfficiency: 0.55,
                        luckScore: 40,
                        skillScore: 45,
                        isWin: false,
                        isRiichi: false
                    }
                ]
            }
        ]
    }

    const report = await service.getCoachingReport('synthetic-game-1', 10001)

    assert.strictEqual(report.gameId, 'synthetic-game-1')
    assert.strictEqual(report.targetSeat, 0)
    assert.strictEqual(report.is3P, false)
    assert.strictEqual(report.quadrant, 'SLUMP_LOSS')
    assert.strictEqual(report.criticalMistakes.length, 2)
    assert.strictEqual(report.criticalMistakes[0]?.mistakeCategory, 'RECKLESS_PUSH_DEAL_IN')
    assert.strictEqual(report.criticalMistakes[1]?.mistakeCategory, 'UKEIRE_LOSS')
    assert.ok(report.overallSummaryKo.includes('실력 점수가 난조'))
    assert.ok(report.actionableAdviceKo.length > 0)
})

test('AnalysisService - getCoachingReport analyzes rawProtobuf game with CoachingAdvisor', async () => {
    const service = new MockAnalysisService()
    const decoder = new LiqiBinaryDecoder()
    const encoded = decoder.encode(SAMPLE_MAJSOUL_GAME)

    service.mockGame = {
        id: SAMPLE_MAJSOUL_GAME.uuid,
        roomType: SAMPLE_MAJSOUL_GAME.roomType,
        rawProtobuf: Buffer.from(encoded),
        participants: [
            {
                seat: 0,
                finalScore: 25000,
                finalRank: 2,
                luckScore: 50.0,
                skillScore: 50.0,
                player: { accountId: 10001, nickname: '마작수련생' }
            }
        ],
        rounds: []
    }

    const report = await service.getCoachingReport(SAMPLE_MAJSOUL_GAME.uuid, 10001)

    assert.strictEqual(report.gameId, SAMPLE_MAJSOUL_GAME.uuid)
    assert.strictEqual(report.targetSeat, 0)
    assert.ok(report.overallSummaryKo.length > 0)
    assert.ok(report.actionableAdviceKo.length > 0)
})

test('AnalysisService - is3PRoom correctly detects multilingual 3P rooms', () => {
    // 3-Player indicators across languages
    assert.strictEqual(is3PRoom('3인 옥탁 동풍전'), true)
    assert.strictEqual(is3PRoom('Jade 3-Player South'), true)
    assert.strictEqual(is3PRoom('3P Gold East'), true)
    assert.strictEqual(is3PRoom('3人南'), true)
    assert.strictEqual(is3PRoom('3人東'), true)
    assert.strictEqual(is3PRoom('Sanma Silver South'), true)
    assert.strictEqual(is3PRoom('삼마 반장전'), true)

    // 4-Player rooms should not match 3P
    assert.strictEqual(is3PRoom('4인 왕탁 동풍전'), false)
    assert.strictEqual(is3PRoom('4-Player Jade South'), false)
    assert.strictEqual(is3PRoom('4人南'), false)
    assert.strictEqual(is3PRoom('옥탁 반장전'), false)
    assert.strictEqual(is3PRoom('금탁 동풍전'), false)
})

test('AnalysisService - buildRoomFilter constructs accurate Prisma where filters', () => {
    const filter3p = buildRoomFilter('3p')
    assert.ok(Array.isArray(filter3p.OR))
    assert.strictEqual(filter3p.OR.length, THREE_PLAYER_ROOM_KEYWORDS.length)

    const filter4p = buildRoomFilter('4p')
    assert.ok(Array.isArray(filter4p.AND))
    assert.strictEqual(filter4p.AND.length, THREE_PLAYER_ROOM_KEYWORDS.length)
})

test('AnalysisService - Multilingual 3P vs 4P room filtering in getRollingStats', async () => {
    const service = new MockAnalysisService()

    const mock3PGames: ParticipantWithGameRounds[] = [
        {
            id: 'p-3p-en',
            gameId: 'game-3p-en',
            playerId: 'player-1',
            seat: 0 as SeatIndex,
            finalScore: 15000,
            finalRank: 3, // In 3P, rank 3 is last place!
            luckScore: 40,
            skillScore: 50,
            game: {
                id: 'game-3p-en',
                roomType: 'Jade 3-Player South',
                gameDate: new Date(1720000000000),
                rounds: []
            }
        }
    ]

    service.mockParticipants = mock3PGames
    const stats3p = await service.getRollingStats(10001, 10, '3p')

    assert.strictEqual(stats3p.gameMode, '3p')
    assert.strictEqual(stats3p.totalGames, 1)
    assert.strictEqual(stats3p.lastPlaceRate, 100.0) // rank 3 counted as last place
    assert.ok(service.lastGameFilter?.OR !== undefined)

    const mock4PGames: ParticipantWithGameRounds[] = [
        {
            id: 'p-4p-en',
            gameId: 'game-4p-en',
            playerId: 'player-1',
            seat: 0 as SeatIndex,
            finalScore: 25000,
            finalRank: 3, // In 4P, rank 3 is NOT last place (rank 4 is last place)
            luckScore: 50,
            skillScore: 55,
            game: {
                id: 'game-4p-en',
                roomType: '4-Player Jade South',
                gameDate: new Date(1720000000000),
                rounds: []
            }
        }
    ]

    service.mockParticipants = mock4PGames
    const stats4p = await service.getRollingStats(10001, 10, '4p')

    assert.strictEqual(stats4p.gameMode, '4p')
    assert.strictEqual(stats4p.totalGames, 1)
    assert.strictEqual(stats4p.lastPlaceRate, 0.0) // rank 3 is not last place in 4P
    assert.ok(service.lastGameFilter?.AND !== undefined)
})


