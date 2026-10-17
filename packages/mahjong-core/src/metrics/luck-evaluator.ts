import { SeatIndex, RoundLuckMetric } from '@mahjong-sensei/types'
import { MajsoulRoundRecord } from '../parser/types'
import { ShantenCalculator } from '../shanten'
import { TileConverter } from '../tiles'

export class LuckEvaluator {
    private readonly shantenCalc: ShantenCalculator = new ShantenCalculator()

    public evaluateRound(round: MajsoulRoundRecord, targetSeat: SeatIndex): RoundLuckMetric {
        /*_ GEMINI THINKING _*/
        const is3P = round.actions.some((a) => a.type === 'RecordBaBei') || (round.header.hands[3]?.length ?? 0) === 0
        const startingHand = round.header.hands[targetSeat] ?? []
        const startShanten = this.shantenCalc.calculate(startingHand, is3P)
        let startDoraCount = this.countDora(startingHand, [round.header.dora], is3P)

        let drawCount = 0
        let effectiveDraws = 0
        let uradoraHits = 0
        let unavoidableDamage = 0
        let isWin = false

        // Track hand through round actions
        const currentHand = [...startingHand]
        let currentShanten = startShanten

        for (const action of round.actions) {
            if (action.type === 'RecordDealTile' && action.seat === targetSeat) {
                drawCount++
                currentHand.push(action.tile)
                const newShanten = this.shantenCalc.calculate(currentHand, is3P)
                // If draw reduced shanten or maintained tenpai
                if (newShanten < currentShanten) {
                    effectiveDraws++
                }
            } else if (action.type === 'RecordDiscardTile' && action.seat === targetSeat) {
                const idx = currentHand.indexOf(action.tile)
                if (idx !== -1) {
                    currentHand.splice(idx, 1)
                }
                currentShanten = this.shantenCalc.calculate(currentHand, is3P)
            } else if (action.type === 'RecordBaBei' && action.seat === targetSeat) {
                const idx = currentHand.indexOf('4z')
                if (idx !== -1) {
                    currentHand.splice(idx, 1)
                    startDoraCount++
                }
                if (currentHand.length >= 13) {
                    currentShanten = this.shantenCalc.calculate(currentHand, is3P)
                }
            } else if (action.type === 'RecordHule') {
                for (const h of action.hules) {
                    if (h.seat === targetSeat) {
                        isWin = true
                        uradoraHits += h.uradoras ? h.uradoras.length : 0
                    } else {
                        // Check if opponent won by tsumo and targeted seat lost points
                        const delta = h.deltaScores[targetSeat] ?? 0
                        if (delta < 0 && this.isTsumoWin(h.deltaScores, h.seat)) {
                            unavoidableDamage += Math.abs(delta)
                        }
                    }
                }
            }
        }

        const drawEfficiencyRatio = drawCount > 0 ? (effectiveDraws / drawCount) : 0.25

        // Luck Score Calculation (0..100, baseline 50)
        const shantenLuck = (3.5 - startShanten) * 12
        const doraLuck = (startDoraCount - 0.8) * 8
        const drawLuck = (drawEfficiencyRatio - 0.25) * 40
        const uradoraLuck = uradoraHits * 10
        const tsumoPenalty = -(unavoidableDamage / 2500)

        const rawScore = 50 + shantenLuck + doraLuck + drawLuck + uradoraLuck + tsumoPenalty
        const luckScore = Math.max(0, Math.min(100, Math.round(rawScore)))

        return {
            roundIndex: round.header.ju,
            seat: targetSeat,
            startingShanten: startShanten,
            startingDoraCount: startDoraCount,
            drawEfficiencyRatio: Number(drawEfficiencyRatio.toFixed(2)),
            uradoraCount: uradoraHits,
            unavoidableDamage,
            luckScore,
            isWin
        }
    }

    protected countDora(hand: readonly string[], indicators: readonly string[], is3P: boolean = false): number {
        let count = 0
        for (const tile of hand) {
            if (TileConverter.isRedDora(tile)) {
                count++
            }
            for (const indicator of indicators) {
                const nextTile = this.getNextDoraTile(indicator, is3P)
                const norm = tile.replace('0m', '5m').replace('0p', '5p').replace('0s', '5s')
                if (norm === nextTile) {
                    count++
                }
            }
        }
        return count
    }

    protected getNextDoraTile(indicator: string, is3P: boolean = false): string {
        const norm = indicator.replace('0m', '5m').replace('0p', '5p').replace('0s', '5s')
        const suit = norm.slice(-1)
        const val = parseInt(norm.slice(0, -1), 10)

        if (is3P && suit === 'm' && val === 1) {
            return '9m'
        }

        if (suit === 'z') {
            if (val >= 1 && val <= 4) {
                return `${val === 4 ? 1 : val + 1}z`
            }
            if (val >= 5 && val <= 7) {
                return `${val === 7 ? 5 : val + 1}z`
            }
        }

        const nextVal = val === 9 ? 1 : val + 1
        return `${nextVal}${suit}`
    }

    private isTsumoWin(deltaScores: readonly [number, number, number, number], winnerSeat: SeatIndex): boolean {
        let payers = 0
        for (let i = 0; i < 4; i++) {
            if (i !== winnerSeat && (deltaScores[i] ?? 0) < 0) {
                payers++
            }
        }
        return payers >= 2
    }
}
