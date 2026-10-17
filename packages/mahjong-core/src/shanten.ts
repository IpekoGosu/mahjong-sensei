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

        let i = 0
        while (i < TILE_COUNT) {
            if (is3P && i >= 1 && i <= 7) {
                i++
                continue
            }
            const count = counts[i] ?? 0
            if (count >= 2) {
                pairs++
            }
            if (count >= 1) {
                kinds++
            }
            i++
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
        let i = 0
        while (i < TILE_COUNT) {
            // In 3P mode, manzu tiles 2m..8m (indices 1..7) do not exist and cannot form pairs
            if (is3P && i >= 1 && i <= 7) {
                i++
                continue
            }
            const count = countsCopy[i] ?? 0
            if (count >= 2) {
                countsCopy[i] = count - 2
                this.searchMelds(countsCopy, 0, 1, 0, state, is3P, meldCount, counts, i)
                countsCopy[i] = count
            }
            i++
        }

        // Try without a pair
        this.searchMelds(countsCopy, 0, 0, 0, state, is3P, meldCount, counts, -1)

        return state.bestShanten
    }

    protected searchMelds(
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
        /*_ GEMINI THINKING _*/
        // Skip tiles with 0 count
        while (index < TILE_COUNT && (counts[index] ?? 0) === 0) {
            index++
        }

        if (index >= TILE_COUNT) {
            this.searchPartials(
                counts,
                0,
                pairs,
                melds,
                0,
                state,
                is3P,
                meldCount,
                originalCounts ?? counts,
                headIndex
            )
            return
        }

        const count = counts[index] ?? 0

        // 1. Try Koutsu (Triplet) - in 3P mode, 2m-8m cannot form triplets, only 1m and 9m
        const canFormTriplet = !is3P || !(index >= 1 && index <= 7)
        if (canFormTriplet && count >= 3) {
            counts[index] = count - 3
            this.searchMelds(counts, index, pairs, melds + 1, state, is3P, meldCount, originalCounts, headIndex)
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
                this.searchMelds(counts, index, pairs, melds + 1, state, is3P, meldCount, originalCounts, headIndex)
                counts[index] = count
                counts[index + 1] = next1
                counts[index + 2] = next2
            }
        }

        // 3. Skip current tile without forming a full meld
        this.searchMelds(counts, index + 1, pairs, melds, state, is3P, meldCount, originalCounts, headIndex)
    }

    protected searchPartials(
        counts: number[],
        index: number,
        pairs: number,
        melds: number,
        partials: number,
        state: { bestShanten: number },
        is3P: boolean,
        meldCount: number,
        originalCounts: readonly number[],
        headIndex: number
    ): void {
        /*_ GEMINI THINKING _*/
        while (index < TILE_COUNT && (counts[index] ?? 0) === 0) {
            index++
        }

        if (index >= TILE_COUNT) {
            const effectiveMelds = Math.min(4, melds + meldCount)
            let totalMelds = effectiveMelds + partials
            if (totalMelds > 4) {
                totalMelds = 4
            }
            let currentShanten = 8 - (effectiveMelds * 2) - (totalMelds - effectiveMelds) - pairs

            // Bug 2: 4 identical tiles phantom 5th-tile tanki head bug
            // When pairs === 0 and effectiveMelds + partials >= 4, the hand requires a tanki wait for the head.
            // Verify there is at least one remaining unused tile in hand that is NOT exhausted (originalCount < 4).
            if (pairs === 0 && effectiveMelds + partials >= 4) {
                let hasValidTankiCandidate = false
                let i = 0
                while (i < TILE_COUNT) {
                    if ((counts[i] ?? 0) > 0 && (originalCounts[i] ?? 0) < 4) {
                        hasValidTankiCandidate = true
                        break
                    }
                    i++
                }
                if (!hasValidTankiCandidate) {
                    currentShanten++
                }
            }

            if (currentShanten < state.bestShanten) {
                state.bestShanten = currentShanten
            }
            return
        }

        const count = counts[index] ?? 0

        // 1. Try pair partial
        // In 3P mode, 2m-8m cannot form pairs
        const canFormPair = !is3P || !(index >= 1 && index <= 7)
        const notHeadPair = !(pairs > 0 && headIndex === index)
        if (canFormPair && notHeadPair && count >= 2) {
            counts[index] = count - 2
            this.searchPartials(counts, index + 1, pairs, melds, partials + 1, state, is3P, meldCount, originalCounts, headIndex)
            counts[index] = count
        }

        // 2. Try Ryanmen / Penchan [index, index + 1]
        const suitOffset = index % 9
        const isSuited = is3P ? (index >= 9 && index < 27) : (index < 27)
        if (isSuited && suitOffset <= 7) {
            const next1 = counts[index + 1] ?? 0
            if (count >= 1 && next1 >= 1) {
                counts[index] = count - 1
                counts[index + 1] = next1 - 1
                this.searchPartials(counts, index, pairs, melds, partials + 1, state, is3P, meldCount, originalCounts, headIndex)
                counts[index] = count
                counts[index + 1] = next1
            }
        }

        // 3. Try Kanchan [index, index + 2]
        if (isSuited && suitOffset <= 6) {
            const next2 = counts[index + 2] ?? 0
            if (count >= 1 && next2 >= 1) {
                counts[index] = count - 1
                counts[index + 2] = next2 - 1
                this.searchPartials(counts, index, pairs, melds, partials + 1, state, is3P, meldCount, originalCounts, headIndex)
                counts[index] = count
                counts[index + 2] = next2
            }
        }

        // 4. Skip index
        this.searchPartials(counts, index + 1, pairs, melds, partials, state, is3P, meldCount, originalCounts, headIndex)
    }

    protected countPartials(counts: readonly number[], is3P: boolean = false): number {
        /*_ GEMINI THINKING _*/
        const copy = [...counts]
        const state = { maxPartials: 0 }
        this.backtrackCountPartials(copy, 0, 0, state, is3P)
        return state.maxPartials
    }

    protected backtrackCountPartials(
        counts: number[],
        index: number,
        currentPartials: number,
        state: { maxPartials: number },
        is3P: boolean
    ): void {
        while (index < TILE_COUNT && (counts[index] ?? 0) === 0) {
            index++
        }

        if (index >= TILE_COUNT) {
            if (currentPartials > state.maxPartials) {
                state.maxPartials = currentPartials
            }
            return
        }

        const count = counts[index] ?? 0

        // 1. Try pair
        const canFormPair = !is3P || !(index >= 1 && index <= 7)
        if (canFormPair && count >= 2) {
            counts[index] = count - 2
            this.backtrackCountPartials(counts, index + 1, currentPartials + 1, state, is3P)
            counts[index] = count
        }

        // 2. Try ryanmen / penchan
        const suitOffset = index % 9
        const isSuited = is3P ? (index >= 9 && index < 27) : (index < 27)
        if (isSuited && suitOffset <= 7) {
            const next1 = counts[index + 1] ?? 0
            if (count >= 1 && next1 >= 1) {
                counts[index] = count - 1
                counts[index + 1] = next1 - 1
                this.backtrackCountPartials(counts, index, currentPartials + 1, state, is3P)
                counts[index] = count
                counts[index + 1] = next1
            }
        }

        // 3. Try kanchan
        if (isSuited && suitOffset <= 6) {
            const next2 = counts[index + 2] ?? 0
            if (count >= 1 && next2 >= 1) {
                counts[index] = count - 1
                counts[index + 2] = next2 - 1
                this.backtrackCountPartials(counts, index, currentPartials + 1, state, is3P)
                counts[index] = count
                counts[index + 2] = next2
            }
        }

        // 4. Skip index
        this.backtrackCountPartials(counts, index + 1, currentPartials, state, is3P)
    }
}
