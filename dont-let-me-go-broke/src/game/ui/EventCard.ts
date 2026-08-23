import * as Phaser from 'phaser'
import type { ChoiceSide, GameEvent } from '../core/types.ts'
import { colors, layout } from '../theme.ts'
import { addEyebrow, drawPanel, drawSoftShadow, PillButton, sans, serif } from './primitives.ts'

const WIDTH = layout.card.width
const HEIGHT = layout.card.height
const PAD = 40

/** Horizontal travel, in px, that commits the swipe on release. */
const COMMIT_DISTANCE = 145
/** A flick shorter than the commit distance still counts if it is fast enough. */
const FLICK_VELOCITY = 0.55
/** Movement under this is a tap, not a drag. */
const TAP_SLOP = 12

const BUTTON_WIDTH = (WIDTH - PAD * 2 - 20) / 2
const BUTTON_HEIGHT = 92
const BUTTON_Y = HEIGHT / 2 - PAD - BUTTON_HEIGHT / 2

/**
 * The event card: sender, prompt, two buttons — and the whole thing draggable.
 *
 * Owns all pointer input for the decision (drag *and* tap), and emits a single
 * `decide` event with the chosen side. It never touches the rules; the scene
 * decides what a choice means.
 */
export class EventCard extends Phaser.GameObjects.Container {
  private readonly restX: number
  private readonly restY: number

  private readonly overlay: Phaser.GameObjects.Graphics
  private readonly leftStamp: Phaser.GameObjects.Container
  private readonly rightStamp: Phaser.GameObjects.Container
  private readonly leftButton: PillButton
  private readonly rightButton: PillButton

  private pressedSide: ChoiceSide | null = null
  private dragDistance = 0
  private locked = false

  constructor(scene: Phaser.Scene, x: number, y: number, event: GameEvent) {
    super(scene, x, y)

    this.restX = x
    this.restY = y

    const shadow = scene.add.graphics()
    drawSoftShadow(shadow, WIDTH, HEIGHT, layout.radius.card)
    this.add(shadow)

    const face = scene.add.graphics()
    drawPanel(face, WIDTH, HEIGHT, layout.radius.card, colors.card, 1, colors.cardEdge, 1)
    this.add(face)

    this.buildHeader(scene, event)
    this.buildPrompt(scene, event)

    this.leftButton = new PillButton(
      scene,
      -(BUTTON_WIDTH / 2 + 10),
      BUTTON_Y,
      BUTTON_WIDTH,
      BUTTON_HEIGHT,
      event.leftChoice.label,
      'outline',
    )
    this.rightButton = new PillButton(
      scene,
      BUTTON_WIDTH / 2 + 10,
      BUTTON_Y,
      BUTTON_WIDTH,
      BUTTON_HEIGHT,
      event.rightChoice.label,
      'solid',
    )
    this.add([this.leftButton, this.rightButton])

    // Tint wash + direction stamps, revealed progressively while dragging.
    this.overlay = scene.add.graphics().setAlpha(0)
    this.add(this.overlay)

    this.leftStamp = this.buildStamp(scene, -138, 152, event.leftChoice.label, colors.negativeCss, -6)
    this.rightStamp = this.buildStamp(scene, 138, 152, event.rightChoice.label, colors.positiveCss, 6)
    this.add([this.leftStamp, this.rightStamp])

    scene.add.existing(this)
    this.enableInput()
  }

  private buildHeader(scene: Phaser.Scene, event: GameEvent): void {
    const avatarX = -WIDTH / 2 + PAD + 38
    const avatarY = -HEIGHT / 2 + PAD + 38

    const avatar = scene.add.graphics()
    avatar.fillStyle(colors.cream, 1)
    avatar.fillCircle(avatarX, avatarY, 38)
    avatar.lineStyle(1, colors.cardEdge, 1)
    avatar.strokeCircle(avatarX, avatarY, 38)
    this.add(avatar)

    this.add(
      scene.add
        .text(avatarX, avatarY + 1, event.initials, sans(26, colors.inkCss, { weight: '600' }))
        .setOrigin(0.5)
        .setLetterSpacing(1),
    )

    const textX = avatarX + 60
    this.add(
      scene.add
        .text(textX, avatarY - 14, event.sender, sans(29, colors.inkCss, { weight: '600' }))
        .setOrigin(0, 0.5),
    )
    this.add(addEyebrow(scene, textX, avatarY + 18, event.context, colors.mutedCss, 17).setOrigin(0, 0.5))

    const rule = scene.add.graphics()
    rule.fillStyle(colors.hairline, 1)
    rule.fillRect(-WIDTH / 2 + PAD, -HEIGHT / 2 + 152, WIDTH - PAD * 2, 1)
    this.add(rule)
  }

  private buildPrompt(scene: Phaser.Scene, event: GameEvent): void {
    const prompt = scene.add
      .text(0, -18, event.prompt, serif(41, colors.inkCss, { align: 'center', wrap: WIDTH - PAD * 2 - 24 }))
      .setOrigin(0.5)
      .setLineSpacing(14)

    // Long prompts step down a size or two rather than colliding with the buttons.
    let size = 41
    while (prompt.height > 300 && size > 28) {
      size -= 2
      prompt.setFontSize(size)
    }

    this.add(prompt)
  }

  private buildStamp(
    scene: Phaser.Scene,
    x: number,
    y: number,
    label: string,
    color: string,
    angle: number,
  ): Phaser.GameObjects.Container {
    const container = scene.add.container(x, y).setAngle(angle).setAlpha(0)

    const caption = scene.add
      .text(0, 0, label.toUpperCase(), sans(22, color, { weight: '600', align: 'center' }))
      .setOrigin(0.5)
      .setLetterSpacing(2.5)

    const width = Math.min(WIDTH - PAD * 2, caption.width + 44)
    const frame = scene.add.graphics()
    frame.lineStyle(3, Phaser.Display.Color.HexStringToColor(color).color, 1)
    frame.strokeRoundedRect(-width / 2, -26, width, 52, 26)

    container.add([frame, caption])
    return container
  }

  private enableInput(): void {
    this.setSize(WIDTH, HEIGHT)
    // Container hit areas are tested against display-origin-normalised
    // coordinates, so this rectangle runs 0..W / 0..H rather than being
    // centred like the card's own children.
    this.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, WIDTH, HEIGHT),
      Phaser.Geom.Rectangle.Contains,
    )
    this.scene.input.setDraggable(this)

    this.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.locked) return
      this.dragDistance = 0
      this.pressedSide = this.buttonAt(pointer)
      if (this.pressedSide === 'left') this.leftButton.setPressed(true)
      if (this.pressedSide === 'right') this.rightButton.setPressed(true)
    })

    this.on('drag', (_pointer: Phaser.Input.Pointer, dragX: number, dragY: number) => {
      if (this.locked) return

      const offsetX = dragX - this.restX
      this.dragDistance = Math.max(this.dragDistance, Math.abs(offsetX))

      if (this.dragDistance > TAP_SLOP) this.releaseButtons()

      this.x = dragX
      // The card follows vertically only a little — it should feel hinged.
      this.y = this.restY + (dragY - this.restY) * 0.22
      this.setAngle(offsetX * 0.03)
      this.renderSwipeHint(offsetX)
    })

    this.on('dragend', (pointer: Phaser.Input.Pointer) => {
      if (this.locked) return
      this.releaseButtons()

      const offsetX = this.x - this.restX
      const flicked = Math.abs(offsetX) > TAP_SLOP * 4
        && Math.abs(pointer.velocity.x) > FLICK_VELOCITY
        && Math.sign(pointer.velocity.x) === Math.sign(offsetX)

      if (Math.abs(offsetX) >= COMMIT_DISTANCE || flicked) {
        this.decide(offsetX < 0 ? 'left' : 'right')
      } else {
        this.returnToRest()
      }
    })

    this.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (this.locked) return
      const side = this.pressedSide
      this.releaseButtons()

      if (side !== null && this.dragDistance <= TAP_SLOP && this.buttonAt(pointer) === side) {
        this.decide(side)
      }
    })

    this.on('pointerupoutside', () => this.releaseButtons())
  }

  /** Which button, if any, sits under the pointer — in the card's own space. */
  private buttonAt(pointer: Phaser.Input.Pointer): ChoiceSide | null {
    const local = this.getWorldTransformMatrix().applyInverse(pointer.x, pointer.y)

    if (Phaser.Geom.Rectangle.Contains(this.leftButton.bounds, local.x, local.y)) return 'left'
    if (Phaser.Geom.Rectangle.Contains(this.rightButton.bounds, local.x, local.y)) return 'right'
    return null
  }

  private releaseButtons(): void {
    this.pressedSide = null
    this.leftButton.setPressed(false)
    this.rightButton.setPressed(false)
  }

  /** Wash of colour plus the matching stamp, both scaled by how far you've pulled. */
  private renderSwipeHint(offsetX: number): void {
    const progress = Phaser.Math.Clamp(Math.abs(offsetX) / COMMIT_DISTANCE, 0, 1)
    const towardsLeft = offsetX < 0

    this.leftStamp.setAlpha(towardsLeft ? progress : 0).setScale(0.92 + progress * 0.08)
    this.rightStamp.setAlpha(towardsLeft ? 0 : progress).setScale(0.92 + progress * 0.08)

    this.overlay.clear()
    if (progress <= 0.01) {
      this.overlay.setAlpha(0)
      return
    }

    drawPanel(
      this.overlay,
      WIDTH,
      HEIGHT,
      layout.radius.card,
      towardsLeft ? colors.negative : colors.positive,
      0.09,
    )
    this.overlay.setAlpha(progress)
  }

  private decide(side: ChoiceSide): void {
    this.lock()
    this.emit('decide', side)
  }

  /** Stops accepting input — called the moment a decision is made. */
  lock(): void {
    this.locked = true
    this.disableInteractive()
  }

  playIntro(): void {
    this.setPosition(this.restX, this.restY + 84)
    this.setScale(0.94)
    this.setAlpha(0)

    this.scene.tweens.add({
      targets: this,
      y: this.restY,
      scaleX: 1,
      scaleY: 1,
      alpha: 1,
      duration: 380,
      ease: 'Back.easeOut',
    })
  }

  /** Sends the card off the side it was thrown, then hands back to the scene. */
  flyOut(side: ChoiceSide, onComplete: () => void): void {
    const direction = side === 'left' ? -1 : 1

    this.scene.tweens.add({
      targets: this,
      x: this.restX + direction * 900,
      y: this.y + 40,
      angle: direction * 22,
      alpha: 0.15,
      duration: 380,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        this.destroy()
        onComplete()
      },
    })
  }

  private returnToRest(): void {
    this.scene.tweens.add({
      targets: this,
      x: this.restX,
      y: this.restY,
      angle: 0,
      duration: 340,
      ease: 'Back.easeOut',
    })

    this.scene.tweens.add({
      targets: [this.overlay, this.leftStamp, this.rightStamp],
      alpha: 0,
      duration: 200,
      ease: 'Sine.easeOut',
    })
  }
}
