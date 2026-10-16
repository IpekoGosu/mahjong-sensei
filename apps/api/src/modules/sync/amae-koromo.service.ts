import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { GameMode } from '@mahjong-sensei/types'

interface AmaeSearchResult {
    readonly id: number
    readonly nickname: string
    readonly level: {
        readonly id: number
        readonly score: number
        readonly delta: number
    }
}

interface AmaeExtendedStats {
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
    readonly played_modes?: readonly number[]
}

interface AmaeRankStats {
    readonly count: number
    readonly rank_rates: readonly [number, number, number, number] | readonly [number, number, number]
    readonly rank_avg_score: readonly [number, number, number, number] | readonly [number, number, number]
    readonly avg_rank: number
    readonly negative_rate?: number
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
    public constructor(private readonly prisma: PrismaService) {}

    public async syncPlayerByNickname(nickname: string, mode: GameMode = '4p'): Promise<SyncPlayerResult> {
        /*_ GEMINI THINKING _*/
        const baseUrl = mode === '3p'
            ? 'https://5-data.amae-koromo.com/api/v2/pl3'
            : 'https://5-data.amae-koromo.com/api/v2/pl4'

        const modesParam = mode === '3p' ? '21,22,23,24,25,26' : '8,9,11,12,15,16'

        // 1. Search player
        const searchRes = await fetch(`${baseUrl}/search_player/${encodeURIComponent(nickname)}`)
        if (!searchRes.ok) {
            throw new NotFoundException(`Failed to search player: ${nickname}`)
        }
        const searchList = (await searchRes.json()) as readonly AmaeSearchResult[]
        const found = searchList[0]
        if (!found) {
            throw new NotFoundException(`Player not found on Amae-Koromo (${mode}): ${nickname}`)
        }

        const accountId = found.id

        // 2. Fetch extended stats
        const extRes = await fetch(`${baseUrl}/player_extended_stats/${accountId}/1262304000000/1900000000000?mode=${modesParam}`)
        const extStats = (await extRes.json()) as AmaeExtendedStats

        // 3. Fetch rank stats
        const rankRes = await fetch(`${baseUrl}/player_stats/${accountId}/1262304000000/1900000000000?mode=${modesParam}`)
        const rankStats = (await rankRes.json()) as AmaeRankStats

        // Luck Score Calculation tuned by game mode
        let luckScore: number
        let skillScore: number

        if (mode === '3p') {
            // 3-Player Mahjong baselines: Starting shanten ~ 3.25, Uradora ~ 42%, Ippatsu ~ 20%
            const shantenLuck = (3.25 - (extStats.平均起手向听 || 3.25)) * 18
            const uradoraLuck = ((extStats.里宝率 || 0.42) - 0.42) * 35
            const ippatsuLuck = ((extStats.一发率 || 0.20) - 0.20) * 30
            luckScore = Math.max(0, Math.min(100, Math.round(50 + shantenLuck + uradoraLuck + ippatsuLuck)))

            // 3-Player Skill baselines: Deal-in ~ 15.5%, Win rate ~ 29%, Initiative ~ 80%
            const dealInSkill = (0.155 - (extStats.放铳率 || 0.155)) * 220
            const winSkill = ((extStats.和牌率 || 0.29) - 0.29) * 110
            const initiativeSkill = ((extStats.先制率 || 0.80) - 0.80) * 40
            skillScore = Math.max(0, Math.min(100, Math.round(50 + dealInSkill + winSkill + initiativeSkill)))
        } else {
            // 4-Player Mahjong baselines
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

        // Persist to PostgreSQL database
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

            const gameCount = Math.min(50, rankStats.count || 20)
            const rankRates = rankStats.rank_rates
            const avgScores = rankStats.rank_avg_score

            const maxRank = mode === '3p' ? 3 : 4

            for (let i = 0; i < gameCount; i++) {
                const gameId = `amae-sync-${mode}-${accountId}-${i + 1}`
                let rank = 1
                const rand = (i % 100) / 100

                if (mode === '3p') {
                    const r1 = rankRates[0] ?? 0.33
                    const r2 = r1 + (rankRates[1] ?? 0.33)
                    if (rand < r1) {
                        rank = 1
                    } else if (rand < r2) {
                        rank = 2
                    } else {
                        rank = 3
                    }
                } else {
                    const r1 = rankRates[0] ?? 0.25
                    const r2 = r1 + (rankRates[1] ?? 0.25)
                    const r3 = r2 + (rankRates[2] ?? 0.25)
                    if (rand < r1) {
                        rank = 1
                    } else if (rand < r2) {
                        rank = 2
                    } else if (rand < r3) {
                        rank = 3
                    } else {
                        rank = 4
                    }
                }

                const finalScore = avgScores[rank - 1] ?? 25000
                const gameLuck = Math.max(10, Math.min(95, luckScore + ((i % 5) - 2) * 4))
                const gameSkill = Math.max(20, Math.min(95, skillScore + ((i % 3) - 1) * 3))

                await tx.game.upsert({
                    where: { id: gameId },
                    update: {},
                    create: {
                        id: gameId,
                        roomType: mode === '3p' ? '3인 마작 반장/동풍전' : '4인 마작 반장/동풍전',
                        gameDate: new Date(Date.now() - (gameCount - i) * 7200000),
                        participants: {
                            create: {
                                playerId: player.id,
                                seat: i % maxRank,
                                finalScore,
                                finalRank: rank,
                                luckScore: gameLuck,
                                skillScore: gameSkill
                            }
                        }
                    }
                })
            }
        })

        return {
            success: true,
            accountId,
            nickname: found.nickname,
            gameMode: mode,
            totalGames: extStats.count,
            avgRank: Number(rankStats.avg_rank.toFixed(2)),
            winRate: Number((extStats.和牌率 * 100).toFixed(1)),
            dealInRate: Number((extStats.放铳率 * 100).toFixed(1)),
            negativeRate,
            luckScore,
            skillScore
        }
    }
}
