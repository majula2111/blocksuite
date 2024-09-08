import { DisposableGroup } from '@blocksuite/global/utils';

import { GfxBlockElementModel, type GfxModel } from './gfx-block-model.js';
import {
  type GfxContainerElement,
  GfxGroupLikeElementModel,
  isGfxContainerElm,
} from './surface/element-model.js';
import { SurfaceBlockModel } from './surface/surface-model.js';

/**
 * Get the top elements from the list of elements, which are in some tree structures.
 *
 * For example: a list `[C1, E1, C2, E2, E2, E3, E4, C4, E6]`,
 * and they are in the elements tree like:
 * ```
 *     C1         C4      E6
 *    /  \        |
 *  E1   C2       E5
 *       / \
 *      E2  C3*
 *         / \
 *        E3 E4
 * ```
 * where the star symbol `*` denote it is not in the list.
 *
 * The result should be `[F1, F2, E6, E3, E4]`.
 */
export function getTopElements(elements: GfxModel[]): GfxModel[] {
  const results = new Set(elements);

  elements = [...new Set(elements)];

  elements.forEach(e1 => {
    elements.forEach(e2 => {
      if (isGfxContainerElm(e1) && e1.hasDescendantElement(e2)) {
        results.delete(e2);
      }
    });
  });

  return [...results];
}

export class TreeManager {
  private _elementToContainer = new Map<string, string>();

  constructor(readonly surface: SurfaceBlockModel) {}

  getContainer(elementId: string): (GfxModel & GfxContainerElement) | null {
    const containerId = this._elementToContainer.get(elementId);
    if (!containerId) return null;

    const canvasElement = this.surface.getElementById(containerId);
    if (isGfxContainerElm(canvasElement)) return canvasElement;

    const blockModel = this.surface.doc.getBlock(containerId)?.model;
    if (isGfxContainerElm(blockModel)) {
      return blockModel as GfxContainerElement & GfxModel;
    }

    console.warn(
      `the found container id(${containerId}) dose not refer to a container element(${canvasElement || blockModel})`
    );
    return null;
  }

  watch() {
    const onGfxModelAdded = (model: GfxModel) => {
      if (!isGfxContainerElm(model)) return;
      model.childElements.forEach(child => {
        const prevContainer = this.getContainer(child.id);
        // eslint-disable-next-line unicorn/prefer-dom-node-remove
        prevContainer?.removeChild(child);

        this._elementToContainer.set(child.id, model.id);
      });
    };

    const onGfxModelDeleted = (model: GfxModel) => {
      const container = this.getContainer(model.id);
      // eslint-disable-next-line unicorn/prefer-dom-node-remove
      container?.removeChild(model);

      if (isGfxContainerElm(model)) {
        model.childElements.forEach(child => {
          this._elementToContainer.delete(child.id);
        });
      }
    };

    const onGfxContainerUpdated = (model: GfxModel) => {
      if (!isGfxContainerElm(model)) return;

      const previousChildrenIds = new Set<string>();
      this._elementToContainer.forEach((containerId, elementId) => {
        if (containerId === model.id) previousChildrenIds.add(elementId);
      });

      model.childIds.forEach(childId => {
        this._elementToContainer.set(childId, model.id);
        previousChildrenIds.delete(childId);
      });

      previousChildrenIds.forEach(prevChildId => {
        this._elementToContainer.delete(prevChildId);
      });
    };

    const disposable = new DisposableGroup();

    // Graphic Block Elements

    const { doc } = this.surface;
    const elements = doc
      .getBlocks()
      .filter(
        model =>
          model instanceof GfxBlockElementModel &&
          (model.parent instanceof SurfaceBlockModel ||
            model.parent?.role === 'root')
      ) as GfxModel[];

    elements.forEach(el => {
      if (isGfxContainerElm(el)) {
        el.childElements.forEach(child => {
          this._elementToContainer.set(child.id, el.id);
        });
      }
    });

    disposable.add(
      doc.slots.blockUpdated.on(payload => {
        if (payload.type === 'add') {
          const { model } = payload;
          if (model instanceof GfxBlockElementModel) {
            onGfxModelAdded(model);
          }
        } else if (payload.type === 'delete') {
          const { model } = payload;
          if (model instanceof GfxBlockElementModel) {
            onGfxModelDeleted(model);
          }
        } else if (payload.type === 'update') {
          const model = doc.getBlock(payload.id)?.model;
          if (!(model instanceof GfxBlockElementModel)) return;
          if (!isGfxContainerElm(model)) return;

          // Since the implement of GfxContainer may be different,
          // listen to the change of the children of container based on `blockUpdated` is difficult.
          // TODO(@L-Sun): remove this speed up branch if we can listen the change of children of container
          if (
            payload.flavour === 'affine:frame' &&
            payload.props.key !== 'childElementIds'
          ) {
            return;
          }

          onGfxContainerUpdated(
            model as GfxBlockElementModel & GfxContainerElement
          );
        }
      })
    );

    // Canvas Elements

    this.surface.elementModels.forEach(el => {
      if (isGfxContainerElm(el)) {
        el.childElements.forEach(child => {
          this._elementToContainer.set(child.id, el.id);
        });
      }
    });

    disposable.add(
      this.surface.elementAdded.on(({ id }) => {
        const element = this.surface.getElementById(id);
        element && onGfxModelAdded(element);
      })
    );

    disposable.add(
      this.surface.elementRemoved.on(({ model }) => {
        onGfxModelDeleted(model);
      })
    );

    disposable.add(
      this.surface.elementUpdated.on(({ id, oldValues }) => {
        const element = this.surface.getElementById(id);
        if (!isGfxContainerElm(element)) return;

        // Since the implement of GfxContainer may be different,
        // listen to the change of the children of container is difficult
        // TODO(@L-Sun): remove this speed up branch if we can listen the change of children of container
        if (
          element instanceof GfxGroupLikeElementModel &&
          !oldValues['childIds']
        )
          return;

        onGfxContainerUpdated(element);
      })
    );

    return disposable;
  }
}

function traverse(
  element: GfxModel,
  preCallback?: (element: GfxModel) => void | boolean,
  postCallBack?: (element: GfxModel) => void
) {
  if (preCallback) {
    const interrupt = preCallback(element);
    if (interrupt) return;
  }

  if (isGfxContainerElm(element)) {
    element.childElements.forEach(child => {
      traverse(child, preCallback, postCallBack);
    });
  }

  postCallBack && postCallBack(element);
}

export function getAncestorContainersImpl(element: GfxModel) {
  const containers: (GfxContainerElement & GfxModel)[] = [];

  let container = element.container;
  while (container) {
    containers.push(container);
    container = container.container;
  }

  return containers;
}

export function getDescendantElementsImpl(
  container: GfxContainerElement
): GfxModel[] {
  const results: GfxModel[] = [];
  container.childElements.forEach(child => {
    traverse(child, element => {
      results.push(element);
    });
  });
  return results;
}

export function hasDescendantElementImpl(
  container: GfxContainerElement,
  element: GfxModel
): boolean {
  let _container = element.container;
  while (_container) {
    if (_container === container) return true;
    _container = _container.container;
  }
  return false;
}
