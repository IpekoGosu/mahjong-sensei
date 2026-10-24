import {
    StyleDiagnosis,
    StyleEvaluationInput,
    TiltDiagnosisResult,
    TiltEvaluationInput,
    TiltSymptom,
    TiltSeverity,
    TiltMetricsComparison
} from '@mahjong-sensei/types'

export class StyleEvaluator {
    public static readonly DEFAULT_3P_BASELINE: TiltMetricsComparison = {
        avgWinScore: 8200,
        badWaitRiichiRate: 22.0,
        halfHeartedDealInRate: 9.0,
        doraDischargeRate: 14.0,
        earlyFuroRate: 22.0
    }

    public static readonly DEFAULT_4P_BASELINE: TiltMetricsComparison = {
        avgWinScore: 6800,
        badWaitRiichiRate: 20.0,
        halfHeartedDealInRate: 8.5,
        doraDischargeRate: 12.0,
        earlyFuroRate: 28.0
    }

    /*_ GEMINI THINKING _*/
    public diagnoseTilt(input: TiltEvaluationInput): TiltDiagnosisResult {
        const symptom1 = this.evaluateDoraNeglectSymptom(input.baseline, input.recent)
        const symptom2 = this.evaluateBadWaitRiichiSymptom(input.baseline, input.recent)
        const symptom3 = this.evaluateHalfHeartedMawashiuchiSymptom(input.baseline, input.recent)

        const symptoms: readonly TiltSymptom[] = [symptom1, symptom2, symptom3]
        const detectedCount = symptoms.filter((s) => s.detected).length

        const scoreDropPercent = Math.max(0, -symptom1.delta)
        const badWaitExcess = Math.max(0, symptom2.delta - 10)
        const dealInExcess = Math.max(0, symptom3.delta - 6)

        let tiltScore = 15
        let severity: TiltSeverity = 'NORMAL'
        let isTilt = false

        if (detectedCount === 3) {
            tiltScore = Math.min(100, Math.max(85, Math.round(88 + (scoreDropPercent * 0.2) + (badWaitExcess * 0.4) + (dealInExcess * 0.5))))
            severity = 'CRITICAL'
            isTilt = true
        } else if (detectedCount === 2) {
            tiltScore = Math.min(84, Math.max(65, Math.round(68 + (scoreDropPercent * 0.2) + (badWaitExcess * 0.3) + (dealInExcess * 0.4))))
            severity = 'WARNING'
            isTilt = true
        } else if (detectedCount === 1) {
            tiltScore = Math.min(64, Math.max(40, Math.round(45 + (scoreDropPercent * 0.15) + (badWaitExcess * 0.3) + (dealInExcess * 0.3))))
            severity = 'CAUTION'
            isTilt = false
        }

        const title = this.determineTiltTitle(severity)
        const summary = this.buildTiltSummary(severity, symptoms)
        const advice = this.buildTiltAdvice(severity, symptoms)

        return {
            isTilt,
            tiltScore,
            severity,
            title,
            summary,
            advice,
            symptoms
        }
    }

    /*_ GEMINI THINKING _*/
    protected evaluateDoraNeglectSymptom(
        baseline: TiltMetricsComparison,
        recent: TiltMetricsComparison
    ): TiltSymptom {
        const scoreDrop = baseline.avgWinScore - recent.avgWinScore
        const dropPercent = baseline.avgWinScore > 0 ? (scoreDrop / baseline.avgWinScore) * 100 : 0
        const doraDelta = (recent.doraDischargeRate !== undefined && baseline.doraDischargeRate !== undefined)
            ? (recent.doraDischargeRate - baseline.doraDischargeRate)
            : 0

        const detected = dropPercent >= 15.0 || scoreDrop >= 1500 || doraDelta >= 15.0
        const delta = -Number(dropPercent.toFixed(1))

        const description = detected
            ? `조급함으로 인한 도라 조기 방출과 역 없는 울기로 평균 화료 타점이 평소(${Math.round(baseline.avgWinScore).toLocaleString()}점) 대비 ${Math.round(recent.avgWinScore).toLocaleString()}점으로 급감(-${Math.round(dropPercent)}%)했습니다.`
            : `평균 화료 타점이 ${Math.round(recent.avgWinScore).toLocaleString()}점으로 평소 수준을 안정적으로 유지하고 있습니다.`

        return {
            type: 'DORA_NEGLECT',
            label: '타점 빈곤화 (도라 방출/저화료 울기)',
            detected,
            baselineValue: baseline.avgWinScore,
            recentValue: recent.avgWinScore,
            delta,
            description
        }
    }

    /*_ GEMINI THINKING _*/
    protected evaluateBadWaitRiichiSymptom(
        baseline: TiltMetricsComparison,
        recent: TiltMetricsComparison
    ): TiltSymptom {
        const badWaitDelta = recent.badWaitRiichiRate - baseline.badWaitRiichiRate
        const detected = badWaitDelta >= 10.0 || recent.badWaitRiichiRate >= 38.0
        const delta = Number(badWaitDelta.toFixed(1))

        const description = detected
            ? `간짱/변짱/샤보 등 우형 대기에서의 선제 리치 비율이 평소(${baseline.badWaitRiichiRate.toFixed(1)}%) 대비 ${recent.badWaitRiichiRate.toFixed(1)}%로 비정상 증가(+${badWaitDelta.toFixed(1)}%p)했습니다.`
            : `우형 리치 비율이 ${recent.badWaitRiichiRate.toFixed(1)}%로 정석적인 양면 이상 대기 비율을 유지하고 있습니다.`

        return {
            type: 'BAD_WAIT_RIICHI',
            label: '우형 리치 급증 (간짱/변짱/샤보 선제)',
            detected,
            baselineValue: baseline.badWaitRiichiRate,
            recentValue: recent.badWaitRiichiRate,
            delta,
            description
        }
    }

    /*_ GEMINI THINKING _*/
    protected evaluateHalfHeartedMawashiuchiSymptom(
        baseline: TiltMetricsComparison,
        recent: TiltMetricsComparison
    ): TiltSymptom {
        const dealInDelta = recent.halfHeartedDealInRate - baseline.halfHeartedDealInRate
        const detected = dealInDelta >= 6.0 || recent.halfHeartedDealInRate >= 16.0
        const delta = Number(dealInDelta.toFixed(1))

        const description = detected
            ? `상대 공세 시 완전한 베타오리 대신 애매한 스지·원현물 타패(어설픈 돌리기)로 방총되는 비율이 평소(${baseline.halfHeartedDealInRate.toFixed(1)}%) 대비 ${recent.halfHeartedDealInRate.toFixed(1)}%로 급증(+${dealInDelta.toFixed(1)}%p)했습니다.`
            : `상대 공세 시 철저한 현물 위주 수비를 구사하여 어설픈 돌리기로 인한 방총을 억제하고 있습니다.`

        return {
            type: 'HALF_HEARTED_MAWASHIUCHI',
            label: '어설픈 돌리기 방총 (스지/원현물 승부)',
            detected,
            baselineValue: baseline.halfHeartedDealInRate,
            recentValue: recent.halfHeartedDealInRate,
            delta,
            description
        }
    }

    /*_ GEMINI THINKING _*/
    protected determineTiltTitle(severity: TiltSeverity): string {
        switch (severity) {
            case 'CRITICAL':
                return '치명적 멘탈 틸트 (대국 중단 강력 권장)'
            case 'WARNING':
                return '경고: 틸트 징후 감지 (페이스 조절 필요)'
            case 'CAUTION':
                return '주의: 부분적 멘탈 흔들림'
            case 'NORMAL':
                return '안정적인 멘탈 상태'
        }
    }

    /*_ GEMINI THINKING _*/
    protected buildTiltSummary(severity: TiltSeverity, symptoms: readonly TiltSymptom[]): string {
        const detectedLabels = symptoms.filter((s) => s.detected).map((s) => s.label.split(' (')[0] ?? s.label)

        switch (severity) {
            case 'CRITICAL':
                return `타점 빈곤화, 우형 리치 남발, 어설픈 돌리기 3대 징후가 모두 감지된 심각한 슬럼프 국면입니다. 조급한 심리로 인해 작혼 A- 평점 뒤에서 치명적인 레이팅 누수가 발생하고 있습니다.`
            case 'WARNING':
                return `최근 슬럼프 구간에서 주요 틸트 징후(${detectedLabels.join(', ')})가 뚜렷하게 관측되었습니다. 조급한 타패 판단이 누적되어 승률과 연대율을 악화시키고 있습니다.`
            case 'CAUTION':
                return `평소 베이스라인 대비 ${detectedLabels.join(', ')} 지표에서 조급한 성향이 감지되었습니다. 아직 전면적인 틸트는 아니지만 슬럼프 전이를 경계해야 합니다.`
            case 'NORMAL':
                return '베이스라인 수준의 침착한 타패와 공수 밸런스를 견고하게 유지하고 있습니다. 틸트 징후가 발견되지 않았습니다.'
        }
    }

    /*_ GEMINI THINKING _*/
    protected buildTiltAdvice(severity: TiltSeverity, symptoms: readonly TiltSymptom[]): string {
        const detected = symptoms.filter((s) => s.detected)

        switch (severity) {
            case 'CRITICAL':
                return '지금 즉시 랭크 대국을 중단하고 최소 30분 이상의 쿨다운 휴식을 가지세요. 복귀 시에는 양면 타츠 중심의 멘젠 조패와 100% 현물 베타오리 기본기에만 집중해야 합니다.'
            case 'WARNING': {
                const hasBadWait = detected.some((s) => s.type === 'BAD_WAIT_RIICHI')
                const hasHalfHearted = detected.some((s) => s.type === 'HALF_HEARTED_MAWASHIUCHI')
                if (hasBadWait && hasHalfHearted) {
                    return '공격 시에는 우형 리치를 지양하고 양면 타츠와 도라를 살리는 조패에 집중하며, 수비 시에는 어설픈 스지 밀기 대신 현물 안전패를 내며 호흡을 가다듬으세요.'
                }
                return '공격 시에는 도라와 고타점을 의식한 정석 조패로 복귀하고, 상대 리치 선언 시에는 어설픈 스지 밀기 대신 현물 안전패를 내며 호흡을 가다듬으세요.'
            }
            case 'CAUTION':
                return '1~2국 정도 차분하게 멘젠으로 패를 모으며 평정심을 유지하세요.'
            case 'NORMAL':
                return '현재의 훌륭한 멘탈 밸런스와 침착한 타패를 계속 유지하세요.'
        }
    }

    /*_ GEMINI THINKING _*/
    public evaluateStyle(input: StyleEvaluationInput): StyleDiagnosis {
        const is3P = input.gameMode === '3p'
        const attackType = this.determineAttackType(input, is3P)
        const defenseType = this.determineDefenseType(input, is3P)
        const title = this.determineTitle(attackType, defenseType, input, is3P)
        const description = this.buildDescription(input, attackType, defenseType)
        const luckRemark = this.determineLuckRemark(input.uradoraRate, is3P)
        const skillRemark = this.determineSkillRemark(input.dealInRate, is3P)

        return {
            title,
            description,
            attackType,
            defenseType,
            luckRemark,
            skillRemark
        }
    }

    /*_ GEMINI THINKING _*/
    protected determineAttackType(input: StyleEvaluationInput, is3P: boolean): string {
        const damatenThreshold = is3P ? 16 : 18
        const furoHighThreshold = is3P ? 32 : 35
        const furoLowThreshold = is3P ? 26 : 28

        if (input.damatenRate >= damatenThreshold && input.damatenRate > 0) {
            return '카운터 다마텐'
        }

        if (input.furoRate >= furoHighThreshold) {
            return '속공 후로'
        }

        if (input.furoRate <= furoLowThreshold && (input.riichiRate >= (is3P ? 22 : 20) || input.initiativeRate >= 78)) {
            return '단단한 멘젠 선제'
        }

        if (input.initiativeRate >= 80) {
            return '초선제 속공'
        }

        if (input.riichiRate >= (is3P ? 25 : 22)) {
            return '강력한 리치 공세'
        }

        return '정석 밸런스'
    }

    /*_ GEMINI THINKING _*/
    protected determineDefenseType(input: StyleEvaluationInput, is3P: boolean): string {
        const ironThreshold = is3P ? 14.0 : 11.5
        const stableThreshold = is3P ? 16.0 : 13.5
        const aggressiveThreshold = is3P ? 18.0 : 15.5

        if (input.dealInRate <= ironThreshold) {
            return '철벽 수비'
        }

        if (input.dealInRate <= stableThreshold) {
            return '안정 수비'
        }

        if (input.dealInRate <= aggressiveThreshold) {
            return '공격 지향'
        }

        return '난타전 승부'
    }

    /*_ GEMINI THINKING _*/
    protected determineTitle(
        attackType: string,
        defenseType: string,
        input: StyleEvaluationInput,
        is3P: boolean
    ): string {
        if (attackType === '카운터 다마텐' && defenseType === '철벽 수비') {
            return '카운터 다마텐 & 철벽 수비'
        }

        if (attackType === '단단한 멘젠 선제') {
            return '단단한 멘젠 선제형'
        }

        if (attackType === '속공 후로') {
            return '속공 후로 어태커'
        }

        const winThreshold = is3P ? 28 : 22
        if (defenseType === '철벽 수비' && input.winRate >= winThreshold) {
            return '공수겸비 밸런서'
        }

        if (attackType === '초선제 속공') {
            return '초선제 속공형'
        }

        if (attackType === '강력한 리치 공세') {
            return '강력한 리치 공세형'
        }

        return `${attackType} & ${defenseType}`
    }

    /*_ GEMINI THINKING _*/
    protected buildDescription(
        input: StyleEvaluationInput,
        attackType: string,
        defenseType: string
    ): string {
        if (attackType === '카운터 다마텐') {
            if (input.negativeRate !== undefined && input.negativeRate > 0) {
                return `다마텐율 ${input.damatenRate}%와 선제율 ${input.initiativeRate}%로 상대를 침착하게 공략하며, 들통율이 ${input.negativeRate}%에 불과합니다.`
            }
            return `다마텐율 ${input.damatenRate}%와 선제율 ${input.initiativeRate}%로 상대를 침착하게 공략하며, 방총율 ${input.dealInRate}%의 견고한 수비를 유지합니다.`
        }

        if (attackType === '단단한 멘젠 선제') {
            if (input.topTwoRate !== undefined && input.topTwoRate > 0) {
                return `후로율 ${input.furoRate}%와 선제 리치율 ${input.initiativeRate}%의 강한 공격력으로 연대율 ${input.topTwoRate}%를 견인하고 있습니다.`
            }
            return `후로율 ${input.furoRate}%와 선제 리치율 ${input.initiativeRate}%의 강력한 멘젠 타력으로 화료율 ${input.winRate}%를 이끌어내고 있습니다.`
        }

        if (attackType === '속공 후로') {
            return `후로율 ${input.furoRate}%의 기민한 울기로 화료율 ${input.winRate}%를 기록하며 신속하게 국을 주도합니다.`
        }

        if (defenseType === '철벽 수비') {
            return `방총율 ${input.dealInRate}%의 철벽 수비와 선제율 ${input.initiativeRate}%의 날카로운 공세로 안정적인 경기 운영을 펼치고 있습니다.`
        }

        return `선제율 ${input.initiativeRate}%와 화료율 ${input.winRate}%를 바탕으로 방총율 ${input.dealInRate}%를 제어하는 균형 잡힌 플레이를 펼치고 있습니다.`
    }

    /*_ GEMINI THINKING _*/
    protected determineLuckRemark(uradoraRate: number, is3P: boolean): string {
        if (is3P) {
            if (uradoraRate >= 40.0) {
                return '도라 편중 호조'
            }
            if (uradoraRate >= 32.0) {
                return '우라도라 호조'
            }
            if (uradoraRate >= 24.0) {
                return '정직한 승부'
            }
            return '도라 불운'
        }

        if (uradoraRate >= 32.0) {
            return '도라 편중 호조'
        }
        if (uradoraRate >= 26.0) {
            return '정직한 승부'
        }
        if (uradoraRate >= 20.0) {
            return '평균적 운세'
        }
        return '도라 불운'
    }

    /*_ GEMINI THINKING _*/
    protected determineSkillRemark(dealInRate: number, is3P: boolean): string {
        if (is3P) {
            if (dealInRate <= 14.0) {
                return '3마 상위 5% 철벽 수비'
            }
            if (dealInRate <= 15.5) {
                return '3마 상위 15% 방총 제어'
            }
            if (dealInRate <= 17.5) {
                return '공격 지향 수비'
            }
            return '방총 제어 주의'
        }

        if (dealInRate <= 11.5) {
            return '상위 5% 철벽 수비'
        }
        if (dealInRate <= 13.0) {
            return '상위 15% 방총 제어'
        }
        if (dealInRate <= 15.0) {
            return '공격 지향 수비'
        }
        return '방총 제어 주의'
    }
}
