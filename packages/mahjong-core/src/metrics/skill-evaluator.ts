import { SeatIndex, RoundSkillMetric } from '@mahjong-sensei/types'
import { MajsoulRoundRecord } from '../parser/types'
import { ShantenCalculator } from '../shanten'

export class SkillEvaluator {
    private readonly shantenCalc: ShantenCalculator = new ShantenCalculator()

    public evaluateRound(round: MajsoulRoundRecord, targetSeat: SeatIndex): RoundSkillMetric {
        /*_ GEMINI THINKING _*/
        const is3P = round.actions.some((a) => a.type === 'RecordBaBei') || (round.header.hands[3]?.length ?? 0) === 0
        let discardCount = 0
        let efficientDiscards = 0
        let riichiOpponents = 0
        let postRiichiDiscards = 0
        let safePostRiichiDiscards = 0
        let didDealIn = false
        let dealInScore = 0
        let targetMeldCount = 0

        const activeRiichiSeats = new Set<SeatIndex>()
        const currentHand = [...(round.header.hands[targetSeat] ?? [])]

        const playerDiscards = new Map<SeatIndex, string[]>()
        playerDiscards.set(0, [])
        playerDiscards.set(1, [])
        playerDiscards.set(2, [])
        playerDiscards.set(3, [])

        const visibleTileCounts = new Map<string, number>()
        let seenDoraCount = 0
        let lastDiscardedTile: string | null = null

        if (round.header.dora) {
            this.addVisibleTile(round.header.dora, visibleTileCounts)
        }

        const targetStartingHand = round.header.hands[targetSeat] ?? []
        for (const tile of targetStartingHand) {
            this.addVisibleTile(tile, visibleTileCounts)
        }

        for (const action of round.actions) {
            if (action.type === 'RecordDealTile') {
                if (action.doras && action.doras.length > seenDoraCount) {
                    for (const dora of action.doras.slice(seenDoraCount)) {
                        this.addVisibleTile(dora, visibleTileCounts)
                    }
                    seenDoraCount = action.doras.length
                }

                if (action.seat === targetSeat) {
                    currentHand.push(action.tile)
                    this.addVisibleTile(action.tile, visibleTileCounts)
                }
            } else if (action.type === 'RecordDiscardTile') {
                if (action.doras && action.doras.length > seenDoraCount) {
                    for (const dora of action.doras.slice(seenDoraCount)) {
                        this.addVisibleTile(dora, visibleTileCounts)
                    }
                    seenDoraCount = action.doras.length
                }

                lastDiscardedTile = action.tile

                const discards = playerDiscards.get(action.seat)
                if (discards) {
                    discards.push(action.tile)
                }

                if (action.seat !== targetSeat) {
                    for (const riichiSeat of activeRiichiSeats) {
                        if (riichiSeat !== action.seat) {
                            playerDiscards.get(riichiSeat)?.push(action.tile)
                        }
                    }
                    this.addVisibleTile(action.tile, visibleTileCounts)
                }

                if (action.isLiqi && action.seat !== targetSeat) {
                    activeRiichiSeats.add(action.seat)
                    riichiOpponents++
                }

                if (action.seat === targetSeat) {
                    discardCount++
                    const prevShanten = this.shantenCalc.calculate(currentHand, is3P, targetMeldCount)
                    const idx = currentHand.indexOf(action.tile)
                    if (idx !== -1) {
                        currentHand.splice(idx, 1)
                    }
                    const afterShanten = this.shantenCalc.calculate(currentHand, is3P, targetMeldCount)

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
                        for (const riichiSeat of activeRiichiSeats) {
                            playerDiscards.get(riichiSeat)?.push(action.tile)
                        }
                    }
                }
            } else if (action.type === 'RecordChiPengGang') {
                let skippedCalled = false
                const handTilesToRemove: string[] = []

                for (const tile of action.tiles) {
                    if (
                        !skippedCalled &&
                        lastDiscardedTile !== null &&
                        this.normalizeTile(tile) === this.normalizeTile(lastDiscardedTile)
                    ) {
                        skippedCalled = true
                        continue
                    }

                    if (action.seat !== targetSeat) {
                        this.addVisibleTile(tile, visibleTileCounts)
                    } else {
                        handTilesToRemove.push(tile)
                    }
                }

                if (action.seat === targetSeat) {
                    targetMeldCount++
                    for (const tile of handTilesToRemove) {
                        let idx = currentHand.indexOf(tile)
                        if (idx === -1) {
                            const norm = this.normalizeTile(tile)
                            idx = currentHand.findIndex((h) => this.normalizeTile(h) === norm)
                        }
                        if (idx !== -1) {
                            currentHand.splice(idx, 1)
                        }
                    }
                }
            } else if (action.type === 'RecordAnGangAddGang') {
                if (action.seat === targetSeat) {
                    if (action.gangType === 'ankan') {
                        targetMeldCount++
                        for (const tile of action.tiles) {
                            let idx = currentHand.indexOf(tile)
                            if (idx === -1) {
                                const norm = this.normalizeTile(tile)
                                idx = currentHand.findIndex((h) => this.normalizeTile(h) === norm)
                            }
                            if (idx !== -1) {
                                currentHand.splice(idx, 1)
                            }
                            this.addVisibleTile(tile, visibleTileCounts)
                        }
                    } else if (action.tiles.length > 0) {
                        const addedTile = action.tiles[0]
                        if (addedTile) {
                            let idx = currentHand.indexOf(addedTile)
                            if (idx === -1) {
                                const norm = this.normalizeTile(addedTile)
                                idx = currentHand.findIndex((h) => this.normalizeTile(h) === norm)
                            }
                            if (idx !== -1) {
                                currentHand.splice(idx, 1)
                            }
                            this.addVisibleTile(addedTile, visibleTileCounts)
                        }
                    }
                } else {
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
            } else if (action.type === 'RecordBaBei') {
                if (action.doras && action.doras.length > seenDoraCount) {
                    for (const dora of action.doras.slice(seenDoraCount)) {
                        this.addVisibleTile(dora, visibleTileCounts)
                    }
                    seenDoraCount = action.doras.length
                }

                if (action.seat === targetSeat) {
                    const idx = currentHand.indexOf('4z')
                    if (idx !== -1) {
                        currentHand.splice(idx, 1)
                    }
                }
                this.addVisibleTile('4z', visibleTileCounts)
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
        const defenseScore = postRiichiDiscards > 0 ? (foldAccuracyRate - 0.75) * 40 : 0
        let dealInPenalty = 0
        if (didDealIn) {
            dealInPenalty = -(18 + (dealInScore / 600))
        }

        const rawScore = 50 + efficiencyScore + defenseScore + dealInPenalty
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

        let safety = 0.20

        // Terminals (1, 9) with/without suji (4, 6)
        if (num === 1) {
            const hasSuji = normalizedDiscards.has(`4${suit}`)
            safety = hasSuji ? 0.85 : 0.45
        } else if (num === 9) {
            const hasSuji = normalizedDiscards.has(`6${suit}`)
            safety = hasSuji ? 0.85 : 0.45
        } else if (num === 2 || num === 8) {
            // (2, 8) with/without 5
            const hasSuji = normalizedDiscards.has(`5${suit}`)
            safety = hasSuji ? 0.75 : 0.35
        } else if (num === 3) {
            // (3, 7) with/without (6, 4)
            const hasSuji = normalizedDiscards.has(`6${suit}`)
            safety = hasSuji ? 0.70 : 0.30
        } else if (num === 7) {
            const hasSuji = normalizedDiscards.has(`4${suit}`)
            safety = hasSuji ? 0.70 : 0.30
        } else if (num === 4) {
            // Middle tiles (4, 5, 6): double suji (0.80) / single suji (0.50) / musuji (0.20)
            const suji1 = normalizedDiscards.has(`1${suit}`)
            const suji7 = normalizedDiscards.has(`7${suit}`)
            if (suji1 && suji7) {
                safety = 0.80
            } else if (suji1 || suji7) {
                safety = 0.50
            } else {
                safety = 0.20
            }
        } else if (num === 5) {
            const suji2 = normalizedDiscards.has(`2${suit}`)
            const suji8 = normalizedDiscards.has(`8${suit}`)
            if (suji2 && suji8) {
                safety = 0.80
            } else if (suji2 || suji8) {
                safety = 0.50
            } else {
                safety = 0.20
            }
        } else if (num === 6) {
            const suji3 = normalizedDiscards.has(`3${suit}`)
            const suji9 = normalizedDiscards.has(`9${suit}`)
            if (suji3 && suji9) {
                safety = 0.80
            } else if (suji3 || suji9) {
                safety = 0.50
            } else {
                safety = 0.20
            }
        }

        // Kabe / No-Chance: if an adjacent bridge tile required for a ryanmen wait has all 4 copies visible
        let isKabe = false
        if (num === 1) {
            const count3 = visibleTileCounts.get(`3${suit}`) ?? 0
            const count2 = visibleTileCounts.get(`2${suit}`) ?? 0
            if (count3 >= 4 || count2 >= 4) {
                isKabe = true
            }
        } else if (num === 2) {
            const count3 = visibleTileCounts.get(`3${suit}`) ?? 0
            if (count3 >= 4) {
                isKabe = true
            }
        } else if (num === 8) {
            const count7 = visibleTileCounts.get(`7${suit}`) ?? 0
            if (count7 >= 4) {
                isKabe = true
            }
        } else if (num === 9) {
            const count7 = visibleTileCounts.get(`7${suit}`) ?? 0
            const count8 = visibleTileCounts.get(`8${suit}`) ?? 0
            if (count7 >= 4 || count8 >= 4) {
                isKabe = true
            }
        }

        if (isKabe && safety < 0.85) {
            safety = 0.85
        }

        return safety
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
