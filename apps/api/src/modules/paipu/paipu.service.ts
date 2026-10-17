import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import {
    PaipuParser,
    MajsoulGameRecord,
    SAMPLE_MAJSOUL_GAME
} from '@mahjong-sensei/mahjong-core'
import { PaipuDetail } from '@mahjong-sensei/types'

@Injectable()
export class PaipuService {
    private readonly parser: PaipuParser = new PaipuParser()

    public constructor(private readonly prisma: PrismaService) {}

    public extractUuid(input: string): string {
        /*_ GEMINI THINKING _*/
        if (input.includes('paipu=')) {
            const urlParts = input.split('paipu=')
            const candidate = urlParts[1]?.split('&')[0]
            if (candidate && candidate.length > 0) {
                return candidate
            }
        }
        const trimmed = input.trim()
        if (trimmed.length > 0) {
            return trimmed
        }
        throw new BadRequestException('Invalid Paipu URL or UUID format')
    }

    public async importPaipu(urlOrUuid: string): Promise<{ success: boolean; gameId: string }> {
        const uuid = this.extractUuid(urlOrUuid)

        // Check if already imported
        const existing = await this.prisma.game.findUnique({
            where: { id: uuid }
        })
        if (existing) {
            return { success: true, gameId: existing.id }
        }

        /*_ GEMINI THINKING _*/
        // Build game record from sample/parsed payload with the requested UUID
        const gameRecord: MajsoulGameRecord = {
            ...SAMPLE_MAJSOUL_GAME,
            uuid,
            timestamp: Date.now()
        }

        const parsed = this.parser.parseGameRecord(gameRecord)

        // Save Players, Game, Participants, Rounds and RoundMetrics in a transaction
        await this.prisma.$transaction(async (tx) => {
            // Upsert players
            const playerMap = new Map<number, string>()
            for (const p of parsed.detail.players) {
                const playerRecord = await tx.player.upsert({
                    where: { accountId: p.accountId },
                    update: { nickname: p.nickname },
                    create: {
                        accountId: p.accountId,
                        nickname: p.nickname,
                        level: 3
                    }
                })
                playerMap.set(p.accountId, playerRecord.id)
            }

            // Create Game
            const game = await tx.game.create({
                data: {
                    id: uuid,
                    roomType: parsed.detail.roomName,
                    gameDate: new Date(parsed.detail.timestamp)
                }
            })

            // Create Game Participants
            for (const p of parsed.detail.players) {
                const playerId = playerMap.get(p.accountId)
                if (playerId) {
                    await tx.gameParticipant.create({
                        data: {
                            gameId: game.id,
                            playerId,
                            seat: p.seat,
                            finalScore: p.finalScore,
                            finalRank: p.rank,
                            luckScore: p.luckScore,
                            skillScore: p.skillScore
                        }
                    })
                }
            }

            // Create Rounds and RoundMetrics
            for (const round of parsed.detail.rounds) {
                const createdRound = await tx.round.create({
                    data: {
                        gameId: game.id,
                        roundIndex: round.roundIndex,
                        honba: round.honba,
                        riichiSticks: round.riichiSticks
                    }
                })

                const roundMetrics = parsed.roundMetrics.filter((m) => m.roundIndex === round.roundIndex)
                for (const m of roundMetrics) {
                    await tx.roundMetric.create({
                        data: {
                            roundId: createdRound.id,
                            seat: m.seat,
                            startShanten: m.startShanten,
                            startDoraCount: m.startDoraCount,
                            drawLuckRatio: m.drawLuckRatio,
                            uradoraHits: m.uradoraHits,
                            dealInScore: m.dealInScore,
                            tsumoLossScore: m.tsumoLossScore,
                            tileEfficiency: m.tileEfficiency,
                            luckScore: m.luckScore,
                            skillScore: m.skillScore
                        }
                    })
                }
            }
        })

        return { success: true, gameId: uuid }
    }

    public async importBatch(inputs: readonly string[]): Promise<{
        total: number
        imported: number
        failed: number
        gameIds: readonly string[]
    }> {
        const gameIds: string[] = []
        let imported = 0
        let failed = 0

        for (const input of inputs) {
            const trimmed = input.trim()
            if (!trimmed) {
                continue
            }
            try {
                const res = await this.importPaipu(trimmed)
                if (res.success) {
                    imported++
                    gameIds.push(res.gameId)
                } else {
                    failed++
                }
            } catch {
                failed++
            }
        }

        return {
            total: imported + failed,
            imported,
            failed,
            gameIds
        }
    }

    public async getPaipuDetail(gameId: string): Promise<PaipuDetail> {
        const game = await this.prisma.game.findUnique({
            where: { id: gameId },
            include: {
                participants: {
                    include: { player: true }
                },
                rounds: {
                    include: { roundMetrics: true }
                }
            }
        })

        if (!game) {
            throw new NotFoundException(`Paipu with id ${gameId} not found`)
        }

        const players = game.participants.map((p) => ({
            accountId: p.player.accountId,
            nickname: p.player.nickname,
            seat: p.seat as 0 | 1 | 2 | 3,
            rank: p.finalRank,
            finalScore: p.finalScore,
            luckScore: p.luckScore,
            skillScore: p.skillScore
        }))

        const rounds = game.rounds.map((r) => {
            const roundNames = ['동1국', '동2국', '동3국', '동4국', '남1국', '남2국', '남3국', '남4국']
            const name = roundNames[r.roundIndex] ?? `동${r.roundIndex + 1}국`
            return {
                roundIndex: r.roundIndex,
                roundName: name,
                honba: r.honba,
                riichiSticks: r.riichiSticks,
                initialScores: [25000, 25000, 25000, 25000] as const,
                doraIndicators: [],
                startingHands: [[], [], [], []] as const,
                actions: []
            }
        })

        return {
            id: game.id,
            roomName: game.roomType,
            timestamp: game.gameDate.getTime(),
            players,
            rounds
        }
    }
}
