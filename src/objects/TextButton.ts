import Phaser from 'phaser';

import { Palette } from '../config/GameConfig';

export interface TextButtonStyle {
  width?: number;
  height?: number;
  fill?: number;
  textColor?: string;
  fontSize?: number;
}

/**
 * Touch-friendly pill button: a rounded rect plus a label, sized generously
 * for thumbs (min 96px tall by default) and driven by pointer events only —
 * no keyboard bindings, which would not exist on device anyway.
 */
export class TextButton extends Phaser.GameObjects.Container {
  private readonly background: Phaser.GameObjects.Graphics;
  private readonly label: Phaser.GameObjects.Text;
  private readonly buttonWidth: number;
  private readonly buttonHeight: number;
  private readonly fillColor: number;
  private enabledState = true;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    text: string,
    onClick: () => void,
    style: TextButtonStyle = {}
  ) {
    super(scene, x, y);

    this.buttonWidth = style.width ?? 420;
    this.buttonHeight = style.height ?? 108;
    this.fillColor = style.fill ?? 0x1f2a54;

    this.background = scene.add.graphics();
    this.label = scene.add
      .text(0, 0, text, {
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: `${style.fontSize ?? 40}px`,
        color: style.textColor ?? Palette.text
      })
      .setOrigin(0.5);

    this.add([this.background, this.label]);
    this.draw(1);

    this.setSize(this.buttonWidth, this.buttonHeight);
    this.setInteractive(
      // Container hit areas are in local space, so the rect is centred on 0,0.
      new Phaser.Geom.Rectangle(
        -this.buttonWidth / 2,
        -this.buttonHeight / 2,
        this.buttonWidth,
        this.buttonHeight
      ),
      Phaser.Geom.Rectangle.Contains
    );

    this.on(Phaser.Input.Events.POINTER_DOWN, () => {
      if (!this.enabledState) {
        return;
      }
      this.setScale(0.96);
    });

    this.on(Phaser.Input.Events.POINTER_OUT, () => this.setScale(1));

    this.on(Phaser.Input.Events.POINTER_UP, () => {
      this.setScale(1);
      if (this.enabledState) {
        onClick();
      }
    });

    scene.add.existing(this);
  }

  setLabel(text: string): this {
    this.label.setText(text);
    return this;
  }

  setEnabled(enabled: boolean): this {
    this.enabledState = enabled;
    this.draw(enabled ? 1 : 0.45);
    this.label.setAlpha(enabled ? 1 : 0.5);
    return this;
  }

  private draw(alpha: number): void {
    const halfW = this.buttonWidth / 2;
    const halfH = this.buttonHeight / 2;
    this.background.clear();
    this.background.fillStyle(this.fillColor, alpha);
    this.background.fillRoundedRect(-halfW, -halfH, this.buttonWidth, this.buttonHeight, 26);
    this.background.lineStyle(2, 0xffffff, 0.18 * alpha);
    this.background.strokeRoundedRect(-halfW, -halfH, this.buttonWidth, this.buttonHeight, 26);
  }
}
