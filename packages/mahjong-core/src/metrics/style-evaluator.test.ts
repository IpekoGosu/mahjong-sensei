/*_ GEMINI THINKING _*/
import test from 'node:test'
import assert from 'node:assert'
import {
    StyleEvaluationInput,
    TiltEvaluationInput,
    TiltMetricsComparison,
    TiltSymptom,
    TiltSeverity
} from '@mahjong-sensei/types'
import { StyleEvaluator } from './style-evaluator'

class MockStyleEvaluator extends StyleEvaluator {
    public testEvaluateDoraNeglectSymptom(baseline: TiltMetricsComparison, recent: TiltMetricsComparison): TiltSymptom {
        return this.evaluateDoraNeglectSymptom(baseline, recent)
    }

    public testEvaluateBadWaitRiichiSymptom(baseline: TiltMetricsComparison, recent: TiltMetricsComparison): TiltSymptom {
        return this.evaluateBadWaitRiichiSymptom(baseline, recent)
    }

    public testEvaluateHalfHeartedMawashiuchiSymptom(baseline: TiltMetricsComparison, recent: TiltMetricsComparison): TiltSymptom {
        return this.evaluateHalfHeartedMawashiuchiSymptom(baseline, recent)
    }

    public testDetermineTiltTitle(severity: TiltSeverity): string {
        return this.determineTiltTitle(severity)
    }

    public testBuildTiltSummary(severity: TiltSeverity, symptoms: readonly TiltSymptom[]): string {
        return this.buildTiltSummary(severity, symptoms)
    }

    public testBuildTiltAdvice(severity: TiltSeverity, symptoms: readonly TiltSymptom[]): string {
        return this.buildTiltAdvice(severity, symptoms)
    }

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

test('StyleEvaluator - diagnoseTilt: Critical tilt detected when all 3 symptoms trigger in slump', () => {
    const evaluator = new StyleEvaluator()

    const input: TiltEvaluationInput = {
        baseline: {
            avgWinScore: 8200,
            badWaitRiichiRate: 20.0,
            halfHeartedDealInRate: 8.0,
            doraDischargeRate: 12.0
        },
        recent: {
            avgWinScore: 5400, // Drop > 34% (Symptom 1: Dora Neglect / Low Han)
            badWaitRiichiRate: 42.0, // Increase +22%p (Symptom 2: Bad Wait Riichi)
            halfHeartedDealInRate: 18.5, // Increase +10.5%p (Symptom 3: Half-hearted Mawashiuchi)
            doraDischargeRate: 32.0
        },
        slumpGameCount: 100,
        gameMode: '3p'
    }

    const diagnosis = evaluator.diagnoseTilt(input)

    assert.strictEqual(diagnosis.isTilt, true)
    assert.strictEqual(diagnosis.severity, 'CRITICAL')
    assert.ok(diagnosis.tiltScore >= 85)
    assert.strictEqual(diagnosis.title, '치명적 멘탈 틸트 (대국 중단 강력 권장)')
    assert.ok(diagnosis.summary.includes('타점 빈곤화'))
    assert.ok(diagnosis.summary.includes('우형 리치 남발'))
    assert.ok(diagnosis.summary.includes('어설픈 돌리기'))
    assert.ok(diagnosis.advice.includes('지금 즉시 랭크 대국을 중단'))

    const symptom1 = diagnosis.symptoms.find((s) => s.type === 'DORA_NEGLECT')
    const symptom2 = diagnosis.symptoms.find((s) => s.type === 'BAD_WAIT_RIICHI')
    const symptom3 = diagnosis.symptoms.find((s) => s.type === 'HALF_HEARTED_MAWASHIUCHI')

    assert.ok(symptom1 && symptom1.detected)
    assert.ok(symptom2 && symptom2.detected)
    assert.ok(symptom3 && symptom3.detected)
    assert.ok(symptom1.description.includes('급감'))
    assert.ok(symptom2.description.includes('우형 대기'))
    assert.ok(symptom3.description.includes('어설픈 돌리기'))
})

test('StyleEvaluator - diagnoseTilt: Warning tilt detected with 2 symptoms', () => {
    const evaluator = new StyleEvaluator()

    const input: TiltEvaluationInput = {
        baseline: StyleEvaluator.DEFAULT_4P_BASELINE,
        recent: {
            avgWinScore: 5000, // Drop > 26% (Triggered)
            badWaitRiichiRate: 36.0, // Increase +16%p (Triggered)
            halfHeartedDealInRate: 9.0 // Normal (+0.5%p, not triggered)
        },
        slumpGameCount: 50,
        gameMode: '4p'
    }

    const diagnosis = evaluator.diagnoseTilt(input)

    assert.strictEqual(diagnosis.isTilt, true)
    assert.strictEqual(diagnosis.severity, 'WARNING')
    assert.ok(diagnosis.tiltScore >= 65 && diagnosis.tiltScore < 85)
    assert.strictEqual(diagnosis.title, '경고: 틸트 징후 감지 (페이스 조절 필요)')
    assert.ok(diagnosis.summary.includes('타점 빈곤화'))
    assert.ok(diagnosis.summary.includes('우형 리치 급증'))
})

test('StyleEvaluator - diagnoseTilt: Caution state with 1 symptom', () => {
    const evaluator = new StyleEvaluator()

    const input: TiltEvaluationInput = {
        baseline: StyleEvaluator.DEFAULT_3P_BASELINE,
        recent: {
            avgWinScore: 8100, // Normal
            badWaitRiichiRate: 39.0, // Bad Wait triggered (>= 38%)
            halfHeartedDealInRate: 9.5 // Normal
        },
        slumpGameCount: 30,
        gameMode: '3p'
    }

    const diagnosis = evaluator.diagnoseTilt(input)

    assert.strictEqual(diagnosis.isTilt, false)
    assert.strictEqual(diagnosis.severity, 'CAUTION')
    assert.ok(diagnosis.tiltScore >= 40 && diagnosis.tiltScore < 65)
    assert.strictEqual(diagnosis.title, '주의: 부분적 멘탈 흔들림')
})

test('StyleEvaluator - diagnoseTilt: Normal mental state when baseline is maintained', () => {
    const evaluator = new StyleEvaluator()

    const input: TiltEvaluationInput = {
        baseline: StyleEvaluator.DEFAULT_3P_BASELINE,
        recent: {
            avgWinScore: 8400,
            badWaitRiichiRate: 19.5,
            halfHeartedDealInRate: 8.5
        },
        slumpGameCount: 100,
        gameMode: '3p'
    }

    const diagnosis = evaluator.diagnoseTilt(input)

    assert.strictEqual(diagnosis.isTilt, false)
    assert.strictEqual(diagnosis.severity, 'NORMAL')
    assert.strictEqual(diagnosis.tiltScore, 15)
    assert.strictEqual(diagnosis.title, '안정적인 멘탈 상태')
    assert.strictEqual(diagnosis.symptoms.every((s) => !s.detected), true)
})
