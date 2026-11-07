import { test, expect } from '@playwright/test'

async function mount(page) {
  await page.route('**/src/utils/audio.js*', r => r.fulfill({ contentType:'text/javascript', body:`
    export async function processarGravacao(blob) { window.processed++; return {blob} }
    export function mensagemErro() { return 'Erro ao processar' }
  ` }))
  await page.goto('/reverse/')
  await page.evaluate(async () => {
    window.processed = 0; window.submitted = 0; window.acquisitions = 0
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { configurable:true, value:async () => {
      window.acquisitions++
      if (window.denied) throw new DOMException('busy', 'NotReadableError')
      const track = new EventTarget()
      track.muted = !!window.initiallyMuted; track.readyState = 'live'
      track.stop = () => { track.readyState = 'ended' }
      window.track = track
      return { getTracks:() => [track], getAudioTracks:() => [track] }
    } })
    window.MediaRecorder = class {
      static isTypeSupported() { return true }
      constructor() { this.state='inactive'; this.mimeType='audio/webm'; window.rec=this }
      start(slice) { this.state='recording'; window.slice=slice }
      stop() { this.state='inactive'; queueMicrotask(() => { this.ondataavailable?.({data:new Blob(['recorded'])}); this.onstop?.() }) }
    }
    const { default: React } = await import('/reverse/node_modules/.vite/deps/react.js')
    const { default: {createRoot} } = await import('/reverse/node_modules/.vite/deps/react-dom_client.js')
    const { default: Recorder } = await import('/reverse/src/components/Recorder.jsx')
    const el=document.createElement('div'); document.body.replaceChildren(el)
    createRoot(el).render(React.createElement(Recorder,{onPronto:()=>window.submitted++}))
  })
}

for (const interruption of ['mute','ended','error','initiallyMuted','denied']) {
  test(`microphone ${interruption} recovers without sending damaged audio`, async ({page}) => {
    await mount(page)
    if (['initiallyMuted','denied'].includes(interruption)) await page.evaluate(key=>window[key]=true,interruption)
    await page.getByRole('button',{name:'GRAVAR',exact:true}).click()
    if (!['initiallyMuted','denied'].includes(interruption)) {
      await expect(page.getByRole('button',{name:/PARAR/})).toBeVisible()
      await page.evaluate(type=>{
        if(type==='error')window.rec.onerror()
        else { if(type==='mute') window.track.muted=true; else window.track.readyState='ended'; window.track.dispatchEvent(new Event(type)) }
      },interruption)
    }
    await expect(page.getByRole('alert')).toContainText('ligação')
    expect(await page.evaluate(()=>[window.processed,window.submitted])).toEqual([0,0])
    await page.evaluate(()=>{window.initiallyMuted=false;window.denied=false})
    await page.getByRole('button',{name:'GRAVAR',exact:true}).click()
    await page.getByRole('button',{name:/PARAR/}).click()
    await expect.poll(()=>page.evaluate(()=>window.submitted)).toBe(1)
    expect(await page.evaluate(()=>window.slice)).toBe(250)
  })
}

test('offline decoding produces normal and reversed WAV without opening a live device', async ({page})=>{
  await page.goto('/reverse/')
  const result=await page.evaluate(async()=>{
    const { processarGravacao }=await import('/reverse/src/utils/audio.js')
    const data=new ArrayBuffer(44+44100*2),v=new DataView(data)
    const str=(o,s)=>{for(let i=0;i<s.length;i++)v.setUint8(o+i,s.charCodeAt(i))}
    str(0,'RIFF');v.setUint32(4,data.byteLength-8,true);str(8,'WAVE');str(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,44100,true);v.setUint32(28,88200,true);v.setUint16(32,2,true);v.setUint16(34,16,true);str(36,'data');v.setUint32(40,data.byteLength-44,true)
    for(let i=0;i<44100;i++)v.setInt16(44+i*2,Math.sin(i*.1)*16000,true)
    window.AudioContext=class {constructor(){throw Error('Live device must not be opened')}}
    const r=await processarGravacao(new Blob([data],{type:'audio/wav'}))
    const a=new Int16Array(await r.normal.blob.arrayBuffer(),44),b=new Int16Array(await r.invertido.blob.arrayBuffer(),44)
    return {duration:r.normal.duracao,reversed:a.every((value,i)=>value===b[b.length-1-i])}
  })
  expect(result.duration).toBeGreaterThan(.9);expect(result.reversed).toBe(true)
})
