import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CrButton, CrCard, CrChip } from '../../ui';
import { EmojiSizeSelect } from './components/emoji-size-select';
import { ImagePicker } from './components/image-picker';
import { ImageStage } from './components/image-stage';

/** Seite „Mosaik“: Layout-Anhaltspunkt, noch ohne Logik. */
@Component({
  selector: 'app-mosaik',
  imports: [CrButton, CrCard, CrChip, EmojiSizeSelect, ImagePicker, ImageStage],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './mosaik.html',
  styleUrl: './mosaik.css',
})
export class Mosaik {}
