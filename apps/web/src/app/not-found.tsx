import React from 'react'
import Link from 'next/link'

export default function NotFound(): React.ReactElement {
    return (
        <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4">
            <h1 className="text-4xl font-black text-amber-500 mb-2">404</h1>
            <p className="text-slate-400 mb-6">요청하신 페이지를 찾을 수 없습니다.</p>
            <Link
                href="/"
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-sm font-semibold transition-colors"
            >
                대시보드로 돌아가기
            </Link>
        </main>
    )
}
