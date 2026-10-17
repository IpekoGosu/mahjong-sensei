import { TileConverter, TILE_COUNT } from './tiles'

const YAOJUU_INDICES: readonly number[] = [
    0, 8,   // 1m, 9m
    9, 17,  // 1p, 9p
    18, 26, // 1s, 9s
    27, 28, 29, 30, 31, 32, 33 // 1z ~ 7z
]

export class ShantenCalculator {
    public calculate(tiles: readonly string[], is3P: boolean = false, meldCount: number = 0): number {
        const counts = TileConverter.handToCountArray(tiles)
        const regular = this.calculateRegular(counts, is3P, meldCount)
        if (meldCount > 0) {
            return regular
        }
        const chitoi = this.calculateChitoitsu(counts, is3P)
        const kokushi = this.calculateKokushi(counts)

        return Math.min(regular, chitoi, kokushi)
    }

    public calculateChitoitsu(counts: readonly number[], is3P: boolean = false): number {
        /*_ GEMINI THINKING _*/
        let pairs = 0
        let kinds = 0

        for (let i = 0; i < TILE_COUNT; i++) {
            if (is3P && i >= 1 && i <= 7) {
                continue
            }
            const count = counts[i] ?? 0
            if (count >= 2) {
                pairs++
            }
            if (count >= 1) {
                kinds++
            }
        }

        let shanten = 6 - pairs
        if (kinds < 7) {
            shanten += 7 - kinds
        }
        return shanten
    }

    public calculateKokushi(counts: readonly number[]): number {
        let uniqueYaojuu = 0
        let hasYaojuuPair = false

        for (const index of YAOJUU_INDICES) {
            const count = counts[index] ?? 0
            if (count >= 1) {
                uniqueYaojuu++
            }
            if (count >= 2) {
                hasYaojuuPair = true
            }
        }

        return 13 - uniqueYaojuu - (hasYaojuuPair ? 1 : 0)
    }

    public calculateRegular(counts: readonly number[], is3P: boolean = false, meldCount: number = 0): number {
        /*_ GEMINI THINKING _*/
        const countsCopy = [...counts]
        const state = { bestShanten: 8 }

        // Try using each tile as the pair (head)
        for (let i = 0; i < TILE_COUNT; i++) {
            // In 3P mode, manzu tiles 2m..8m (indices 1..7) do not exist and cannot form pairs
            if (is3P && i >= 1 && i <= 7) {
                continue
            }
            const count = countsCopy[i] ?? 0
            if (count >= 2) {
                countsCopy[i] = count - 2
                this.searchMelds(countsCopy, 0, 1, 0, state, is3P, meldCount)
                countsCopy[i] = count
            }
        }

        // Try without a pair
        this.searchMelds(countsCopy, 0, 0, 0, state, is3P, meldCount)

        return state.bestShanten
    }

    private searchMelds(
        counts: number[],
        index: number,
        pairs: number,
        melds: number,
        state: { bestShanten: number },
        is3P: boolean = false,
        meldCount: number = 0
    ): void {
        /*_ GEMINI THINKING _*/
        // Skip tiles with 0 count
        while (index < TILE_COUNT && (counts[index] ?? 0) === 0) {
            index++
        }

        if (index >= TILE_COUNT) {
            // Count remaining partial melds (taatsu)
            const partials = this.countPartials(counts, is3P)
            const effectiveMelds = Math.min(4, melds + meldCount)
            let totalMelds = effectiveMelds + partials
            if (totalMelds > 4) {
                totalMelds = 4
            }
            const currentShanten = 8 - (effectiveMelds * 2) - (totalMelds - effectiveMelds) - pairs
            if (currentShanten < state.bestShanten) {
                state.bestShanten = currentShanten
            }
            return
        }

        const count = counts[index] ?? 0

        // 1. Try Koutsu (Triplet) - in 3P mode, 2m-8m cannot form triplets, only 1m and 9m
        const canFormTriplet = !is3P || !(index >= 1 && index <= 7)
        if (canFormTriplet && count >= 3) {
            counts[index] = count - 3
            this.searchMelds(counts, index, pairs, melds + 1, state, is3P, meldCount)
            counts[index] = count
        }

        // 2. Try Shuntsu (Sequence) - in 3P mode, manzu tiles (0..8) cannot form sequences
        const suitOffset = index % 9
        const isSuited = is3P ? (index >= 9 && index < 27) : (index < 27)
        if (isSuited && suitOffset <= 6) {
            const next1 = counts[index + 1] ?? 0
            const next2 = counts[index + 2] ?? 0
            if (count >= 1 && next1 >= 1 && next2 >= 1) {
                counts[index] = count - 1
                counts[index + 1] = next1 - 1
                counts[index + 2] = next2 - 1
                this.searchMelds(counts, index, pairs, melds + 1, state, is3P, meldCount)
                counts[index] = count
                counts[index + 1] = next1
                counts[index + 2] = next2
            }
        }

        // 3. Skip current tile without forming a full meld
        this.searchMelds(counts, index + 1, pairs, melds, state, is3P, meldCount)
    }

    private countPartials(counts: readonly number[], is3P: boolean = false): number {
        /*_ GEMINI THINKING _*/
        let partials = 0
        const copy = [...counts]

        // Pairs - in 3P mode, 2m-8m cannot form pairs
        for (let i = 0; i < TILE_COUNT; i++) {
            if (is3P && i >= 1 && i <= 7) {
                continue
            }
            const c = copy[i] ?? 0
            if (c >= 2) {
                partials++
                copy[i] = c - 2
            }
        }

        // Sequences of 2 (penchan, ryanmen, kanchan) - in 3P mode, manzu (0..8) cannot form partial sequences
        const startSuit = is3P ? 9 : 0
        for (let i = startSuit; i < 27; i++) {
            const suitOffset = i % 9
            const c0 = copy[i] ?? 0
            if (c0 > 0 && suitOffset <= 7) {
                const c1 = copy[i + 1] ?? 0
                if (c1 > 0) {
                    partials++
                    copy[i] = c0 - 1
                    copy[i + 1] = c1 - 1
                    continue
                }
            }
            if (c0 > 0 && suitOffset <= 6) {
                const c2 = copy[i + 2] ?? 0
                if (c2 > 0) {
                    partials++
                    copy[i] = c0 - 1
                    copy[i + 2] = c2 - 1
                }
            }
        }

        return partials
    }
}
