'use client'

/*_ GEMINI THINKING _*/
import React from 'react'
import { TiltDiagnosisResult, TiltSeverity } from '@mahjong-sensei/types'
import { Flame, ShieldAlert, AlertTriangle, CheckCircle, Activity, Sparkles } from 'lucide-react'

export interface TiltAlertWidgetProps {
    readonly tiltDiagnosis?: TiltDiagnosisResult | undefined
    readonly variant?: 'dashboard' | 'modal'
}

export const TiltAlertWidget: React.FC<TiltAlertWidgetProps> = ({
    tiltDiagnosis,
    variant = 'dashboard'
}) => {
    if (!tiltDiagnosis) {
        return null
    }

    const { isTilt, tiltScore, severity, title, summary, advice, symptoms } = tiltDiagnosis

    const formattedSymptoms = React.useMemo(() => {
        return symptoms.map((symptom) => {
            const bracketIndex = symptom.label.indexOf(' (')
            const displayTitle = bracketIndex !== -1 ? symptom.label.slice(0, bracketIndex) : symptom.label
            return {
                ...symptom,
                displayTitle
            }
        })
    }, [symptoms])

    const getSeverityStyles = (sev: TiltSeverity): {
        readonly containerClass: string
        readonly badgeClass: string
        readonly badgeText: string
        readonly barClass: string
        readonly iconColor: string
    } => {
        switch (sev) {
            case 'CRITICAL':
                return {
                    containerClass: 'bg-rose-950/40 border-rose-500/40 text-rose-200',
                    badgeClass: 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse',
                    badgeText: '🚨 치명적 틸트 (대국 중단 권장)',
                    barClass: 'bg-gradient-to-r from-orange-500 to-rose-500',
                    iconColor: 'text-rose-400'
                }
            case 'WARNING':
                return {
                    containerClass: 'bg-amber-950/30 border-amber-500/40 text-amber-200',
                    badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
                    badgeText: '⚠️ 틸트 경고 (페이스 조절 필요)',
                    barClass: 'bg-gradient-to-r from-yellow-500 to-amber-500',
                    iconColor: 'text-amber-400'
                }
            case 'CAUTION':
                return {
                    containerClass: 'bg-yellow-950/20 border-yellow-500/30 text-yellow-200',
                    badgeClass: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
                    badgeText: '⚡ 부분적 멘탈 흔들림',
                    barClass: 'bg-yellow-500',
                    iconColor: 'text-yellow-400'
                }
            case 'NORMAL':
                return {
                    containerClass: 'bg-emerald-950/20 border-emerald-500/30 text-emerald-200',
                    badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
                    badgeText: '🛡️ 멘탈 안정 (틸트 없음)',
                    barClass: 'bg-emerald-500',
                    iconColor: 'text-emerald-400'
                }
        }
    }

    const styles = getSeverityStyles(severity)

    return (
        <div className={`rounded-2xl border p-5 transition-all shadow-lg ${styles.containerClass} ${variant === 'modal' ? 'mt-3 mb-2' : ''}`}>
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2.5">
                    {isTilt ? (
                        <Flame className={`w-5 h-5 ${styles.iconColor} animate-bounce`} />
                    ) : (
                        <Activity className={`w-5 h-5 ${styles.iconColor}`} />
                    )}
                    <h3 className="font-bold text-white text-base flex items-center gap-2">
                        <span>틸트 위험도 경고</span>
                        <span className="text-xs text-slate-400 font-normal">(Tilt Alert Engine)</span>
                    </h3>
                </div>

                <div className="flex items-center gap-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold border ${styles.badgeClass}`}>
                        {styles.badgeText}
                    </span>
                    <span className="text-xs font-mono font-bold text-slate-300 bg-slate-900/80 px-2.5 py-1 rounded-lg border border-slate-800">
                        지수 {tiltScore}/100
                    </span>
                </div>
            </div>

            {/* Score Bar */}
            <div className="w-full bg-slate-900/90 rounded-full h-2 mb-4 overflow-hidden border border-slate-800">
                <div
                    className={`h-full rounded-full transition-all duration-500 ${styles.barClass}`}
                    style={{ width: `${Math.min(100, Math.max(8, tiltScore))}%` }}
                />
            </div>

            {/* Title & Summary */}
            <div className="space-y-1.5 mb-4">
                <h4 className="text-sm font-semibold text-white flex items-center gap-1.5">
                    {severity === 'CRITICAL' && <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />}
                    {severity === 'WARNING' && <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />}
                    {severity === 'NORMAL' && <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />}
                    <span>{title}</span>
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed font-sans bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                    {summary}
                </p>
            </div>

            {/* Actionable Advice */}
            <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-xs text-slate-200 mb-4 flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                    <span className="font-semibold text-amber-300 block mb-0.5">코칭 권장 솔루션</span>
                    <span>{advice}</span>
                </div>
            </div>

            {/* 3대 징후 상세 내역 */}
            <div className="space-y-2 pt-2 border-t border-slate-800/70">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                    틸트 3대 징후 감지 현황
                </span>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                    {formattedSymptoms.map((symptom) => (
                        <div
                            key={symptom.type}
                            className={`p-3 rounded-xl border transition-all text-xs space-y-1.5 ${
                                symptom.detected
                                    ? 'bg-rose-950/30 border-rose-500/30 text-rose-200'
                                    : 'bg-slate-950/50 border-slate-800/80 text-slate-400'
                            }`}
                        >
                            <div className="flex items-center justify-between gap-1">
                                <span className="font-bold text-[11px] truncate">{symptom.displayTitle}</span>
                                {symptom.detected ? (
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                                        감지됨
                                    </span>
                                ) : (
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-400">
                                        정상
                                    </span>
                                )}
                            </div>

                            <p className="text-[11px] leading-snug line-clamp-2 text-slate-300">
                                {symptom.description}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
