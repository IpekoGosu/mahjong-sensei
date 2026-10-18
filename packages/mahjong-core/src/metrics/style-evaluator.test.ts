/*_ GEMINI THINKING _*/
import test from 'node:test'
import assert from 'node:assert'
import { StyleEvaluationInput } from '@mahjong-sensei/types'
import { StyleEvaluator } from './style-evaluator'

class MockStyleEvaluator extends StyleEvaluator {
    public testDetermineAttackType(input: StyleEvaluationInput, is3P: boolean): string {
        return this.determineAttackType(input, is3P)
    }

    public testDetermineDefenseType(input: StyleEvaluationInput, is3P: boolean): string {
        return this.determineDefenseType(input, is3P)
    }

    public testDetermineTitle(attack: string, defense: string, input: StyleEvaluationInput, is3P: boolean): string {
        return this.determineTitle(attack, defense, input, is3P)
    }

    public testBuildDescription(input: StyleEvaluationInput, attack: string, defense: string): string {
        return this.buildDescription(input, attack, defense)
    }

    public testDetermineLuckRemark(uradoraRate: number, is3P: boolean): string {
        return this.determineLuckRemark(uradoraRate, is3P)
    }

    public testDetermineSkillRemark(dealInRate: number, is3P: boolean): string {
        return this.determineSkillRemark(dealInRate, is3P)
    }
}

test('StyleEvaluator - Evaluate 3P Counter Damaten & Ironclad Defense Profile', () => {
    const evaluator = new StyleEvaluator()
    const input: StyleEvaluationInput = {
        gameMode: '3p',
        winRate: 29.3,
        dealInRate: 13.8,
        riichiRate: 25.0,
        furoRate: 23.1,
        damatenRate: 19.2,
        initiativeRate: 81.0,
        uradoraRate: 43.2,
        negativeRate: 3.7,
        averageRank: 2.21,
        topTwoRate: 58.5,
        averageLuckScore: 43.5,
        averageSkillScore: 52.0
    }

    const result = evaluator.evaluateStyle(input)

    assert.strictEqual(result.title, '카운터 다마텐 & 철벽 수비')
    assert.strictEqual(result.attackType, '카운터 다마텐')
    assert.strictEqual(result.defenseType, '철벽 수비')
    assert.strictEqual(result.luckRemark, '도라 편중 호조')
    assert.strictEqual(result.skillRemark, '3마 상위 5% 철벽 수비')
    assert.strictEqual(
        result.description,
        '다마텐율 19.2%와 선제율 81%로 상대를 침착하게 공략하며, 들통율이 3.7%에 불과합니다.'
    )
})

test('StyleEvaluator - Evaluate 4P Menzen Initiative Profile', () => {
    const evaluator = new StyleEvaluator()
    const input: StyleEvaluationInput = {
        gameMode: '4p',
        winRate: 22.0,
        dealInRate: 12.2,
        riichiRate: 22.5,
        furoRate: 27.6,
        damatenRate: 14.5,
        initiativeRate: 85.0,
        uradoraRate: 27.8,
        negativeRate: 8.7,
        averageRank: 2.38,
        topTwoRate: 56.0,
        averageLuckScore: 48.5,
        averageSkillScore: 68.0
    }

    const result = evaluator.evaluateStyle(input)

    assert.strictEqual(result.title, '단단한 멘젠 선제형')
    assert.strictEqual(result.attackType, '단단한 멘젠 선제')
    assert.strictEqual(result.defenseType, '안정 수비')
    assert.strictEqual(result.luckRemark, '정직한 승부')
    assert.strictEqual(result.skillRemark, '상위 15% 방총 제어')
    assert.strictEqual(
        result.description,
        '후로율 27.6%와 선제 리치율 85%의 강한 공격력으로 연대율 56%를 견인하고 있습니다.'
    )
})

test('StyleEvaluator - Evaluate Speed Caller (Furo) Attacker Profile', () => {
    const evaluator = new StyleEvaluator()
    const input: StyleEvaluationInput = {
        gameMode: '4p',
        winRate: 24.5,
        dealInRate: 14.0,
        riichiRate: 14.0,
        furoRate: 38.5,
        damatenRate: 8.0,
        initiativeRate: 72.0,
        uradoraRate: 22.0
    }

    const result = evaluator.evaluateStyle(input)

    assert.strictEqual(result.title, '속공 후로 어태커')
    assert.strictEqual(result.attackType, '속공 후로')
    assert.strictEqual(result.defenseType, '공격 지향')
    assert.ok(result.description.includes('후로율 38.5%'))
})

test('StyleEvaluator - Protected methods testing via MockStyleEvaluator', () => {
    const mock = new MockStyleEvaluator()

    const input3P: StyleEvaluationInput = {
        gameMode: '3p',
        winRate: 30.0,
        dealInRate: 12.5,
        riichiRate: 26.0,
        furoRate: 20.0,
        damatenRate: 10.0,
        initiativeRate: 82.0,
        uradoraRate: 35.0
    }

    const attack = mock.testDetermineAttackType(input3P, true)
    assert.strictEqual(attack, '단단한 멘젠 선제')

    const defense = mock.testDetermineDefenseType(input3P, true)
    assert.strictEqual(defense, '철벽 수비')

    const luckRemark3P = mock.testDetermineLuckRemark(42.0, true)
    assert.strictEqual(luckRemark3P, '도라 편중 호조')

    const luckRemarkUnlucky = mock.testDetermineLuckRemark(15.0, true)
    assert.strictEqual(luckRemarkUnlucky, '도라 불운')

    const skillRemark4P = mock.testDetermineSkillRemark(10.5, false)
    assert.strictEqual(skillRemark4P, '상위 5% 철벽 수비')

    const skillRemarkAggressive = mock.testDetermineSkillRemark(16.5, false)
    assert.strictEqual(skillRemarkAggressive, '방총 제어 주의')
})
