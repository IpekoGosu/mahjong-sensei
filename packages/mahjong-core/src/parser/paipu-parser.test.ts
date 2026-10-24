import test from 'node:test'
import assert from 'node:assert'
import { PlayerSummary } from '@mahjong-sensei/types'
import { PaipuParser } from './paipu-parser'
import { SAMPLE_MAJSOUL_GAME } from '../sample-data/sample-paipu'
import { MajsoulGameRecord } from './types'

test('PaipuParser - Parse sample game and compute round metrics', () => {
    const parser = new PaipuParser()
    const result = parser.parseGameRecord(SAMPLE_MAJSOUL_GAME)

    // Check basic details
    assert.strictEqual(result.detail.id, '230801-sample-jade-east')
    assert.strictEqual(result.detail.players.length, 4)
    assert.strictEqual(result.detail.rounds.length, 2)

    // Check player 0 (SenseiPlayer) performance
    const player0 = result.detail.players.find((p: PlayerSummary) => p.accountId === 10001)
    assert.ok(player0 !== undefined)
    assert.strictEqual(player0.seat, 0)
    assert.strictEqual(player0.rank, 1) // Finished 1st
    assert.ok(player0.luckScore > 50)  // Good luck hand (1-shanten starting hand + tsumo)

    // Check round metrics length (2 rounds * 4 seats = 8 metrics)
    assert.strictEqual(result.roundMetrics.length, 8)

    const round0Seat0 = result.roundMetrics.find((m) => m.roundIndex === 0 && m.seat === 0)
    assert.ok(round0Seat0 !== undefined)
    assert.strictEqual(round0Seat0.startShanten, 0) // Tenpai (0-shanten) hand
    assert.strictEqual(round0Seat0.uradoraHits, 1)  // 1 uradora hit
    assert.strictEqual(round0Seat0.isWin, true)
    assert.strictEqual(round0Seat0.isRiichi, false)
    assert.strictEqual(round0Seat0.isFuro, false)
    assert.strictEqual(round0Seat0.isDamaten, true)
    assert.strictEqual(round0Seat0.isInitiative, false)

    const round1Seat1 = result.roundMetrics.find((m) => m.roundIndex === 1 && m.seat === 1)
    assert.ok(round1Seat1 !== undefined)
    assert.strictEqual(round1Seat1.isRiichi, true)
    assert.strictEqual(round1Seat1.isInitiative, true)
    assert.strictEqual(round1Seat1.isWin, false)
    assert.strictEqual(round1Seat1.isDamaten, false)

    // Check round 0 result & metrics
    const round0 = result.detail.rounds[0]
    assert.ok(round0 !== undefined)
    assert.strictEqual(round0.roundName, '동1국')
    assert.deepStrictEqual(round0.doraIndicators, ['5m'])
    assert.ok(round0.result !== undefined)
    assert.strictEqual(round0.result.type, 'tsumo')
    assert.deepStrictEqual(round0.result.winnerSeats, [0])
    assert.strictEqual(round0.result.score, 12000)
    assert.ok(round0.result.summaryKo.includes('쯔모 화료'))
    assert.ok(round0.roundMetrics !== undefined)
    assert.strictEqual(round0.roundMetrics.length, 4)
    assert.strictEqual(round0.roundMetrics[0]?.startingShanten, 0)
    assert.strictEqual(round0.roundMetrics[0]?.isWin, true)

    // Check round 1 result & metrics
    const round1 = result.detail.rounds[1]
    assert.ok(round1 !== undefined)
    assert.strictEqual(round1.roundName, '동2국')
    assert.ok(round1.result !== undefined)
    assert.strictEqual(round1.result.type, 'ryukyoku')
    assert.ok(round1.result.summaryKo.includes('유국'))
    assert.ok(round1.roundMetrics !== undefined)
    assert.strictEqual(round1.roundMetrics.length, 4)
    assert.strictEqual(round1.roundMetrics[1]?.isRiichi, true)
})

test('PaipuParser - Parse game with RecordLiuJu (구종구패 and 사풍연타)', () => {
    const parser = new PaipuParser()
    const gameWithLiuJu: MajsoulGameRecord = {
        uuid: 'test-liuju-parser-001',
        roomType: '동풍전',
        timestamp: 1690000000,
        players: [
            { accountId: 10001, nickname: 'PlayerA', seat: 0, level: 1 },
            { accountId: 10002, nickname: 'PlayerB', seat: 1, level: 1 },
            { accountId: 10003, nickname: 'PlayerC', seat: 2, level: 1 },
            { accountId: 10004, nickname: 'PlayerD', seat: 3, level: 1 }
        ],
        rounds: [
            {
                header: {
                    type: 'RecordNewRound',
                    chang: 0,
                    ju: 0,
                    ben: 0,
                    liqi: 0,
                    scores: [25000, 25000, 25000, 25000],
                    dora: '1m',
                    hands: [
                        ['1m', '9m', '1p', '9p', '1s', '9s', '1z', '2z', '3z', '4z', '5z', '6z', '7z'],
                        ['2m', '3m', '4m', '5m', '6m', '7m', '8m', '2p', '3p', '4p', '2s', '3s', '4s'],
                        ['2m', '3m', '4m', '5m', '6m', '7m', '8m', '2p', '3p', '4p', '2s', '3s', '4s'],
                        ['2m', '3m', '4m', '5m', '6m', '7m', '8m', '2p', '3p', '4p', '2s', '3s', '4s']
                    ]
                },
                actions: [
                    {
                        type: 'RecordDealTile',
                        seat: 0,
                        tile: '1m'
                    },
                    {
                        type: 'RecordLiuJu',
                        liujuType: 1,
                        seat: 0
                    }
                ]
            },
            {
                header: {
                    type: 'RecordNewRound',
                    chang: 0,
                    ju: 0,
                    ben: 1,
                    liqi: 0,
                    scores: [25000, 25000, 25000, 25000],
                    dora: '2m',
                    hands: [
                        ['1z', '2m', '3m', '4m', '5m', '6m', '7m', '8m', '2p', '3p', '4p', '2s', '3s'],
                        ['1z', '2m', '3m', '4m', '5m', '6m', '7m', '8m', '2p', '3p', '4p', '2s', '3s'],
                        ['1z', '2m', '3m', '4m', '5m', '6m', '7m', '8m', '2p', '3p', '4p', '2s', '3s'],
                        ['1z', '2m', '3m', '4m', '5m', '6m', '7m', '8m', '2p', '3p', '4p', '2s', '3s']
                    ]
                },
                actions: [
                    { type: 'RecordDealTile', seat: 0, tile: '1z' },
                    { type: 'RecordDiscardTile', seat: 0, tile: '1z', isLiqi: false, isMoqie: true },
                    { type: 'RecordDealTile', seat: 1, tile: '1z' },
                    { type: 'RecordDiscardTile', seat: 1, tile: '1z', isLiqi: false, isMoqie: true },
                    { type: 'RecordDealTile', seat: 2, tile: '1z' },
                    { type: 'RecordDiscardTile', seat: 2, tile: '1z', isLiqi: false, isMoqie: true },
                    { type: 'RecordDealTile', seat: 3, tile: '1z' },
                    { type: 'RecordDiscardTile', seat: 3, tile: '1z', isLiqi: false, isMoqie: true },
                    {
                        type: 'RecordLiuJu',
                        liujuType: 2
                    }
                ]
            }
        ]
    }

    const parsed = parser.parseGameRecord(gameWithLiuJu)
    assert.strictEqual(parsed.detail.rounds.length, 2)

    // Round 0: 구종구패 (type 1, seat 0)
    const round0 = parsed.detail.rounds[0]
    assert.ok(round0 !== undefined)
    assert.ok(round0.result !== undefined)
    assert.strictEqual(round0.result.type, 'ryukyoku')
    assert.strictEqual(round0.result.summaryKo, '유국 (구종구패)')
    assert.deepStrictEqual(round0.result.deltaScores, [0, 0, 0, 0])
    const lastActionRound0 = round0.actions[round0.actions.length - 1]
    assert.ok(lastActionRound0 !== undefined)
    assert.strictEqual(lastActionRound0.type, 'ryukyoku')
    assert.strictEqual(lastActionRound0.seat, 0)

    // Round 1: 사풍연타 (type 2)
    const round1 = parsed.detail.rounds[1]
    assert.ok(round1 !== undefined)
    assert.ok(round1.result !== undefined)
    assert.strictEqual(round1.result.type, 'ryukyoku')
    assert.strictEqual(round1.result.summaryKo, '유국 (사풍연타)')
    assert.deepStrictEqual(round1.result.deltaScores, [0, 0, 0, 0])
    const lastActionRound1 = round1.actions[round1.actions.length - 1]
    assert.ok(lastActionRound1 !== undefined)
    assert.strictEqual(lastActionRound1.type, 'ryukyoku')
})

test('PaipuParser - Parse game with RecordLiuJu (사간산, 사가리치, and fallback)', () => {
    const parser = new PaipuParser()
    const buildGame = (liujuType?: number): MajsoulGameRecord => ({
        uuid: `test-liuju-${liujuType ?? 'fallback'}`,
        roomType: '동풍전',
        timestamp: 1690000000,
        players: [
            { accountId: 10001, nickname: 'PlayerA', seat: 0, level: 1 },
            { accountId: 10002, nickname: 'PlayerB', seat: 1, level: 1 },
            { accountId: 10003, nickname: 'PlayerC', seat: 2, level: 1 },
            { accountId: 10004, nickname: 'PlayerD', seat: 3, level: 1 }
        ],
        rounds: [
            {
                header: {
                    type: 'RecordNewRound',
                    chang: 0,
                    ju: 0,
                    ben: 0,
                    liqi: 0,
                    scores: [25000, 25000, 25000, 25000],
                    dora: '1m',
                    hands: [[], [], [], []]
                },
                actions: [
                    {
                        type: 'RecordLiuJu',
                        ...(liujuType !== undefined ? { liujuType } : {})
                    }
                ]
            }
        ]
    })

    const parsedType3 = parser.parseGameRecord(buildGame(3))
    assert.strictEqual(parsedType3.detail.rounds[0]?.result?.summaryKo, '유국 (사간산)')

    const parsedType4 = parser.parseGameRecord(buildGame(4))
    assert.strictEqual(parsedType4.detail.rounds[0]?.result?.summaryKo, '유국 (사가리치)')

    const parsedType5 = parser.parseGameRecord(buildGame(5))
    assert.strictEqual(parsedType5.detail.rounds[0]?.result?.summaryKo, '유국 (삼가화료)')

    const parsedFallback = parser.parseGameRecord(buildGame(undefined))
    assert.strictEqual(parsedFallback.detail.rounds[0]?.result?.summaryKo, '유국 (중도유국)')
})

test('PaipuParser - Parse 3P (Sanma) game with RecordLiuJu produces 3-element deltaScores', () => {
    const parser = new PaipuParser()
    const sanmaGame: MajsoulGameRecord = {
        uuid: 'test-sanma-liuju-001',
        roomType: '3인 남풍전',
        timestamp: 1690000000,
        players: [
            { accountId: 10001, nickname: 'PlayerA', seat: 0, level: 1 },
            { accountId: 10002, nickname: 'PlayerB', seat: 1, level: 1 },
            { accountId: 10003, nickname: 'PlayerC', seat: 2, level: 1 }
        ],
        rounds: [
            {
                header: {
                    type: 'RecordNewRound',
                    chang: 0,
                    ju: 0,
                    ben: 0,
                    liqi: 0,
                    scores: [35000, 35000, 35000, 0],
                    dora: '1m',
                    hands: [
                        ['1m', '9m', '1p', '9p', '1s', '9s', '1z', '2z', '3z', '4z', '5z', '6z', '7z'],
                        ['2m', '3m', '4m', '5m', '6m', '7m', '8m', '2p', '3p', '4p', '2s', '3s', '4s'],
                        ['2m', '3m', '4m', '5m', '6m', '7m', '8m', '2p', '3p', '4p', '2s', '3s', '4s'],
                        []
                    ]
                },
                actions: [
                    {
                        type: 'RecordLiuJu',
                        liujuType: 1,
                        seat: 0
                    }
                ]
            }
        ]
    }

    const parsed = parser.parseGameRecord(sanmaGame)
    const round0 = parsed.detail.rounds[0]
    assert.ok(round0 !== undefined)
    assert.ok(round0.result !== undefined)
    assert.strictEqual(round0.result.type, 'ryukyoku')
    assert.strictEqual(round0.result.summaryKo, '유국 (구종구패)')
    assert.deepStrictEqual(round0.result.deltaScores, [0, 0, 0])
    assert.strictEqual(round0.result.deltaScores?.length, 3)
})

