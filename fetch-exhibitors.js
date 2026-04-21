/**
 * fetch-exhibitors.js
 * AlgoliaからクリエイターEXPO 2026の個人クリエイター出展者を取得し
 * data/exhibitors.json に保存するスクリプト。
 * 毎週月曜9時に実行される。
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUTPUT_FILE = path.join(__dirname, 'data', 'exhibitors.json')

// Algolia設定（ページのHTMLから取得した公開search-only key）
const ALGOLIA_APP_ID  = 'XD0U5M6Y4R'
const ALGOLIA_API_KEY = 'd5cd7d4ec26134ff4a34d736a7f9ad47'
const ALGOLIA_INDEX   = 'evt-57bc0de5-45b7-477f-aa0d-1d4cf08fc4c5-index'

// フィルタ条件
const EVENT_EDITION_ID = 'eve-2b972fc3-9919-4475-983b-a08253dfd7d1'
// クリエイターEXPO 且つ 個人クリエイターカテゴリに絞る
const FILTERS = `eventEditionId:"${EVENT_EDITION_ID}" AND locale:"ja-jp"`
const FACET_FILTERS = [
  ['exhibitorFilters.展示会.lvl0:948411:3: クリエイターEXPO'],
  ['exhibitorFilters.製品カテゴリー.lvl0:948448:6: 個人クリエイター'],
]

async function fetchPage(page) {
  const url = `https://${ALGOLIA_APP_ID}-dsn.algolia.net/1/indexes/${ALGOLIA_INDEX}/query`
  const body = JSON.stringify({
    query: '',
    hitsPerPage: 100,
    page,
    filters: FILTERS,
    facetFilters: FACET_FILTERS,
    attributesToRetrieve: [
      'exhibitorName',
      'companyName',
      'exhibitorDescription',
      'exhibitorFilters',
      'website',
    ],
  })

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'X-Algolia-Application-Id': ALGOLIA_APP_ID,
      'X-Algolia-API-Key': ALGOLIA_API_KEY,
      'Content-Type': 'application/json',
    },
    body,
  })

  if (!res.ok) throw new Error(`Algolia error: ${res.status} ${await res.text()}`)
  return res.json()
}

function getSubcats(h) {
  const filters = h.exhibitorFilters ?? {}
  const cat = filters['製品カテゴリー'] ?? {}
  const lvl1 = Array.isArray(cat.lvl1) ? cat.lvl1 : []
  return lvl1
    .slice(0, 2)
    .map(v => (v.includes(' > ') ? v.split(' > ')[1] : v))
    .join('・')
}

async function main() {
  console.log(`[${new Date().toISOString()}] クリエイターEXPO 個人クリエイター出展者データ取得開始`)

  const allHits = []
  let page = 0

  while (true) {
    const data = await fetchPage(page)
    allHits.push(...data.hits)
    console.log(`  Page ${page}: ${data.hits.length}件 (累計 ${allHits.length}/${data.nbHits})`)
    page++
    if (page >= data.nbPages) break
  }

  console.log(`  取得完了: ${allHits.length}社`)

  // 整形して保存
  const exhibitors = allHits.map((h, i) => ({
    no: i + 1,
    name: h.exhibitorName || h.companyName || '不明',
    desc: (h.exhibitorDescription ?? '').replace(/\n/g, ' ').slice(0, 120),
    sub: getSubcats(h),
    website: h.website ?? '',
  }))

  const output = {
    fetchedAt: new Date().toISOString(),
    count: exhibitors.length,
    category: '個人クリエイター',
    event: 'クリエイターEXPO 2026',
    exhibitors,
  }

  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true })
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2), 'utf-8')
  console.log(`  保存完了: ${OUTPUT_FILE}`)
  console.log(`[${new Date().toISOString()}] 完了`)
}

main().catch(err => {
  console.error('取得エラー:', err)
  process.exit(1)
})
