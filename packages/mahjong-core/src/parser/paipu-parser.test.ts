import test from 'node:test'
import assert from 'node:assert'
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
    const player0 = result.detail.players.find((p) => p.accountId === 10001)
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
})
