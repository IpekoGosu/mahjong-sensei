import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
    title: 'Mahjong Sensei - 작혼 패보 및 운/실력 분석',
    description: '작혼 대국 데이터를 분석하여 최근 10-30-50-100판 운과 실력을 객관적으로 분리해주는 분석 플랫폼'
}

export default function RootLayout({
    children
}: Readonly<{
    children: React.ReactNode
}>): React.ReactElement {
    return (
        <html lang="ko">
            <body className="antialiased min-h-screen bg-slate-950 text-slate-100">
                {children}
            </body>
        </html>
    )
}
