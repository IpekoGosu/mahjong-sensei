import { SeatIndex, PerformanceQuadrant } from '@mahjong-sensei/types'
import { MajsoulGameRecord, MajsoulRoundRecord } from '../parser/types'
import { ShantenCalculator } from '../shanten'
import { MetricCalculator } from '../metrics'
import { LuckEvaluator } from './luck-evaluator'
import { SkillEvaluator } from './skill-evaluator'
import { TILE_NAMES } from '../tiles'

export type MistakeCategory =
    | 'SHANTEN_RETREAT'
    | 'UKEIRE_LOSS'
    | 'RECKLESS_PUSH_DEAL_IN'
    | 'DANGEROUS_MUSUJI_PUSH'

export interface CriticalMistakeHighlight {
    readonly roundIndex: number
    readonly turnNumber: number
    readonly discardedTile: string
    readonly optimalTile: string
    readonly prevShanten: number
    readonly afterShanten: number
    readonly optimalUkeire: number
    readonly actualUkeire: number
    readonly mistakeCategory: MistakeCategory
    readonly severityScore: number
    readonly coachingMessageKo: string
}

export interface GameCoachingReport {
    readonly gameId: string
    readonly targetSeat: number
    readonly is3P: boolean
    readonly quadrant: PerformanceQuadrant
    readonly criticalMistakes: readonly CriticalMistakeHighlight[]
    readonly overallSummaryKo: string
    readonly actionableAdviceKo: readonly string[]
}

export interface OptimalDiscardResult {
    readonly tile: string
    readonly shanten: number
    readonly ukeire: number
}

export interface MistakeFeedbackParams {
    readonly category: MistakeCategory
    readonly turnNumber: number
    readonly discardedTile: string
    readonly optimalTile: string
    readonly prevShanten: number
    readonly afterShanten: number
    readonly optimalUkeire: number
    readonly actualUkeire: number
    readonly roundIndex?: number
}

interface DiscardCandidate {
    tile: string
    shanten: number
    ukeire: number
}

export class CoachingAdvisor {
    private readonly shantenCalc: ShantenCalculator = new ShantenCalculator()
    private readonly metricCalculator: MetricCalculator = new MetricCalculator()
    private readonly luckEvaluator: LuckEvaluator = new LuckEvaluator()
    private readonly skillEvaluator: SkillEvaluator = new SkillEvaluator()

    /*_ GEMINI THINKING _*/
    public analyzeGame(
        gameRecord: MajsoulGameRecord,
        targetSeat: SeatIndex,
        is3P?: boolean
    ): GameCoachingReport {
        const isThreePlayer = is3P ?? (
            gameRecord.players.length === 3 ||
            gameRecord.roomType.includes('3인') ||
            gameRecord.rounds.some((r) => r.actions.some((a) => a.type === 'RecordBaBei') || (r.header.hands[3]?.length ?? 0) === 0)
        )

        const allMistakes: CriticalMistakeHighlight[] = []
        let totalLuck = 0
        let totalSkill = 0
        const roundCount = gameRecord.rounds.length || 1

        let rIdx = 0
        while (rIdx < gameRecord.rounds.length) {
            const round = gameRecord.rounds[rIdx]
            if (round) {
                const luckMetric = this.luckEvaluator.evaluateRound(round, targetSeat)
                const skillMetric = this.skillEvaluator.evaluateRound(round, targetSeat)
                totalLuck += luckMetric.luckScore
                totalSkill += skillMetric.skillScore

                const roundMistakes = this.analyzeRound(round, rIdx, targetSeat, isThreePlayer)
                allMistakes.push(...roundMistakes)
            }
            rIdx++
        }

        const avgLuck = totalLuck / roundCount
        const avgSkill = totalSkill / roundCount
        const quadrant = this.metricCalculator.classifyQuadrant(avgLuck, avgSkill)

        allMistakes.sort((a, b) => b.severityScore - a.severityScore)
        const criticalMistakes = allMistakes.slice(0, 3)

        const overallSummaryKo = this.buildOverallSummary(quadrant, criticalMistakes, isThreePlayer)
        const actionableAdviceKo = this.buildActionableAdvice(criticalMistakes, isThreePlayer)

        return {
            gameId: gameRecord.uuid,
            targetSeat,
            is3P: isThreePlayer,
            quadrant,
            criticalMistakes,
            overallSummaryKo,
            actionableAdviceKo
        }
    }

    /*_ GEMINI THINKING _*/
    public analyzeRound(
        round: MajsoulRoundRecord,
        roundIndex: number,
        targetSeat: SeatIndex,
        is3P: boolean
    ): readonly CriticalMistakeHighlight[] {
        const mistakes: CriticalMistakeHighlight[] = []
        const currentHand = [...(round.header.hands[targetSeat] ?? [])]
        const visibleCounts = new Map<string, number>()
        const activeRiichiSeats = new Set<SeatIndex>()
        const opponentSafeTiles = new Map<SeatIndex, Set<string>>()
        opponentSafeTiles.set(0, new Set<string>())
        opponentSafeTiles.set(1, new Set<string>())
        opponentSafeTiles.set(2, new Set<string>())
        opponentSafeTiles.set(3, new Set<string>())

        let seenDoraCount = 0
        let lastDiscardedTile: string | null = null
        let targetTurnNumber = 0

        if (round.header.dora) {
            this.addVisibleTile(round.header.dora, visibleCounts)
        }

        const actions = round.actions
        let aIdx = 0
        while (aIdx < actions.length) {
            const action = actions[aIdx]
            if (!action) {
                aIdx++
                continue
            }

            if (action.type === 'RecordDealTile') {
                if (action.doras) {
                    for (const dora of action.doras.slice(seenDoraCount)) {
                        this.addVisibleTile(dora, visibleCounts)
                    }
                    seenDoraCount = action.doras.length
                }

                if (action.seat === targetSeat) {
                    currentHand.push(action.tile)
                }
            } else if (action.type === 'RecordDiscardTile') {
                if (action.doras) {
                    for (const dora of action.doras.slice(seenDoraCount)) {
                        this.addVisibleTile(dora, visibleCounts)
                    }
                    seenDoraCount = action.doras.length
                }

                lastDiscardedTile = action.tile
                const normDiscard = this.normalizeTile(action.tile)

                if (action.seat !== targetSeat) {
                    this.addVisibleTile(action.tile, visibleCounts)
                    opponentSafeTiles.get(action.seat)?.add(normDiscard)

                    if (action.isLiqi) {
                        activeRiichiSeats.add(action.seat)
                    }

                    for (const riichiSeat of activeRiichiSeats) {
                        opponentSafeTiles.get(riichiSeat)?.add(normDiscard)
                    }
                } else {
                    targetTurnNumber++
                    const prevShanten = this.shantenCalc.calculate(currentHand, is3P)

                    const handAfterDiscard = [...currentHand]
                    const removeIdx = handAfterDiscard.indexOf(action.tile)
                    if (removeIdx !== -1) {
                        handAfterDiscard.splice(removeIdx, 1)
                    } else {
                        const altIdx = handAfterDiscard.findIndex((t) => this.normalizeTile(t) === normDiscard)
                        if (altIdx !== -1) {
                            handAfterDiscard.splice(altIdx, 1)
                        }
                    }

                    const afterShanten = this.shantenCalc.calculate(handAfterDiscard, is3P)
                    const actualUkeire = this.calculateUkeire(handAfterDiscard, visibleCounts, is3P)

                    let didDealIn = false
                    let dealInPoints = 0
                    if (aIdx + 1 < actions.length) {
                        const nextAction = actions[aIdx + 1]
                        if (nextAction && nextAction.type === 'RecordHule') {
                            for (const h of nextAction.hules) {
                                const delta = h.deltaScores[targetSeat] ?? 0
                                const isTsumo = this.isTsumoWin(h.deltaScores, h.seat)
                                if (h.seat !== targetSeat && delta < 0 && !isTsumo) {
                                    didDealIn = true
                                    dealInPoints = Math.max(dealInPoints, Math.abs(delta))
                                }
                            }
                        }
                    }

                    const discardSafety = this.calculateDiscardSafety(
                        action.tile,
                        activeRiichiSeats,
                        opponentSafeTiles,
                        visibleCounts,
                        currentHand
                    )

                    let safestTileInHand: string | null = null
                    let maxSafetyInHand = -1
                    let bestSafeShanten = 999
                    let bestSafeUkeire = -1

                    if (activeRiichiSeats.size > 0) {
                        for (const t of currentHand) {
                            const s = this.calculateDiscardSafety(
                                t,
                                activeRiichiSeats,
                                opponentSafeTiles,
                                visibleCounts,
                                currentHand
                            )
                            const cHand = [...currentHand]
                            const rIdx = cHand.indexOf(t)
                            if (rIdx !== -1) {
                                cHand.splice(rIdx, 1)
                            }
                            const shanten = this.shantenCalc.calculate(cHand, is3P)
                            const ukeire = this.calculateUkeire(cHand, visibleCounts, is3P)

                            if (s > maxSafetyInHand) {
                                maxSafetyInHand = s
                                safestTileInHand = t
                                bestSafeShanten = shanten
                                bestSafeUkeire = ukeire
                            } else if (s === maxSafetyInHand && s >= 0.85) {
                                if (shanten < bestSafeShanten || (shanten === bestSafeShanten && ukeire > bestSafeUkeire)) {
                                    safestTileInHand = t
                                    bestSafeShanten = shanten
                                    bestSafeUkeire = ukeire
                                }
                            }
                        }
                    }

                    const combinedSafeTiles = new Set<string>()
                    if (activeRiichiSeats.size > 0) {
                        for (const t of currentHand) {
                            const s = this.calculateDiscardSafety(
                                t,
                                activeRiichiSeats,
                                opponentSafeTiles,
                                visibleCounts,
                                currentHand
                            )
                            if (s >= 0.85) {
                                combinedSafeTiles.add(this.normalizeTile(t))
                            }
                        }
                    }

                    const optimalResult = this.findOptimalDiscard(
                        currentHand,
                        visibleCounts,
                        is3P,
                        activeRiichiSeats.size > 0 && prevShanten >= 1 ? combinedSafeTiles : undefined
                    )

                    let mistakeCategory: MistakeCategory | null = null
                    let severityScore = 0
                    let chosenOptimalTile = optimalResult.tile

                    if (didDealIn) {
                        mistakeCategory = 'RECKLESS_PUSH_DEAL_IN'
                        severityScore = Math.min(100, Math.max(85, Math.round(85 + (dealInPoints / 1000))))
                        if (safestTileInHand && maxSafetyInHand >= 0.85) {
                            chosenOptimalTile = safestTileInHand
                        }
                    } else if (
                        activeRiichiSeats.size > 0 &&
                        prevShanten >= 1 &&
                        discardSafety <= 0.50 &&
                        safestTileInHand &&
                        maxSafetyInHand >= 0.85
                    ) {
                        mistakeCategory = 'DANGEROUS_MUSUJI_PUSH'
                        severityScore = Math.min(90, Math.max(70, Math.round(70 + (prevShanten * 5) + ((1.0 - discardSafety) * 15))))
                        chosenOptimalTile = safestTileInHand
                    } else if (afterShanten > prevShanten && optimalResult.shanten <= prevShanten) {
                        mistakeCategory = 'SHANTEN_RETREAT'
                        severityScore = Math.min(85, Math.max(50, 75 - (Math.min(2, prevShanten) * 10)))
                    } else if (
                        afterShanten === prevShanten &&
                        (optimalResult.ukeire - actualUkeire) >= 4 &&
                        this.normalizeTile(action.tile) !== this.normalizeTile(optimalResult.tile)
                    ) {
                        mistakeCategory = 'UKEIRE_LOSS'
                        severityScore = Math.min(70, Math.max(25, Math.round(30 + ((optimalResult.ukeire - actualUkeire) * 2.5))))
                    }

                    if (mistakeCategory !== null) {
                        const coachingMessageKo = this.buildMistakeFeedback({
                            category: mistakeCategory,
                            turnNumber: targetTurnNumber,
                            discardedTile: action.tile,
                            optimalTile: chosenOptimalTile,
                            prevShanten,
                            afterShanten,
                            optimalUkeire: optimalResult.ukeire,
                            actualUkeire,
                            roundIndex
                        })

                        mistakes.push({
                            roundIndex,
                            turnNumber: targetTurnNumber,
                            discardedTile: action.tile,
                            optimalTile: chosenOptimalTile,
                            prevShanten,
                            afterShanten,
                            optimalUkeire: optimalResult.ukeire,
                            actualUkeire,
                            mistakeCategory,
                            severityScore,
                            coachingMessageKo
                        })
                    }

                    const curIdx = currentHand.indexOf(action.tile)
                    if (curIdx !== -1) {
                        currentHand.splice(curIdx, 1)
                    } else {
                        const altIdx = currentHand.findIndex((t) => this.normalizeTile(t) === normDiscard)
                        if (altIdx !== -1) {
                            currentHand.splice(altIdx, 1)
                        }
                    }

                    this.addVisibleTile(action.tile, visibleCounts)
                    for (const riichiSeat of activeRiichiSeats) {
                        opponentSafeTiles.get(riichiSeat)?.add(normDiscard)
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
                        this.addVisibleTile(tile, visibleCounts)
                    } else {
                        handTilesToRemove.push(tile)
                    }
                }

                if (action.seat === targetSeat) {
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
                if (action.seat !== targetSeat) {
                    if (action.gangType === 'ankan') {
                        for (const tile of action.tiles) {
                            this.addVisibleTile(tile, visibleCounts)
                        }
                    } else if (action.tiles.length > 0) {
                        const addedTile = action.tiles[0]
                        if (addedTile) {
                            this.addVisibleTile(addedTile, visibleCounts)
                        }
                    }
                } else {
                    if (action.gangType === 'ankan') {
                        for (const tile of action.tiles) {
                            const idx = currentHand.indexOf(tile)
                            if (idx !== -1) {
                                currentHand.splice(idx, 1)
                            }
                        }
                    } else if (action.tiles.length > 0) {
                        const addedTile = action.tiles[0]
                        if (addedTile) {
                            const idx = currentHand.indexOf(addedTile)
                            if (idx !== -1) {
                                currentHand.splice(idx, 1)
                            }
                        }
                    }
                }
            } else if (action.type === 'RecordBaBei') {
                this.addVisibleTile('4z', visibleCounts)
                if (action.seat === targetSeat) {
                    const idx = currentHand.indexOf('4z')
                    if (idx !== -1) {
                        currentHand.splice(idx, 1)
                    }
                    if (currentHand.length >= 13) {
                        this.shantenCalc.calculate(currentHand, is3P)
                    }
                }
            }
            aIdx++
        }

        return mistakes
    }

    /*_ GEMINI THINKING _*/
    protected calculateUkeire(
        hand: readonly string[],
        visibleCounts: ReadonlyMap<string, number>,
        is3P: boolean
    ): number {
        const currentShanten = this.shantenCalc.calculate(hand, is3P)
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

            const nextShanten = this.shantenCalc.calculate([...hand, tile], is3P)
            if (nextShanten < currentShanten) {
                totalUkeire += remaining
            }
        }

        return totalUkeire
    }

    /*_ GEMINI THINKING _*/
    protected findOptimalDiscard(
        hand: readonly string[],
        visibleCounts: ReadonlyMap<string, number>,
        is3P: boolean,
        safeTiles?: ReadonlySet<string>
    ): OptimalDiscardResult {
        if (hand.length === 0) {
            return { tile: '', shanten: 8, ukeire: 0 }
        }

        const uniqueTiles: string[] = []
        const seen = new Set<string>()
        for (const tile of hand) {
            const norm = this.normalizeTile(tile)
            if (!seen.has(norm)) {
                seen.add(norm)
                uniqueTiles.push(tile)
            }
        }

        const candidates: DiscardCandidate[] = []

        for (const candidateTile of uniqueTiles) {
            const candidateHand = [...hand]
            const removeIdx = candidateHand.indexOf(candidateTile)
            if (removeIdx !== -1) {
                candidateHand.splice(removeIdx, 1)
            }
            const shanten = this.shantenCalc.calculate(candidateHand, is3P)
            const ukeire = this.calculateUkeire(candidateHand, visibleCounts, is3P)
            candidates.push({ tile: candidateTile, shanten, ukeire })
        }

        if (safeTiles && safeTiles.size > 0) {
            const safeCandidates = candidates.filter((c) => safeTiles.has(this.normalizeTile(c.tile)))
            if (safeCandidates.length > 0) {
                safeCandidates.sort((a, b) => {
                    if (a.shanten !== b.shanten) {
                        return a.shanten - b.shanten
                    }
                    return b.ukeire - a.ukeire
                })
                const bestSafe = safeCandidates[0]
                if (bestSafe) {
                    return bestSafe
                }
            }
        }

        candidates.sort((a, b) => {
            if (a.shanten !== b.shanten) {
                return a.shanten - b.shanten
            }
            return b.ukeire - a.ukeire
        })

        const best = candidates[0]
        if (best) {
            return best
        }

        return { tile: hand[0] ?? '', shanten: 8, ukeire: 0 }
    }

    /*_ GEMINI THINKING _*/
    protected buildMistakeFeedback(
        categoryOrParams: MistakeCategory | MistakeFeedbackParams,
        turnNumber?: number,
        discardedTile?: string,
        optimalTile?: string,
        prevShanten?: number,
        afterShanten?: number,
        optimalUkeire?: number,
        actualUkeire?: number
    ): string {
        let category: MistakeCategory
        let turn: number
        let discarded: string
        let optimal: string
        let prev: number
        let after: number
        let optUk: number
        let actUk: number

        if (typeof categoryOrParams === 'object') {
            category = categoryOrParams.category
            turn = categoryOrParams.turnNumber
            discarded = categoryOrParams.discardedTile
            optimal = categoryOrParams.optimalTile
            prev = categoryOrParams.prevShanten
            after = categoryOrParams.afterShanten
            optUk = categoryOrParams.optimalUkeire
            actUk = categoryOrParams.actualUkeire
        } else {
            category = categoryOrParams
            turn = turnNumber ?? 1
            discarded = discardedTile ?? ''
            optimal = optimalTile ?? ''
            prev = prevShanten ?? 0
            after = afterShanten ?? 0
            optUk = optimalUkeire ?? 0
            actUk = actualUkeire ?? 0
        }

        switch (category) {
            case 'SHANTEN_RETREAT':
                return `${turn}순목에 [${discarded}]을(를) 버려 샹텐수가 후퇴했습니다 (${prev}샹텐 ➔ ${after}샹텐). [${optimal}]을(를) 버려 유효패 ${optUk}장을 유지하는 것이 이상적입니다.`
            case 'UKEIRE_LOSS':
                return `${turn}순목에 [${discarded}] 대신 [${optimal}]을(를) 버렸다면 유효패가 ${optUk}장으로 ${optUk - actUk}장 더 넓었습니다. 효율적인 조패를 위해 고립패를 우선 정리하세요.`
            case 'RECKLESS_PUSH_DEAL_IN':
                return `상대 리치 선언 후 ${turn}순목에 위험패 [${discarded}]을(를) 버려 방총되었습니다. 리치에 맞서 텐파이가 아니라면 안전패 [${optimal}]을(를) 버리며 수비(베타오리)해야 합니다.`
            case 'DANGEROUS_MUSUJI_PUSH':
                return `상대 리치 상황에서 ${turn}순목에 텐파이가 아님에도(${prev}샹텐) 위험한 무스지 [${discarded}]을(를) 밀었습니다. 안전패 [${optimal}]을(를) 버리며 내리는 판단이 안전합니다.`
        }
    }

    /*_ GEMINI THINKING _*/
    protected calculateDiscardSafety(
        tile: string,
        activeRiichiSeats: ReadonlySet<SeatIndex>,
        opponentSafeTiles: ReadonlyMap<SeatIndex, ReadonlySet<string>>,
        visibleTileCounts: ReadonlyMap<string, number>,
        hand: readonly string[]
    ): number {
        if (activeRiichiSeats.size === 0) {
            return 1.0
        }

        let minSafety = 1.0
        for (const seat of activeRiichiSeats) {
            const safeSet = opponentSafeTiles.get(seat) ?? new Set<string>()
            const safety = this.evaluateSafetyAgainstPlayer(tile, safeSet, visibleTileCounts, hand)
            if (safety < minSafety) {
                minSafety = safety
            }
        }

        return minSafety
    }

    /*_ GEMINI THINKING _*/
    protected evaluateSafetyAgainstPlayer(
        tile: string,
        safeSet: ReadonlySet<string>,
        visibleTileCounts: ReadonlyMap<string, number>,
        hand: readonly string[]
    ): number {
        const normTile = this.normalizeTile(tile)

        if (safeSet.has(normTile)) {
            return 1.0
        }

        if (normTile.endsWith('z')) {
            const boardCopies = visibleTileCounts.get(normTile) ?? 0
            const handCopies = hand.filter((t) => this.normalizeTile(t) === normTile).length
            const totalVisible = boardCopies + handCopies
            if (totalVisible >= 4) {
                return 1.0
            }
            if (totalVisible === 3) {
                return 0.95
            }
            if (totalVisible === 2) {
                return 0.75
            }
            return 0.40
        }

        const suit = normTile.slice(-1)
        const num = Number.parseInt(normTile.slice(0, -1), 10)

        let safety = 0.20

        if (num === 1) {
            const hasSuji = safeSet.has(`4${suit}`)
            safety = hasSuji ? 0.85 : 0.45
        } else if (num === 9) {
            const hasSuji = safeSet.has(`6${suit}`)
            safety = hasSuji ? 0.85 : 0.45
        } else if (num === 2 || num === 8) {
            const hasSuji = safeSet.has(`5${suit}`)
            safety = hasSuji ? 0.75 : 0.35
        } else if (num === 3) {
            const hasSuji = safeSet.has(`6${suit}`)
            safety = hasSuji ? 0.70 : 0.30
        } else if (num === 7) {
            const hasSuji = safeSet.has(`4${suit}`)
            safety = hasSuji ? 0.70 : 0.30
        } else if (num === 4) {
            const suji1 = safeSet.has(`1${suit}`)
            const suji7 = safeSet.has(`7${suit}`)
            if (suji1 && suji7) {
                safety = 0.80
            } else if (suji1 || suji7) {
                safety = 0.50
            } else {
                safety = 0.20
            }
        } else if (num === 5) {
            const suji2 = safeSet.has(`2${suit}`)
            const suji8 = safeSet.has(`8${suit}`)
            if (suji2 && suji8) {
                safety = 0.80
            } else if (suji2 || suji8) {
                safety = 0.50
            } else {
                safety = 0.20
            }
        } else if (num === 6) {
            const suji3 = safeSet.has(`3${suit}`)
            const suji9 = safeSet.has(`9${suit}`)
            if (suji3 && suji9) {
                safety = 0.80
            } else if (suji3 || suji9) {
                safety = 0.50
            } else {
                safety = 0.20
            }
        }

        let isKabe = false
        if (num === 1) {
            const count3 = (visibleTileCounts.get(`3${suit}`) ?? 0) + hand.filter((t) => this.normalizeTile(t) === `3${suit}`).length
            const count2 = (visibleTileCounts.get(`2${suit}`) ?? 0) + hand.filter((t) => this.normalizeTile(t) === `2${suit}`).length
            if (count3 >= 4 || count2 >= 4) {
                isKabe = true
            }
        } else if (num === 2) {
            const count3 = (visibleTileCounts.get(`3${suit}`) ?? 0) + hand.filter((t) => this.normalizeTile(t) === `3${suit}`).length
            if (count3 >= 4) {
                isKabe = true
            }
        } else if (num === 8) {
            const count7 = (visibleTileCounts.get(`7${suit}`) ?? 0) + hand.filter((t) => this.normalizeTile(t) === `7${suit}`).length
            if (count7 >= 4) {
                isKabe = true
            }
        } else if (num === 9) {
            const count7 = (visibleTileCounts.get(`7${suit}`) ?? 0) + hand.filter((t) => this.normalizeTile(t) === `7${suit}`).length
            const count8 = (visibleTileCounts.get(`8${suit}`) ?? 0) + hand.filter((t) => this.normalizeTile(t) === `8${suit}`).length
            if (count7 >= 4 || count8 >= 4) {
                isKabe = true
            }
        }

        if (isKabe && safety < 0.85) {
            safety = 0.85
        }

        return safety
    }

    /*_ GEMINI THINKING _*/
    protected normalizeTile(tile: string): string {
        return tile.replace('0m', '5m').replace('0p', '5p').replace('0s', '5s')
    }

    /*_ GEMINI THINKING _*/
    protected addVisibleTile(tile: string, visibleCounts: Map<string, number>): void {
        const norm = this.normalizeTile(tile)
        const count = visibleCounts.get(norm) ?? 0
        visibleCounts.set(norm, count + 1)
    }

    /*_ GEMINI THINKING _*/
    private buildOverallSummary(
        quadrant: PerformanceQuadrant,
        criticalMistakes: readonly CriticalMistakeHighlight[],
        is3P: boolean
    ): string {
        const modeLabel = is3P ? '3인 마작(3P)' : '4인 마작(4P)'
        let quadrantDesc = ''
        switch (quadrant) {
            case 'SKILLFUL_WIN':
                quadrantDesc = '실력과 운이 모두 따라준 완벽한 승리(1사분면)'
                break
            case 'UNLUCKY_LOSS':
                quadrantDesc = '실력은 안정적이었으나 운이 따르지 않은 억까성 패배(2사분면)'
                break
            case 'SLUMP_LOSS':
                quadrantDesc = '실력 발휘와 패산 흐름 모두 아쉬웠던 슬럼프성 대국(3사분면)'
                break
            case 'LUCKY_FLUKE':
                quadrantDesc = '패산의 도움으로 좋은 결과를 거두었으나 실수가 다소 있었던 운빨 승리(4사분면)'
                break
        }

        if (criticalMistakes.length === 0) {
            return `${modeLabel} 대국 분석 결과, 이번 대국은 ${quadrantDesc} 국면이었습니다. 전반적으로 무리한 타패나 패 효율 손실 없이 매우 안정적인 공수 밸런스를 보여주었습니다.`
        }

        return `${modeLabel} 대국 분석 결과, 이번 대국은 ${quadrantDesc} 국면이었습니다. 총 ${criticalMistakes.length}건의 주요 개선 타패가 감지되었으며, 특히 리치 대응 수비와 패 효율 극대화에 유의하면 실력을 더욱 향상시킬 수 있습니다.`
    }

    /*_ GEMINI THINKING _*/
    private buildActionableAdvice(
        criticalMistakes: readonly CriticalMistakeHighlight[],
        is3P: boolean
    ): readonly string[] {
        const advice: string[] = []
        const categories = new Set(criticalMistakes.map((m) => m.mistakeCategory))

        if (categories.has('RECKLESS_PUSH_DEAL_IN')) {
            advice.push('상대 리치 선언 시 텐파이가 아니라면 현물(Genbutsu)과 스지 안전패를 최우선으로 타패하여 방총을 방지하세요.')
        }
        if (categories.has('DANGEROUS_MUSUJI_PUSH')) {
            advice.push('리치에 대항하여 1~2샹텐에서 위험한 무스지 패를 미는 것은 기대값이 낮으므로, 철저한 베타오리를 권장합니다.')
        }
        if (categories.has('SHANTEN_RETREAT')) {
            advice.push('유효 타츠를 함부로 파괴하여 샹텐수가 후퇴하지 않도록 불필요한 고립패를 먼저 정리하세요.')
        }
        if (categories.has('UKEIRE_LOSS')) {
            advice.push('양면(라이언멘) 대기 형태를 보존하고 유효패 매수를 극대화하는 타일 이피션시(패 효율) 원칙을 적용하세요.')
        }
        if (is3P) {
            advice.push('3인 마작은 타점과 진행 속도가 매우 빠르므로, 무스지 방총 한 번이 대국 순위에 치명적인 영향을 줍니다.')
        }

        if (advice.length === 0) {
            advice.push('현재의 뛰어난 패 효율과 수비 밸런스를 계속 유지하세요.')
        }

        return advice
    }

    /*_ GEMINI THINKING _*/
    private isTsumoWin(deltaScores: readonly [number, number, number, number], winnerSeat: SeatIndex): boolean {
        let payers = 0
        let i = 0
        while (i < 4) {
            if (i !== winnerSeat && (deltaScores[i] ?? 0) < 0) {
                payers++
            }
            i++
        }
        return payers >= 2
    }
}
