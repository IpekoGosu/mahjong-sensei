import {
    SeatIndex,
    RoundLuckMetric,
    OpponentLuckMetrics,
    OpponentLuckGrade,
    UnavoidableLossSummary
} from '@mahjong-sensei/types'
import { MajsoulRoundRecord } from '../parser/types'
import { ShantenCalculator } from '../shanten'
import { TileConverter } from '../tiles'

export class LuckEvaluator {
    private readonly shantenCalc: ShantenCalculator = new ShantenCalculator()

    public evaluateRound(round: MajsoulRoundRecord, targetSeat: SeatIndex): RoundLuckMetric {
        /*_ GEMINI THINKING _*/
        const is3P = round.actions.some((a) => a.type === 'RecordBaBei') || (round.header.hands[3]?.length ?? 0) === 0
        const seatCount = is3P ? 3 : 4
        const dealerSeat = (round.header.ju % seatCount) as SeatIndex
        const startingHand = round.header.hands[targetSeat] ?? []
        const startShanten = this.shantenCalc.calculate(startingHand, is3P)
        let startDoraCount = this.countDora(startingHand, [round.header.dora], is3P)

        let drawCount = 0
        let effectiveDraws = 0
        let uradoraHits = 0
        let unavoidableDamage = 0
        let dealInDamage = 0
        let dealerManganTsumoCount = 0
        let dealerHanemanTsumoCount = 0
        let isDealerTsumo = false
        let isWin = false

        // Track hand through round actions
        const currentHand = [...startingHand]
        let currentShanten = startShanten
        let meldCount = 0
        let lastDiscardedTile: string | null = null

        for (const action of round.actions) {
            if (action.type === 'RecordDealTile') {
                lastDiscardedTile = null
                if (action.seat === targetSeat) {
                    drawCount++
                    currentHand.push(action.tile)
                    const newShanten = this.shantenCalc.calculate(currentHand, is3P, meldCount)
                    // If draw reduced shanten or maintained tenpai
                    if (newShanten < currentShanten) {
                        effectiveDraws++
                    }
                }
            } else if (action.type === 'RecordDiscardTile') {
                lastDiscardedTile = action.tile
                if (action.seat === targetSeat) {
                    let idx = currentHand.indexOf(action.tile)
                    if (idx === -1) {
                        const norm = this.normalizeTile(action.tile)
                        idx = currentHand.findIndex((t) => this.normalizeTile(t) === norm)
                    }
                    if (idx !== -1) {
                        currentHand.splice(idx, 1)
                    }
                    currentShanten = this.shantenCalc.calculate(currentHand, is3P, meldCount)
                }
            } else if (action.type === 'RecordChiPengGang') {
                if (action.seat === targetSeat) {
                    meldCount++
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
                        handTilesToRemove.push(tile)
                    }

                    if (!skippedCalled && action.tiles.length > 0) {
                        let skipIdx = handTilesToRemove.findIndex((t) => {
                            const norm = this.normalizeTile(t)
                            return !currentHand.some((h) => this.normalizeTile(h) === norm)
                        })
                        if (skipIdx === -1) {
                            skipIdx = 0
                        }
                        handTilesToRemove.splice(skipIdx, 1)
                    }

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
                lastDiscardedTile = null
            } else if (action.type === 'RecordAnGangAddGang') {
                if (action.seat === targetSeat) {
                    if (action.gangType === 'ankan') {
                        meldCount++
                        for (const tile of action.tiles) {
                            let idx = currentHand.indexOf(tile)
                            if (idx === -1) {
                                const norm = this.normalizeTile(tile)
                                idx = currentHand.findIndex((h) => this.normalizeTile(h) === norm)
                            }
                            if (idx !== -1) {
                                currentHand.splice(idx, 1)
                            }
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
                        }
                    }
                }
                lastDiscardedTile = null
            } else if (action.type === 'RecordBaBei') {
                lastDiscardedTile = null
                if (action.seat === targetSeat) {
                    const idx = currentHand.indexOf('4z')
                    if (idx !== -1) {
                        currentHand.splice(idx, 1)
                        startDoraCount++
                    }
                    if (currentHand.length >= (13 - meldCount * 3)) {
                        currentShanten = this.shantenCalc.calculate(currentHand, is3P, meldCount)
                    }
                }
            } else if (action.type === 'RecordHule') {
                for (const h of action.hules) {
                    if (h.seat === targetSeat) {
                        isWin = true
                        uradoraHits += h.uradoras ? h.uradoras.length : 0
                    } else {
                        const delta = h.deltaScores[targetSeat] ?? 0
                        if (delta < 0) {
                            const isTsumo = this.isTsumoWin(h.deltaScores, h.seat)
                            const damage = Math.abs(delta)
                            if (isTsumo) {
                                unavoidableDamage += damage
                                if (h.seat === dealerSeat) {
                                    isDealerTsumo = true
                                    const fan = h.fan ?? 0
                                    const handScore = h.handScore ?? 0
                                    if (damage >= 6000 || fan >= 6 || handScore >= 18000) {
                                        dealerHanemanTsumoCount++
                                    } else if (damage >= 4000 || fan >= 5 || handScore >= 12000) {
                                        dealerManganTsumoCount++
                                    }
                                }
                            } else {
                                dealInDamage += damage
                            }
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

        const totalLoss = unavoidableDamage + dealInDamage
        const unavoidableLossRatio = totalLoss > 0
            ? Number((unavoidableDamage / totalLoss).toFixed(3))
            : 0

        return {
            roundIndex: round.header.ju,
            seat: targetSeat,
            startingShanten: startShanten,
            startingDoraCount: startDoraCount,
            drawEfficiencyRatio: Number(drawEfficiencyRatio.toFixed(2)),
            uradoraCount: uradoraHits,
            unavoidableDamage,
            luckScore,
            isWin,
            totalUnavoidableLoss: unavoidableDamage,
            unavoidableLossRatio,
            dealInDamage,
            dealerManganTsumoCount,
            dealerHanemanTsumoCount,
            isDealerTsumo
        }
    }

    /*_ GEMINI THINKING _*/
    public evaluateGameUnavoidableLoss(
        rounds: readonly MajsoulRoundRecord[],
        targetSeat: SeatIndex,
        is3P: boolean = true
    ): UnavoidableLossSummary {
        let totalUnavoidableLoss = 0
        let totalDealInLoss = 0
        let dealerManganTsumoCount = 0
        let dealerHanemanTsumoCount = 0
        let consecutiveDealerTsumoCount = 0
        let maxConsecutiveDealerTsumos = 0
        let currentStreak = 0

        for (const round of rounds) {
            const metric = this.evaluateRound(round, targetSeat)
            const roundUnavoidable = metric.totalUnavoidableLoss ?? metric.unavoidableDamage
            const roundDealIn = metric.dealInDamage ?? 0

            totalUnavoidableLoss += roundUnavoidable
            totalDealInLoss += roundDealIn

            const manganCount = metric.dealerManganTsumoCount ?? 0
            const hanemanCount = metric.dealerHanemanTsumoCount ?? 0
            dealerManganTsumoCount += manganCount
            dealerHanemanTsumoCount += hanemanCount

            if (metric.isDealerTsumo) {
                currentStreak++
                if (currentStreak >= 2) {
                    consecutiveDealerTsumoCount++
                }
                if (currentStreak > maxConsecutiveDealerTsumos) {
                    maxConsecutiveDealerTsumos = currentStreak
                }
            } else {
                currentStreak = 0
            }
        }

        const totalLoss = totalUnavoidableLoss + totalDealInLoss
        const unavoidableLossRatio = totalLoss > 0
            ? Number((totalUnavoidableLoss / totalLoss).toFixed(3))
            : 0

        // In 3P, tsumo loss severity is especially acute (threshold 75% or 0 deal-in)
        const tsumoRatioThreshold = is3P ? 0.75 : 0.80
        const isPureUnluckyLoss = (totalDealInLoss === 0 && totalLoss > 0) ||
            (totalLoss > 0 && unavoidableLossRatio >= tsumoRatioThreshold)

        return {
            totalUnavoidableLoss,
            totalDealInLoss,
            totalLoss,
            unavoidableLossRatio,
            dealerManganTsumoCount,
            dealerHanemanTsumoCount,
            consecutiveDealerTsumoCount,
            maxConsecutiveDealerTsumos,
            isPureUnluckyLoss
        }
    }

    /*_ GEMINI THINKING _*/
    public evaluateOpponentLuck(
        rounds: readonly MajsoulRoundRecord[],
        targetSeat: SeatIndex,
        is3P: boolean = true
    ): OpponentLuckMetrics {
        let opponentRiichiCount = 0
        let opponentRiichiWinCount = 0
        let opponentWinCount = 0
        let earlyWinCount = 0
        let targetHitCount = 0
        let ippatsuHitCount = 0
        let uradoraHitCount = 0

        const winTurns: number[] = []
        const tenpaiTurns: number[] = []

        for (const round of rounds) {
            const discardsCount: [number, number, number, number] = [0, 0, 0, 0]
            const activeRiichi = new Set<SeatIndex>()
            const ippatsuEligible = new Set<SeatIndex>()
            const riichiDeclaredTurns = new Map<SeatIndex, number>()

            for (const action of round.actions) {
                if (action.type === 'RecordDiscardTile') {
                    discardsCount[action.seat]++
                    const currentTurn = discardsCount[action.seat]

                    if (ippatsuEligible.has(action.seat)) {
                        ippatsuEligible.delete(action.seat)
                    }

                    if (action.isLiqi) {
                        activeRiichi.add(action.seat)
                        ippatsuEligible.add(action.seat)
                        riichiDeclaredTurns.set(action.seat, currentTurn)

                        if (action.seat !== targetSeat) {
                            opponentRiichiCount++
                            tenpaiTurns.push(currentTurn)
                        }
                    }
                } else if (
                    action.type === 'RecordChiPengGang' ||
                    action.type === 'RecordAnGangAddGang' ||
                    action.type === 'RecordBaBei'
                ) {
                    ippatsuEligible.clear()
                } else if (action.type === 'RecordHule') {
                    for (const h of action.hules) {
                        if (h.seat !== targetSeat) {
                            opponentWinCount++
                            const winnerTurn = discardsCount[h.seat] > 0 ? discardsCount[h.seat] : 1
                            winTurns.push(winnerTurn)

                            if (winnerTurn <= 6) {
                                earlyWinCount++
                            }

                            const hasRiichiYaku = h.yaku?.some(y =>
                                y.includes('리치') || y.includes('立直') || y.includes('Riichi')
                            ) ?? false
                            const isRiichiWin = activeRiichi.has(h.seat) || hasRiichiYaku

                            if (isRiichiWin) {
                                opponentRiichiWinCount++
                            }

                            const hasIppatsuYaku = h.yaku?.some(y =>
                                y.includes('일발') || y.includes('一発') || y.includes('Ippatsu')
                            ) ?? false
                            const isIppatsu = ippatsuEligible.has(h.seat) || hasIppatsuYaku

                            const hasUradoraYaku = (h.uradoras && h.uradoras.length > 0) ||
                                (h.yaku?.some(y =>
                                    y.includes('우라도라') || y.includes('裏ドラ') || y.includes('Uradora')
                                ) ?? false)

                            const delta = h.deltaScores[targetSeat] ?? 0
                            if (delta < 0) {
                                targetHitCount++
                                if (isIppatsu) {
                                    ippatsuHitCount++
                                }
                                if (hasUradoraYaku) {
                                    uradoraHitCount++
                                }
                            }
                        }
                    }
                } else if (action.type === 'RecordNoTile') {
                    for (const tenpaiSeat of action.tenpaiSeats) {
                        if (tenpaiSeat !== targetSeat && !riichiDeclaredTurns.has(tenpaiSeat)) {
                            const turn = discardsCount[tenpaiSeat] > 0 ? discardsCount[tenpaiSeat] : 12
                            tenpaiTurns.push(turn)
                        }
                    }
                }
            }
        }

        const avgWinTurn = winTurns.length > 0
            ? Number((winTurns.reduce((a, b) => a + b, 0) / winTurns.length).toFixed(1))
            : (is3P ? 8.2 : 9.5)

        const avgTenpaiTurn = tenpaiTurns.length > 0
            ? Number((tenpaiTurns.reduce((a, b) => a + b, 0) / tenpaiTurns.length).toFixed(1))
            : (is3P ? 7.1 : 8.4)

        const earlyWinRate = opponentWinCount > 0
            ? Number(((earlyWinCount / opponentWinCount) * 100).toFixed(1))
            : 0

        const totalRounds = rounds.length > 0 ? rounds.length : 1
        const opponentRiichiRate = Number(((opponentRiichiCount / totalRounds) * 100).toFixed(1))

        const riichiWinRate = opponentRiichiCount > 0
            ? Number(((opponentRiichiWinCount / opponentRiichiCount) * 100).toFixed(1))
            : 0

        const ippatsuHitRate = targetHitCount > 0
            ? Number(((ippatsuHitCount / targetHitCount) * 100).toFixed(1))
            : 0

        const uradoraHitRate = targetHitCount > 0
            ? Number(((uradoraHitCount / targetHitCount) * 100).toFixed(1))
            : 0

        const opponentLuckGrade = this.calculateOpponentLuckGrade(
            earlyWinRate,
            riichiWinRate,
            ippatsuHitRate,
            uradoraHitRate
        )

        return {
            avgTenpaiTurn,
            avgWinTurn,
            earlyWinRate,
            earlyWinCount,
            totalOpponentWins: opponentWinCount,
            opponentRiichiRate,
            riichiWinRate,
            ippatsuHitRate,
            uradoraHitRate,
            opponentLuckGrade
        }
    }

    /*_ GEMINI THINKING _*/
    public calculateOpponentLuckGrade(
        earlyWinRate: number,
        riichiWinRate: number,
        ippatsuHitRate: number,
        uradoraHitRate: number
    ): OpponentLuckGrade {
        let score = 50
        score += (earlyWinRate - 15) * 0.8
        score += (riichiWinRate - 50) * 0.4
        score += (ippatsuHitRate - 12) * 0.9
        score += (uradoraHitRate - 30) * 0.6

        if (score >= 72) {
            return 'S'
        }
        if (score >= 60) {
            return 'A'
        }
        if (score >= 48) {
            return 'B'
        }
        if (score >= 38) {
            return 'C'
        }
        return 'D'
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

    /*_ GEMINI THINKING _*/
    protected getNextDoraTile(indicator: string, is3P: boolean = false): string {
        return TileConverter.getNextDoraTile(indicator, is3P)
    }

    protected isTsumoWin(deltaScores: readonly [number, number, number, number], winnerSeat: SeatIndex): boolean {
        let payers = 0
        for (let i = 0; i < 4; i++) {
            if (i !== winnerSeat && (deltaScores[i] ?? 0) < 0) {
                payers++
            }
        }
        return payers >= 2
    }

    private normalizeTile(tile: string): string {
        return TileConverter.normalizeTile(tile)
    }
}
