import { Injectable, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { MetricCalculator } from '@mahjong-sensei/mahjong-core'

@Injectable()
export class PaipuService {
    private readonly metricCalc: MetricCalculator = new MetricCalculator()

    public constructor(private readonly prisma: PrismaService) {}

    public extractUuid(input: string): string {
        /*_ GEMINI THINKING _*/
        // Handles full URLs (e.g., https://mahjongsoul.game.yo-star.com/?paipu=230801-xxxx) or pure UUIDs
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

        // Mock game creation for initial Phase 1 pipeline verification
        const defaultPlayer = await this.prisma.player.upsert({
            where: { accountId: 10001 },
            update: {},
            create: {
                accountId: 10001,
                nickname: 'SenseiPlayer',
                level: 3
            }
        })

        const calculatedLuck = this.metricCalc.calculateRoundLuckScore({
            startingHand: ['1m', '2m', '3m', '4p', '5p', '6p', '7s', '8s', '9s', '1z', '1z', '2z', '2z', '3z'],
            doraIndicators: ['5m'],
            drawCount: 12,
            effectiveDrawCount: 6,
            uradoraCount: 1,
            unavoidableDamage: 0
        })

        const calculatedSkill = this.metricCalc.calculateRoundSkillScore({
            actionsCount: 12,
            optimalDiscardCount: 11,
            didDealIn: false,
            dealInScore: 0,
            isRiichiDiscard: false
        })

        const game = await this.prisma.game.create({
            data: {
                id: uuid,
                roomType: '옥탁 반장전 (Jade South)',
                gameDate: new Date(),
                participants: {
                    create: [
                        {
                            playerId: defaultPlayer.id,
                            seat: 0,
                            finalScore: 38200,
                            finalRank: 1,
                            luckScore: calculatedLuck,
                            skillScore: calculatedSkill
                        }
                    ]
                }
            }
        })

        return { success: true, gameId: game.id }
    }
}
