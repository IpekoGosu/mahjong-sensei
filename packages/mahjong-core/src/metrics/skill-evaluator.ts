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

        const playerDiscards = new Map<SeatIndex, string[]>()
        playerDiscards.set(0, [])
        playerDiscards.set(1, [])
        playerDiscards.set(2, [])
        playerDiscards.set(3, [])

        const visibleTileCounts = new Map<string, number>()
        const seenDoras = new Set<string>()

        if (round.header.dora) {
            seenDoras.add(round.header.dora)
            this.addVisibleTile(round.header.dora, visibleTileCounts)
        }

        const targetStartingHand = round.header.hands[targetSeat] ?? []
        for (const tile of targetStartingHand) {
            this.addVisibleTile(tile, visibleTileCounts)
        }

        for (const action of round.actions) {
            if (action.type === 'RecordDealTile') {
                if (action.doras) {
                    for (const dora of action.doras) {
                        if (!seenDoras.has(dora)) {
                            seenDoras.add(dora)
                            this.addVisibleTile(dora, visibleTileCounts)
                        }
                    }
                }

                if (action.seat === targetSeat) {
                    currentHand.push(action.tile)
                    this.addVisibleTile(action.tile, visibleTileCounts)
                }
            } else if (action.type === 'RecordDiscardTile') {
                if (action.doras) {
                    for (const dora of action.doras) {
                        if (!seenDoras.has(dora)) {
                            seenDoras.add(dora)
                            this.addVisibleTile(dora, visibleTileCounts)
                        }
                    }
                }

                const discards = playerDiscards.get(action.seat)
                if (discards) {
                    discards.push(action.tile)
                }

                if (action.seat !== targetSeat) {
                    this.addVisibleTile(action.tile, visibleTileCounts)
                }

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
                        const safety = this.calculateDiscardSafety(
                            action.tile,
                            activeRiichiSeats,
                            playerDiscards,
                            visibleTileCounts
                        )
                        safePostRiichiDiscards += safety
                    }
                }
            } else if (action.type === 'RecordChiPengGang') {
                if (action.seat !== targetSeat) {
                    let isFirst = true
                    for (const tile of action.tiles) {
                        if (isFirst) {
                            isFirst = false
                            continue
                        }
                        this.addVisibleTile(tile, visibleTileCounts)
                    }
                }
            } else if (action.type === 'RecordAnGangAddGang') {
                if (action.seat !== targetSeat) {
                    if (action.gangType === 'ankan') {
                        for (const tile of action.tiles) {
                            this.addVisibleTile(tile, visibleTileCounts)
                        }
                    } else if (action.tiles.length > 0) {
                        const addedTile = action.tiles[0]
                        if (addedTile) {
                            this.addVisibleTile(addedTile, visibleTileCounts)
                        }
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

    /*_ GEMINI THINKING _*/
    protected calculateDiscardSafety(
        tile: string,
        activeRiichiSeats: ReadonlySet<SeatIndex>,
        playerDiscards: ReadonlyMap<SeatIndex, readonly string[]>,
        visibleTileCounts: ReadonlyMap<string, number>
    ): number {
        if (activeRiichiSeats.size === 0) {
            return 1.0
        }

        let minSafety = 1.0
        for (const seat of activeRiichiSeats) {
            const discards = playerDiscards.get(seat) ?? []
            const safety = this.evaluateSafetyAgainstPlayer(tile, discards, visibleTileCounts)
            if (safety < minSafety) {
                minSafety = safety
            }
        }

        return minSafety
    }

    /*_ GEMINI THINKING _*/
    protected evaluateSafetyAgainstPlayer(
        tile: string,
        opponentDiscards: readonly string[],
        visibleTileCounts: ReadonlyMap<string, number>
    ): number {
        const normTile = this.normalizeTile(tile)
        const normalizedDiscards = new Set<string>(
            opponentDiscards.map((d: string) => this.normalizeTile(d))
        )

        // 1. Genbutsu: tile is in Riichi opponent's discards
        if (normalizedDiscards.has(normTile)) {
            return 1.0
        }

        // 2. Honor tiles (z): evaluate based on visible copies
        if (normTile.endsWith('z')) {
            const visibleCopies = visibleTileCounts.get(normTile) ?? 0
            if (visibleCopies >= 3) {
                return 0.95
            }
            if (visibleCopies === 2) {
                return 0.75
            }
            return 0.40
        }

        // 3. Suited tiles: terminals, (2,8), (3,7), middle tiles (4,5,6)
        const suit = normTile.slice(-1)
        const num = Number.parseInt(normTile.slice(0, -1), 10)

        // Terminals (1, 9) with/without suji (4, 6)
        if (num === 1) {
            const hasSuji = normalizedDiscards.has(`4${suit}`)
            return hasSuji ? 0.85 : 0.45
        }
        if (num === 9) {
            const hasSuji = normalizedDiscards.has(`6${suit}`)
            return hasSuji ? 0.85 : 0.45
        }

        // (2, 8) with/without 5
        if (num === 2 || num === 8) {
            const hasSuji = normalizedDiscards.has(`5${suit}`)
            return hasSuji ? 0.75 : 0.35
        }

        // (3, 7) with/without (6, 4)
        if (num === 3) {
            const hasSuji = normalizedDiscards.has(`6${suit}`)
            return hasSuji ? 0.70 : 0.30
        }
        if (num === 7) {
            const hasSuji = normalizedDiscards.has(`4${suit}`)
            return hasSuji ? 0.70 : 0.30
        }

        // Middle tiles (4, 5, 6): double suji (0.80) / single suji (0.50) / musuji (0.20)
        if (num === 4) {
            const suji1 = normalizedDiscards.has(`1${suit}`)
            const suji7 = normalizedDiscards.has(`7${suit}`)
            if (suji1 && suji7) {
                return 0.80
            }
            if (suji1 || suji7) {
                return 0.50
            }
            return 0.20
        }

        if (num === 5) {
            const suji2 = normalizedDiscards.has(`2${suit}`)
            const suji8 = normalizedDiscards.has(`8${suit}`)
            if (suji2 && suji8) {
                return 0.80
            }
            if (suji2 || suji8) {
                return 0.50
            }
            return 0.20
        }

        if (num === 6) {
            const suji3 = normalizedDiscards.has(`3${suit}`)
            const suji9 = normalizedDiscards.has(`9${suit}`)
            if (suji3 && suji9) {
                return 0.80
            }
            if (suji3 || suji9) {
                return 0.50
            }
            return 0.20
        }

        return 0.20
    }

    private normalizeTile(tile: string): string {
        return tile.replace('0m', '5m').replace('0p', '5p').replace('0s', '5s')
    }

    private addVisibleTile(tile: string, visibleTileCounts: Map<string, number>): void {
        const norm = this.normalizeTile(tile)
        const count = visibleTileCounts.get(norm) ?? 0
        visibleTileCounts.set(norm, count + 1)
    }
}
