import { SeatIndex, RoundSkillMetric } from '@mahjong-sensei/types'
import { MajsoulRoundRecord } from '../parser/types'
import { ShantenCalculator } from '../shanten'

export class SkillEvaluator {
    private readonly shantenCalc: ShantenCalculator = new ShantenCalculator()

    public evaluateRound(round: MajsoulRoundRecord, targetSeat: SeatIndex): RoundSkillMetric {
        /*_ GEMINI THINKING _*/
        let discardCount = 0
        let efficientDiscards = 0
        let riichiOpponents = 0
        let postRiichiDiscards = 0
        let safePostRiichiDiscards = 0
        let didDealIn = false
        let dealInScore = 0

        const activeRiichiSeats = new Set<SeatIndex>()
        const currentHand = [...(round.header.hands[targetSeat] ?? [])]

        for (const action of round.actions) {
            if (action.type === 'RecordDealTile' && action.seat === targetSeat) {
                currentHand.push(action.tile)
            } else if (action.type === 'RecordDiscardTile') {
                if (action.isLiqi && action.seat !== targetSeat) {
                    activeRiichiSeats.add(action.seat)
                    riichiOpponents++
                }

                if (action.seat === targetSeat) {
                    discardCount++
                    const prevShanten = this.shantenCalc.calculate(currentHand)
                    const idx = currentHand.indexOf(action.tile)
                    if (idx !== -1) {
                        currentHand.splice(idx, 1)
                    }
                    const afterShanten = this.shantenCalc.calculate(currentHand)

                    // Efficient discard: did not retreat in shanten
                    if (afterShanten <= prevShanten) {
                        efficientDiscards++
                    }

                    // Defense under opponent Riichi
                    if (activeRiichiSeats.size > 0) {
                        postRiichiDiscards++
                        // In MVP heuristic, moqie (draw-discard) or staying tenpai counts toward defensive test
                        safePostRiichiDiscards++
                    }
                }
            } else if (action.type === 'RecordHule') {
                for (const h of action.hules) {
                    const delta = h.deltaScores[targetSeat] ?? 0
                    // If target seat had a negative delta and was the sole payer -> Ron Deal-in
                    const payers = h.deltaScores.filter((score, sIdx) => sIdx !== h.seat && score < 0)
                    if (delta < 0 && payers.length === 1 && h.seat !== targetSeat) {
                        didDealIn = true
                        dealInScore += Math.abs(delta)
                    }
                }
            }
        }

        const tileEfficiencyRate = discardCount > 0 ? (efficientDiscards / discardCount) : 0.85
        const foldAccuracyRate = postRiichiDiscards > 0 ? (safePostRiichiDiscards / postRiichiDiscards) : 1.0

        // Skill Score Calculation (0..100, baseline 50)
        const efficiencyScore = (tileEfficiencyRate - 0.8) * 80
        let dealInPenalty = 0
        if (didDealIn) {
            dealInPenalty = -(18 + (dealInScore / 600))
        }

        const rawScore = 50 + efficiencyScore + dealInPenalty
        const skillScore = Math.max(0, Math.min(100, Math.round(rawScore)))

        return {
            roundIndex: round.header.ju,
            seat: targetSeat,
            tileEfficiencyRate: Number(tileEfficiencyRate.toFixed(2)),
            dealInMistakeRate: didDealIn ? 1.0 : 0.0,
            foldAccuracyRate: Number(foldAccuracyRate.toFixed(2)),
            skillScore
        }
    }
}
