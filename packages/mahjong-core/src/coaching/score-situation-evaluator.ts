import { SeatIndex, MistakeCategory } from '@mahjong-sensei/types'
import { MajsoulRecordNewRound } from '../parser/types'

export interface PlayerScoreSituation {
    readonly seat: SeatIndex
    readonly rank: number
    readonly score: number
    readonly scoreGapToFirst: number
    readonly scoreGapToThird: number
    readonly isDealer: boolean
}

export interface OpponentThreatAssessment {
    readonly seat: SeatIndex
    readonly kitaCount: number
    readonly meldDoraCount: number
    readonly exposedDoraCount: number
    readonly isHighValueThreat: boolean
    readonly threatMultiplier: number
    readonly isRiichi: boolean
}

export interface DefenseRiskDecision {
    readonly shouldDefend: boolean
    readonly riskLevel: 'EXTREME' | 'HIGH' | 'MODERATE' | 'LOW'
    readonly reasonKo: string
}

export interface DealInEvaluationResult {
    readonly mistakeCategory: MistakeCategory
    readonly severityScore: number
    readonly coachingMessageKo: string
    readonly droppedFrom2ndTo3rd: boolean
    readonly situationScorePenalty: number
}

export interface RoundSituationSummary {
    readonly roundIndex: number
    readonly isOrasu: boolean
    readonly is3P: boolean
    readonly startRank: number
    readonly finalRank: number
    readonly droppedFrom2ndTo3rd: boolean
    readonly situationScore: number
    readonly coachingAdviceKo?: string
}

export class ScoreSituationEvaluator {
    /*_ GEMINI THINKING _*/
    public isOrasu(
        chang: number,
        ju: number,
        is3P: boolean,
        isEastOnly: boolean = false
    ): boolean {
        const lastJu = is3P ? 2 : 3
        if (chang >= 1 && ju >= lastJu) {
            return true
        }
        if (isEastOnly && chang === 0 && ju >= lastJu) {
            return true
        }
        return false
    }

    /*_ GEMINI THINKING _*/
    public calculatePlayerScoreSituation(
        scores: readonly number[],
        targetSeat: SeatIndex,
        ju: number = 0,
        is3P: boolean = true
    ): PlayerScoreSituation {
        const playerCount = is3P ? 3 : 4
        const dealerSeat = ((ju % playerCount) + playerCount) % playerCount

        interface SeatScoreInfo {
            readonly seat: SeatIndex
            readonly score: number
            readonly dealerDistance: number
        }

        const seatList: SeatScoreInfo[] = []
        let s = 0
        while (s < playerCount) {
            const currentSeat = s as SeatIndex
            const dist = ((currentSeat - dealerSeat + playerCount) % playerCount)
            seatList.push({
                seat: currentSeat,
                score: scores[s] ?? 0,
                dealerDistance: dist
            })
            s++
        }

        seatList.sort((a, b) => {
            if (b.score !== a.score) {
                return b.score - a.score
            }
            return a.dealerDistance - b.dealerDistance
        })

        let rank = 1
        let rIdx = 0
        while (rIdx < seatList.length) {
            const item = seatList[rIdx]
            if (item && item.seat === targetSeat) {
                rank = rIdx + 1
                break
            }
            rIdx++
        }

        const targetScore = scores[targetSeat] ?? 0
        const firstScore = seatList[0]?.score ?? targetScore
        const thirdScore = seatList[2]?.score ?? (seatList[seatList.length - 1]?.score ?? targetScore)

        const scoreGapToFirst = Math.max(0, firstScore - targetScore)
        const scoreGapToThird = targetScore - thirdScore

        return {
            seat: targetSeat,
            rank,
            score: targetScore,
            scoreGapToFirst,
            scoreGapToThird,
            isDealer: targetSeat === dealerSeat
        }
    }

    /*_ GEMINI THINKING _*/
    public assessOpponentThreat(
        seat: SeatIndex,
        kitaCount: number,
        meldDoras: number,
        isRiichi: boolean
    ): OpponentThreatAssessment {
        const exposedDoraCount = Math.max(0, kitaCount) + Math.max(0, meldDoras)
        const isHighValueThreat = exposedDoraCount >= 2

        let threatMultiplier = 1.0
        if (exposedDoraCount === 1) {
            threatMultiplier = 1.3
        } else if (exposedDoraCount === 2) {
            threatMultiplier = 1.7
        } else if (exposedDoraCount >= 3) {
            threatMultiplier = 2.2
        }

        if (isRiichi) {
            threatMultiplier *= 1.25
        }

        return {
            seat,
            kitaCount,
            meldDoraCount: meldDoras,
            exposedDoraCount,
            isHighValueThreat,
            threatMultiplier: Number(threatMultiplier.toFixed(2)),
            isRiichi
        }
    }

    /*_ GEMINI THINKING _*/
    public evaluate2ndPlaceDefenseRisk(
        targetSituation: PlayerScoreSituation,
        opponentThreat: OpponentThreatAssessment,
        playerShanten: number,
        discardSafety: number
    ): DefenseRiskDecision {
        if (targetSituation.rank !== 2) {
            return {
                shouldDefend: false,
                riskLevel: 'LOW',
                reasonKo: '현재 2위가 아니므로 2위 수비 모델이 적용되지 않습니다.'
            }
        }

        const gapToThird = targetSituation.scoreGapToThird
        const gapToFirst = targetSituation.scoreGapToFirst
        const isCloseToThird = gapToThird <= 16000

        if (isCloseToThird) {
            if (opponentThreat.isHighValueThreat || opponentThreat.isRiichi) {
                if (playerShanten >= 1) {
                    return {
                        shouldDefend: true,
                        riskLevel: 'EXTREME',
                        reasonKo: `3위와의 점수차(${gapToThird.toLocaleString()}점)가 좁고 텐파이가 아닌 상태(${playerShanten}샹텐)에서 고타점/리치 타가에 승부하면 라스로 직행할 위험이 극히 높습니다.`
                    }
                }
                if (discardSafety <= 0.60) {
                    return {
                        shouldDefend: true,
                        riskLevel: 'HIGH',
                        reasonKo: `텐파이 상태라도 3위와 점수차가 좁고 상대의 위협 타점이 높아 위험패 승부는 3위 전락 위험이 큽니다.`
                    }
                }
            } else if (discardSafety <= 0.40 && playerShanten >= 1) {
                return {
                    shouldDefend: true,
                    riskLevel: 'HIGH',
                    reasonKo: `3위 방어가 우선시되는 상황에서 무스지 위험패 타패는 2위 방어에 매우 불리합니다.`
                }
            }
        }

        if (gapToFirst >= 20000 && opponentThreat.isRiichi && playerShanten >= 1) {
            return {
                shouldDefend: true,
                riskLevel: 'HIGH',
                reasonKo: '1위와의 점수차가 현격하여 역전이 불가능한 국면이므로 무조건 2위를 굳히는 수비가 유리합니다.'
            }
        }

        return {
            shouldDefend: false,
            riskLevel: 'MODERATE',
            reasonKo: '3위와의 점수차가 충분하거나 적절한 승부 구간입니다.'
        }
    }

    /*_ GEMINI THINKING _*/
    public evaluateDealInSituation(
        header: MajsoulRecordNewRound,
        targetSeat: SeatIndex,
        winnerSeat: SeatIndex,
        dealInPoints: number,
        is3P: boolean,
        isEastOnly: boolean,
        playerShanten: number,
        winnerKitaCount: number,
        winnerMeldDoras: number,
        winnerIsRiichi: boolean,
        discardedTile: string,
        optimalTile: string,
        turnNumber: number
    ): DealInEvaluationResult {
        const isOrasuRound = this.isOrasu(header.chang, header.ju, is3P, isEastOnly)
        const initialSituation = this.calculatePlayerScoreSituation(header.scores, targetSeat, header.ju, is3P)

        const finalScores: number[] = [
            header.scores[0] ?? 0,
            header.scores[1] ?? 0,
            header.scores[2] ?? 0,
            header.scores[3] ?? 0
        ]
        finalScores[targetSeat] = (finalScores[targetSeat] ?? 0) - dealInPoints
        finalScores[winnerSeat] = (finalScores[winnerSeat] ?? 0) + dealInPoints

        const finalSituation = this.calculatePlayerScoreSituation(finalScores, targetSeat, header.ju, is3P)
        const droppedFrom2ndTo3rd = isOrasuRound && is3P && initialSituation.rank === 2 && finalSituation.rank === 3

        const threat = this.assessOpponentThreat(winnerSeat, winnerKitaCount, winnerMeldDoras, winnerIsRiichi)

        if (droppedFrom2ndTo3rd) {
            const coachingMessageKo = `[오라스 치명적 판단 오류] 2위 유지 및 3위(라스) 회피가 절대적인 오라스 국면에서, 3위와의 점수차(${initialSituation.scoreGapToThird.toLocaleString()}점)를 방어하지 않고 무리하게 [${discardedTile}]을(를) 승부하다가 ${dealInPoints.toLocaleString()}점 방총되어 3위(라스)로 추락했습니다. 안전패 [${optimalTile}]을(를) 버려 2위를 확정짓는 수비가 필요했습니다.`
            return {
                mistakeCategory: 'ORASU_FATAL_DEAL_IN',
                severityScore: 100,
                coachingMessageKo,
                droppedFrom2ndTo3rd: true,
                situationScorePenalty: 45
            }
        }

        if (threat.isHighValueThreat && playerShanten >= 1) {
            const coachingMessageKo = `상대(좌석 ${winnerSeat})가 북패(키타) ${winnerKitaCount}개 및 도라 ${threat.exposedDoraCount}개를 노출하여 고타점(만관 이상)이 확정된 상황에서, 텐파이가 아님에도(${playerShanten}샹텐) ${turnNumber}순목에 위험패 [${discardedTile}]을(를) 버려 ${dealInPoints.toLocaleString()}점 방총되었습니다. 고타점 확정 상대에게는 안전패 [${optimalTile}]을(를) 내며 철저히 내려야 합니다.`
            return {
                mistakeCategory: 'HIGH_VALUE_RISK_DEAL_IN',
                severityScore: Math.min(100, Math.max(90, Math.round(90 + (dealInPoints / 2000)))),
                coachingMessageKo,
                droppedFrom2ndTo3rd: false,
                situationScorePenalty: 25
            }
        }

        const coachingMessageKo = `상대 리치 선언 후 ${turnNumber}순목에 위험패 [${discardedTile}]을(를) 버려 방총되었습니다. 리치에 맞서 텐파이가 아니라면 안전패 [${optimalTile}]을(를) 버리며 수비(베타오리)해야 합니다.`
        return {
            mistakeCategory: 'RECKLESS_PUSH_DEAL_IN',
            severityScore: Math.min(100, Math.max(85, Math.round(85 + (dealInPoints / 1000)))),
            coachingMessageKo,
            droppedFrom2ndTo3rd: false,
            situationScorePenalty: 15
        }
    }

    /*_ GEMINI THINKING _*/
    public calculateOverallSituationScore(
        roundSummaries: readonly RoundSituationSummary[]
    ): number {
        if (roundSummaries.length === 0) {
            return 80
        }

        let totalScore = 0
        for (const summary of roundSummaries) {
            totalScore += summary.situationScore
        }

        const avgScore = totalScore / roundSummaries.length
        return Math.max(0, Math.min(100, Math.round(avgScore)))
    }
}
