/*_ GEMINI THINKING _*/
import test from 'node:test'
import assert from 'node:assert'
import { AnalysisController } from './analysis.controller'
import { AnalysisService } from './analysis.service'
import { TierBenchmarkService } from './tier-benchmark.service'
import { RollingQueryDto } from './dto/rolling-query.dto'
import { RollingWindowSize, GameMode, RollingWindowStats, GameCoachingReport } from '@mahjong-sensei/types'
import { PrismaService } from '../../prisma/prisma.service'

class MockPrismaService extends PrismaService {
    public constructor() {
        super()
    }
}

class MockAnalysisServiceForController extends AnalysisService {
    public lastAccountId: number = 0
    public lastWindowSize: RollingWindowSize = 10
    public lastMode: GameMode = '3p'

    public constructor() {
        super(new MockPrismaService())
    }

    public override async getRollingStats(
        accountId: number,
        windowSize: RollingWindowSize,
        mode: GameMode = '3p'
    ): Promise<RollingWindowStats> {
        this.lastAccountId = accountId
        this.lastWindowSize = windowSize
        this.lastMode = mode
        return {
            windowSize,
            gameMode: mode,
            totalGames: windowSize,
            averageRank: 2.1,
            topTwoRate: 55.0,
            lastPlaceRate: 20.0,
            averageLuckScore: 52.0,
            averageSkillScore: 65.0,
            luckTrend: [],
            rankTrend: [],
            games: [],
            winRate: 25.0,
            dealInRate: 12.0,
            riichiRate: 22.0,
            furoRate: 26.0,
            damatenRate: 15.0,
            initiativeRate: 82.0,
            uradoraRate: 30.0
        }
    }

    public override async getCoachingReport(
        gameId: string,
        _accountId?: number
    ): Promise<GameCoachingReport> {
        return {
            gameId,
            targetSeat: 0,
            is3P: false,
            quadrant: 'SKILLFUL_WIN',
            criticalMistakes: [],
            overallSummaryKo: '우수한 대국이었습니다.',
            actionableAdviceKo: []
        }
    }
}

test('RollingQueryDto - parseWindow validates 10, 30, 50, 100 and falls back to 10', () => {
    assert.strictEqual(RollingQueryDto.parseWindow(100), 100)
    assert.strictEqual(RollingQueryDto.parseWindow('100'), 100)
    assert.strictEqual(RollingQueryDto.parseWindow(50), 50)
    assert.strictEqual(RollingQueryDto.parseWindow('50'), 50)
    assert.strictEqual(RollingQueryDto.parseWindow(30), 30)
    assert.strictEqual(RollingQueryDto.parseWindow('30'), 30)
    assert.strictEqual(RollingQueryDto.parseWindow(10), 10)
    assert.strictEqual(RollingQueryDto.parseWindow('10'), 10)

    // Fallbacks for invalid inputs
    assert.strictEqual(RollingQueryDto.parseWindow(undefined), 10)
    assert.strictEqual(RollingQueryDto.parseWindow(null), 10)
    assert.strictEqual(RollingQueryDto.parseWindow(''), 10)
    assert.strictEqual(RollingQueryDto.parseWindow(20), 10)
    assert.strictEqual(RollingQueryDto.parseWindow('200'), 10)
    assert.strictEqual(RollingQueryDto.parseWindow('invalid'), 10)
})

test('RollingQueryDto - parseMode validates 4p and defaults to 3p', () => {
    assert.strictEqual(RollingQueryDto.parseMode('4p'), '4p')
    assert.strictEqual(RollingQueryDto.parseMode('3p'), '3p')
    assert.strictEqual(RollingQueryDto.parseMode(undefined), '3p')
    assert.strictEqual(RollingQueryDto.parseMode(null), '3p')
    assert.strictEqual(RollingQueryDto.parseMode('unknown_mode'), '3p')
})

test('AnalysisController - getRolling with window=100 and limit=100', async () => {
    const analysisService = new MockAnalysisServiceForController()
    const tierService = new TierBenchmarkService()
    const controller = new AnalysisController(analysisService, tierService)

    // 1. window=100
    const stats100 = await controller.getRolling(10001, '100', undefined, '4p')
    assert.strictEqual(analysisService.lastAccountId, 10001)
    assert.strictEqual(analysisService.lastWindowSize, 100)
    assert.strictEqual(analysisService.lastMode, '4p')
    assert.strictEqual(stats100.windowSize, 100)

    // 2. limit=100 (alias when window is omitted)
    const statsLimit100 = await controller.getRolling(10002, undefined, '100', '3p')
    assert.strictEqual(analysisService.lastAccountId, 10002)
    assert.strictEqual(analysisService.lastWindowSize, 100)
    assert.strictEqual(analysisService.lastMode, '3p')
    assert.strictEqual(statsLimit100.windowSize, 100)

    // 3. Numeric inputs (when passed from direct NestJS pipe)
    const statsNum100 = await controller.getRolling(10003, 100, undefined, '3p')
    assert.strictEqual(analysisService.lastWindowSize, 100)
    assert.strictEqual(statsNum100.windowSize, 100)
})

test('AnalysisController - getRolling with window 30, 50, and fallback for invalid window', async () => {
    const analysisService = new MockAnalysisServiceForController()
    const tierService = new TierBenchmarkService()
    const controller = new AnalysisController(analysisService, tierService)

    // 30 window
    await controller.getRolling(10001, '30', undefined, '3p')
    assert.strictEqual(analysisService.lastWindowSize, 30)

    // 50 window
    await controller.getRolling(10001, '50', undefined, '4p')
    assert.strictEqual(analysisService.lastWindowSize, 50)

    // Invalid window 75 falls back to 10
    await controller.getRolling(10001, '75', undefined, '3p')
    assert.strictEqual(analysisService.lastWindowSize, 10)

    // Default params (undefined window/limit)
    await controller.getRolling(10001)
    assert.strictEqual(analysisService.lastWindowSize, 10)
    assert.strictEqual(analysisService.lastMode, '3p')
})

test('AnalysisController - getBenchmarks, getShareCard, and getCoaching delegation', async () => {
    const analysisService = new MockAnalysisServiceForController()
    const tierService = new TierBenchmarkService()
    const controller = new AnalysisController(analysisService, tierService)

    // getBenchmarks
    const benchmark = controller.getBenchmarks('4p', 'MASTER', 55.0, 70.0)
    assert.strictEqual(benchmark.mode, '4p')
    assert.strictEqual(benchmark.tier, 'MASTER')
    assert.strictEqual(benchmark.playerLuck, 55.0)
    assert.strictEqual(benchmark.playerSkill, 70.0)

    // getShareCard
    const svg = controller.getShareCard('테스트유저', '3p', '작호 (Master)', 52.0, 68.0, 29.5, 13.5, 'SKILLFUL_WIN')
    assert.strictEqual(typeof svg, 'string')
    assert.strictEqual(svg.includes('<svg'), true)
    assert.strictEqual(svg.includes('테스트유저'), true)

    // getCoaching
    const coaching = await controller.getCoaching('test-game-uuid', 10001)
    assert.strictEqual(coaching.gameId, 'test-game-uuid')
    assert.strictEqual(coaching.quadrant, 'SKILLFUL_WIN')
})
