import type { Translator } from '../../i18n/Translator'
import { type Throw, ThrowSession } from '../../logic/ThrowSession'
import type { BoardPoint, Score } from '../../rules/scoring'
import { isAimTarget } from '../../rules/scoring'
import type { Announcer } from './controls'

/** What the 3D scene does with the darts (absent without 3D: the game still works in text) */
export interface ThrowStage {
  /** Plays the dart's flight; resolves once it has landed */
  throwDart(thrown: Throw, index: number): Promise<void>
  collect(): void
}

export interface ThrowHooks {
  readonly onGameShot: () => void
}

/**
 * The finish: three darts at double 20. Works with the keyboard and a screen reader (a target
 * list and a Throw button, results announced), and with a pointer on the board when 3D is on.
 */
export class ThrowPanel {
  private stage: ThrowStage | null = null
  private busy = false
  private readonly select: HTMLSelectElement
  private readonly throwButton: HTMLButtonElement
  private readonly collectButton: HTMLButtonElement
  private readonly dartsLeft: HTMLElement
  private readonly log: HTMLOListElement

  constructor(
    form: HTMLFormElement,
    private readonly session: ThrowSession,
    private readonly translator: Translator,
    private readonly announcer: Announcer,
    private readonly hooks: ThrowHooks,
  ) {
    this.select = required(form, 'select')
    this.throwButton = required(form, '[data-throw-button]')
    this.collectButton = required(form, '[data-collect]')
    this.dartsLeft = required(form, '[data-darts-left]')
    this.log = required(form, '[data-throw-log]')

    form.addEventListener('submit', (event) => {
      event.preventDefault()
      const target = this.select.value
      if (isAimTarget(target)) void this.throwAt(this.session.aimFor(target))
    })
    this.collectButton.addEventListener('click', () => this.collect())
    this.render()
    form.classList.add('is-ready')
  }

  attachStage(stage: ThrowStage): void {
    this.stage = stage
  }

  /** A throw at a point of the board (a click or tap on the 3D board, or the chosen target) */
  async throwAt(aim: BoardPoint): Promise<void> {
    if (this.busy) return
    if (!this.session.canThrow()) {
      this.announcer.say(this.translator.t('throw.noDarts'))
      return
    }
    this.busy = true
    this.session.throwAt(aim)
    this.render()
    const thrown = this.session.lastThrow()
    if (!thrown) return
    await this.stage?.throwDart(thrown, ThrowSession.DARTS - this.session.dartsLeft() - 1)
    this.busy = false
    this.record(thrown)
    this.render()
    if (thrown.gameShot) this.hooks.onGameShot()
  }

  private record(thrown: Throw): void {
    const label = this.label(thrown.score)
    const item = document.createElement('li')
    const name = document.createElement('span')
    const points = document.createElement('span')
    name.textContent = label
    points.textContent = this.translator.number(thrown.score.points)
    item.append(name, points)
    if (thrown.gameShot) item.classList.add('is-win')
    this.log.append(item)
    this.announcer.say(
      thrown.gameShot
        ? this.translator.t('throw.win')
        : this.translator.t('throw.hit', { label, points: thrown.score.points }),
    )
  }

  private collect(): void {
    if (this.busy) return
    this.session.collect()
    this.stage?.collect()
    this.log.replaceChildren()
    this.render()
    this.announcer.say(this.translator.t('throw.collected'))
  }

  private render(): void {
    this.dartsLeft.textContent = this.translator.plural('throw.dartsLeft', this.session.dartsLeft())
    const canThrow = this.session.canThrow()
    const canCollect = this.session.visit().length > 0
    if (!this.busy) this.handOn(canThrow, canCollect)
    this.setUsable(this.throwButton, canThrow)
    this.setUsable(this.collectButton, canCollect)
  }

  /**
   * While a dart flies both buttons wait, still focusable (aria-disabled): a disabled button loses
   * the keyboard focus (Chrome hands it to the page), and the next Enter went nowhere (2026-11-09)
   */
  private setUsable(button: HTMLButtonElement, usable: boolean): void {
    button.disabled = !this.busy && !usable
    if (this.busy) button.setAttribute('aria-disabled', 'true')
    else button.removeAttribute('aria-disabled')
  }

  /** The focus moves on to the next thing to do before its own button switches off */
  private handOn(canThrow: boolean, canCollect: boolean): void {
    const focused = this.throwButton.ownerDocument.activeElement
    if (focused === this.throwButton && !canThrow && canCollect) {
      this.collectButton.disabled = false
      this.collectButton.focus()
    } else if (focused === this.collectButton && !canCollect && canThrow) {
      this.throwButton.disabled = false
      this.throwButton.focus()
    }
  }

  private label(score: Score): string {
    return this.translator.t(`score.${score.ring}`, { segment: score.segment ?? '' })
  }
}

function required<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector)
  if (!element) throw new Error(`ThrowPanel: ${selector} is missing`)
  return element
}
