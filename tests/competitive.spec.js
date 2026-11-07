import { test, expect } from '@playwright/test'

for (const width of [390, 1280]) {
  test(`home and competitive audio isolation at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/reverse/')
    await expect(page.getByRole('button', { name: /Jogar online/ })).toBeVisible()
    await page.screenshot({ path: `test-results/home-${width}.png`, fullPage: true, animations: 'disabled' })

    // Mount the real component with isolated network dependencies. No live room is changed.
    await page.route('**/src/lib/supabase.js', route => route.fulfill({ contentType: 'text/javascript', body: `
      const channel = { on() { return this }, subscribe() { return this }, unsubscribe() {}, send() {} };
      export const supabaseConfigurado = true;
      export const supabase = { channel: () => channel, removeChannel() {} };
    ` }))
    await page.route('**/src/services/competitivo.js', route => route.fulfill({ contentType: 'text/javascript', body: `
      export async function lerCompetitivo() { return window.fixture }
      export async function ouvirCompetitivo(path, picos, duracao) {
        window.downloads.push(path);
        return { blob: new Blob([path], {type:'audio/wav'}), picos, duracao };
      }
      export async function iniciarCompetitivo() {}
      export async function enviarCompetitivo() {}
      export async function votarCompetitivo() {}
      export async function proximaRodada() {}
      export async function revanche() {}
    ` }))
    await page.goto('/reverse/')
    await page.evaluate(async () => {
      window.downloads = []
      window.setRound = (round, phase = 'attempts') => {
        const creator = round % 2 ? 'me' : 'other'
        const audio = (id, user_id, is_creator) => ({ id, user_id, is_creator, round_no: round, normal_path: `${round}/${id}/normal.wav`, reversed_path: `${round}/${id}/reversed.wav`, peaks_normal:[.3,.7,.5], peaks_reversed:[.5,.7,.3], duration:1 })
        window.fixture = { game: {round_no:round, start_round:0, total_rounds:8, phase}, audios: [audio(`original-${round}`, creator, true), ...(phase === 'vote' ? [audio(`attempt-${round}`, 'other', false)] : [])], votos:[], pontos:[] }
      }
      window.setRound(0)
      const { default: React } = await import('/reverse/node_modules/.vite/deps/react.js')
      const { default: { createRoot } } = await import('/reverse/node_modules/.vite/deps/react-dom_client.js')
      const { default: CompetitiveGame } = await import('/reverse/src/components/CompetitiveGame.jsx')
      const el = document.createElement('div')
      document.body.replaceChildren(el)
      el.style.cssText = 'max-width:448px;margin:auto;padding:24px 20px'
      createRoot(el).render(React.createElement(CompetitiveGame, { sala:{id:'test',code:'TESTE'}, jogadores:[{user_id:'other',player_name:'Ana'},{user_id:'me',player_name:'Bruno',is_host:true}], usuarioId:'me',onSair(){} }))
    })
    for (const round of [0, 2, 4, 6]) {
      await page.evaluate(r => window.setRound(r), round)
      await expect(page.getByText(`RODADA ${round + 1} / 8`)).toBeVisible({ timeout:10000 })
      await page.getByRole('button', { name:'ESTOU PRONTO' }).click()
      await expect.poll(() => page.evaluate(async () => {
        const audio = document.querySelector('audio')
        return audio?.src ? fetch(audio.src).then(r => r.text()) : ''
      })).toBe(`${round}/original-${round}/reversed.wav`)
    }
    for (const round of [1, 3]) {
      await page.evaluate(r => window.setRound(r, 'vote'), round)
      await expect(page.getByText(`RODADA ${round + 1} / 8`)).toBeVisible({ timeout:10000 })
      await expect.poll(() => page.evaluate(async () => {
        const audio = document.querySelector('audio')
        return audio?.src ? fetch(audio.src).then(r => r.text()) : ''
      })).toBe(`${round}/original-${round}/normal.wav`)
    }
    await page.screenshot({ path:`test-results/competitive-${width}.png`,fullPage:true, animations:'disabled' })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  })
}
