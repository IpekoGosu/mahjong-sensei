import test from 'node:test'
import assert from 'node:assert'
import { ShantenCalculator } from './shanten'
import { TileConverter } from './tiles'

class MockShantenCalculator extends ShantenCalculator {
    public testCountPartials(counts: readonly number[], is3P: boolean = false): number {
        return this.countPartials(counts, is3P)
    }

    public testSearchMelds(
        counts: number[],
        index: number,
        pairs: number,
        melds: number,
        state: { bestShanten: number },
        is3P: boolean = false,
        meldCount: number = 0,
        originalCounts?: readonly number[],
        headIndex: number = -1
    ): void {
        this.searchMelds(counts, index, pairs, melds, state, is3P, meldCount, originalCounts, headIndex)
    }
}

test('MockShantenCalculator - countPartials on overlapping shapes', () => {
    const mock = new MockShantenCalculator()

    // 1m 2m 2m 4m should extract 2 partials ([1m, 2m] + [2m, 4m]), not 1 partial ([2m, 2m])
    const counts1224m = TileConverter.handToCountArray(['1m', '2m', '2m', '4m'])
    const partials1224m = mock.testCountPartials(counts1224m)
    assert.strictEqual(partials1224m, 2)

    // 2p 3p 3p 4p 4p 5p should extract 3 partials ([2p, 3p] + [3p, 4p] + [4p, 5p])
    const counts233445p = TileConverter.handToCountArray(['2p', '3p', '3p', '4p', '4p', '5p'])
    const partials233445p = mock.testCountPartials(counts233445p)
    assert.strictEqual(partials233445p, 3)
})

test('ShantenCalculator - 1m 2m 2m 4m hand shanten evaluation', () => {
    const calc = new ShantenCalculator()

    // Hand with 1m 2m 2m 4m + 2 melds + 1 pair + 1 isolated tile: 1-shanten
    // 2 melds (567p, 234s) + 1 pair (99s) + 2 partials from 1224m = 5 blocks -> 1-shanten
    const handWith2Melds = [
        '1m', '2m', '2m', '4m',
        '5p', '6p', '7p',
        '2s', '3s', '4s',
        '9s', '9s',
        '7z'
    ]
    assert.strictEqual(calc.calculate(handWith2Melds), 1)

    // Hand with 1m 2m 2m 4m + 3 melds (2 in hand + 1 open meld) + 1 pair: 0-shanten (tenpai)
    const handWith3Melds = [
        '1m', '2m', '2m', '4m',
        '5p', '6p', '7p',
        '2s', '3s', '4s',
        '9s', '9s'
    ]
    assert.strictEqual(calc.calculate(handWith3Melds, false, 1), 0)
})

test('ShantenCalculator - 4 identical tiles phantom 5th-tile tanki prevention', () => {
    const calc = new ShantenCalculator()

    // 1m 1m 1m 1m 2p 3p 4p 2s 3s 4s 5z 5z 5z (13 tiles)
    // 1m triplet + 234p seq + 234s seq + 5z triplet = 4 melds
    // Remaining tile is 1m, but all 4 copies of 1m are exhausted in hand.
    // Cannot wait on a 5th copy of 1m for tanki head, so cannot be 0-shanten (tenpai).
    // Must be 1-shanten, and cannot be -1 agari.
    const phantomHand = [
        '1m', '1m', '1m', '1m',
        '2p', '3p', '4p',
        '2s', '3s', '4s',
        '5z', '5z', '5z'
    ]
    const shanten = calc.calculate(phantomHand)
    assert.strictEqual(shanten, 1)
    assert.notStrictEqual(shanten, 0)
    assert.notStrictEqual(shanten, -1)

    // Hand with 4 identical tiles as 2 pairs without another head candidate
    // e.g. 1m 1m 1m 1m 2p 3p 4p 2s 3s 4s 7z
    const fourIdenticalNoHead = [
        '1m', '1m', '1m', '1m',
        '2p', '3p', '4p',
        '2s', '3s', '4s',
        '7z'
    ]
    const shantenNoHead = calc.calculate(fourIdenticalNoHead)
    assert.ok(shantenNoHead >= 1)
})
