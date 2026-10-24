import test from 'node:test'
import assert from 'node:assert'
import { PlayerSummary } from '@mahjong-sensei/types'
import { PaipuParser } from './paipu-parser'
import { SAMPLE_MAJSOUL_GAME } from '../sample-data/sample-paipu'
import { MajsoulGameRecord } from './types'

test('PaipuParser - Parse sample game and compute round metrics and final scores', () => {
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
    assert.strictEqual(player0.finalScore, 36000) // 37000 - 1000 (noten penalty in round 1)
    assert.ok(player0.luckScore > 50)  // Good luck hand (1-shanten starting hand + tsumo)

    // Check player 1 (tenpai in round 1: 21000 + 3000 = 24000)
    const player1 = result.detail.players.find((p: PlayerSummary) => p.accountId === 10002)
    assert.ok(player1 !== undefined)
    assert.strictEqual(player1.seat, 1)
    assert.strictEqual(player1.rank, 2)
    assert.strictEqual(player1.finalScore, 24000)

    // Check player 2 (noten: 21000 - 1000 = 20000, tied with player 3, wins tie-break)
    const player2 = result.detail.players.find((p: PlayerSummary) => p.accountId === 10003)
    assert.ok(player2 !== undefined)
    assert.strictEqual(player2.seat, 2)
    assert.strictEqual(player2.rank, 3)
    assert.strictEqual(player2.finalScore, 20000)

    // Check player 3 (noten: 21000 - 1000 = 20000, loses tie-break to seat 2)
    const player3 = result.detail.players.find((p: PlayerSummary) => p.accountId === 10004)
    assert.ok(player3 !== undefined)
    assert.strictEqual(player3.seat, 3)
    assert.strictEqual(player3.rank, 4)
    assert.strictEqual(player3.finalScore, 20000)

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

test('PaipuParser - All-Last comeback Ron win accurately flips final scores and ranks', () => {
    const parser = new PaipuParser()
    const gameRecord: MajsoulGameRecord = {
        uuid: 'test-all-last-ron',
        roomType: '옥탁 동풍전 (Jade East)',
        timestamp: 1722510000000,
        players: [
            { accountId: 10001, nickname: 'EastDealer', seat: 0, level: 3 },
            { accountId: 10002, nickname: 'SouthChallenger', seat: 1, level: 4 },
            { accountId: 10003, nickname: 'WestPlayer', seat: 2, level: 3 },
            { accountId: 10004, nickname: 'NorthPlayer', seat: 3, level: 5 }
        ],
        rounds: [
            {
                header: {
                    type: 'RecordNewRound',
                    chang: 0,
                    ju: 3,
                    ben: 0,
                    liqi: 0,
                    scores: [30000, 26000, 24000, 20000],
                    dora: '1m',
                    hands: [
                        ['1m', '2m', '3m', '4m', '5m', '6m', '7m', '8m', '9m', '1p', '2p', '3p', '4p'],
                        ['2m', '3m', '4m', '2p', '3p', '4p', '2s', '3s', '4s', '5s', '5s', '7s', '8s'],
                        ['1s', '2s', '3s', '4s', '5s', '6s', '7s', '8s', '9s', '1z', '2z', '3z', '4z'],
                        ['1z', '2z', '3z', '4z', '5z', '6z', '7z', '1m', '2m', '3m', '4m', '5m', '6m']
                    ]
                },
                actions: [
                    { type: 'RecordDealTile', seat: 0, tile: '9s' },
                    { type: 'RecordDiscardTile', seat: 0, tile: '9s', isMoqie: true, isLiqi: false },
                    {
                        type: 'RecordHule',
                        hules: [
                            {
                                seat: 1,
                                deltaScores: [-8000, 8000, 0, 0],
                                handScore: 8000,
                                fan: 4,
                                fu: 30,
                                yaku: ['탕야오', '도라 3']
                            }
                        ]
                    }
                ]
            }
        ]
    }

    const result = parser.parseGameRecord(gameRecord)
    const p0 = result.detail.players.find((p) => p.seat === 0)
    const p1 = result.detail.players.find((p) => p.seat === 1)
    const p2 = result.detail.players.find((p) => p.seat === 2)
    const p3 = result.detail.players.find((p) => p.seat === 3)

    assert.ok(p0 !== undefined && p1 !== undefined && p2 !== undefined && p3 !== undefined)

    // Seat 1: 26000 + 8000 = 34000 -> 1st place (comeback victory!)
    assert.strictEqual(p1.finalScore, 34000)
    assert.strictEqual(p1.rank, 1)

    // Seat 2: 24000 -> 2nd place (moves up from 3rd to 2nd)
    assert.strictEqual(p2.finalScore, 24000)
    assert.strictEqual(p2.rank, 2)

    // Seat 0: 30000 - 8000 = 22000 -> 3rd place (drops from 1st to 3rd)
    assert.strictEqual(p0.finalScore, 22000)
    assert.strictEqual(p0.rank, 3)

    // Seat 3: 20000 -> 4th place
    assert.strictEqual(p3.finalScore, 20000)
    assert.strictEqual(p3.rank, 4)
})

test('PaipuParser - All-Last comeback Tsumo win accurately distributes losses and updates ranks', () => {
    const parser = new PaipuParser()
    const gameRecord: MajsoulGameRecord = {
        uuid: 'test-all-last-tsumo',
        roomType: '옥탁 동풍전 (Jade East)',
        timestamp: 1722510000000,
        players: [
            { accountId: 10001, nickname: 'EastDealer', seat: 0, level: 3 },
            { accountId: 10002, nickname: 'SouthPlayer', seat: 1, level: 3 },
            { accountId: 10003, nickname: 'WestChallenger', seat: 2, level: 4 },
            { accountId: 10004, nickname: 'NorthPlayer', seat: 3, level: 5 }
        ],
        rounds: [
            {
                header: {
                    type: 'RecordNewRound',
                    chang: 0,
                    ju: 3,
                    ben: 0,
                    liqi: 0,
                    scores: [32000, 22000, 28000, 18000],
                    dora: '1p',
                    hands: [
                        ['1m', '2m', '3m', '4m', '5m', '6m', '7m', '8m', '9m', '1p', '2p', '3p', '4p'],
                        ['1p', '2p', '3p', '4p', '5p', '6p', '7p', '8p', '9p', '1s', '2s', '3s', '4s'],
                        ['1s', '2s', '3s', '4s', '5s', '6s', '7s', '8s', '9s', '1z', '1z', '2z', '2z'],
                        ['1z', '2z', '3z', '4z', '5z', '6z', '7z', '1m', '2m', '3m', '4m', '5m', '6m']
                    ]
                },
                actions: [
                    { type: 'RecordDealTile', seat: 2, tile: '2z' },
                    {
                        type: 'RecordHule',
                        hules: [
                            {
                                seat: 2,
                                deltaScores: [-4000, -2000, 8000, -2000],
                                handScore: 8000,
                                fan: 4,
                                fu: 30,
                                yaku: ['멘젠쯔모', '자풍 서', '도라 2']
                            }
                        ]
                    }
                ]
            }
        ]
    }

    const result = parser.parseGameRecord(gameRecord)
    const p0 = result.detail.players.find((p) => p.seat === 0)
    const p1 = result.detail.players.find((p) => p.seat === 1)
    const p2 = result.detail.players.find((p) => p.seat === 2)
    const p3 = result.detail.players.find((p) => p.seat === 3)

    assert.ok(p0 !== undefined && p1 !== undefined && p2 !== undefined && p3 !== undefined)

    // Seat 2: 28000 + 8000 = 36000 -> 1st place (comeback victory!)
    assert.strictEqual(p2.finalScore, 36000)
    assert.strictEqual(p2.rank, 1)

    // Seat 0: 32000 - 4000 = 28000 -> 2nd place (dealer pays 4000)
    assert.strictEqual(p0.finalScore, 28000)
    assert.strictEqual(p0.rank, 2)

    // Seat 1: 22000 - 2000 = 20000 -> 3rd place
    assert.strictEqual(p1.finalScore, 20000)
    assert.strictEqual(p1.rank, 3)

    // Seat 3: 18000 - 2000 = 16000 -> 4th place
    assert.strictEqual(p3.finalScore, 16000)
    assert.strictEqual(p3.rank, 4)
})

test('PaipuParser - All-Last Ryuukyoku Tenpai payments flip 1st place and break ties by seat order', () => {
    const parser = new PaipuParser()
    const gameRecord: MajsoulGameRecord = {
        uuid: 'test-all-last-ryukyoku',
        roomType: '옥탁 동풍전 (Jade East)',
        timestamp: 1722510000000,
        players: [
            { accountId: 10001, nickname: 'Seat0East', seat: 0, level: 3 },
            { accountId: 10002, nickname: 'Seat1South', seat: 1, level: 4 },
            { accountId: 10003, nickname: 'Seat2West', seat: 2, level: 3 },
            { accountId: 10004, nickname: 'Seat3North', seat: 3, level: 5 }
        ],
        rounds: [
            {
                header: {
                    type: 'RecordNewRound',
                    chang: 0,
                    ju: 3,
                    ben: 0,
                    liqi: 0,
                    scores: [26000, 25000, 25000, 24000],
                    dora: '9m',
                    hands: [
                        ['1m', '2m', '3m', '4m', '5m', '6m', '7m', '8m', '9m', '1p', '2p', '3p', '4p'],
                        ['1p', '2p', '3p', '4p', '5p', '6p', '7p', '8p', '9p', '1s', '2s', '3s', '4s'],
                        ['1s', '2s', '3s', '4s', '5s', '6s', '7s', '8s', '9s', '1z', '2z', '3z', '4z'],
                        ['1z', '2z', '3z', '4z', '5z', '6z', '7z', '1m', '2m', '3m', '4m', '5m', '6m']
                    ]
                },
                actions: [
                    {
                        type: 'RecordNoTile',
                        tenpaiSeats: [3],
                        deltaScores: [-1000, -1000, -1000, 3000]
                    }
                ]
            }
        ]
    }

    const result = parser.parseGameRecord(gameRecord)
    const p0 = result.detail.players.find((p) => p.seat === 0)
    const p1 = result.detail.players.find((p) => p.seat === 1)
    const p2 = result.detail.players.find((p) => p.seat === 2)
    const p3 = result.detail.players.find((p) => p.seat === 3)

    assert.ok(p0 !== undefined && p1 !== undefined && p2 !== undefined && p3 !== undefined)

    // Seat 3: 24000 + 3000 = 27000 -> 1st place (single tenpai comeback from 4th!)
    assert.strictEqual(p3.finalScore, 27000)
    assert.strictEqual(p3.rank, 1)

    // Seat 0: 26000 - 1000 = 25000 -> 2nd place
    assert.strictEqual(p0.finalScore, 25000)
    assert.strictEqual(p0.rank, 2)

    // Seat 1: 25000 - 1000 = 24000 (tied with Seat 2, wins tie-break: South > West)
    assert.strictEqual(p1.finalScore, 24000)
    assert.strictEqual(p1.rank, 3)

    // Seat 2: 25000 - 1000 = 24000 (tied with Seat 1, loses tie-break: South > West)
    assert.strictEqual(p2.finalScore, 24000)
    assert.strictEqual(p2.rank, 4)
})

test('PaipuParser - Tie-break strictly enforces initial seat order East > South > West > North', () => {
    const parser = new PaipuParser()
    const gameRecord: MajsoulGameRecord = {
        uuid: 'test-all-tied',
        roomType: '옥탁 동풍전 (Jade East)',
        timestamp: 1722510000000,
        players: [
            { accountId: 10001, nickname: 'Seat0East', seat: 0, level: 3 },
            { accountId: 10002, nickname: 'Seat1South', seat: 1, level: 4 },
            { accountId: 10003, nickname: 'Seat2West', seat: 2, level: 3 },
            { accountId: 10004, nickname: 'Seat3North', seat: 3, level: 5 }
        ],
        rounds: [
            {
                header: {
                    type: 'RecordNewRound',
                    chang: 0,
                    ju: 3,
                    ben: 0,
                    liqi: 0,
                    scores: [25000, 25000, 25000, 25000],
                    dora: '5p',
                    hands: [
                        ['1m', '2m', '3m', '4m', '5m', '6m', '7m', '8m', '9m', '1p', '2p', '3p', '4p'],
                        ['1p', '2p', '3p', '4p', '5p', '6p', '7p', '8p', '9p', '1s', '2s', '3s', '4s'],
                        ['1s', '2s', '3s', '4s', '5s', '6s', '7s', '8s', '9s', '1z', '2z', '3z', '4z'],
                        ['1z', '2z', '3z', '4z', '5z', '6z', '7z', '1m', '2m', '3m', '4m', '5m', '6m']
                    ]
                },
                actions: [
                    {
                        type: 'RecordNoTile',
                        tenpaiSeats: [],
                        deltaScores: [0, 0, 0, 0]
                    }
                ]
            }
        ]
    }

    const result = parser.parseGameRecord(gameRecord)
    const p0 = result.detail.players.find((p) => p.seat === 0)
    const p1 = result.detail.players.find((p) => p.seat === 1)
    const p2 = result.detail.players.find((p) => p.seat === 2)
    const p3 = result.detail.players.find((p) => p.seat === 3)

    assert.ok(p0 !== undefined && p1 !== undefined && p2 !== undefined && p3 !== undefined)

    // All players have 25000 points. Rank must follow seat index 0 > 1 > 2 > 3
    assert.strictEqual(p0.finalScore, 25000)
    assert.strictEqual(p0.rank, 1)

    assert.strictEqual(p1.finalScore, 25000)
    assert.strictEqual(p1.rank, 2)

    assert.strictEqual(p2.finalScore, 25000)
    assert.strictEqual(p2.rank, 3)

    assert.strictEqual(p3.finalScore, 25000)
    assert.strictEqual(p3.rank, 4)
})

test('PaipuParser - All-Last Double Ron sums deltaScores and applies tie-break', () => {
    const parser = new PaipuParser()
    const gameRecord: MajsoulGameRecord = {
        uuid: 'test-all-last-double-ron',
        roomType: '옥탁 동풍전 (Jade East)',
        timestamp: 1722510000000,
        players: [
            { accountId: 10001, nickname: 'Seat0East', seat: 0, level: 3 },
            { accountId: 10002, nickname: 'Seat1South', seat: 1, level: 4 },
            { accountId: 10003, nickname: 'Seat2West', seat: 2, level: 3 },
            { accountId: 10004, nickname: 'Seat3North', seat: 3, level: 5 }
        ],
        rounds: [
            {
                header: {
                    type: 'RecordNewRound',
                    chang: 0,
                    ju: 3,
                    ben: 0,
                    liqi: 0,
                    scores: [30000, 23000, 24000, 23000],
                    dora: '5s',
                    hands: [
                        ['1m', '2m', '3m', '4m', '5m', '6m', '7m', '8m', '9m', '1p', '2p', '3p', '4p'],
                        ['1p', '2p', '3p', '4p', '5p', '6p', '7p', '8p', '9p', '1s', '2s', '3s', '4s'],
                        ['1s', '2s', '3s', '4s', '5s', '6s', '7s', '8s', '9s', '1z', '2z', '3z', '4z'],
                        ['1z', '2z', '3z', '4z', '5z', '6z', '7z', '1m', '2m', '3m', '4m', '5m', '6m']
                    ]
                },
                actions: [
                    { type: 'RecordDealTile', seat: 0, tile: '5m' },
                    { type: 'RecordDiscardTile', seat: 0, tile: '5m', isMoqie: true, isLiqi: false },
                    {
                        type: 'RecordHule',
                        hules: [
                            {
                                seat: 1,
                                deltaScores: [-8000, 8000, 0, 0],
                                handScore: 8000,
                                fan: 4,
                                fu: 30,
                                yaku: ['핑후', '도라 3']
                            },
                            {
                                seat: 3,
                                deltaScores: [-8000, 0, 0, 8000],
                                handScore: 8000,
                                fan: 4,
                                fu: 30,
                                yaku: ['탕야오', '도라 3']
                            }
                        ]
                    }
                ]
            }
        ]
    }

    const result = parser.parseGameRecord(gameRecord)
    const p0 = result.detail.players.find((p) => p.seat === 0)
    const p1 = result.detail.players.find((p) => p.seat === 1)
    const p2 = result.detail.players.find((p) => p.seat === 2)
    const p3 = result.detail.players.find((p) => p.seat === 3)

    assert.ok(p0 !== undefined && p1 !== undefined && p2 !== undefined && p3 !== undefined)

    // Seat 0 pays 8000 to Seat 1 and 8000 to Seat 3: 30000 - 16000 = 14000 -> 4th place
    assert.strictEqual(p0.finalScore, 14000)
    assert.strictEqual(p0.rank, 4)

    // Seat 1: 23000 + 8000 = 31000 (tied with Seat 3, South > North tie-break -> 1st place)
    assert.strictEqual(p1.finalScore, 31000)
    assert.strictEqual(p1.rank, 1)

    // Seat 3: 23000 + 8000 = 31000 (tied with Seat 1, South > North tie-break -> 2nd place)
    assert.strictEqual(p3.finalScore, 31000)
    assert.strictEqual(p3.rank, 2)

    // Seat 2: 24000 -> 3rd place
    assert.strictEqual(p2.finalScore, 24000)
    assert.strictEqual(p2.rank, 3)
})

test('PaipuParser - 3-Player (Sanma) All-Last tie-breaking and score delta calculation', () => {
    const parser = new PaipuParser()
    const gameRecord: MajsoulGameRecord = {
        uuid: 'test-sanma-all-last',
        roomType: '옥탁 3인 남풍전 (Jade 3P South)',
        timestamp: 1722510000000,
        players: [
            { accountId: 10001, nickname: 'SanmaEast', seat: 0, level: 3 },
            { accountId: 10002, nickname: 'SanmaSouth', seat: 1, level: 4 },
            { accountId: 10003, nickname: 'SanmaWest', seat: 2, level: 3 }
        ],
        rounds: [
            {
                header: {
                    type: 'RecordNewRound',
                    chang: 1,
                    ju: 2,
                    ben: 0,
                    liqi: 0,
                    scores: [35000, 35000, 35000, 0],
                    dora: '1p',
                    hands: [
                        ['1p', '2p', '3p', '4p', '5p', '6p', '7p', '8p', '9p', '1s', '2s', '3s', '4s'],
                        ['1s', '2s', '3s', '4s', '5s', '6s', '7s', '8s', '9s', '1z', '2z', '3z', '4z'],
                        ['1z', '2z', '3z', '4z', '5z', '6z', '7z', '1p', '2p', '3p', '4p', '5p', '6p'],
                        []
                    ]
                },
                actions: [
                    {
                        type: 'RecordNoTile',
                        tenpaiSeats: [0, 1],
                        deltaScores: [1000, 1000, -2000, 0]
                    }
                ]
            }
        ]
    }

    const result = parser.parseGameRecord(gameRecord)
    assert.strictEqual(result.detail.players.length, 3)

    const p0 = result.detail.players.find((p) => p.seat === 0)
    const p1 = result.detail.players.find((p) => p.seat === 1)
    const p2 = result.detail.players.find((p) => p.seat === 2)

    assert.ok(p0 !== undefined && p1 !== undefined && p2 !== undefined)

    // Seat 0: 35000 + 1000 = 36000 (tied with Seat 1, East > South tie-break -> 1st place)
    assert.strictEqual(p0.finalScore, 36000)
    assert.strictEqual(p0.rank, 1)

    // Seat 1: 35000 + 1000 = 36000 (tied with Seat 0, East > South tie-break -> 2nd place)
    assert.strictEqual(p1.finalScore, 36000)
    assert.strictEqual(p1.rank, 2)

    // Seat 2: 35000 - 2000 = 33000 -> 3rd place (last place in 3P)
    assert.strictEqual(p2.finalScore, 33000)
    assert.strictEqual(p2.rank, 3)
})
