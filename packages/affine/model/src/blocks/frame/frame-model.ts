import {
  getDescendantElementsImpl,
  type GfxBlockElementModel,
  type GfxContainerElement,
  gfxContainerSymbol,
  type GfxElementGeometry,
  type GfxModel,
  hasDescendantElementImpl,
  type PointTestOptions,
  SurfaceBlockModel,
} from '@blocksuite/block-std/gfx';
import { Bound, type SerializedXYWH } from '@blocksuite/global/utils';
import { BlockModel, defineBlockSchema, type Text } from '@blocksuite/store';

import type { Color } from '../../consts/index.js';

import { GfxCompatible } from '../../utils/index.js';

export type FrameBlockProps = {
  title: Text;
  background: Color;
  xywh: SerializedXYWH;
  index: string;
  childElementIds?: Record<string, boolean>;
};

export const FrameBlockSchema = defineBlockSchema({
  flavour: 'affine:frame',
  props: (internal): FrameBlockProps => ({
    title: internal.Text(),
    background: '--affine-palette-transparent',
    xywh: `[0,0,100,100]`,
    index: 'a0',
    childElementIds: Object.create(null),
  }),
  metadata: {
    version: 1,
    role: 'content',
    parent: ['affine:surface'],
    children: [],
  },
  toModel: () => {
    return new FrameBlockModel();
  },
});

export class FrameBlockModel
  extends GfxCompatible<FrameBlockProps>(BlockModel)
  implements GfxElementGeometry, GfxContainerElement
{
  [gfxContainerSymbol] = true as const;

  get childElements() {
    const surface = this.doc
      .getBlocks()
      .find(model => model instanceof SurfaceBlockModel);
    if (!surface) return [];

    const elements: BlockSuite.EdgelessModel[] = [];

    for (const key of this.childIds) {
      const element =
        surface.getElementById(key) ||
        (surface.doc.getBlockById(key) as GfxBlockElementModel);

      element && elements.push(element);
    }

    return elements;
  }

  get childIds() {
    return [...(this.childElementIds ? Object.keys(this.childElementIds) : [])];
  }

  addChild(element: GfxModel) {
    this.doc.transact(() => {
      if (!this.childElementIds) this.childElementIds = {};
      this.childElementIds[element.id] = true;
    });
  }

  override containsBound(bound: Bound): boolean {
    return this.elementBound.contains(bound);
  }

  getDescendantElements(): GfxModel[] {
    return getDescendantElementsImpl(this);
  }

  hasChild(element: GfxModel): boolean {
    return this.childElementIds ? element.id in this.childElementIds : false;
  }

  hasDescendantElement(element: GfxModel): boolean {
    return hasDescendantElementImpl(this, element);
  }

  override includesPoint(x: number, y: number, _: PointTestOptions): boolean {
    const bound = Bound.deserialize(this.xywh);
    return bound.isPointInBound([x, y]);
  }

  override intersectsBound(selectedBound: Bound): boolean {
    const bound = Bound.deserialize(this.xywh);
    return (
      bound.isIntersectWithBound(selectedBound) || selectedBound.contains(bound)
    );
  }

  removeChild(element: GfxModel): void {
    this.doc.transact(() => {
      this.childElementIds && delete this.childElementIds[element.id];
    });
  }
}

declare global {
  namespace BlockSuite {
    interface EdgelessBlockModelMap {
      'affine:frame': FrameBlockModel;
    }
    interface BlockModels {
      'affine:frame': FrameBlockModel;
    }
  }
}
