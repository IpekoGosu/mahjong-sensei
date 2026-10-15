import { TileConverter, TILE_COUNT } from './tiles'

const YAOJUU_INDICES: readonly number[] = [
    0, 8,   // 1m, 9m
    9, 17,  // 1p, 9p
    18, 26, // 1s, 9s
    27, 28, 29, 30, 31, 32, 33 // 1z ~ 7z
]

export class ShantenCalculator {
    private bestShanten: number = 8

    public calculate(tiles: readonly string[]): number {
        const counts = TileConverter.handToCountArray(tiles)
        const regular = this.calculateRegular(counts)
        const chitoi = this.calculateChitoitsu(counts)
        const kokushi = this.calculateKokushi(counts)

        return Math.min(regular, chitoi, kokushi)
    }

    public calculateChitoitsu(counts: readonly number[]): number {
        let pairs = 0
        let kinds = 0

        for (let i = 0; i < TILE_COUNT; i++) {
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

    public calculateRegular(counts: readonly number[]): number {
        const countsCopy = [...counts]
        this.bestShanten = 8

        // Try using each tile as the pair (head)
        for (let i = 0; i < TILE_COUNT; i++) {
            const count = countsCopy[i] ?? 0
            if (count >= 2) {
                countsCopy[i] = count - 2
                this.searchMelds(countsCopy, 0, 1, 0)
                countsCopy[i] = count
            }
        }

        // Try without a pair
        this.searchMelds(countsCopy, 0, 0, 0)

        return this.bestShanten
    }

    private searchMelds(
        counts: number[],
        index: number,
        pairs: number,
        melds: number
    ): void {
        /*_ GEMINI THINKING _*/
        // Skip tiles with 0 count
        while (index < TILE_COUNT && (counts[index] ?? 0) === 0) {
            index++
        }

        if (index >= TILE_COUNT) {
            // Count remaining partial melds (taatsu)
            const partials = this.countPartials(counts)
            let totalMelds = melds + partials
            if (totalMelds > 4) {
                totalMelds = 4
            }
            const currentShanten = 8 - (melds * 2) - (totalMelds - melds) - pairs
            if (currentShanten < this.bestShanten) {
                this.bestShanten = currentShanten
            }
            return
        }

        const count = counts[index] ?? 0

        // 1. Try Koutsu (Triplet)
        if (count >= 3) {
            counts[index] = count - 3
            this.searchMelds(counts, index, pairs, melds + 1)
            counts[index] = count
        }

        // 2. Try Shuntsu (Sequence) - only suited tiles (0..26) and not wrapping around suits
        const suitOffset = index % 9
        const isSuited = index < 27
        if (isSuited && suitOffset <= 6) {
            const next1 = counts[index + 1] ?? 0
            const next2 = counts[index + 2] ?? 0
            if (count >= 1 && next1 >= 1 && next2 >= 1) {
                counts[index] = count - 1
                counts[index + 1] = next1 - 1
                counts[index + 2] = next2 - 1
                this.searchMelds(counts, index, pairs, melds + 1)
                counts[index] = count
                counts[index + 1] = next1
                counts[index + 2] = next2
            }
        }

        // 3. Skip current tile without forming a full meld
        this.searchMelds(counts, index + 1, pairs, melds)
    }

    private countPartials(counts: readonly number[]): number {
        let partials = 0
        const copy = [...counts]

        // Pairs
        for (let i = 0; i < TILE_COUNT; i++) {
            const c = copy[i] ?? 0
            if (c >= 2) {
                partials++
                copy[i] = c - 2
            }
        }

        // Sequences of 2 (penchan, ryanmen, kanchan)
        for (let i = 0; i < 27; i++) {
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
