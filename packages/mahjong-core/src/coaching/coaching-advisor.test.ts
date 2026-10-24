/*_ GEMINI THINKING _*/
import test from 'node:test'
import assert from 'node:assert'
import {
    CoachingAdvisor,
    MistakeCategory,
    MistakeFeedbackParams
} from './coaching-advisor'
import { MajsoulRoundRecord, MajsoulGameRecord } from '../parser/types'
import { TiltDiagnosisResult } from '@mahjong-sensei/types'

class MockCoachingAdvisorInCoachingDir extends CoachingAdvisor {
    public testBuildMistakeFeedback(
        categoryOrParams: MistakeCategory | MistakeFeedbackParams,
        turnNumber?: number,
        discardedTile?: string,
        optimalTile?: string,
        prevShanten?: number,
        afterShanten?: number,
        optimalUkeire?: number,
        actualUkeire?: number,
        evLoss?: number
    ): string {
        return this.buildMistakeFeedback(
            categoryOrParams,
            turnNumber,
            discardedTile,
            optimalTile,
            prevShanten,
            afterShanten,
            optimalUkeire,
            actualUkeire,
            evLoss
        )
    }
}

test('CoachingAdvisor - DANGER_PUSH_LOW_EV detection in 3P against Riichi', () => {
    const advisor = new CoachingAdvisor()

    // 3P round where Seat 0 has 1-shanten hand with Genbutsu 1z and dangerous musuji 5s
    // Hand: 111p 999p 1s 2s 1z 5s 1m 9m (1-shanten in 3P)
    const roundRecord: MajsoulRoundRecord = {
        header: {
            type: 'RecordNewRound',
            chang: 0,
            ju: 0,
            ben: 0,
            liqi: 0,
            scores: [35000, 35000, 35000, 0],
            dora: '9m',
            hands: [
                ['1p', '1p', '1p', '9p', '9p', '9p', '1s', '2s', '1z', '5s', '1m', '9m', '7s'],
                ['1p', '2p', '3p', '4p', '5p', '6p', '7p', '8p', '9p', '1s', '2s', '3s', '4s'],
                ['1p', '2p', '3p', '4p', '5p', '6p', '7p', '8p', '9p', '1s', '2s', '3s', '4s'],
                []
            ]
        },
        actions: [
            // Opponent Seat 1 discards 1z
            { type: 'RecordDealTile', seat: 1, tile: '1z' },
            { type: 'RecordDiscardTile', seat: 1, tile: '1z', isMoqie: false, isLiqi: false },

            // Opponent Seat 1 declares Riichi and discards 2z
            { type: 'RecordDealTile', seat: 1, tile: '2z' },
            { type: 'RecordDiscardTile', seat: 1, tile: '2z', isMoqie: false, isLiqi: true },

            // Seat 0 draws 8s, hand has Genbutsu 1z, but pushes dangerous musuji 5s
            { type: 'RecordDealTile', seat: 0, tile: '8s' },
            { type: 'RecordDiscardTile', seat: 0, tile: '5s', isMoqie: false, isLiqi: false },
            { type: 'RecordNoTile', tenpaiSeats: [1], deltaScores: [-1000, 1000, 0, 0] }
        ]
    }

    const mistakes = advisor.analyzeRound(roundRecord, 0, 0, true)
    assert.strictEqual(mistakes.length, 1)

    const mistake = mistakes[0]
    assert.ok(mistake)
    assert.strictEqual(mistake.mistakeCategory, 'DANGER_PUSH_LOW_EV')
    assert.strictEqual(mistake.discardedTile, '5s')
    assert.strictEqual(mistake.optimalTile, '1z')
    assert.ok((mistake.evLoss ?? 0) >= 2500)
    assert.ok(mistake.coachingMessageKo.includes('기대치 손실'))
    assert.ok(mistake.coachingMessageKo.includes('베타오리'))
})

test('CoachingAdvisor - TIMID_FOLD_HIGH_EV detection in 3P when folding Haneman tenpai', () => {
    const advisor = new CoachingAdvisor()

    // Seat 0 has Haneman Tenpai (0-shanten):
    // 3 Doras: 9p x 3 (dora indicator 8p)
    // Hand: 111p 999p 456s 23s 11z (13 tiles, waiting on 1s/4s)
    // Under opponent Riichi, Seat 0 draws dangerous 5s
    // Instead of pushing 5s to maintain Tenpai, Seat 0 timidly discards safe 1z (breaking pair to 1-shanten)
    const roundRecord: MajsoulRoundRecord = {
        header: {
            type: 'RecordNewRound',
            chang: 0,
            ju: 0,
            ben: 0,
            liqi: 0,
            scores: [35000, 35000, 35000, 0],
            dora: '8p',
            hands: [
                ['1p', '1p', '1p', '9p', '9p', '9p', '4s', '5s', '6s', '2s', '3s', '1z', '1z'],
                ['1p', '2p', '3p', '4p', '5p', '6p', '7p', '8p', '9p', '1s', '2s', '3s', '4s'],
                ['1p', '2p', '3p', '4p', '5p', '6p', '7p', '8p', '9p', '1s', '2s', '3s', '4s'],
                []
            ]
        },
        actions: [
            // Opponent Seat 1 discards 1z
            { type: 'RecordDealTile', seat: 1, tile: '1z' },
            { type: 'RecordDiscardTile', seat: 1, tile: '1z', isMoqie: false, isLiqi: false },

            // Opponent Seat 1 declares Riichi
            { type: 'RecordDealTile', seat: 1, tile: '2z' },
            { type: 'RecordDiscardTile', seat: 1, tile: '2z', isMoqie: false, isLiqi: true },

            // Seat 0 draws dangerous 5s (now hand is 111p 999p 456s 23s 11z + 5s)
            // But Seat 0 timidly discards safe 1z instead of pushing 5s, breaking tenpai!
            { type: 'RecordDealTile', seat: 0, tile: '5s' },
            { type: 'RecordDiscardTile', seat: 0, tile: '1z', isMoqie: false, isLiqi: false },

            { type: 'RecordNoTile', tenpaiSeats: [1], deltaScores: [-1000, 1000, 0, 0] }
        ]
    }

    const mistakes = advisor.analyzeRound(roundRecord, 0, 0, true)
    const timidMistake = mistakes.find((m) => m.mistakeCategory === 'TIMID_FOLD_HIGH_EV')
    assert.ok(timidMistake)
    assert.strictEqual(timidMistake.discardedTile, '1z')
    assert.ok((timidMistake.evLoss ?? 0) >= 2500)
    assert.ok(timidMistake.coachingMessageKo.includes('과도한 방총 공포'))
    assert.ok(timidMistake.coachingMessageKo.includes('고화료(하네만/배만) 텐파이'))
})

test('CoachingAdvisor - analyzeGame prioritizes Critical EV Loss (> 2500) over routine mistakes', () => {
    const advisor = new CoachingAdvisor()

    // Construct a game where Round 1 has UKEIRE_LOSS (evLoss ~800, severity 40)
    // and Round 2 has a catastrophic DANGER_PUSH_LOW_EV (evLoss 4500, severity 85)
    const gameRecord: MajsoulGameRecord = {
        uuid: 'game_critical_ev_loss_test',
        roomType: '3인반장전',
        timestamp: 1718000000,
        players: [
            { accountId: 2001, nickname: 'TiltedPlayer', seat: 0, level: 2 },
            { accountId: 2002, nickname: 'Opponent1', seat: 1, level: 2 },
            { accountId: 2003, nickname: 'Opponent2', seat: 2, level: 2 }
        ],
        rounds: [
            // Round 1: UKEIRE_LOSS
            {
                header: {
                    type: 'RecordNewRound',
                    chang: 0,
                    ju: 0,
                    ben: 0,
                    liqi: 0,
                    scores: [35000, 35000, 35000, 0],
                    dora: '5z',
                    hands: [
                        ['1p', '2p', '3p', '4p', '5p', '6p', '1z', '1z', '2s', '3s', '7s', '9s', '9p'],
                        ['1p', '2p', '3p', '4p', '5p', '6p', '7p', '8p', '9p', '1s', '2s', '3s', '4s'],
                        ['1p', '2p', '3p', '4p', '5p', '6p', '7p', '8p', '9p', '1s', '2s', '3s', '4s'],
                        []
                    ]
                },
                actions: [
                    { type: 'RecordDealTile', seat: 0, tile: '1z' },
                    { type: 'RecordDiscardTile', seat: 0, tile: '2s', isMoqie: false, isLiqi: false },
                    { type: 'RecordNoTile', tenpaiSeats: [], deltaScores: [0, 0, 0, 0] }
                ]
            },
            // Round 2: DANGER_PUSH_LOW_EV (opponent riichi, cheap/noten musuji push)
            {
                header: {
                    type: 'RecordNewRound',
                    chang: 0,
                    ju: 1,
                    ben: 0,
                    liqi: 0,
                    scores: [35000, 35000, 35000, 0],
                    dora: '9m',
                    hands: [
                        ['1p', '1p', '1p', '9p', '9p', '9p', '1s', '2s', '1z', '5s', '1m', '9m', '7s'],
                        ['1p', '2p', '3p', '4p', '5p', '6p', '7p', '8p', '9p', '1s', '2s', '3s', '4s'],
                        ['1p', '2p', '3p', '4p', '5p', '6p', '7p', '8p', '9p', '1s', '2s', '3s', '4s'],
                        []
                    ]
                },
                actions: [
                    { type: 'RecordDealTile', seat: 1, tile: '1z' },
                    { type: 'RecordDiscardTile', seat: 1, tile: '1z', isMoqie: false, isLiqi: false },
                    { type: 'RecordDealTile', seat: 1, tile: '2z' },
                    { type: 'RecordDiscardTile', seat: 1, tile: '2z', isMoqie: false, isLiqi: true },
                    { type: 'RecordDealTile', seat: 0, tile: '8s' },
                    { type: 'RecordDiscardTile', seat: 0, tile: '5s', isMoqie: false, isLiqi: false },
                    { type: 'RecordNoTile', tenpaiSeats: [1], deltaScores: [-1000, 1000, 0, 0] }
                ]
            }
        ]
    }

    const report = advisor.analyzeGame(gameRecord, 0, true)

    assert.ok(report.criticalMistakes.length >= 1)
    // The #1 critical mistake must be the DANGER_PUSH_LOW_EV because evLoss > 2500
    assert.strictEqual(report.criticalMistakes[0]?.mistakeCategory, 'DANGER_PUSH_LOW_EV')
    assert.ok((report.criticalMistakes[0]?.evLoss ?? 0) >= 2500)
    assert.ok(report.overallSummaryKo.includes('치명적 EV Loss 스파이크'))
    assert.ok(report.actionableAdviceKo.some((a) => a.includes('만관 확정 리치')))
})

test('CoachingAdvisor - analyzeGame embeds tiltDiagnosis and advice', () => {
    const advisor = new CoachingAdvisor()

    const gameRecord: MajsoulGameRecord = {
        uuid: 'game_tilt_report_test',
        roomType: '3인반장전',
        timestamp: 1718000000,
        players: [
            { accountId: 3001, nickname: 'TiltedUser', seat: 0, level: 2 },
            { accountId: 3002, nickname: 'P2', seat: 1, level: 2 },
            { accountId: 3003, nickname: 'P3', seat: 2, level: 2 }
        ],
        rounds: []
    }

    const mockTiltDiagnosis: TiltDiagnosisResult = {
        isTilt: true,
        tiltScore: 88,
        severity: 'CRITICAL',
        title: '치명적 멘탈 틸트 (대국 중단 강력 권장)',
        summary: '3대 징후 복합 발생',
        advice: '지금 즉시 랭크 대국을 중단하고 최소 30분 이상 휴식하세요.',
        symptoms: []
    }

    const report = advisor.analyzeGame(gameRecord, 0, true, mockTiltDiagnosis)

    assert.ok(report.tiltDiagnosis)
    assert.strictEqual(report.tiltDiagnosis.severity, 'CRITICAL')
    assert.strictEqual(report.tiltDiagnosis.tiltScore, 88)
    assert.ok(report.actionableAdviceKo.some((a) => a.includes('[틸트 경고]')))
})

test('MockCoachingAdvisorInCoachingDir - buildMistakeFeedback for DANGER_PUSH_LOW_EV and TIMID_FOLD_HIGH_EV', () => {
    const mock = new MockCoachingAdvisorInCoachingDir()

    const dangerPushMsg = mock.testBuildMistakeFeedback({
        category: 'DANGER_PUSH_LOW_EV',
        turnNumber: 7,
        discardedTile: '5s',
        optimalTile: '1z',
        prevShanten: 1,
        afterShanten: 1,
        optimalUkeire: 4,
        actualUkeire: 4,
        evLoss: 4500
    })
    assert.ok(dangerPushMsg.includes('싼 패/노텐(1샹텐) 상태'))
    assert.ok(dangerPushMsg.includes('기대치 손실 약 -4,500점'))
    assert.ok(dangerPushMsg.includes('베타오리'))

    const timidFoldMsg = mock.testBuildMistakeFeedback({
        category: 'TIMID_FOLD_HIGH_EV',
        turnNumber: 9,
        discardedTile: '1z',
        optimalTile: '7s',
        prevShanten: 0,
        afterShanten: 1,
        optimalUkeire: 8,
        actualUkeire: 0,
        evLoss: 4200
    })
    assert.ok(timidFoldMsg.includes('과도한 방총 공포'))
    assert.ok(timidFoldMsg.includes('고화료(하네만/배만) 텐파이'))
    assert.ok(timidFoldMsg.includes('기대치 손실 약 -4,200점'))
})
