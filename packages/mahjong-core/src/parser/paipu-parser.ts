import {
    SeatIndex,
    PaipuDetail,
    PlayerSummary,
    PaipuRound,
    PaipuAction
} from '@mahjong-sensei/types'
import { MajsoulGameRecord, MajsoulRoundRecord } from './types'
import { LuckEvaluator } from '../metrics/luck-evaluator'
import { SkillEvaluator } from '../metrics/skill-evaluator'

export interface ParsedGameResult {
    readonly detail: PaipuDetail
    readonly roundMetrics: readonly {
        readonly roundIndex: number
        readonly seat: SeatIndex
        readonly luckScore: number
        readonly skillScore: number
        readonly startShanten: number
        readonly startDoraCount: number
        readonly drawLuckRatio: number
        readonly uradoraHits: number
        readonly dealInScore: number
        readonly tsumoLossScore: number
        readonly tileEfficiency: number
        readonly isWin: boolean
        readonly isRiichi: boolean
        readonly isFuro: boolean
        readonly isDamaten: boolean
        readonly isInitiative: boolean
    }[]
}

export class PaipuParser {
    private readonly luckEvaluator: LuckEvaluator = new LuckEvaluator()
    private readonly skillEvaluator: SkillEvaluator = new SkillEvaluator()

    public parseGameRecord(record: MajsoulGameRecord): ParsedGameResult {
        /*_ GEMINI THINKING _*/
        const roundMetrics: {
            roundIndex: number
            seat: SeatIndex
            luckScore: number
            skillScore: number
            startShanten: number
            startDoraCount: number
            drawLuckRatio: number
            uradoraHits: number
            dealInScore: number
            tsumoLossScore: number
            tileEfficiency: number
            isWin: boolean
            isRiichi: boolean
            isFuro: boolean
            isDamaten: boolean
            isInitiative: boolean
        }[] = []

        const playerCount = (record.players.length === 3 || record.roomType.includes('3인')) ? 3 : 4
        const playerTotalLuck = [0, 0, 0, 0]
        const playerTotalSkill = [0, 0, 0, 0]
        const roundCount = record.rounds.length || 1

        const parsedRounds: PaipuRound[] = []

        for (let rIdx = 0; rIdx < record.rounds.length; rIdx++) {
            const round = record.rounds[rIdx]
            if (!round) {
                continue
            }

            const styleFlags = this.analyzeRoundStyleFlags(round)

            for (let seat = 0; seat < playerCount; seat++) {
                const s = seat as SeatIndex
                const luckMetric = this.luckEvaluator.evaluateRound(round, s)
                const skillMetric = this.skillEvaluator.evaluateRound(round, s)
                const flags = styleFlags[s]

                playerTotalLuck[s] = (playerTotalLuck[s] ?? 0) + luckMetric.luckScore
                playerTotalSkill[s] = (playerTotalSkill[s] ?? 0) + skillMetric.skillScore

                const isWin = flags.isWin || (luckMetric.isWin ?? false)
                const dealInScore = flags.dealInScore > 0 ? flags.dealInScore : (skillMetric.dealInMistakeRate > 0 ? 8000 : 0)
                const uradoraHits = flags.uradoraHits > 0 ? flags.uradoraHits : luckMetric.uradoraCount

                roundMetrics.push({
                    roundIndex: rIdx,
                    seat: s,
                    luckScore: luckMetric.luckScore,
                    skillScore: skillMetric.skillScore,
                    startShanten: luckMetric.startingShanten,
                    startDoraCount: luckMetric.startingDoraCount,
                    drawLuckRatio: luckMetric.drawEfficiencyRatio,
                    uradoraHits,
                    dealInScore,
                    tsumoLossScore: luckMetric.unavoidableDamage,
                    tileEfficiency: skillMetric.tileEfficiencyRate,
                    isWin,
                    isRiichi: flags.isRiichi,
                    isFuro: flags.isFuro,
                    isDamaten: flags.isDamaten,
                    isInitiative: flags.isInitiative
                })
            }

            parsedRounds.push(this.transformRound(round, rIdx))
        }

        // Calculate final scores and ranks
        const defaultScore = playerCount === 3 ? 35000 : 25000
        const lastRound = record.rounds[record.rounds.length - 1]
        const finalScores = lastRound ? [...lastRound.header.scores] : [defaultScore, defaultScore, defaultScore, defaultScore]

        // Rank determination (tie-breaking by seat order)
        const validSeats = (playerCount === 3 ? [0, 1, 2] : [0, 1, 2, 3]) as SeatIndex[]
        const rankedSeats: SeatIndex[] = validSeats.sort((a, b) => {
            const scoreA = finalScores[a] ?? defaultScore
            const scoreB = finalScores[b] ?? defaultScore
            if (scoreB !== scoreA) {
                return scoreB - scoreA
            }
            return a - b
        })

        const seatRanks = playerCount === 3 ? [1, 2, 3] : [1, 2, 3, 4]
        for (let r = 0; r < playerCount; r++) {
            const seat = rankedSeats[r]
            if (seat !== undefined) {
                seatRanks[seat] = r + 1
            }
        }

        const players: PlayerSummary[] = record.players.map((p) => {
            const seat = p.seat
            const totalLuck = playerTotalLuck[seat] ?? 50
            const totalSkill = playerTotalSkill[seat] ?? 50
            return {
                accountId: p.accountId,
                nickname: p.nickname,
                seat,
                rank: seatRanks[seat] ?? (playerCount === 3 ? 3 : 4),
                finalScore: finalScores[seat] ?? 25000,
                luckScore: Number((totalLuck / roundCount).toFixed(1)),
                skillScore: Number((totalSkill / roundCount).toFixed(1))
            }
        })

        const detail: PaipuDetail = {
            id: record.uuid,
            roomName: record.roomType,
            timestamp: record.timestamp,
            players,
            rounds: parsedRounds
        }

        return {
            detail,
            roundMetrics
        }
    }

    private transformRound(round: MajsoulRoundRecord, roundIndex: number): PaipuRound {
        const roundNames = ['동1국', '동2국', '동3국', '동4국', '남1국', '남2국', '남3국', '남4국']
        const name = roundNames[round.header.ju] ?? `동${round.header.ju + 1}국`

        let step = 0
        const actions: PaipuAction[] = []

        for (const action of round.actions) {
            step++
            if (action.type === 'RecordDealTile') {
                actions.push({
                    step,
                    seat: action.seat,
                    type: 'tsumo',
                    tile: action.tile
                })
            } else if (action.type === 'RecordDiscardTile') {
                actions.push({
                    step,
                    seat: action.seat,
                    type: 'dahai',
                    tile: action.tile,
                    isRiichi: action.isLiqi
                })
            } else if (action.type === 'RecordChiPengGang') {
                actions.push({
                    step,
                    seat: action.seat,
                    type: action.meldType,
                    consumedTiles: action.tiles
                })
            } else if (action.type === 'RecordAnGangAddGang') {
                actions.push({
                    step,
                    seat: action.seat,
                    type: action.gangType,
                    consumedTiles: action.tiles
                })
            } else if (action.type === 'RecordHule') {
                for (const h of action.hules) {
                    actions.push({
                        step,
                        seat: h.seat,
                        type: 'hora'
                    })
                }
            } else if (action.type === 'RecordNoTile') {
                actions.push({
                    step,
                    seat: 0,
                    type: 'ryukyoku'
                })
            }
        }

        return {
            roundIndex,
            roundName: name,
            honba: round.header.ben,
            riichiSticks: round.header.liqi,
            initialScores: round.header.scores,
            doraIndicators: [round.header.dora],
            startingHands: round.header.hands,
            actions
        }
    }

    /*_ GEMINI THINKING _*/
    protected analyzeRoundStyleFlags(round: MajsoulRoundRecord): Record<SeatIndex, {
        isRiichi: boolean
        isFuro: boolean
        isWin: boolean
        isDamaten: boolean
        isInitiative: boolean
        dealInScore: number
        uradoraHits: number
    }> {
        const isRiichiSeats = new Set<SeatIndex>()
        const isFuroSeats = new Set<SeatIndex>()
        const isWinSeats = new Set<SeatIndex>()
        const dealInScores: Record<SeatIndex, number> = { 0: 0, 1: 0, 2: 0, 3: 0 }
        const uradoraHitsBySeat: Record<SeatIndex, number> = { 0: 0, 1: 0, 2: 0, 3: 0 }
        let firstRiichiSeat: SeatIndex | null = null
        let ryukyokuTenpaiSeats: readonly SeatIndex[] = []

        for (const action of round.actions) {
            if (action.type === 'RecordDiscardTile' && action.isLiqi) {
                isRiichiSeats.add(action.seat)
                if (firstRiichiSeat === null) {
                    firstRiichiSeat = action.seat
                }
            } else if (action.type === 'RecordChiPengGang') {
                isFuroSeats.add(action.seat)
            } else if (action.type === 'RecordAnGangAddGang' && action.gangType === 'kakan') {
                isFuroSeats.add(action.seat)
            } else if (action.type === 'RecordHule') {
                for (const h of action.hules) {
                    isWinSeats.add(h.seat)
                    if (h.uradoras) {
                        uradoraHitsBySeat[h.seat] = (uradoraHitsBySeat[h.seat] ?? 0) + h.uradoras.length
                    }
                    const losingSeats = ([0, 1, 2, 3] as SeatIndex[]).filter((st) => (h.deltaScores[st] ?? 0) < 0)
                    if (losingSeats.length === 1 && losingSeats[0] !== undefined) {
                        const loser = losingSeats[0]
                        dealInScores[loser] = (dealInScores[loser] ?? 0) + Math.abs(h.deltaScores[loser] ?? 0)
                    }
                }
            } else if (action.type === 'RecordNoTile') {
                ryukyokuTenpaiSeats = action.tenpaiSeats
            }
        }

        const result: Record<SeatIndex, {
            isRiichi: boolean
            isFuro: boolean
            isWin: boolean
            isDamaten: boolean
            isInitiative: boolean
            dealInScore: number
            uradoraHits: number
        }> = {
            0: { isRiichi: false, isFuro: false, isWin: false, isDamaten: false, isInitiative: false, dealInScore: 0, uradoraHits: 0 },
            1: { isRiichi: false, isFuro: false, isWin: false, isDamaten: false, isInitiative: false, dealInScore: 0, uradoraHits: 0 },
            2: { isRiichi: false, isFuro: false, isWin: false, isDamaten: false, isInitiative: false, dealInScore: 0, uradoraHits: 0 },
            3: { isRiichi: false, isFuro: false, isWin: false, isDamaten: false, isInitiative: false, dealInScore: 0, uradoraHits: 0 }
        }

        for (let seat = 0; seat < 4; seat++) {
            const s = seat as SeatIndex
            const isRiichi = isRiichiSeats.has(s)
            const isFuro = isFuroSeats.has(s)
            const isWin = isWinSeats.has(s)
            const isTenpaiAtRyukyoku = ryukyokuTenpaiSeats.includes(s)
            const isDamaten = !isRiichi && !isFuro && (isWin || isTenpaiAtRyukyoku)

            const isInitiative = isRiichi && firstRiichiSeat === s

            result[s] = {
                isRiichi,
                isFuro,
                isWin,
                isDamaten,
                isInitiative,
                dealInScore: dealInScores[s] ?? 0,
                uradoraHits: uradoraHitsBySeat[s] ?? 0
            }
        }

        return result
    }
}

