import type { RandomSource } from '../../time/random'

export type Sound = 'whoosh' | 'thud' | 'win' | 'tick'

type Voice = (context: AudioContext, noise: AudioBuffer, output: AudioNode) => void

/** A short burst of noise swept through a band-pass: the dart cutting the air */
const whoosh: Voice = (context, noise, output) => {
  const now = context.currentTime
  const source = new AudioBufferSourceNode(context, { buffer: noise })
  const band = new BiquadFilterNode(context, { type: 'bandpass', Q: 1.4, frequency: 700 })
  const gain = new GainNode(context, { gain: 0 })
  band.frequency.exponentialRampToValueAtTime(2600, now + 0.28)
  gain.gain.linearRampToValueAtTime(0.22, now + 0.08)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.34)
  source.connect(band).connect(gain).connect(output)
  source.start(now)
  source.stop(now + 0.36)
}

/** A falling sine with a click: the point biting into sisal */
const thud: Voice = (context, noise, output) => {
  const now = context.currentTime
  const body = new OscillatorNode(context, { type: 'sine', frequency: 150 })
  const bodyGain = new GainNode(context, { gain: 0.55 })
  body.frequency.exponentialRampToValueAtTime(52, now + 0.13)
  bodyGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16)
  body.connect(bodyGain).connect(output)
  body.start(now)
  body.stop(now + 0.18)

  const click = new AudioBufferSourceNode(context, { buffer: noise })
  const high = new BiquadFilterNode(context, { type: 'highpass', frequency: 2400 })
  const clickGain = new GainNode(context, { gain: 0.18 })
  clickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.03)
  click.connect(high).connect(clickGain).connect(output)
  click.start(now)
  click.stop(now + 0.04)
}

/** Two bright notes: game shot */
const win: Voice = (context, _noise, output) => {
  const now = context.currentTime
  ;[659.25, 987.77, 1318.5].forEach((frequency, index) => {
    const start = now + index * 0.11
    const note = new OscillatorNode(context, { type: 'triangle', frequency })
    const gain = new GainNode(context, { gain: 0 })
    gain.gain.linearRampToValueAtTime(0.16, start + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.42)
    note.connect(gain).connect(output)
    note.start(start)
    note.stop(start + 0.45)
  })
}

const tick: Voice = (context, _noise, output) => {
  const now = context.currentTime
  const note = new OscillatorNode(context, { type: 'sine', frequency: 1250 })
  const gain = new GainNode(context, { gain: 0.07 })
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05)
  note.connect(gain).connect(output)
  note.start(now)
  note.stop(now + 0.06)
}

const VOICES: Readonly<Record<Sound, Voice>> = { whoosh, thud, win, tick }

/**
 * Sounds made in code with the Web Audio API: no audio file to download. Silent until the visitor
 * turns sound on (the audio context starts inside that click, as browsers require).
 */
export class SoundEngine {
  private context: AudioContext | null = null
  private noise: AudioBuffer | null = null
  private master: GainNode | null = null
  private enabled = false

  constructor(private readonly random: RandomSource) {}

  isEnabled(): boolean {
    return this.enabled
  }

  setEnabled(on: boolean): void {
    this.enabled = on
    if (!on) {
      void this.context?.suspend()
      return
    }
    if (!this.context) this.start()
    else void this.context.resume()
  }

  play(sound: Sound): void {
    if (!this.enabled || !this.context || !this.noise || !this.master) return
    VOICES[sound](this.context, this.noise, this.master)
  }

  private start(): void {
    const context = new AudioContext()
    const length = Math.floor(context.sampleRate * 0.4)
    const noise = context.createBuffer(1, length, context.sampleRate)
    const samples = noise.getChannelData(0)
    for (let index = 0; index < length; index += 1) samples[index] = this.random.next() * 2 - 1
    this.master = new GainNode(context, { gain: 0.8 })
    this.master.connect(context.destination)
    this.context = context
    this.noise = noise
  }
}
