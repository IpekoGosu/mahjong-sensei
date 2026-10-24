import nodeTest from 'node:test'
import assert from 'node:assert/strict'
import {
    ScoreSituationEvaluator,
    PlayerScoreSituation,
    OpponentThreatAssessment
} from './score-situation-evaluator'
import { CoachingAdvisor } from './coaching-advisor'
import { MajsoulRoundRecord, MajsoulGameRecord } from '../parser/types'

class MockScoreSituationEvaluator extends ScoreSituationEvaluator {
    public testCalculatePlayerScoreSituation(
        scores: readonly number[],
        targetSeat: 0 | 1 | 2 | 3,
        ju: number = 0,
        is3P: boolean = true
    ): PlayerScoreSituation {
        return this.calculatePlayerScoreSituation(scores, targetSeat, ju, is3P)
    }

    public testAssessOpponentThreat(
        seat: 0 | 1 | 2 | 3,
        kitaCount: number,
        meldDoras: number,
        isRiichi: boolean
    ): OpponentThreatAssessment {
        return this.assessOpponentThreat(seat, kitaCount, meldDoras, isRiichi)
    }
}

/*_ GEMINI THINKING _*/
nodeTest('ScoreSituationEvaluator - isOrasu correctly identifies All-Last for 3P and 4P', () => {
    const evaluator = new ScoreSituationEvaluator()

    // 3P Hanchan (South 3 is Orasu: chang 1, ju 2)
    assert.equal(evaluator.isOrasu(1, 2, true, false), true)
    // 3P South 3 renchan (ju >= 2)
    assert.equal(evaluator.isOrasu(1, 3, true, false), true)
    // 3P South 1 or 2 is NOT Orasu
    assert.equal(evaluator.isOrasu(1, 0, true, false), false)
    assert.equal(evaluator.isOrasu(1, 1, true, false), false)

    // 3P Tonpuusen (East 3 is Orasu if isEastOnly: chang 0, ju 2)
    assert.equal(evaluator.isOrasu(0, 2, true, true), true)
    // 3P East 1 or 2 is NOT Orasu in Tonpuusen
    assert.equal(evaluator.isOrasu(0, 0, true, true), false)
    assert.equal(evaluator.isOrasu(0, 1, true, true), false)
    // 3P East 3 is NOT Orasu if it's a Hanchan game
    assert.equal(evaluator.isOrasu(0, 2, true, false), false)

    // 4P comparison (4P Orasu is ju 3)
    assert.equal(evaluator.isOrasu(1, 2, false, false), false) // South 3 is NOT Orasu in 4P
    assert.equal(evaluator.isOrasu(1, 3, false, false), true)  // South 4 is Orasu in 4P
    assert.equal(evaluator.isOrasu(0, 3, false, true), true)   // East 4 is Orasu in Tonpuu 4P
})

/*_ GEMINI THINKING _*/
nodeTest('ScoreSituationEvaluator - calculatePlayerScoreSituation evaluates 3P rank and score gaps', () => {
    const mock = new MockScoreSituationEvaluator()

    // Seat 0: 45000 (1st), Seat 1: 30000 (2nd), Seat 2: 25000 (3rd)
    const scores = [45000, 30000, 25000, 0] as const

    const sitSeat1 = mock.testCalculatePlayerScoreSituation(scores, 1, 2, true)
    assert.equal(sitSeat1.rank, 2)
    assert.equal(sitSeat1.score, 30000)
    assert.equal(sitSeat1.scoreGapToFirst, 15000)
    assert.equal(sitSeat1.scoreGapToThird, 5000)
    assert.equal(sitSeat1.isDealer, false)

    const sitSeat0 = mock.testCalculatePlayerScoreSituation(scores, 0, 0, true)
    assert.equal(sitSeat0.rank, 1)
    assert.equal(sitSeat0.score, 45000)
    assert.equal(sitSeat0.scoreGapToFirst, 0)
    assert.equal(sitSeat0.scoreGapToThird, 20000)
    assert.equal(sitSeat0.isDealer, true)

    const sitSeat2 = mock.testCalculatePlayerScoreSituation(scores, 2, 2, true)
    assert.equal(sitSeat2.rank, 3)
    assert.equal(sitSeat2.score, 25000)
    assert.equal(sitSeat2.scoreGapToFirst, 20000)
    assert.equal(sitSeat2.scoreGapToThird, 0)
    assert.equal(sitSeat2.isDealer, true) // ju 2 % 3 === 2 (Seat 2 is dealer)
})

/*_ GEMINI THINKING _*/
nodeTest('ScoreSituationEvaluator - calculatePlayerScoreSituation breaks ties by dealer proximity', () => {
    const mock = new MockScoreSituationEvaluator()
    // Tied scores: 30000 each for Seat 0, 1, 2. Dealer is Seat 1 (ju = 1)
    const scores = [30000, 30000, 30000, 0] as const

    // Proximity to dealer (Seat 1):
    // Seat 1 dist = 0 (Rank 1)
    // Seat 2 dist = 1 (Rank 2)
    // Seat 0 dist = 2 (Rank 3)
    const sitDealer = mock.testCalculatePlayerScoreSituation(scores, 1, 1, true)
    assert.equal(sitDealer.rank, 1)

    const sitNext = mock.testCalculatePlayerScoreSituation(scores, 2, 1, true)
    assert.equal(sitNext.rank, 2)

    const sitLast = mock.testCalculatePlayerScoreSituation(scores, 0, 1, true)
    assert.equal(sitLast.rank, 3)
})

/*_ GEMINI THINKING _*/
nodeTest('ScoreSituationEvaluator - assessOpponentThreat models Kita and high-value exposed doras', () => {
    const mock = new MockScoreSituationEvaluator()

    // 0 Kita, 0 meld doras, damaten
    const threat0 = mock.testAssessOpponentThreat(1, 0, 0, false)
    assert.equal(threat0.exposedDoraCount, 0)
    assert.equal(threat0.isHighValueThreat, false)
    assert.equal(threat0.threatMultiplier, 1.0)

    // 1 Kita
    const threat1 = mock.testAssessOpponentThreat(1, 1, 0, false)
    assert.equal(threat1.exposedDoraCount, 1)
    assert.equal(threat1.isHighValueThreat, false)
    assert.equal(threat1.threatMultiplier, 1.3)

    // 2 Kita: guaranteed Mangan threat (고타점 확정)
    const threat2 = mock.testAssessOpponentThreat(1, 2, 0, false)
    assert.equal(threat2.exposedDoraCount, 2)
    assert.equal(threat2.isHighValueThreat, true)
    assert.equal(threat2.threatMultiplier, 1.7)

    // 3 Kita: Haneman/Baiman threat
    const threat3 = mock.testAssessOpponentThreat(1, 3, 0, false)
    assert.equal(threat3.exposedDoraCount, 3)
    assert.equal(threat3.isHighValueThreat, true)
    assert.equal(threat3.threatMultiplier, 2.2)

    // 1 Kita + 1 meld dora (e.g. red dora): 2 exposed doras -> High Value Threat!
    const threatCombo = mock.testAssessOpponentThreat(1, 1, 1, true)
    assert.equal(threatCombo.exposedDoraCount, 2)
    assert.equal(threatCombo.isHighValueThreat, true)
    // 1.7 * 1.25 for Riichi = 2.125 -> 2.13
    assert.equal(threatCombo.threatMultiplier, 2.13)
})

/*_ GEMINI THINKING _*/
nodeTest('ScoreSituationEvaluator - evaluate2ndPlaceDefenseRisk detects extreme defense risk in Orasu', () => {
    const evaluator = new ScoreSituationEvaluator()

    const targetSit: PlayerScoreSituation = {
        seat: 1,
        rank: 2,
        score: 30000,
        scoreGapToFirst: 12000,
        scoreGapToThird: 4000, // Very narrow gap to 3rd place!
        isDealer: false
    }

    // High value opponent (2 Kita)
    const opponentThreat: OpponentThreatAssessment = {
        seat: 2,
        kitaCount: 2,
        meldDoraCount: 0,
        exposedDoraCount: 2,
        isHighValueThreat: true,
        threatMultiplier: 1.7,
        isRiichi: true
    }

    // Player is 1-shanten: pushing is EXTREME risk
    const decisionShanten1 = evaluator.evaluate2ndPlaceDefenseRisk(targetSit, opponentThreat, 1, 0.40)
    assert.equal(decisionShanten1.shouldDefend, true)
    assert.equal(decisionShanten1.riskLevel, 'EXTREME')
    assert.ok(decisionShanten1.reasonKo.includes('3위와의 점수차'))

    // Target is rank 1: 2nd place defense model does not apply
    const targetRank1: PlayerScoreSituation = {
        ...targetSit,
        rank: 1
    }
    const decisionRank1 = evaluator.evaluate2ndPlaceDefenseRisk(targetRank1, opponentThreat, 1, 0.40)
    assert.equal(decisionRank1.shouldDefend, false)
    assert.equal(decisionRank1.riskLevel, 'LOW')
})

/*_ GEMINI THINKING _*/
nodeTest('ScoreSituationEvaluator - evaluateDealInSituation catches fatal drop from 2nd to 3rd place', () => {
    const evaluator = new ScoreSituationEvaluator()

    const header = {
        type: 'RecordNewRound' as const,
        chang: 1,
        ju: 2, // South 3 (Orasu in 3P)
        ben: 0,
        liqi: 0,
        scores: [45000, 30000, 25000, 0] as const, // Seat 0: 1st, Seat 1: 2nd, Seat 2: 3rd
        dora: '1p',
        hands: [[], [], [], []] as const
    }

    // Seat 1 deals into Seat 2 for 8,000 pts (Mangan)
    // Scores become: Seat 0: 45000, Seat 1: 22000 (3rd!), Seat 2: 33000 (2nd!)
    const result = evaluator.evaluateDealInSituation(
        header,
        1, // targetSeat (was 2nd)
        2, // winnerSeat (was 3rd)
        8000,
        true, // is3P
        false, // isEastOnly
        1, // 1-shanten
        1, // winnerKitaCount
        0, // winnerMeldDoras
        true, // winnerIsRiichi
        '5p', // discardedTile
        '1z', // optimalTile
        9 // turnNumber
    )

    assert.equal(result.mistakeCategory, 'ORASU_FATAL_DEAL_IN')
    assert.equal(result.severityScore, 100)
    assert.equal(result.droppedFrom2ndTo3rd, true)
    assert.equal(result.situationScorePenalty, 45)
    assert.ok(result.coachingMessageKo.includes('[오라스 치명적 판단 오류]'))
    assert.ok(result.coachingMessageKo.includes('3위(라스)로 추락했습니다'))
})

/*_ GEMINI THINKING _*/
nodeTest('ScoreSituationEvaluator - evaluateDealInSituation flags HIGH_VALUE_RISK_DEAL_IN when not tenpai', () => {
    const evaluator = new ScoreSituationEvaluator()

    // East 1 round (not Orasu)
    const header = {
        type: 'RecordNewRound' as const,
        chang: 0,
        ju: 0,
        ben: 0,
        liqi: 0,
        scores: [35000, 35000, 35000, 0] as const,
        dora: '1p',
        hands: [[], [], [], []] as const
    }

    // Opponent has 2 Kita (high value threat!)
    // Target seat is 1-shanten and deals in 12,000 pts
    const result = evaluator.evaluateDealInSituation(
        header,
        0, // targetSeat
        1, // winnerSeat
        12000,
        true, // is3P
        false,
        1, // prevShanten = 1
        2, // winnerKitaCount = 2
        0,
        true, // winnerIsRiichi
        '4p',
        '2z',
        8
    )

    assert.equal(result.mistakeCategory, 'HIGH_VALUE_RISK_DEAL_IN')
    assert.equal(result.droppedFrom2ndTo3rd, false)
    assert.ok(result.severityScore >= 90)
    assert.ok(result.coachingMessageKo.includes('북패(키타) 2개'))
    assert.ok(result.coachingMessageKo.includes('고타점(만관 이상)이 확정'))
})

/*_ GEMINI THINKING _*/
nodeTest('ScoreSituationEvaluator - calculateOverallSituationScore handles penalties and defaults', () => {
    const evaluator = new ScoreSituationEvaluator()

    assert.equal(evaluator.calculateOverallSituationScore([]), 80)

    const goodSummaries = [
        { roundIndex: 0, isOrasu: false, is3P: true, startRank: 1, finalRank: 1, droppedFrom2ndTo3rd: false, situationScore: 90 },
        { roundIndex: 1, isOrasu: true, is3P: true, startRank: 2, finalRank: 2, droppedFrom2ndTo3rd: false, situationScore: 95 }
    ]
    assert.equal(evaluator.calculateOverallSituationScore(goodSummaries), 93)

    const disasterSummaries = [
        { roundIndex: 0, isOrasu: false, is3P: true, startRank: 1, finalRank: 1, droppedFrom2ndTo3rd: false, situationScore: 85 },
        { roundIndex: 1, isOrasu: true, is3P: true, startRank: 2, finalRank: 3, droppedFrom2ndTo3rd: true, situationScore: 35 }
    ]
    assert.equal(evaluator.calculateOverallSituationScore(disasterSummaries), 60)
})

/*_ GEMINI THINKING _*/
nodeTest('CoachingAdvisor - analyzeRound detects ORASU_FATAL_DEAL_IN in full round replay', () => {
    const advisor = new CoachingAdvisor()

    // South 3 (Orasu in 3P)
    // Seat 0: 45000 (1st), Seat 1: 32000 (2nd), Seat 2: 28000 (3rd)
    // Target is Seat 1. Gap to 3rd is 4,000 pts.
    const roundRecord: MajsoulRoundRecord = {
        header: {
            type: 'RecordNewRound',
            chang: 1,
            ju: 2, // Orasu!
            ben: 0,
            liqi: 0,
            scores: [45000, 32000, 28000, 0],
            dora: '1s',
            hands: [
                ['1m', '9m', '1p', '2p', '3p', '4p', '5p', '6p', '7p', '8p', '9p', '1s', '2s'],
                // Seat 1: 1-shanten hand with genbutsu safe tile '1z' (which Seat 2 discards)
                ['1p', '2p', '3p', '4p', '5p', '6p', '7s', '8s', '9s', '2s', '4s', '6s', '1z'],
                ['1m', '9m', '1p', '2p', '3p', '4p', '5p', '6p', '7p', '8p', '9p', '1s', '2s'],
                []
            ]
        },
        actions: [
            // Seat 2 declares Kita (RecordBaBei)
            { type: 'RecordBaBei', seat: 2, isMoqie: false },
            // Seat 2 discards 1z (Genbutsu for Seat 2)
            { type: 'RecordDiscardTile', seat: 2, tile: '1z', isMoqie: false, isLiqi: false },
            // Seat 0 discards 9m
            { type: 'RecordDiscardTile', seat: 0, tile: '9m', isMoqie: false, isLiqi: false },
            // Seat 1 draws 8s
            { type: 'RecordDealTile', seat: 1, tile: '8s' },
            // Seat 1 discards 8s
            { type: 'RecordDiscardTile', seat: 1, tile: '8s', isMoqie: true, isLiqi: false },
            // Seat 2 declares Riichi!
            { type: 'RecordDealTile', seat: 2, tile: '3s' },
            { type: 'RecordDiscardTile', seat: 2, tile: '3s', isMoqie: false, isLiqi: true },
            // Seat 0 discards 1z (safe against Seat 2)
            { type: 'RecordDealTile', seat: 0, tile: '2z' },
            { type: 'RecordDiscardTile', seat: 0, tile: '1z', isMoqie: false, isLiqi: false },
            // Seat 1 draws dangerous musuji '5s'
            { type: 'RecordDealTile', seat: 1, tile: '5s' },
            // Seat 1 discards 5s instead of 100% safe '1z' in hand, and deals into Seat 2!
            { type: 'RecordDiscardTile', seat: 1, tile: '5s', isMoqie: false, isLiqi: false },
            // Seat 2 Ron for 8,000 pts -> Seat 1 drops to 3rd place!
            {
                type: 'RecordHule',
                hules: [
                    {
                        seat: 2,
                        deltaScores: [0, -8000, 8000, 0],
                        handScore: 8000,
                        fan: 4,
                        fu: 40,
                        yaku: ['리치']
                    }
                ]
            }
        ]
    }

    const mistakes = advisor.analyzeRound(roundRecord, 0, 1, true, false)
    assert.ok(mistakes.length > 0)

    const fatalMistake = mistakes.find((m) => m.mistakeCategory === 'ORASU_FATAL_DEAL_IN' || m.mistakeCategory === 'ORASU_SECOND_DEFENSE_FAILURE')
    assert.ok(fatalMistake !== undefined)
    assert.equal(fatalMistake?.severityScore, 100)
    assert.equal(fatalMistake?.optimalTile, '1z')
    assert.ok(fatalMistake?.coachingMessageKo.includes('오라스'))
    assert.ok(fatalMistake?.coachingMessageKo.includes('3위(라스)로 추락했습니다'))
})

/*_ GEMINI THINKING _*/
nodeTest('CoachingAdvisor - analyzeGame produces situationScore and orasuEvaluation', () => {
    const advisor = new CoachingAdvisor()

    const gameRecord: MajsoulGameRecord = {
        uuid: 'test-3p-orasu-game-uuid',
        timestamp: 1700000000,
        roomType: '작혼 3인 남풍전 옥탁',
        players: [
            { accountId: 100, nickname: 'Player0', seat: 0, level: 1 },
            { accountId: 101, nickname: 'Player1', seat: 1, level: 1 },
            { accountId: 102, nickname: 'Player2', seat: 2, level: 1 }
        ],
        rounds: [
            // Round 0: East 1
            {
                header: {
                    type: 'RecordNewRound',
                    chang: 0,
                    ju: 0,
                    ben: 0,
                    liqi: 0,
                    scores: [35000, 35000, 35000, 0],
                    dora: '1p',
                    hands: [
                        ['1p', '2p', '3p', '4p', '5p', '6p', '7s', '8s', '9s', '1z', '1z', '2z', '2z'],
                        ['1p', '2p', '3p', '4p', '5p', '6p', '7s', '8s', '9s', '1z', '1z', '2z', '2z'],
                        ['1p', '2p', '3p', '4p', '5p', '6p', '7s', '8s', '9s', '1z', '1z', '2z', '2z'],
                        []
                    ]
                },
                actions: [
                    { type: 'RecordDealTile', seat: 0, tile: '3z' },
                    { type: 'RecordDiscardTile', seat: 0, tile: '3z', isMoqie: true, isLiqi: false },
                    { type: 'RecordDealTile', seat: 1, tile: '3z' },
                    { type: 'RecordDiscardTile', seat: 1, tile: '3z', isMoqie: true, isLiqi: false },
                    { type: 'RecordDealTile', seat: 2, tile: '3z' },
                    { type: 'RecordDiscardTile', seat: 2, tile: '3z', isMoqie: true, isLiqi: false }
                ]
            },
            // Round 1: South 3 (Orasu) where Seat 1 starts 2nd and defends without deal-in
            {
                header: {
                    type: 'RecordNewRound',
                    chang: 1,
                    ju: 2,
                    ben: 0,
                    liqi: 0,
                    scores: [45000, 35000, 25000, 0],
                    dora: '1p',
                    hands: [
                        ['1p', '2p', '3p', '4p', '5p', '6p', '7s', '8s', '9s', '1z', '1z', '2z', '2z'],
                        ['1p', '2p', '3p', '4p', '5p', '6p', '7s', '8s', '9s', '1z', '1z', '2z', '2z'],
                        ['1p', '2p', '3p', '4p', '5p', '6p', '7s', '8s', '9s', '1z', '1z', '2z', '2z'],
                        []
                    ]
                },
                actions: [
                    { type: 'RecordDealTile', seat: 0, tile: '3z' },
                    { type: 'RecordDiscardTile', seat: 0, tile: '3z', isMoqie: true, isLiqi: false },
                    { type: 'RecordDealTile', seat: 1, tile: '3z' },
                    { type: 'RecordDiscardTile', seat: 1, tile: '3z', isMoqie: true, isLiqi: false }
                ]
            }
        ]
    }

    const report = advisor.analyzeGame(gameRecord, 1, true)
    assert.equal(report.is3P, true)
    assert.ok(report.situationScore !== undefined)
    assert.ok(report.situationScore >= 80)
    assert.ok(report.orasuEvaluation !== undefined)
    assert.equal(report.orasuEvaluation?.isOrasuEvaluated, true)
    assert.equal(report.orasuEvaluation?.droppedFrom2ndTo3rd, false)
    assert.ok(report.orasuEvaluation?.summaryKo.includes('오라스 2위 상황에서 안정적인 방어로 순위 유지'))
})
