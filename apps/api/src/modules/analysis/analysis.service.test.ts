/*_ GEMINI THINKING _*/
import test from 'node:test'
import assert from 'node:assert'
import { AnalysisService, ParticipantWithGameRounds } from './analysis.service'
import { PrismaService } from '../../prisma/prisma.service'
import { SeatIndex, RollingWindowSize } from '@mahjong-sensei/types'

class MockPrismaService extends PrismaService {
    public constructor() {
        super()
    }
}

class MockAnalysisService extends AnalysisService {
    public mockParticipants: readonly ParticipantWithGameRounds[] = []

    public constructor() {
        super(new MockPrismaService())
    }

    protected override async fetchParticipants(
        _accountId: number,
        _roomFilter: { readonly contains: string } | { readonly not: { readonly contains: string } },
        _windowSize: RollingWindowSize
    ): Promise<readonly ParticipantWithGameRounds[]> {
        return this.mockParticipants
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
