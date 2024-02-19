import { assertExists } from '@blocksuite/global/utils';
import type { Page } from '@blocksuite/store';
import { Workspace } from '@blocksuite/store';

import type {
  EdgelessModel,
  Selectable,
  TopLevelBlockModel,
} from '../../_common/types.js';
import { matchFlavours } from '../../_common/utils/model.js';
import type { EdgelessPageService } from '../../index.js';
import type {
  FrameBlockModel,
  NoteBlockModel,
  SurfaceBlockModel,
} from '../../models.js';
import { Bound, Overlay, type RoughCanvas } from '../../surface-block/index.js';
import { edgelessElementsBound } from './utils/bound-utils.js';
import { isFrameBlock } from './utils/query.js';

const MIN_FRAME_WIDTH = 800;
const MIN_FRAME_HEIGHT = 640;
const FRAME_PADDING = 40;

export function removeContainedFrames(frames: FrameBlockModel[]) {
  return frames.filter(frame => {
    const bound = Bound.deserialize(frame.xywh);
    return frames.some(
      f => f.id === frame.id || !Bound.deserialize(f.xywh).contains(bound)
    );
  });
}

export class FrameOverlay extends Overlay {
  bound: Bound | null = null;

  override render(ctx: CanvasRenderingContext2D, _rc: RoughCanvas): void {
    if (!this.bound) return;
    const { x, y, w, h } = this.bound;
    ctx.beginPath();
    ctx.strokeStyle = '#1E96EB';
    ctx.lineWidth = 2;
    ctx.roundRect(x, y, w, h, 8);
    ctx.stroke();
  }

  highlight(frame: FrameBlockModel) {
    const bound = Bound.deserialize(frame.xywh);

    this.bound = bound;
    this._renderer.refresh();
  }

  clear() {
    this.bound = null;
    this._renderer.refresh();
  }
}

export class EdgelessFrameManager {
  constructor(private _pageService: EdgelessPageService) {}

  selectFrame(eles: Selectable[]) {
    const frames = this._pageService.frames;
    if (frames.length === 0) return null;

    const selectedFrames = eles.filter(ele => isFrameBlock(ele));
    const bound = edgelessElementsBound(eles);
    for (let i = frames.length - 1; i >= 0; i--) {
      const frame = frames[i];
      if (selectedFrames.includes(frame)) continue;
      if (Bound.deserialize(frame.xywh).contains(bound)) {
        return frame;
      }
    }
    return null;
  }

  getElementsInFrame(frame: FrameBlockModel, fullyContained = true) {
    const bound = Bound.deserialize(frame.xywh);
    const elements: EdgelessModel[] = this._pageService.layer.canvasGrid.search(
      bound,
      true
    );

    return elements.concat(
      getBlocksInFrame(this._pageService.page, frame, fullyContained)
    );
  }

  createFrameOnSelected() {
    const frames = this._pageService.frames;
    const surfaceModel =
      this._pageService.page.getBlockByFlavour('affine:surface')[0];

    let bound = edgelessElementsBound(this._pageService.selection.elements);
    bound = bound.expand(FRAME_PADDING);
    if (bound.w < MIN_FRAME_WIDTH) {
      const offset = (MIN_FRAME_WIDTH - bound.w) / 2;
      bound = bound.expand(offset, 0);
    }
    if (bound.h < MIN_FRAME_HEIGHT) {
      const offset = (MIN_FRAME_HEIGHT - bound.h) / 2;
      bound = bound.expand(0, offset);
    }
    const id = this._pageService.addBlock(
      'affine:frame',
      {
        title: new Workspace.Y.Text(`Frame ${frames.length + 1}`),
        xywh: bound.serialize(),
      },
      surfaceModel
    );
    const frameModel = this._pageService.getElementById(id);
    this._pageService.page.captureSync();
    assertExists(frameModel);

    this._pageService.selection.set({
      elements: [frameModel.id],
      editing: false,
    });

    return this._pageService.getElementById(id);
  }
}

export function getNotesInFrame(
  page: Page,
  frame: FrameBlockModel,
  fullyContained: boolean = true
) {
  const bound = Bound.deserialize(frame.xywh);

  return (page.getBlockByFlavour('affine:note') as NoteBlockModel[]).filter(
    ele => {
      const xywh = Bound.deserialize(ele.xywh);

      return fullyContained
        ? bound.contains(xywh)
        : bound.isPointInBound([xywh.x, xywh.y]);
    }
  ) as NoteBlockModel[];
}

export function getBlocksInFrame(
  page: Page,
  model: FrameBlockModel,
  fullyContained: boolean = true
) {
  const bound = Bound.deserialize(model.xywh);
  const surfaceModel = page.getBlockByFlavour([
    'affine:surface',
  ]) as SurfaceBlockModel[];

  return (
    getNotesInFrame(page, model, fullyContained) as TopLevelBlockModel[]
  ).concat(
    surfaceModel[0].children.filter(ele => {
      if (ele.id === model.id) return;
      if (matchFlavours(ele, ['affine:image', 'affine:frame'])) {
        const blockBound = Bound.deserialize(ele.xywh);
        return fullyContained
          ? bound.contains(blockBound)
          : bound.containsPoint([blockBound.x, blockBound.y]);
      }

      return false;
    }) as TopLevelBlockModel[]
  );
}
