import { StyleDiagnosis, StyleEvaluationInput } from '@mahjong-sensei/types'

export class StyleEvaluator {
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
