import { PerformanceQuadrant } from '@mahjong-sensei/types'
import { ShantenCalculator } from './shanten'
import { TileConverter } from './tiles'

export interface RoundLuckInput {
    readonly startingHand: readonly string[]
    readonly doraIndicators: readonly string[]
    readonly drawCount: number
    readonly effectiveDrawCount: number
    readonly uradoraCount: number
    readonly unavoidableDamage: number
}

export interface RoundSkillInput {
    readonly actionsCount: number
    readonly optimalDiscardCount: number
    readonly didDealIn: boolean
    readonly dealInScore: number
    readonly isRiichiDiscard: boolean
}

export class MetricCalculator {
    private readonly shantenCalc: ShantenCalculator = new ShantenCalculator()

    public calculateStartingShanten(hand: readonly string[]): number {
        return this.shantenCalc.calculate(hand)
    }

    public countDoraInHand(hand: readonly string[], doraIndicators: readonly string[]): number {
        /*_ GEMINI THINKING _*/
        // Count red fives and dora indicator matches
        let count = 0
        for (const tile of hand) {
            if (TileConverter.isRedDora(tile)) {
                count++
            }
        }
        for (const indicator of doraIndicators) {
            const nextTile = this.getNextDoraTile(indicator)
            for (const tile of hand) {
                const norm = tile.replace('0m', '5m').replace('0p', '5p').replace('0s', '5s')
                if (norm === nextTile) {
                    count++
                }
            }
        }
        return count
    }

    public calculateRoundLuckScore(input: RoundLuckInput): number {
        const startingShanten = this.calculateStartingShanten(input.startingHand)
        const doraCount = this.countDoraInHand(input.startingHand, input.doraIndicators)

        // Baseline starting shanten is roughly 3.5. Lower shanten is luckier.
        const shantenLuck = (3.5 - startingShanten) * 12
        // Dora luck: baseline is 0.8 dora per hand
        const doraLuck = (doraCount - 0.8) * 8
        // Draw luck: effective draw ratio
        const drawRatio = input.drawCount > 0 ? (input.effectiveDrawCount / input.drawCount) : 0.25
        const drawLuck = (drawRatio - 0.25) * 40
        // Uradora luck: 5 points per uradora hit
        const uradoraLuck = input.uradoraCount * 10
        // Unavoidable damage penalty: minus points for getting hit by opponent tsumo
        const tsumoHitLuck = -(input.unavoidableDamage / 2000)

        const rawScore = 50 + shantenLuck + doraLuck + drawLuck + uradoraLuck + tsumoHitLuck
        return Math.max(0, Math.min(100, Math.round(rawScore)))
    }

    public calculateRoundSkillScore(input: RoundSkillInput): number {
        // Tile efficiency rate: baseline ~ 80%
        const efficiencyRatio = input.actionsCount > 0
            ? (input.optimalDiscardCount / input.actionsCount)
            : 0.8
        const efficiencyScore = (efficiencyRatio - 0.8) * 80

        // Deal-in penalty
        let dealInPenalty = 0
        if (input.didDealIn) {
            dealInPenalty = -(15 + (input.dealInScore / 800))
        }

        const rawScore = 50 + efficiencyScore + dealInPenalty
        return Math.max(0, Math.min(100, Math.round(rawScore)))
    }

    public classifyQuadrant(luckScore: number, skillScore: number): PerformanceQuadrant {
        const isLucky = luckScore >= 50
        const isSkillful = skillScore >= 50

        if (isSkillful && isLucky) {
            return 'SKILLFUL_WIN'
        }
        if (isSkillful && !isLucky) {
            return 'UNLUCKY_LOSS'
        }
        if (!isSkillful && !isLucky) {
            return 'SLUMP_LOSS'
        }
        return 'LUCKY_FLUKE'
    }

    private getNextDoraTile(indicator: string): string {
        const norm = indicator.replace('0m', '5m').replace('0p', '5p').replace('0s', '5s')
        const suit = norm.slice(-1)
        const val = parseInt(norm.slice(0, -1), 10)

        if (suit === 'z') {
            if (val >= 1 && val <= 4) {
                const nextVal = val === 4 ? 1 : val + 1
                return `${nextVal}z`
            }
            if (val >= 5 && val <= 7) {
                const nextVal = val === 7 ? 5 : val + 1
                return `${nextVal}z`
            }
        }

        const nextVal = val === 9 ? 1 : val + 1
        return `${nextVal}${suit}`
    }
}
