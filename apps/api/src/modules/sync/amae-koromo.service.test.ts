/*_ GEMINI THINKING _*/
import test from 'node:test'
import assert from 'node:assert'
import {
    AmaeKoromoService,
    ModeGroupConfig,
    DeterministicGameSpec,
    AmaeExtendedStats
} from './amae-koromo.service'
import { PrismaService } from '../../prisma/prisma.service'
import { GameMode } from '@mahjong-sensei/types'

class MockAmaeKoromoService extends AmaeKoromoService {
    public constructor() {
        super(new PrismaService())
    }

    public testResolveRoomType(modeId: number): string {
        return this.resolveRoomType(modeId)
    }

    public testGetRoomTypeByModeId(modeId: number): string {
        return this.getRoomTypeByModeId(modeId)
    }

    public testResolvePrimaryModeId(
        playedModes: readonly number[],
        mode: GameMode,
        isEast: boolean,
        levelId?: number
    ): number {
        return this.resolvePrimaryModeId(playedModes, mode, isEast, levelId)
    }

    public testCalculateStartShanten(
        playerSeat: number,
        extStats: Partial<AmaeExtendedStats>,
        gameLuck: number = 50,
        avgLuck: number = 50,
        mode: GameMode = '3p',
        roundIndex: number = 0
    ): number {
        return this.calculateStartShanten(playerSeat, extStats, gameLuck, avgLuck, mode, roundIndex)
    }

    public testBuildDeterministicGameSpecs(
        targetCount: number,
        mode: GameMode,
        eastGroup?: ModeGroupConfig | null,
        southGroup?: ModeGroupConfig | null
    ): readonly DeterministicGameSpec[] {
        return this.buildDeterministicGameSpecs({
            targetCount,
            mode,
            eastGroup,
            southGroup
        })
    }
}

test('AmaeKoromoService - Mode ID to roomType label resolution (East vs South for 3P and 4P)', () => {
    /*_ GEMINI THINKING _*/
    const service = new MockAmaeKoromoService()

    // 3P East modes: 21, 23, 25
    assert.strictEqual(service.testResolveRoomType(21), '3인 금탁 동풍전')
    assert.strictEqual(service.testGetRoomTypeByModeId(21), '3인 금탁 동풍전')
    assert.strictEqual(service.testResolveRoomType(23), '3인 옥탁 동풍전')
    assert.strictEqual(service.testResolveRoomType(25), '3인 왕좌탁 동풍전')

    // 3P South modes: 22, 24, 26
    assert.strictEqual(service.testResolveRoomType(22), '3인 금탁 반장전')
    assert.strictEqual(service.testResolveRoomType(24), '3인 옥탁 반장전')
    assert.strictEqual(service.testResolveRoomType(26), '3인 왕좌탁 반장전')

    // 4P East modes: 8, 11, 15
    assert.strictEqual(service.testResolveRoomType(8), '4인 금탁 동풍전')
    assert.strictEqual(service.testResolveRoomType(11), '4인 옥탁 동풍전')
    assert.strictEqual(service.testResolveRoomType(15), '4인 왕좌탁 동풍전')

    // 4P South modes: 9, 12, 16
    assert.strictEqual(service.testResolveRoomType(9), '4인 금탁 반장전')
    assert.strictEqual(service.testResolveRoomType(12), '4인 옥탁 반장전')
    assert.strictEqual(service.testResolveRoomType(16), '4인 왕좌탁 반장전')

    // Verify AnalysisService compatibility (contains '3인' for 3P, '4인' for 4P)
    const threePlayerModes = [21, 22, 23, 24, 25, 26]
    let idx3p = 0
    while (idx3p < threePlayerModes.length) {
        const modeId = threePlayerModes[idx3p]
        if (modeId !== undefined) {
            const label = service.testResolveRoomType(modeId)
            assert.strictEqual(label.includes('3인'), true)
        }
        idx3p++
    }

    const fourPlayerModes = [8, 9, 11, 12, 15, 16]
    let idx4p = 0
    while (idx4p < fourPlayerModes.length) {
        const modeId = fourPlayerModes[idx4p]
        if (modeId !== undefined) {
            const label = service.testResolveRoomType(modeId)
            assert.strictEqual(label.includes('4인'), true)
            assert.strictEqual(label.includes('3인'), false)
        }
        idx4p++
    }

    // Verify primary mode resolution based on played_modes (e.g. 서울불빛 played [24, 21, 23])
    const seoulPlayedModes = [24, 21, 23]
    const primaryEastMode = service.testResolvePrimaryModeId(seoulPlayedModes, '3p', true, 20401)
    const primarySouthMode = service.testResolvePrimaryModeId(seoulPlayedModes, '3p', false, 20401)
    assert.strictEqual(primaryEastMode, 23)
    assert.strictEqual(service.testResolveRoomType(primaryEastMode), '3인 옥탁 동풍전')
    assert.strictEqual(primarySouthMode, 24)
    assert.strictEqual(service.testResolveRoomType(primarySouthMode), '3인 옥탁 반장전')
})

test('AmaeKoromoService - Deterministic rank & East/South distribution (no Math.random, window consistency)', () => {
    /*_ GEMINI THINKING _*/
    const service = new MockAmaeKoromoService()

    // Scenario 1: Realistic 3P player (서울불빛: 98% East, 2% South)
    const eastGroup: ModeGroupConfig = {
        count: 1954,
        rankRates: [0.35, 0.35, 0.30],
        rankAvgScore: [52500, 34100, 17700],
        roomType: '3인 옥탁 동풍전',
        modeId: 23
    }

    const southGroup: ModeGroupConfig = {
        count: 41,
        rankRates: [0.37, 0.29, 0.34],
        rankAvgScore: [57500, 37200, 7800],
        roomType: '3인 옥탁 반장전',
        modeId: 24
    }

    const run1 = service.testBuildDeterministicGameSpecs(50, '3p', eastGroup, southGroup)
    const run2 = service.testBuildDeterministicGameSpecs(50, '3p', eastGroup, southGroup)

    // 1. Verify 0 Math.random usage (100% deterministic reproducibility across runs)
    assert.strictEqual(run1.length, 50)
    assert.deepStrictEqual(run1, run2)

    // 2. Verify East/South proportional allocation (49 East, 1 South)
    const southGames = run1.filter((g) => !g.isEast)
    const eastGames = run1.filter((g) => g.isEast)
    assert.strictEqual(southGames.length, 1)
    assert.strictEqual(eastGames.length, 49)
    assert.strictEqual(southGames[0]?.roomType, '3인 옥탁 반장전')
    assert.strictEqual(eastGames[0]?.roomType, '3인 옥탁 동풍전')

    // 3. Verify rank distribution consistency across rolling window sizes (10, 20, 30, 50)
    const windows = [10, 20, 30, 50]
    let wIdx = 0
    while (wIdx < windows.length) {
        const w = windows[wIdx]
        if (w !== undefined) {
            // Verify both oldest prefix and recent suffix (which AnalysisService queries via orderBy: { gameDate: desc })
            const prefixSlice = run1.slice(0, w)
            const recentSlice = run1.slice(-w)
            for (const slice of [prefixSlice, recentSlice]) {
                const r1 = slice.filter((g) => g.rank === 1).length
                const r2 = slice.filter((g) => g.rank === 2).length
                const r3 = slice.filter((g) => g.rank === 3).length

                const rate1 = r1 / w
                const rate2 = r2 / w
                const rate3 = r3 / w

                // Maximum discretization deviation at any window size is strictly within 1 game (< 0.06 at w=20, < 0.1 at w=10)
                assert.ok(Math.abs(rate1 - 0.35) <= 0.06, `Window ${w} rank 1 rate ${rate1} deviates from 0.35`)
                assert.ok(Math.abs(rate2 - 0.35) <= 0.06, `Window ${w} rank 2 rate ${rate2} deviates from 0.35`)
                assert.ok(Math.abs(rate3 - 0.30) <= 0.05, `Window ${w} rank 3 rate ${rate3} deviates from 0.30`)
            }
        }
        wIdx++
    }

    // 4. Verify deterministic score offsets are distributed around rank_avg_score
    const r1Scores = run1.filter((g) => g.rank === 1).map((g) => g.finalScore)
    const r1Mean = r1Scores.reduce((sum, s) => sum + s, 0) / r1Scores.length
    assert.ok(Math.abs(r1Mean - 52500) < 500, `Mean score ${r1Mean} is near average 52500`)
    // Ensure scores are not all identical flat numbers
    const uniqueScores = new Set(r1Scores)
    assert.ok(uniqueScores.size > 1, 'Scores vary with deterministic offsets')
})

test('AmaeKoromoService - 4P mode deterministic rank and 50/50 East-South interleaving', () => {
    /*_ GEMINI THINKING _*/
    const service = new MockAmaeKoromoService()

    const eastGroup: ModeGroupConfig = {
        count: 50,
        rankRates: [0.25, 0.25, 0.25, 0.25],
        rankAvgScore: [42000, 30000, 20000, 8000],
        roomType: '4인 옥탁 동풍전',
        modeId: 11
    }

    const southGroup: ModeGroupConfig = {
        count: 50,
        rankRates: [0.25, 0.25, 0.25, 0.25],
        rankAvgScore: [44000, 31000, 19000, 6000],
        roomType: '4인 옥탁 반장전',
        modeId: 12
    }

    const specs = service.testBuildDeterministicGameSpecs(50, '4p', eastGroup, southGroup)
    assert.strictEqual(specs.length, 50)

    const eastCount = specs.filter((g) => g.isEast).length
    const southCount = specs.filter((g) => !g.isEast).length
    assert.strictEqual(eastCount, 25)
    assert.strictEqual(southCount, 25)

    // Check rolling window consistency for 4P
    const slice20 = specs.slice(0, 20)
    let rank = 1
    while (rank <= 4) {
        const count = slice20.filter((g) => g.rank === rank).length
        assert.ok(Math.abs(count - 5) <= 1, `4P Window 20 rank ${rank} count is close to 5`)
        rank++
    }
})

test('AmaeKoromoService - Float startShanten calculation from extStats (never hardcoded to 3 or 4)', () => {
    /*_ GEMINI THINKING _*/
    const service = new MockAmaeKoromoService()

    const extStats: AmaeExtendedStats = {
        count: 1000,
        和牌率: 0.293,
        自摸率: 0.408,
        默听率: 0.192,
        放铳率: 0.138,
        副露率: 0.231,
        立直率: 0.250,
        平均打点: 8926,
        平均铳点: 9398,
        流局率: 0.101,
        流听率: 0.435,
        一发率: 0.203,
        里宝率: 0.432,
        先制率: 0.810,
        平均起手向听: 3.27,
        平均起手向听亲: 2.98,
        平均起手向听子: 3.42,
        played_modes: [21, 23, 24]
    }

    // 1. Dealer seat (seat 0): anchored around 平均起手向听亲 (2.98)
    const dealerShanten = service.testCalculateStartShanten(0, extStats, 50, 50, '3p')
    assert.strictEqual(dealerShanten, 2.98)
    assert.notStrictEqual(dealerShanten, 3)
    assert.notStrictEqual(dealerShanten, 4)

    // 2. Non-dealer seat (seat 1): anchored around 平均起手向听子 (3.42)
    const nonDealerShanten = service.testCalculateStartShanten(1, extStats, 50, 50, '3p')
    assert.strictEqual(nonDealerShanten, 3.42)
    assert.notStrictEqual(nonDealerShanten, 3)
    assert.notStrictEqual(nonDealerShanten, 4)

    // 3. Adjusted by game luck offset
    // Lucky hand (gameLuck = 70, higher than average luck 50): shanten should improve (lower)
    const luckyShanten = service.testCalculateStartShanten(0, extStats, 70, 50, '3p')
    assert.strictEqual(luckyShanten, 2.74)
    assert.ok(luckyShanten < dealerShanten)

    // Unlucky hand (gameLuck = 30, lower than average luck 50): shanten should worsen (higher)
    const unluckyShanten = service.testCalculateStartShanten(0, extStats, 30, 50, '3p')
    assert.strictEqual(unluckyShanten, 3.22)
    assert.ok(unluckyShanten > dealerShanten)

    // 4. Mathematical expectation across 3 seats (1 dealer, 2 non-dealers) matches overall extStats
    const meanThreeSeats = (dealerShanten + 2 * nonDealerShanten) / 3
    assert.ok(Math.abs(meanThreeSeats - extStats.平均起手向听) < 0.02)

    // 5. Fallback behavior when 平均起手向听亲 is missing: still float, never integer 3 or 4
    const partialStats: Partial<AmaeExtendedStats> = {
        平均起手向听: 3.35
    }
    const fallbackDealer = service.testCalculateStartShanten(0, partialStats, 50, 50, '3p')
    const fallbackNonDealer = service.testCalculateStartShanten(1, partialStats, 50, 50, '3p')
    assert.strictEqual(fallbackDealer, 3.05)
    assert.strictEqual(fallbackNonDealer, 3.50)
    assert.notStrictEqual(fallbackDealer, 3)
    assert.notStrictEqual(fallbackDealer, 4)

    // 6. Multi-round dealer rotation: (roundIndex % maxRank) === playerSeat
    // In roundIndex = 1 (East 2), seat 1 is dealer, seat 0 is non-dealer
    const round1Seat1Dealer = service.testCalculateStartShanten(1, extStats, 50, 50, '3p', 1)
    const round1Seat0NonDealer = service.testCalculateStartShanten(0, extStats, 50, 50, '3p', 1)
    assert.strictEqual(round1Seat1Dealer, 2.98)
    assert.strictEqual(round1Seat0NonDealer, 3.42)

    // In 4P mode with roundIndex = 2 (East 3), seat 2 is dealer, seat 0 is non-dealer
    const round2Seat2Dealer4P = service.testCalculateStartShanten(2, extStats, 50, 50, '4p', 2)
    const round2Seat0NonDealer4P = service.testCalculateStartShanten(0, extStats, 50, 50, '4p', 2)
    assert.strictEqual(round2Seat2Dealer4P, 2.98)
    assert.strictEqual(round2Seat0NonDealer4P, 3.42)
})
