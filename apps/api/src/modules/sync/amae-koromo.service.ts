/*_ GEMINI THINKING _*/
import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { GameMode } from '@mahjong-sensei/types'

export interface AmaeSearchResult {
    readonly id: number
    readonly nickname: string
    readonly level: {
        readonly id: number
        readonly score: number
        readonly delta: number
    }
    readonly latest_timestamp?: number | undefined
}

export interface AmaeExtendedStats {
    readonly count: number
    readonly 和牌率: number
    readonly 自摸率: number
    readonly 默听率: number
    readonly 放铳率: number
    readonly 副露率: number
    readonly 立直率: number
    readonly 平均打点: number
    readonly 平均铳点: number
    readonly 流局率: number
    readonly 流听率: number
    readonly 一发率: number
    readonly 里宝率: number
    readonly 先制率: number
    readonly 平均起手向听: number
    readonly 平均起手向听亲?: number | undefined
    readonly 平均起手向听子?: number | undefined
    readonly played_modes?: readonly number[] | undefined
}

export interface AmaeRankStats {
    readonly count: number
    readonly rank_rates: readonly [number, number, number, number] | readonly [number, number, number]
    readonly rank_avg_score: readonly [number, number, number, number] | readonly [number, number, number]
    readonly avg_rank: number
    readonly negative_rate?: number | undefined
    readonly played_modes?: readonly number[] | undefined
}

export interface ModeGroupConfig {
    readonly count: number
    readonly rankRates: readonly number[]
    readonly rankAvgScore: readonly number[]
    readonly roomType: string
    readonly modeId?: number | undefined
}

export interface BuildGameSpecsParams {
    readonly targetCount: number
    readonly mode: GameMode
    readonly eastGroup?: ModeGroupConfig | null | undefined
    readonly southGroup?: ModeGroupConfig | null | undefined
    readonly fallbackRankRates?: readonly number[] | undefined
    readonly fallbackAvgScores?: readonly number[] | undefined
}

export interface DeterministicGameSpec {
    readonly gameIndex: number
    readonly rank: number
    readonly finalScore: number
    readonly roomType: string
    readonly isEast: boolean
    readonly modeId?: number | undefined
}

export interface SyncPlayerResult {
    readonly success: boolean
    readonly accountId: number
    readonly nickname: string
    readonly gameMode: GameMode
    readonly totalGames: number
    readonly avgRank: number
    readonly winRate: number
    readonly dealInRate: number
    readonly negativeRate: number
    readonly luckScore: number
    readonly skillScore: number
}

@Injectable()
export class AmaeKoromoService {
    protected readonly logger: Logger = new Logger(AmaeKoromoService.name)

    protected readonly mirrors: readonly string[] = [
        'https://5-data.amae-koromo.com',
        'https://1.data.amae-koromo.com',
        'https://2.data.amae-koromo.com',
        'https://4.data.amae-koromo.com'
    ]

    protected static readonly MODE_NAMES: Readonly<Record<number, string>> = {
        21: '3인 금탁 동풍전',
        22: '3인 금탁 반장전',
        23: '3인 옥탁 동풍전',
        24: '3인 옥탁 반장전',
        25: '3인 왕좌탁 동풍전',
        26: '3인 왕좌탁 반장전',
        8: '4인 금탁 동풍전',
        9: '4인 금탁 반장전',
        11: '4인 옥탁 동풍전',
        12: '4인 옥탁 반장전',
        15: '4인 왕좌탁 동풍전',
        16: '4인 왕좌탁 반장전'
    }

    public constructor(protected readonly prisma: PrismaService) {}

    protected async fetchJsonWithFallback<T>(path: string): Promise<T> {
        /*_ GEMINI THINKING _*/
        const normalizedPath = path.startsWith('/') ? path : `/${path}`
        let lastError: Error | null = null

        for (const mirror of this.mirrors) {
            try {
                const response = await fetch(`${mirror}${normalizedPath}`, {
                    signal: AbortSignal.timeout(5000)
                })
                if (!response.ok) {
                    lastError = new Error(`HTTP ${response.status} ${response.statusText}`)
                    this.logger.warn(
                        `Mirror ${mirror} returned HTTP ${response.status} for ${normalizedPath}, falling back to next mirror`
                    )
                    continue
                }
                const data = (await response.json()) as T
                return data
            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error))
                this.logger.warn(
                    `Mirror ${mirror} failed for ${normalizedPath}: ${lastError.message}, falling back to next mirror`
                )
                continue
            }
        }

        throw new Error(
            `Failed to fetch from all Amae-Koromo mirrors for path "${path}". Last error: ${lastError?.message ?? 'unknown'}`
        )
    }

    protected resolveRoomType(modeId: number): string {
        return AmaeKoromoService.MODE_NAMES[modeId] ?? (modeId >= 20 ? '3인 일반전' : '4인 일반전')
    }

    protected getRoomTypeByModeId(modeId: number): string {
        return this.resolveRoomType(modeId)
    }

    protected resolvePrimaryModeId(
        playedModes: readonly number[],
        mode: GameMode,
        isEast: boolean,
        levelId?: number
    ): number {
        const candidateModes = mode === '3p'
            ? (isEast ? [25, 23, 21] : [26, 24, 22])
            : (isEast ? [15, 11, 8] : [16, 12, 9])

        for (const candidate of candidateModes) {
            if (playedModes.includes(candidate)) {
                return candidate
            }
        }

        if (levelId !== undefined) {
            const isThrone = levelId >= (mode === '3p' ? 20500 : 10500)
            const isJade = levelId >= (mode === '3p' ? 20400 : 10400)
            if (isThrone) {
                return candidateModes[0] ?? (mode === '3p' ? (isEast ? 25 : 26) : (isEast ? 15 : 16))
            }
            if (isJade) {
                return candidateModes[1] ?? (mode === '3p' ? (isEast ? 23 : 24) : (isEast ? 11 : 12))
            }
        }

        return candidateModes[2] ?? (mode === '3p' ? (isEast ? 21 : 22) : (isEast ? 8 : 9))
    }

    protected calculateStartShanten(
        playerSeat: number,
        extStats: Partial<AmaeExtendedStats>,
        gameLuck: number = 50,
        avgLuck: number = 50,
        mode: GameMode = '3p',
        roundIndex: number = 0
    ): number {
        /*_ GEMINI THINKING _*/
        const defaultAll = mode === '3p' ? 3.25 : 3.50
        const allShanten = extStats.平均起手向听 && extStats.平均起手向听 > 0
            ? extStats.平均起手向听
            : defaultAll

        let baseShanten: number

        // In synthetic single-round generation (East 1, -r0), playerSeat === 0 is always East (Dealer/Oya).
        // If multi-round games are supported in the future, dealer seat should rotate: (roundIndex % maxRank) === playerSeat.
        const maxRank = mode === '3p' ? 3 : 4
        const isDealer = (roundIndex % maxRank) === playerSeat

        if (isDealer) {
            baseShanten = extStats.平均起手向听亲 && extStats.平均起手向听亲 > 0
                ? extStats.平均起手向听亲
                : (allShanten - (mode === '3p' ? 0.30 : 0.35))
        } else {
            baseShanten = extStats.平均起手向听子 && extStats.平均起手向听子 > 0
                ? extStats.平均起手向听子
                : (allShanten + (mode === '3p' ? 0.15 : 0.12))
        }

        const luckOffset = (avgLuck - gameLuck) * 0.012
        const rawShanten = Math.max(1.80, Math.min(5.20, baseShanten + luckOffset))

        return Math.round(rawShanten * 100) / 100
    }

    protected buildDeterministicGameSpecs(
        targetCountOrParams: number | BuildGameSpecsParams,
        modeArg?: GameMode,
        eastGroupArg?: ModeGroupConfig | null,
        southGroupArg?: ModeGroupConfig | null
    ): readonly DeterministicGameSpec[] {
        /*_ GEMINI THINKING _*/
        let targetCount: number
        let mode: GameMode
        let eastGroup: ModeGroupConfig | null | undefined
        let southGroup: ModeGroupConfig | null | undefined
        let fallbackRankRates: readonly number[] | undefined
        let fallbackAvgScores: readonly number[] | undefined

        if (typeof targetCountOrParams === 'object') {
            targetCount = targetCountOrParams.targetCount
            mode = targetCountOrParams.mode
            eastGroup = targetCountOrParams.eastGroup
            southGroup = targetCountOrParams.southGroup
            fallbackRankRates = targetCountOrParams.fallbackRankRates
            fallbackAvgScores = targetCountOrParams.fallbackAvgScores
        } else {
            targetCount = targetCountOrParams
            mode = modeArg ?? '3p'
            eastGroup = eastGroupArg
            southGroup = southGroupArg
        }

        const maxRank = mode === '3p' ? 3 : 4
        const defaultRankRates = mode === '3p'
            ? [0.35, 0.35, 0.30]
            : [0.25, 0.25, 0.25, 0.25]
        const defaultScores = mode === '3p'
            ? [48000, 32000, 15000]
            : [42000, 30000, 20000, 8000]

        const eastCount = Math.max(0, eastGroup?.count ?? 0)
        const southCount = Math.max(0, southGroup?.count ?? 0)
        const totalActualCount = eastCount + southCount

        let allocSouth = 0
        let allocEast = targetCount

        if (totalActualCount > 0) {
            if (eastCount === 0 && southCount > 0) {
                allocSouth = targetCount
                allocEast = 0
            } else if (southCount === 0 && eastCount > 0) {
                allocSouth = 0
                allocEast = targetCount
            } else {
                allocSouth = Math.round(targetCount * (southCount / totalActualCount))
                if (allocSouth === 0 && southCount > 0 && targetCount >= 10) {
                    allocSouth = 1
                }
                if (allocSouth === targetCount && eastCount > 0 && targetCount >= 10) {
                    allocSouth = targetCount - 1
                }
                allocEast = targetCount - allocSouth
            }
        } else if (southGroup && !eastGroup) {
            allocSouth = targetCount
            allocEast = 0
        }

        const isSouthGame: boolean[] = new Array(targetCount).fill(false)
        if (allocSouth > 0) {
            if (allocSouth === targetCount) {
                isSouthGame.fill(true)
            } else {
                let i = 0
                while (i < targetCount) {
                    const prevStep = Math.floor((i * allocSouth) / targetCount)
                    const currStep = Math.floor(((i + 1) * allocSouth) / targetCount)
                    if (currStep > prevStep) {
                        isSouthGame[i] = true
                    }
                    i++
                }
            }
        }

        const eastRates = eastGroup?.rankRates ?? fallbackRankRates ?? defaultRankRates
        const southRates = southGroup?.rankRates ?? fallbackRankRates ?? defaultRankRates

        const weightedRankRates: number[] = new Array(maxRank).fill(0)
        let rIndex = 0
        while (rIndex < maxRank) {
            const eRate = eastRates[rIndex] ?? (1 / maxRank)
            const sRate = southRates[rIndex] ?? (1 / maxRank)
            if (allocEast + allocSouth > 0) {
                weightedRankRates[rIndex] = (allocEast * eRate + allocSouth * sRate) / targetCount
            } else {
                weightedRankRates[rIndex] = eRate
            }
            rIndex++
        }

        const sumWeighted = weightedRankRates.reduce((acc, val) => acc + val, 0)
        const normalizedRates = sumWeighted > 0
            ? weightedRankRates.map((w) => w / sumWeighted)
            : defaultRankRates

        const rankCounts: number[] = new Array(maxRank).fill(0)
        const specs: DeterministicGameSpec[] = []

        let gameIdx = 0
        while (gameIdx < targetCount) {
            const isSouth = isSouthGame[gameIdx] ?? false
            const activeGroup = isSouth ? southGroup : eastGroup
            const activeScores = activeGroup?.rankAvgScore ?? fallbackAvgScores ?? defaultScores
            const activeRoomType = activeGroup?.roomType ?? (isSouth
                ? (mode === '3p' ? '3인 옥탁 반장전' : '4인 옥탁 반장전')
                : (mode === '3p' ? '3인 옥탁 동풍전' : '4인 옥탁 동풍전'))

            let bestRank = 1
            let maxDeficit = -Infinity

            let r = 1
            while (r <= maxRank) {
                const targetIdeal = (gameIdx + 1) * (normalizedRates[r - 1] ?? (1 / maxRank))
                const current = rankCounts[r - 1] ?? 0
                const deficit = targetIdeal - current

                if (deficit > maxDeficit) {
                    maxDeficit = deficit
                    bestRank = r
                }
                r++
            }

            rankCounts[bestRank - 1] = (rankCounts[bestRank - 1] ?? 0) + 1

            const baseScore = activeScores[bestRank - 1] ?? (defaultScores[bestRank - 1] ?? 25000)
            const deterministicOffset = (((((gameIdx * 13) + (bestRank * 7)) % 9) - 4) * 400)
            const finalScore = Math.round((baseScore + deterministicOffset) / 100) * 100

            specs.push({
                gameIndex: gameIdx,
                rank: bestRank,
                finalScore,
                roomType: activeRoomType,
                isEast: !isSouth,
                modeId: activeGroup?.modeId
            })
            gameIdx++
        }

        return specs
    }

    /*_ GEMINI THINKING _*/
    protected distributeRoundStyleMetrics(
        gameSpecs: readonly DeterministicGameSpec[],
        extStats: Partial<AmaeExtendedStats>,
        mode: GameMode
    ): readonly {
        readonly isWin: boolean
        readonly isDealIn: boolean
        readonly dealInScore: number
        readonly isRiichi: boolean
        readonly isFuro: boolean
        readonly isDamaten: boolean
        readonly isInitiative: boolean
        readonly uradoraHits: number
    }[] {
        const total = gameSpecs.length
        if (total === 0) {
            return []
        }

        const maxRank = mode === '3p' ? 3 : 4
        const winRateTarget = extStats.和牌率 ?? (mode === '3p' ? 0.29 : 0.22)
        const dealInRateTarget = extStats.放铳率 ?? (mode === '3p' ? 0.14 : 0.12)
        const riichiRateTarget = extStats.立直率 ?? (mode === '3p' ? 0.25 : 0.20)
        const furoRateTarget = extStats.副露率 ?? (mode === '3p' ? 0.23 : 0.28)
        const damatenRateTarget = extStats.默听率 ?? (mode === '3p' ? 0.19 : 0.14)
        const initiativeRateTarget = extStats.先制率 ?? 0.81
        const uradoraRateTarget = extStats.里宝率 ?? (mode === '3p' ? 0.43 : 0.28)

        const targetWinCount = Math.min(total, Math.max(0, Math.round(total * winRateTarget)))
        const targetDealInCount = Math.min(total, Math.max(0, Math.round(total * dealInRateTarget)))
        const targetRiichiCount = Math.min(total, Math.max(0, Math.round(total * riichiRateTarget)))
        const targetFuroCount = Math.min(total, Math.max(0, Math.round(total * furoRateTarget)))
        const targetInitiativeCount = Math.min(targetRiichiCount, Math.max(0, Math.round(targetRiichiCount * initiativeRateTarget)))
        const targetDamaCount = Math.min(targetWinCount, Math.max(0, Math.round(targetWinCount * damatenRateTarget)))

        // 1. Assign wins (rank 1 first, then rank 2, then rank 3)
        const winIndices = new Set<number>()
        const rank1Indices = gameSpecs.map((s, idx) => s.rank === 1 ? idx : -1).filter((i) => i !== -1)
        const rank2Indices = gameSpecs.map((s, idx) => s.rank === 2 ? idx : -1).filter((i) => i !== -1)
        const rank3Indices = gameSpecs.map((s, idx) => s.rank === 3 ? idx : -1).filter((i) => i !== -1)

        for (const idx of rank1Indices) {
            if (winIndices.size < targetWinCount) {
                winIndices.add(idx)
            }
        }
        for (const idx of rank2Indices) {
            if (winIndices.size < targetWinCount) {
                winIndices.add(idx)
            }
        }
        for (const idx of rank3Indices) {
            if (winIndices.size < targetWinCount) {
                winIndices.add(idx)
            }
        }

        // 2. Assign deal-ins (last rank first, then maxRank - 1)
        const dealInIndices = new Set<number>()
        const lastRankIndices = gameSpecs.map((s, idx) => s.rank === maxRank ? idx : -1).filter((i) => i !== -1)
        const secondLastRankIndices = gameSpecs.map((s, idx) => s.rank === maxRank - 1 ? idx : -1).filter((i) => i !== -1)

        for (const idx of lastRankIndices) {
            if (dealInIndices.size < targetDealInCount && !winIndices.has(idx)) {
                dealInIndices.add(idx)
            }
        }
        for (const idx of secondLastRankIndices) {
            if (dealInIndices.size < targetDealInCount && !winIndices.has(idx)) {
                dealInIndices.add(idx)
            }
        }

        // 3. Assign Riichi (prefer win games and high ranks, but not deal-in games)
        const riichiIndices = new Set<number>()
        const candidateRiichiIndices = [...winIndices, ...rank1Indices, ...rank2Indices]
        for (const idx of candidateRiichiIndices) {
            if (riichiIndices.size < targetRiichiCount && !dealInIndices.has(idx)) {
                riichiIndices.add(idx)
            }
        }
        let anyIdx = 0
        while (riichiIndices.size < targetRiichiCount && anyIdx < total) {
            if (!dealInIndices.has(anyIdx)) {
                riichiIndices.add(anyIdx)
            }
            anyIdx++
        }

        // 4. Assign Initiative riichi (first targetInitiativeCount of riichiIndices)
        const initiativeIndices = new Set<number>()
        for (const idx of riichiIndices) {
            if (initiativeIndices.size < targetInitiativeCount) {
                initiativeIndices.add(idx)
            }
        }

        // 5. Assign Damaten wins (wins that are NOT riichi)
        const damatenIndices = new Set<number>()
        const nonRiichiWins = [...winIndices].filter((idx) => !riichiIndices.has(idx))
        for (const idx of nonRiichiWins) {
            if (damatenIndices.size < targetDamaCount) {
                damatenIndices.add(idx)
            }
        }
        if (damatenIndices.size < targetDamaCount) {
            for (const idx of winIndices) {
                if (damatenIndices.size < targetDamaCount && !damatenIndices.has(idx)) {
                    damatenIndices.add(idx)
                    riichiIndices.delete(idx)
                    initiativeIndices.delete(idx)
                }
            }
        }

        // 6. Assign Furo (cannot be riichi or damaten win)
        const furoIndices = new Set<number>()
        let furoCand = 0
        while (furoIndices.size < targetFuroCount && furoCand < total) {
            if (!riichiIndices.has(furoCand) && !damatenIndices.has(furoCand)) {
                furoIndices.add(furoCand)
            }
            furoCand++
        }

        // 7. Assign Uradora hits (riichi wins)
        const uradoraIndices = new Set<number>()
        const riichiWins = [...winIndices].filter((idx) => riichiIndices.has(idx))
        const targetUraCount = Math.min(riichiWins.length, Math.max(0, Math.round(riichiWins.length * uradoraRateTarget)))
        for (const idx of riichiWins) {
            if (uradoraIndices.size < targetUraCount) {
                uradoraIndices.add(idx)
            }
        }

        const avgDealInPts = extStats.平均铳点 && extStats.平均铳点 > 0 ? Math.round(extStats.平均铳点) : (mode === '3p' ? 8600 : 5800)

        const result: {
            readonly isWin: boolean
            readonly isDealIn: boolean
            readonly dealInScore: number
            readonly isRiichi: boolean
            readonly isFuro: boolean
            readonly isDamaten: boolean
            readonly isInitiative: boolean
            readonly uradoraHits: number
        }[] = []

        for (let i = 0; i < total; i++) {
            const isWin = winIndices.has(i)
            const isDealIn = dealInIndices.has(i)
            const isRiichi = riichiIndices.has(i)
            const isFuro = furoIndices.has(i)
            const isDamaten = damatenIndices.has(i)
            const isInitiative = initiativeIndices.has(i)
            const uradoraHits = uradoraIndices.has(i) ? 1 : 0
            const dealInScore = isDealIn ? avgDealInPts : 0

            result.push({
                isWin,
                isDealIn,
                dealInScore,
                isRiichi,
                isFuro,
                isDamaten,
                isInitiative,
                uradoraHits
            })
        }

        return result
    }

    public async syncPlayerByNickname(
        nickname: string,
        mode: GameMode = '3p',
        targetGameCount: number = 50
    ): Promise<SyncPlayerResult> {
        /*_ GEMINI THINKING _*/
        const apiPrefix = mode === '3p' ? '/api/v2/pl3' : '/api/v2/pl4'
        const modesParam = mode === '3p' ? '21,22,23,24,25,26' : '8,9,11,12,15,16'

        // 1. Search player with fallback across mirrors
        let searchList: readonly AmaeSearchResult[]
        try {
            searchList = await this.fetchJsonWithFallback<readonly AmaeSearchResult[]>(
                `${apiPrefix}/search_player/${encodeURIComponent(nickname)}`
            )
        } catch {
            throw new NotFoundException(`Failed to search player: ${nickname}`)
        }

        const found = searchList[0]
        if (!found) {
            throw new NotFoundException(`Player not found on Amae-Koromo (${mode}): ${nickname}`)
        }

        const accountId = found.id

        // 2. Determine time window targeting the most recent games
        const now = Date.now()
        const latestTimestampMs = (found.latest_timestamp ?? 0) * 1000
        let endTime = Math.max(now, latestTimestampMs) + 86400000
        let startTime = (found.latest_timestamp ? latestTimestampMs : now) - (mode === '3p' ? 30 * 86400 * 1000 : 730 * 86400 * 1000)

        // Fetch recent window rank stats
        let rankStats = await this.fetchJsonWithFallback<AmaeRankStats>(
            `${apiPrefix}/player_stats/${accountId}/${startTime}/${endTime}?mode=${modesParam}`
        )

        // If window has too few games (e.g. inactive month), expand gracefully
        if (!rankStats.count || rankStats.count < 10) {
            startTime = 1262304000000
            rankStats = await this.fetchJsonWithFallback<AmaeRankStats>(
                `${apiPrefix}/player_stats/${accountId}/${startTime}/${endTime}?mode=${modesParam}`
            )
        }

        // Fetch matching extended stats for the exact same timeframe
        const extStats = await this.fetchJsonWithFallback<AmaeExtendedStats>(
            `${apiPrefix}/player_extended_stats/${accountId}/${startTime}/${endTime}?mode=${modesParam}`
        )

        // 3. Separate East-wind and South-wind queries when played_modes indicates player played them
        const eastCandidateModes = mode === '3p' ? [21, 23, 25] : [8, 11, 15]
        const southCandidateModes = mode === '3p' ? [22, 24, 26] : [9, 12, 16]

        const allPlayedModes = extStats.played_modes ?? rankStats.played_modes ?? []
        const playedEastModes = allPlayedModes.filter((m) => eastCandidateModes.includes(m))
        const playedSouthModes = allPlayedModes.filter((m) => southCandidateModes.includes(m))

        let eastStats: AmaeRankStats | null = null
        if (playedEastModes.length > 0) {
            try {
                const eastParam = playedEastModes.join(',')
                const res = await this.fetchJsonWithFallback<AmaeRankStats>(
                    `${apiPrefix}/player_stats/${accountId}/${startTime}/${endTime}?mode=${eastParam}`
                )
                if (res && res.count && res.count > 0) {
                    eastStats = res
                }
            } catch {
                eastStats = null
            }
        }

        let southStats: AmaeRankStats | null = null
        if (playedSouthModes.length > 0) {
            try {
                const southParam = playedSouthModes.join(',')
                const res = await this.fetchJsonWithFallback<AmaeRankStats>(
                    `${apiPrefix}/player_stats/${accountId}/${startTime}/${endTime}?mode=${southParam}`
                )
                if (res && res.count && res.count > 0) {
                    southStats = res
                }
            } catch {
                southStats = null
            }
        }

        const eastCount = eastStats?.count ?? (southStats ? 0 : (rankStats.count ?? 0))
        const southCount = southStats?.count ?? (eastStats ? 0 : 0)

        const primaryEastModeId = this.resolvePrimaryModeId(
            allPlayedModes,
            mode,
            true,
            found.level.id
        )
        const eastRoomType = this.resolveRoomType(primaryEastModeId)

        const primarySouthModeId = this.resolvePrimaryModeId(
            allPlayedModes,
            mode,
            false,
            found.level.id
        )
        const southRoomType = this.resolveRoomType(primarySouthModeId)

        const eastGroup: ModeGroupConfig | null = (eastCount > 0 || (southCount === 0 && !southStats))
            ? {
                count: eastCount,
                rankRates: eastStats?.rank_rates ?? rankStats.rank_rates,
                rankAvgScore: eastStats?.rank_avg_score ?? rankStats.rank_avg_score,
                roomType: eastRoomType,
                modeId: primaryEastModeId
            }
            : null

        const southGroup: ModeGroupConfig | null = southCount > 0
            ? {
                count: southCount,
                rankRates: southStats?.rank_rates ?? rankStats.rank_rates,
                rankAvgScore: southStats?.rank_avg_score ?? rankStats.rank_avg_score,
                roomType: southRoomType,
                modeId: primarySouthModeId
            }
            : null

        // 4. Compute Luck & Skill scores
        let luckScore: number
        let skillScore: number

        if (mode === '3p') {
            const shantenLuck = (3.25 - (extStats.平均起手向听 || 3.25)) * 18
            const uradoraLuck = ((extStats.里宝率 || 0.42) - 0.42) * 35
            const ippatsuLuck = ((extStats.一发率 || 0.20) - 0.20) * 30
            luckScore = Math.max(0, Math.min(100, Math.round(50 + shantenLuck + uradoraLuck + ippatsuLuck)))

            const dealInSkill = (0.155 - (extStats.放铳率 || 0.155)) * 220
            const winSkill = ((extStats.和牌率 || 0.29) - 0.29) * 110
            const initiativeSkill = ((extStats.先制率 || 0.80) - 0.80) * 40
            skillScore = Math.max(0, Math.min(100, Math.round(50 + dealInSkill + winSkill + initiativeSkill)))
        } else {
            const shantenLuck = (3.50 - (extStats.平均起手向听 || 3.50)) * 15
            const uradoraLuck = ((extStats.里宝率 || 0.28) - 0.28) * 40
            const ippatsuLuck = ((extStats.一发率 || 0.20) - 0.20) * 30
            luckScore = Math.max(0, Math.min(100, Math.round(50 + shantenLuck + uradoraLuck + ippatsuLuck)))

            const dealInSkill = (0.135 - (extStats.放铳率 || 0.135)) * 200
            const winSkill = ((extStats.和牌率 || 0.20) - 0.20) * 100
            const initiativeSkill = ((extStats.先制率 || 0.80) - 0.80) * 50
            skillScore = Math.max(0, Math.min(100, Math.round(50 + dealInSkill + winSkill + initiativeSkill)))
        }

        const negativeRate = rankStats.negative_rate ? Number((rankStats.negative_rate * 100).toFixed(1)) : 0

        // 5. Deterministic Game Specs Reconstruction (No Math.random())
        const totalAvailable = (eastCount + southCount) > 0 ? (eastCount + southCount) : (rankStats.count || targetGameCount)
        const gameCount = Math.min(targetGameCount, totalAvailable)

        const gameSpecs = this.buildDeterministicGameSpecs({
            targetCount: gameCount,
            mode,
            eastGroup,
            southGroup,
            fallbackRankRates: rankStats.rank_rates,
            fallbackAvgScores: rankStats.rank_avg_score
        })

        const maxRank = mode === '3p' ? 3 : 4
        const baseTimestamp = found.latest_timestamp ? found.latest_timestamp * 1000 : now

        await this.prisma.$transaction(async (tx) => {
            const player = await tx.player.upsert({
                where: { accountId },
                update: {
                    nickname: found.nickname,
                    level: found.level.id
                },
                create: {
                    accountId,
                    nickname: found.nickname,
                    level: found.level.id
                }
            })

            const gamesData: {
                readonly id: string
                readonly roomType: string
                readonly gameDate: Date
            }[] = []

            const participantsData: {
                readonly id: string
                readonly gameId: string
                readonly playerId: string
                readonly seat: number
                readonly finalScore: number
                readonly finalRank: number
                readonly luckScore: number
                readonly skillScore: number
            }[] = []

            const roundsData: {
                readonly id: string
                readonly gameId: string
                readonly roundIndex: number
                readonly honba: number
                readonly riichiSticks: number
            }[] = []

            const distributedMetrics = this.distributeRoundStyleMetrics(gameSpecs, extStats, mode)

            const roundMetricsData: {
                readonly id: string
                readonly roundId: string
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
            }[] = []

            let specIdx = 0
            while (specIdx < gameSpecs.length) {
                const spec = gameSpecs[specIdx]
                if (!spec) {
                    specIdx++
                    continue
                }
                const gameId = `amae-sync-${mode}-${accountId}-${specIdx + 1}`
                const rank = spec.rank
                const finalScore = spec.finalScore
                const roomType = spec.roomType

                let rankBiasLuck = 0
                let rankBiasSkill = 0
                let isBadLuck = false

                if (mode === '3p') {
                    if (rank === 1) {
                        rankBiasLuck = 12
                        rankBiasSkill = 8
                    } else if (rank === 2) {
                        rankBiasLuck = -2
                        rankBiasSkill = 2
                    } else {
                        isBadLuck = (specIdx % 2 === 0)
                        rankBiasLuck = isBadLuck ? -22 : -10
                        rankBiasSkill = isBadLuck ? 2 : -20
                    }
                } else {
                    if (rank === 1) {
                        rankBiasLuck = 14
                        rankBiasSkill = 10
                    } else if (rank === 2) {
                        rankBiasLuck = 4
                        rankBiasSkill = 4
                    } else if (rank === 3) {
                        rankBiasLuck = -6
                        rankBiasSkill = -4
                    } else {
                        isBadLuck = (specIdx % 2 === 0)
                        rankBiasLuck = isBadLuck ? -24 : -12
                        rankBiasSkill = isBadLuck ? 0 : -22
                    }
                }

                const varianceLuck = (((specIdx * 7) + 3) % 7) - 3
                const varianceSkill = (((specIdx * 5) + 2) % 7) - 3
                const gameLuck = Math.max(10, Math.min(95, luckScore + rankBiasLuck + varianceLuck * 2))
                const gameSkill = Math.max(10, Math.min(95, skillScore + rankBiasSkill + varianceSkill * 2))

                const matchTime = new Date(baseTimestamp - (gameSpecs.length - 1 - specIdx) * 3600000 * 2.5)
                const playerSeat = specIdx % maxRank
                const dist = distributedMetrics[specIdx]
                const isDealIn = dist?.isDealIn ?? (rank === maxRank && !isBadLuck)
                const isWin = dist?.isWin ?? (rank === 1 || (rank === 2 && specIdx % 2 === 0))
                const isRiichi = dist?.isRiichi ?? false
                const isFuro = dist?.isFuro ?? false
                const isDamaten = dist?.isDamaten ?? false
                const isInitiative = dist?.isInitiative ?? false
                const uradoraHits = dist ? dist.uradoraHits : (gameLuck >= 70 ? 1 : 0)
                const dealInScore = dist ? dist.dealInScore : (isDealIn ? 8000 : 0)
                const startShanten = this.calculateStartShanten(playerSeat, extStats, gameLuck, luckScore, mode, 0)
                const roundId = `${gameId}-r0`

                gamesData.push({
                    id: gameId,
                    roomType,
                    gameDate: matchTime
                })

                participantsData.push({
                    id: `${gameId}-p${playerSeat}`,
                    gameId,
                    playerId: player.id,
                    seat: playerSeat,
                    finalScore,
                    finalRank: rank,
                    luckScore: gameLuck,
                    skillScore: gameSkill
                })

                roundsData.push({
                    id: roundId,
                    gameId,
                    roundIndex: 0,
                    honba: 0,
                    riichiSticks: 0
                })

                roundMetricsData.push({
                    id: `${roundId}-m${playerSeat}`,
                    roundId,
                    seat: playerSeat,
                    startShanten,
                    startDoraCount: gameLuck >= 60 ? 2 : 1,
                    drawLuckRatio: gameLuck >= 50 ? 0.35 : 0.20,
                    uradoraHits,
                    dealInScore,
                    tsumoLossScore: (rank === maxRank && isBadLuck) ? 6000 : 0,
                    tileEfficiency: gameSkill >= 50 ? 0.88 : 0.72,
                    luckScore: gameLuck,
                    skillScore: gameSkill,
                    isWin,
                    isRiichi,
                    isFuro,
                    isDamaten,
                    isInitiative
                })
                specIdx++
            }

            await tx.game.deleteMany({
                where: {
                    id: { startsWith: `amae-sync-${mode}-${accountId}-` }
                }
            })

            if (gamesData.length > 0) {
                await tx.game.createMany({ data: gamesData, skipDuplicates: true })
                await tx.gameParticipant.createMany({ data: participantsData, skipDuplicates: true })
                await tx.round.createMany({ data: roundsData, skipDuplicates: true })
                await tx.roundMetric.createMany({ data: roundMetricsData, skipDuplicates: true })
            }
        })

        return {
            success: true,
            accountId,
            nickname: found.nickname,
            gameMode: mode,
            totalGames: gameSpecs.length,
            avgRank: Number(rankStats.avg_rank.toFixed(2)),
            winRate: Number((extStats.和牌率 * 100).toFixed(1)),
            dealInRate: Number((extStats.放铳率 * 100).toFixed(1)),
            negativeRate,
            luckScore,
            skillScore
        }
    }
}
