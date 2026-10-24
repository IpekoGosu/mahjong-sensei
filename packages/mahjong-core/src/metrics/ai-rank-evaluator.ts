import {
    SeatIndex,
    AiGrade,
    AiEvaluationBreakdown,
    GameMode
} from '@mahjong-sensei/types'
import { MajsoulGameRecord } from '../parser/types'
import { ShantenCalculator } from '../shanten'
import { TILE_NAMES } from '../tiles'

export type PaipuGame = MajsoulGameRecord

export interface RoundContextInput {
    readonly isDealer: boolean
    readonly matchLength: 'east' | 'south'
    readonly roundIndex: number
    readonly remainingRounds: number
    readonly scores: readonly number[]
    readonly targetSeat: number
    readonly honba: number
    readonly riichiSticks: number
    readonly kanCount: number
    readonly visibleDoraCount: number
}

export interface TurnContextInput extends RoundContextInput {
    readonly turnNumber: number
    readonly remainingTiles: number
    readonly activeRiichiSeats: ReadonlySet<SeatIndex>
    readonly opponentMeldCounts: ReadonlyMap<SeatIndex, number>
    readonly opponentKawas: ReadonlyMap<SeatIndex, readonly string[]>
    readonly handTiles: readonly string[]
    readonly targetMeldCount: number
    readonly doraIndicators: readonly string[]
}

export interface SummaryGameEvaluationInput {
    readonly rank: number
    readonly finalScore: number
    readonly roomType?: string
    readonly gameMode?: GameMode
    readonly luckScore: number
    readonly skillScore: number
    readonly averageStartingShanten?: number
    readonly winCount?: number
    readonly dealInCount?: number
    readonly totalRounds?: number
    readonly dealerRounds?: number
    readonly tsumoLossScore?: number
    readonly tileEfficiency?: number
}

export interface CandidateDiscardEvaluation {
    readonly tile: string
    readonly qValue: number
    readonly evAttack: number
    readonly expectedLoss: number
    readonly resultingShanten: number
    readonly resultingUkeire: number
}

export class AiRankEvaluator {
    private readonly shantenCalc: ShantenCalculator = new ShantenCalculator()

    /*_ GEMINI THINKING _*/
    public evaluatePaipuGame(game: PaipuGame, targetSeat: number): AiEvaluationBreakdown {
        const is3P = game.players.length === 3 || game.roomType.includes('3인')
        const totalRounds = game.rounds.length || 1
        const matchLength: 'east' | 'south' = game.rounds.some((r) => r.header.chang >= 1) || totalRounds > 4 ? 'south' : 'east'

        let evaluatedTurns = 0
        let matchedTurns = 0
        let totalEvLoss = 0
        let attackMistakes = 0
        let dangerPushes = 0
        let totalDealInScore = 0

        const { finalScore, finalRank } = this.calculateFinalScoresAndRank(game, targetSeat)

        let rIdx = 0
        while (rIdx < game.rounds.length) {
            const round = game.rounds[rIdx]
            if (!round) {
                rIdx++
                continue
            }

            const header = round.header
            const seatCount = is3P ? 3 : 4
            const isDealer = (header.ju % seatCount) === targetSeat
            const remainingRounds = Math.max(1, (matchLength === 'east' ? 4 : 8) - rIdx)
            const honba = header.ben
            const riichiSticks = header.liqi
            const scores = [...header.scores]

            const currentHand = [...(header.hands[targetSeat] ?? [])]
            const visibleTileCounts = new Map<string, number>()
            const kawas = new Map<SeatIndex, string[]>()
            kawas.set(0, [])
            kawas.set(1, [])
            kawas.set(2, [])
            kawas.set(3, [])

            const activeRiichiSeats = new Set<SeatIndex>()
            const opponentMeldCounts = new Map<SeatIndex, number>()
            opponentMeldCounts.set(0, 0)
            opponentMeldCounts.set(1, 0)
            opponentMeldCounts.set(2, 0)
            opponentMeldCounts.set(3, 0)

            const doraIndicators: string[] = []
            if (header.dora) {
                doraIndicators.push(header.dora)
                this.addVisibleTile(header.dora, visibleTileCounts)
            }

            let kanCount = 0
            let playerMeldCount = 0
            let turnNumber = 0
            let lastDiscardedTile: string | null = null

            for (const action of round.actions) {
                if (action.type === 'RecordDealTile') {
                    lastDiscardedTile = null
                    if (action.doras) {
                        for (const d of action.doras) {
                            if (!doraIndicators.includes(d)) {
                                doraIndicators.push(d)
                                this.addVisibleTile(d, visibleTileCounts)
                            }
                        }
                    }
                    if (action.seat === targetSeat) {
                        currentHand.push(action.tile)
                        this.addVisibleTile(action.tile, visibleTileCounts)
                        turnNumber++
                    }
                } else if (action.type === 'RecordBaBei') {
                    lastDiscardedTile = null
                    if (action.doras) {
                        for (const d of action.doras) {
                            if (!doraIndicators.includes(d)) {
                                doraIndicators.push(d)
                                this.addVisibleTile(d, visibleTileCounts)
                            }
                        }
                    }
                    if (action.seat === targetSeat) {
                        const bIdx = currentHand.indexOf('4z')
                        if (bIdx !== -1) {
                            currentHand.splice(bIdx, 1)
                        }
                    }
                } else if (action.type === 'RecordChiPengGang') {
                    if (action.seat === targetSeat) {
                        playerMeldCount++
                    } else {
                        const mCount = opponentMeldCounts.get(action.seat) ?? 0
                        opponentMeldCounts.set(action.seat, mCount + 1)
                    }

                    if (action.meldType === 'daiminkan') {
                        kanCount++
                    }

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
                            this.addVisibleTile(tile, visibleTileCounts)
                        }
                    }
                    lastDiscardedTile = null
                } else if (action.type === 'RecordAnGangAddGang') {
                    kanCount++
                    if (action.gangType === 'ankan') {
                        if (action.seat === targetSeat) {
                            playerMeldCount++
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
                        } else {
                            const mCount = opponentMeldCounts.get(action.seat) ?? 0
                            opponentMeldCounts.set(action.seat, mCount + 1)
                            for (const tile of action.tiles) {
                                this.addVisibleTile(tile, visibleTileCounts)
                            }
                        }
                    } else {
                        // kakan (加槓, AddGang)
                        const addedTile = action.tiles[0]
                        if (addedTile) {
                            if (action.seat === targetSeat) {
                                let idx = currentHand.indexOf(addedTile)
                                if (idx === -1) {
                                    const norm = this.normalizeTile(addedTile)
                                    idx = currentHand.findIndex((h) => this.normalizeTile(h) === norm)
                                }
                                if (idx !== -1) {
                                    currentHand.splice(idx, 1)
                                }
                                this.addVisibleTile(addedTile, visibleTileCounts)
                            } else {
                                this.addVisibleTile(addedTile, visibleTileCounts)
                            }
                        }
                    }
                    lastDiscardedTile = null
                } else if (action.type === 'RecordDiscardTile') {
                    lastDiscardedTile = action.tile
                    kawas.get(action.seat)?.push(action.tile)
                    if (action.seat !== targetSeat) {
                        this.addVisibleTile(action.tile, visibleTileCounts)
                    }
                    if (action.isLiqi && action.seat !== targetSeat) {
                        activeRiichiSeats.add(action.seat)
                    }

                    if (action.seat === targetSeat) {
                        const chosenTile = action.tile
                        const remainingWallTiles = Math.max(0, 70 - (turnNumber * 4))

                        // Evaluate candidate discards
                        const uniqueCandidates = Array.from(new Set(currentHand))
                        if (uniqueCandidates.length > 1) {
                            evaluatedTurns++

                            let bestQ = -Infinity
                            let bestTile = chosenTile
                            let chosenQ = -Infinity

                            const context: TurnContextInput = {
                                isDealer,
                                matchLength,
                                roundIndex: rIdx,
                                remainingRounds,
                                scores,
                                targetSeat,
                                honba,
                                riichiSticks,
                                kanCount,
                                visibleDoraCount: doraIndicators.length,
                                turnNumber,
                                remainingTiles: remainingWallTiles,
                                activeRiichiSeats,
                                opponentMeldCounts,
                                opponentKawas: kawas,
                                handTiles: currentHand,
                                targetMeldCount: playerMeldCount,
                                doraIndicators
                            }

                            for (const candidate of uniqueCandidates) {
                                const evalResult = this.evaluateCandidateDiscard(
                                    candidate,
                                    currentHand,
                                    context,
                                    visibleTileCounts,
                                    is3P
                                )

                                if (evalResult.qValue > bestQ) {
                                    bestQ = evalResult.qValue
                                    bestTile = evalResult.tile
                                }
                                if (this.normalizeTile(candidate) === this.normalizeTile(chosenTile)) {
                                    chosenQ = evalResult.qValue
                                }
                            }

                            if (chosenQ === -Infinity) {
                                chosenQ = bestQ
                            }

                            const evLoss = Math.max(0, bestQ - chosenQ)
                            totalEvLoss += evLoss

                            if (this.normalizeTile(chosenTile) === this.normalizeTile(bestTile) || evLoss < 50) {
                                matchedTurns++
                            } else {
                                if (activeRiichiSeats.size > 0) {
                                    dangerPushes++
                                } else {
                                    attackMistakes++
                                }
                            }
                        }

                        // Remove chosen tile from hand
                        const cIdx = currentHand.indexOf(chosenTile)
                        if (cIdx !== -1) {
                            currentHand.splice(cIdx, 1)
                        } else {
                            const norm = this.normalizeTile(chosenTile)
                            const fIdx = currentHand.findIndex((t) => this.normalizeTile(t) === norm)
                            if (fIdx !== -1) {
                                currentHand.splice(fIdx, 1)
                            }
                        }
                    }
                } else if (action.type === 'RecordHule') {
                    for (const h of action.hules) {
                        const delta = h.deltaScores[targetSeat] ?? 0
                        const payers = h.deltaScores.filter((score, sIdx) => sIdx !== h.seat && score < 0)
                        if (delta < 0 && payers.length === 1 && h.seat !== targetSeat) {
                            totalDealInScore += Math.abs(delta)
                        }
                    }
                }
            }
            rIdx++
        }

        if (evaluatedTurns === 0) {
            return this.evaluateSummaryGame({
                rank: finalRank,
                finalScore,
                roomType: game.roomType,
                gameMode: is3P ? '3p' : '4p',
                luckScore: 50,
                skillScore: 60
            })
        }

        const matchRate = Number(((matchedTurns / evaluatedTurns) * 100).toFixed(1))
        const attackScore = Math.max(0, Math.min(100, Math.round(100 - (attackMistakes * 8))))
        const defenseScore = Math.max(0, Math.min(100, Math.round(100 - (dangerPushes * 12) - (totalDealInScore / 600))))
        const situationScore = Math.max(0, Math.min(100, Math.round(80 + (finalRank === 1 ? 15 : finalRank === 2 ? 5 : finalRank === 3 ? (is3P ? -15 : -5) : -15))))

        const aiScore = Math.max(0, Math.min(100, Math.round(
            (matchRate * 0.40) +
            (attackScore * 0.25) +
            (defenseScore * 0.25) +
            (situationScore * 0.10)
        )))

        const grade = this.computeGradeFromScore(aiScore)
        const attackGrade = this.computeGradeFromScore(attackScore)
        const defenseGrade = this.computeGradeFromScore(defenseScore)
        const situationGrade = this.computeGradeFromScore(situationScore)
        const summaryComment = this.buildSummaryComment(grade, attackGrade, defenseGrade, situationGrade)

        return {
            grade,
            aiScore,
            matchRate,
            attackGrade,
            defenseGrade,
            situationGrade,
            summaryComment
        }
    }

    /*_ GEMINI THINKING _*/
    public evaluateSummaryGame(params: SummaryGameEvaluationInput): AiEvaluationBreakdown {
        const skill = params.skillScore
        const luck = params.luckScore
        const winCount = params.winCount ?? 1
        const dealInCount = params.dealInCount ?? 0
        const totalRounds = params.totalRounds ?? 8
        const tileEfficiency = params.tileEfficiency ?? (skill >= 80 ? 0.90 : skill >= 65 ? 0.82 : 0.72)
        const rank = params.rank
        const finalScore = params.finalScore

        // Attack evaluation (0..100)
        const winRate = totalRounds > 0 ? (winCount / totalRounds) : 0.25
        let rawAttack = (tileEfficiency * 60) + (winRate * 120) + (skill * 0.2)
        if (params.dealerRounds && params.dealerRounds > 0 && winCount > 0) {
            rawAttack += 5
        }
        if (params.averageStartingShanten && params.averageStartingShanten < 3.2) {
            rawAttack += 3
        }
        const attackScore = Math.max(0, Math.min(100, Math.round(rawAttack)))

        // Defense evaluation (0..100)
        const dealInRate = totalRounds > 0 ? (dealInCount / totalRounds) : 0.12
        let rawDefense = 90 - (dealInRate * 250) + (skill * 0.15)
        if (dealInCount === 0) {
            rawDefense += 8
        }
        if (dealInCount >= 3) {
            rawDefense -= 15
        }
        const defenseScore = Math.max(0, Math.min(100, Math.round(rawDefense)))

        // Situation evaluation (0..100)
        const is3P = params.gameMode === '3p' || (params.roomType ?? '').includes('3인')
        const situationScore = this.calculateSituationScore(
            rank,
            finalScore,
            params.roomType ?? '',
            is3P,
            luck
        )

        // Match rate (Mortal/MAKA AI consistency)
        let matchRate = Number((50 + (skill * 0.42) + (tileEfficiency * 8)).toFixed(1))
        matchRate = Math.max(30, Math.min(99.5, matchRate))

        // Composite AI Score (0..100)
        let compositeAiScore = Math.round(
            (matchRate * 0.40) +
            (attackScore * 0.25) +
            (defenseScore * 0.25) +
            (situationScore * 0.10)
        )
        compositeAiScore = Math.max(0, Math.min(100, compositeAiScore))

        const grade = this.computeGradeFromScore(compositeAiScore)
        const attackGrade = this.computeGradeFromScore(attackScore)
        const defenseGrade = this.computeGradeFromScore(defenseScore)
        const situationGrade = this.computeGradeFromScore(situationScore)
        const summaryComment = this.buildSummaryComment(grade, attackGrade, defenseGrade, situationGrade)

        return {
            grade,
            aiScore: compositeAiScore,
            matchRate,
            attackGrade,
            defenseGrade,
            situationGrade,
            summaryComment
        }
    }

    /*_ GEMINI THINKING _*/
    protected evaluateCandidateDiscard(
        candidate: string,
        currentHand: readonly string[],
        context: TurnContextInput,
        visibleTileCounts: ReadonlyMap<string, number>,
        is3P: boolean
    ): CandidateDiscardEvaluation {
        const resultingHand = [...currentHand]
        const cIdx = resultingHand.indexOf(candidate)
        if (cIdx !== -1) {
            resultingHand.splice(cIdx, 1)
        } else {
            const norm = this.normalizeTile(candidate)
            const fIdx = resultingHand.findIndex((t) => this.normalizeTile(t) === norm)
            if (fIdx !== -1) {
                resultingHand.splice(fIdx, 1)
            }
        }

        const resultingShanten = this.shantenCalc.calculate(resultingHand, is3P, context.targetMeldCount)
        const resultingUkeire = this.calculateUkeire(resultingHand, visibleTileCounts, is3P, context.targetMeldCount)

        // Hand dora count
        let handDoraCount = 0
        for (const t of resultingHand) {
            if (this.isDoraOrRed(t, context.doraIndicators, is3P)) {
                handDoraCount++
            }
        }

        const dealerBonus = this.calculateDealerBonus(context.isDealer)
        const potBonus = this.calculateTablePotBonus(context.riichiSticks, context.honba)
        const kanMultiplier = this.calculateKanMultiplier(context.kanCount, context.visibleDoraCount)
        const placementMods = this.calculatePlacementModifiers(
            context.scores,
            context.targetSeat,
            context.roundIndex,
            context.matchLength
        )

        // EV Attack
        let baseAttackEv = (10 - resultingShanten * 2.5) * 600 + (resultingUkeire * 120) + (handDoraCount * 1200)
        baseAttackEv += potBonus * (1 / (resultingShanten + 1))
        const evAttack = (baseAttackEv * dealerBonus.attackMultiplier) + dealerBonus.renchanBonusEv

        // Defense expected loss
        let totalDanger = 0
        const isCandidateDora = this.isDoraOrRed(candidate, context.doraIndicators, is3P)

        for (const seat of context.activeRiichiSeats) {
            const oppKawa = context.opponentKawas.get(seat) ?? []
            const oppIsDealer = (context.roundIndex % (is3P ? 3 : 4)) === seat
            const danger = this.calculateTileDanger(
                candidate,
                oppKawa,
                visibleTileCounts,
                isCandidateDora,
                oppIsDealer
            )
            totalDanger += danger
        }

        // Also check opponents with 2+ melds
        for (const [seat, mCount] of context.opponentMeldCounts.entries()) {
            if (seat !== context.targetSeat && !context.activeRiichiSeats.has(seat) && mCount >= 2) {
                const oppKawa = context.opponentKawas.get(seat) ?? []
                const oppIsDealer = (context.roundIndex % (is3P ? 3 : 4)) === seat
                const danger = this.calculateTileDanger(
                    candidate,
                    oppKawa,
                    visibleTileCounts,
                    isCandidateDora,
                    oppIsDealer
                ) * 0.6
                totalDanger += danger
            }
        }

        const expectedLoss = totalDanger * kanMultiplier * 6000

        const qValue = this.calculateQValue(
            evAttack,
            expectedLoss,
            placementMods.placementPushModifier,
            placementMods.placementFoldModifier
        )

        return {
            tile: candidate,
            qValue,
            evAttack,
            expectedLoss,
            resultingShanten,
            resultingUkeire
        }
    }

    /*_ GEMINI THINKING _*/
    protected calculateQValue(
        evAttack: number,
        expectedLoss: number,
        pushModifier: number,
        foldModifier: number
    ): number {
        return (evAttack * pushModifier) - (expectedLoss * foldModifier)
    }

    /*_ GEMINI THINKING _*/
    protected calculateKanMultiplier(kanCount: number, visibleDoraCount: number): number {
        return Number((1 + 0.25 * kanCount + 0.12 * visibleDoraCount).toFixed(4))
    }

    /*_ GEMINI THINKING _*/
    protected calculateTileDanger(
        tile: string,
        opponentKawa: readonly string[],
        visibleTileCounts: ReadonlyMap<string, number>,
        isDora: boolean = false,
        threateningSeatIsDealer: boolean = false,
        roundWind: string = '1z',
        seatWind: string = '2z'
    ): number {
        const norm = this.normalizeTile(tile)
        const normDiscards = new Set<string>(opponentKawa.map((d) => this.normalizeTile(d)))
        const isRed = tile.startsWith('0')
        const tileIsDora = isDora || isRed

        // 1. Genbutsu: tile is directly in opponent discards (100% safe)
        if (normDiscards.has(norm)) {
            return 0.00
        }

        const visCount = visibleTileCounts.get(norm) ?? 0

        // 2. 4-visible / No-Chance Kabe
        if (visCount >= 4) {
            let base = 0.05
            if (tileIsDora) {
                base *= 1.25
            }
            if (threateningSeatIsDealer) {
                base *= 1.4
            }
            return Number(base.toFixed(4))
        }

        // 3. Honor tiles (z)
        if (norm.endsWith('z')) {
            let baseHonor = 0.34
            if (visCount >= 2) {
                baseHonor = 0.10 // 2-cut honor
            } else if (visCount === 1) {
                baseHonor = 0.16 // 1-cut honor
            } else {
                // Live honor (0 visible)
                const isYakuhai = norm === '5z' || norm === '6z' || norm === '7z' || norm === roundWind || norm === seatWind
                baseHonor = isYakuhai ? 0.48 : 0.34 // live yakuhai vs live guest wind
            }

            if (tileIsDora) {
                baseHonor *= 1.25
            }
            if (threateningSeatIsDealer) {
                baseHonor *= 1.4
            }
            return Number(baseHonor.toFixed(4))
        }

        // 4. Suited tiles (m, p, s)
        const suit = norm.slice(-1)
        const num = Number.parseInt(norm.slice(0, -1), 10)

        let baseDanger = 1.00

        // Check Nakasuji first for middle tiles
        const isNakasuji = (num === 4 && normDiscards.has(`1${suit}`) && normDiscards.has(`7${suit}`)) ||
            (num === 5 && normDiscards.has(`2${suit}`) && normDiscards.has(`8${suit}`)) ||
            (num === 6 && normDiscards.has(`3${suit}`) && normDiscards.has(`9${suit}`))

        if (isNakasuji) {
            baseDanger = 0.16
        } else if (num === 1) {
            const hasSuji = normDiscards.has(`4${suit}`)
            baseDanger = hasSuji ? 0.24 : 0.55 // Suji terminal vs Musuji 1/9
        } else if (num === 9) {
            const hasSuji = normDiscards.has(`6${suit}`)
            baseDanger = hasSuji ? 0.24 : 0.55 // Suji terminal vs Musuji 1/9
        } else if (num === 2) {
            const hasSuji = normDiscards.has(`5${suit}`)
            baseDanger = hasSuji ? 0.34 : 0.72 // Suji 2 vs Musuji 2/8
        } else if (num === 8) {
            const hasSuji = normDiscards.has(`5${suit}`)
            baseDanger = hasSuji ? 0.34 : 0.72 // Suji 8 vs Musuji 2/8
        } else if (num === 3) {
            const hasSuji = normDiscards.has(`6${suit}`)
            baseDanger = hasSuji ? 0.34 : 0.88 // Suji 3 vs Musuji 3/7
        } else if (num === 7) {
            const hasSuji = normDiscards.has(`4${suit}`)
            baseDanger = hasSuji ? 0.34 : 0.88 // Suji 7 vs Musuji 3/7
        } else if (num === 4) {
            const hasKatasuji = normDiscards.has(`1${suit}`) || normDiscards.has(`7${suit}`)
            baseDanger = hasKatasuji ? 0.55 : 1.00 // Katasuji (0.55) vs full Musuji (1.00)
        } else if (num === 5) {
            const hasKatasuji = normDiscards.has(`2${suit}`) || normDiscards.has(`8${suit}`)
            baseDanger = hasKatasuji ? 0.55 : 1.00 // Katasuji (0.55) vs full Musuji (1.00)
        } else if (num === 6) {
            const hasKatasuji = normDiscards.has(`3${suit}`) || normDiscards.has(`9${suit}`)
            baseDanger = hasKatasuji ? 0.55 : 1.00 // Katasuji (0.55) vs full Musuji (1.00)
        }

        if (tileIsDora) {
            baseDanger *= 1.25
        }
        if (threateningSeatIsDealer) {
            baseDanger *= 1.4
        }

        return Number(baseDanger.toFixed(4))
    }

    /*_ GEMINI THINKING _*/
    // 3인 마작(3P)에서는 3위가 최하위(라스)이므로 -18점 감점을 적용하고 1위 기준 점수를 45,000점으로 보정
    protected calculateSituationScore(
        rank: number,
        finalScore: number,
        roomType: string,
        is3P: boolean,
        luck: number
    ): number {
        let rawSituation = 70
        if (rank === 1) {
            rawSituation += 15
            if (finalScore >= (is3P ? 45000 : 35000)) {
                rawSituation += 8
            }
        } else if (rank === 2) {
            rawSituation += 5
        } else if (rank === 3) {
            rawSituation -= is3P ? 18 : 5
        } else if (rank === 4) {
            rawSituation -= 18
        }

        if (roomType.includes('왕좌') || roomType.includes('Throne')) {
            rawSituation += 6
        } else if (roomType.includes('옥') || roomType.includes('Jade')) {
            rawSituation += 3
        }

        if (luck < 40 && rank <= 2) {
            rawSituation += 10
        }
        return Math.max(0, Math.min(100, Math.round(rawSituation)))
    }

    /*_ GEMINI THINKING _*/
    protected calculatePlacementModifiers(
        scores: readonly number[],
        targetSeat: number,
        roundIndex: number,
        matchLength: 'east' | 'south'
    ): { readonly placementPushModifier: number, readonly placementFoldModifier: number } {
        const totalRounds = matchLength === 'east' ? 4 : 8
        const remainingRounds = totalRounds - roundIndex

        const myScore = scores[targetSeat] ?? 25000
        const sortedScores = [...scores].sort((a, b) => b - a)
        const myRank = sortedScores.indexOf(myScore) + 1
        const secondScore = sortedScores[1] ?? 25000
        const firstScore = sortedScores[0] ?? 25000
        const lastScore = sortedScores[sortedScores.length - 1] ?? 25000

        // Orasu or near-Orasu late rounds pressure
        if (remainingRounds <= 2) {
            // Defending big 1st-place lead
            if (myRank === 1 && (myScore - secondScore) >= 8000) {
                return {
                    placementPushModifier: 0.75,
                    placementFoldModifier: 1.85
                }
            }
            // Chasing 1st place or avoiding last place
            if (myRank === 4 || (myRank === 3 && (myScore - lastScore) < 4000) || (myRank === 2 && (firstScore - myScore) <= 8000)) {
                return {
                    placementPushModifier: 1.35,
                    placementFoldModifier: 0.80
                }
            }
        }

        return {
            placementPushModifier: 1.0,
            placementFoldModifier: 1.0
        }
    }

    /*_ GEMINI THINKING _*/
    protected calculateDealerBonus(isDealer: boolean): { readonly attackMultiplier: number, readonly renchanBonusEv: number } {
        if (isDealer) {
            return {
                attackMultiplier: 1.5,
                renchanBonusEv: 1200
            }
        }
        return {
            attackMultiplier: 1.0,
            renchanBonusEv: 0
        }
    }

    /*_ GEMINI THINKING _*/
    protected calculateTablePotBonus(riichiSticks: number, honba: number): number {
        return (1000 * riichiSticks) + (300 * honba)
    }

    /*_ GEMINI THINKING _*/
    protected computeGradeFromScore(score: number): AiGrade {
        if (score >= 95) {
            return 'S+'
        }
        if (score >= 90) {
            return 'S'
        }
        if (score >= 80) {
            return 'A'
        }
        if (score >= 70) {
            return 'B'
        }
        if (score >= 60) {
            return 'C'
        }
        return 'D'
    }

    protected calculateUkeire(
        hand: readonly string[],
        visibleCounts: ReadonlyMap<string, number>,
        is3P: boolean,
        meldCount: number = 0
    ): number {
        const currentShanten = this.shantenCalc.calculate(hand, is3P, meldCount)
        if (currentShanten === -1) {
            return 0
        }

        let totalUkeire = 0

        for (const tile of TILE_NAMES) {
            if (is3P && (
                tile === '2m' || tile === '3m' || tile === '4m' ||
                tile === '5m' || tile === '6m' || tile === '7m' || tile === '8m'
            )) {
                continue
            }

            const inHandCount = hand.filter((t) => this.normalizeTile(t) === tile).length
            const visibleCount = visibleCounts.get(tile) ?? 0
            const remaining = Math.max(0, 4 - inHandCount - visibleCount)

            if (remaining <= 0) {
                continue
            }

            const nextShanten = this.shantenCalc.calculate([...hand, tile], is3P, meldCount)
            if (nextShanten < currentShanten) {
                totalUkeire += remaining
            }
        }

        return totalUkeire
    }

    protected normalizeTile(tile: string): string {
        if (tile === '0m') {
            return '5m'
        }
        if (tile === '0p') {
            return '5p'
        }
        if (tile === '0s') {
            return '5s'
        }
        return tile
    }

    /*_ GEMINI THINKING _*/
    // 3인 마작(3P)에서는 2m~8m 만수패가 제외되므로 1m 표시패 -> 9m 도라, 9m 표시패 -> 1m 도라 순환을 지원하도록 is3P 플래그 적용
    protected isDoraOrRed(tile: string, doraIndicators: readonly string[], is3P: boolean = false): boolean {
        if (tile.startsWith('0')) {
            return true
        }
        const norm = this.normalizeTile(tile)
        for (const indicator of doraIndicators) {
            if (this.isNextTileInCycle(indicator, norm, is3P)) {
                return true
            }
        }
        return false
    }

    /*_ GEMINI THINKING _*/
    protected isNextTileInCycle(indicator: string, tile: string, is3P: boolean = false): boolean {
        const normInd = this.normalizeTile(indicator)
        const suit = normInd.slice(-1)
        const num = Number.parseInt(normInd.slice(0, -1), 10)

        if (is3P && suit === 'm') {
            if (num === 1) {
                return tile === '9m'
            }
            if (num === 9) {
                return tile === '1m'
            }
            return false
        }

        if (suit === 'z') {
            if (num >= 1 && num <= 4) {
                const nextNum = num === 4 ? 1 : num + 1
                return tile === `${nextNum}z`
            }
            if (num >= 5 && num <= 7) {
                const nextNum = num === 7 ? 5 : num + 1
                return tile === `${nextNum}z`
            }
        } else {
            const nextNum = num === 9 ? 1 : num + 1
            return tile === `${nextNum}${suit}`
        }
        return false
    }

    protected calculateFinalScoresAndRank(game: PaipuGame, targetSeat: number): { readonly finalScore: number, readonly finalRank: number } {
        if (game.rounds.length === 0) {
            return { finalScore: 25000, finalRank: 1 }
        }
        const lastRound = game.rounds[game.rounds.length - 1]
        if (!lastRound) {
            return { finalScore: 25000, finalRank: 1 }
        }
        const scores = [...lastRound.header.scores]
        for (const action of lastRound.actions) {
            if (action.type === 'RecordHule') {
                for (const h of action.hules) {
                    let s = 0
                    while (s < scores.length) {
                        scores[s] = (scores[s] ?? 0) + (h.deltaScores[s] ?? 0)
                        s++
                    }
                }
            } else if (action.type === 'RecordNoTile') {
                let s = 0
                while (s < scores.length) {
                    scores[s] = (scores[s] ?? 0) + (action.deltaScores[s] ?? 0)
                    s++
                }
            }
        }
        const finalScore = scores[targetSeat] ?? 25000
        const sortedScores = [...scores].sort((a, b) => b - a)
        const finalRank = sortedScores.indexOf(finalScore) + 1
        return { finalScore, finalRank }
    }

    private addVisibleTile(tile: string, visibleCounts: Map<string, number>): void {
        const norm = this.normalizeTile(tile)
        const current = visibleCounts.get(norm) ?? 0
        visibleCounts.set(norm, current + 1)
    }

    private buildSummaryComment(
        grade: AiGrade,
        attackGrade: AiGrade,
        defenseGrade: AiGrade,
        situationGrade: AiGrade
    ): string {
        switch (grade) {
            case 'S+':
                return '혼천/천봉위급의 무결점 AI 일치율과 완벽한 공수판단을 보여준 환상적인 대국입니다.'
            case 'S':
                return '마카/모탈 AI 추천 타패와 높은 일치율을 기록하며 공수 밸런스가 매우 뛰어난 대국입니다.'
            case 'A':
                return `우수한 패효율(공격: ${attackGrade})과 안정적인 수비력(수비: ${defenseGrade})을 바탕으로 모범적인 국면 운영을 펼쳤습니다.`
            case 'B':
                return `기본적인 공수 판단은 양호하나 위험패 승부 및 점수차 상황 판단(상황: ${situationGrade})에서 일부 아쉬운 타패가 있었습니다.`
            case 'C':
                return `텐파이 유혹으로 인한 무리한 밀기와 타쯔 선택 실수가 발생하여 실점 위험이 높았습니다. (수비: ${defenseGrade})`
            case 'D':
                return '위험패 방총과 샨텐 퇴각 실수가 다수 누적되어 국면 주도권을 내주었습니다.'
        }
    }
}
