import { BlockService } from '@blocksuite/block-std';

import { LayerManager } from './managers/layer-manager.js';
import { type SurfaceBlockModel, SurfaceBlockSchema } from './surface-model.js';

export class SurfaceBlockService extends BlockService {
  static override readonly flavour = SurfaceBlockSchema.model.flavour;

  layer!: LayerManager;

  surface!: SurfaceBlockModel;

  override mounted(): void {
    super.mounted();

    this.surface = this.doc.getBlockByFlavour(
      'affine:surface'
    )[0] as SurfaceBlockModel;

    if (!this.surface) {
      const disposable = this.doc.slots.blockUpdated.on(payload => {
        if (payload.flavour === 'affine:surface') {
          disposable.dispose();
          const surface = this.doc.getBlockById(
            payload.id
          ) as SurfaceBlockModel | null;
          if (!surface) return;
          this.surface = surface;
          this.layer = LayerManager.create(this.doc, surface);
        }
      });
    } else {
      this.layer = LayerManager.create(this.doc, this.surface);
    }
  }

  override unmounted(): void {
    this.layer?.dispose();
  }
}