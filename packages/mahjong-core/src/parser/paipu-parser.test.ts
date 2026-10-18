import test from 'node:test'
import assert from 'node:assert'
import { PlayerSummary } from '@mahjong-sensei/types'
import { PaipuParser } from './paipu-parser'
import { SAMPLE_MAJSOUL_GAME } from '../sample-data/sample-paipu'

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

