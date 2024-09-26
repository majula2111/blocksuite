import { type Container, createIdentifier } from '@blocksuite/global/di';
import { BlockSuiteError, ErrorCode } from '@blocksuite/global/exceptions';

import type { PointerEventState } from '../../event/index.js';
import type { ExtensionType } from '../../extension/extension.js';

import { type GfxController, GfxControllerIdentifier } from '../controller.js';
import { eventTarget, type SupportedEvents } from './tool-controller.js';

export abstract class BaseTool {
  static toolName: string = '';

  get active() {
    return this.gfx.tool.currentTool$.peek() === this;
  }

  get doc() {
    return this.gfx.doc;
  }

  get std() {
    return this.gfx.std;
  }

  get toolName() {
    return (this.constructor as typeof BaseTool).toolName;
  }

  constructor(readonly gfx: GfxController) {}

  /**
   * Called when the tool is activated.
   * @param option - The data passed as second argument when calling `ToolController.use`.
   */
  activate(_: Record<string, unknown>): void {}

  addHook(
    evtName: SupportedEvents,
    handler: (evtState: PointerEventState) => undefined | boolean
  ): void {
    this.gfx.tool[eventTarget].addHook(evtName, handler);
  }

  click(_: PointerEventState): void {}

  contextMenu(_: PointerEventState): void {}

  /**
   * Called when the tool is deactivated.
   */
  deactivate(): void {}

  doubleClick(_: PointerEventState): void {}

  dragEnd(_: PointerEventState): void {}

  dragMove(_: PointerEventState): void {}

  dragStart(_: PointerEventState): void {}

  /**
   * Called when the tool is registered.
   */
  onload(): void {}

  /**
   * Called when the tool is unloaded, usually when the whole `ToolController` is destroyed.
   */
  onunload(): void {}

  pointerDown(_: PointerEventState): void {}

  pointerMove(_: PointerEventState): void {}

  pointerOut(_: PointerEventState): void {}

  pointerUp(_: PointerEventState): void {}

  tripleClick(_: PointerEventState): void {}
}

export const ToolIdentifier = createIdentifier<BaseTool>('GfxTool');

export function GfxToolExtension(
  toolCtors: (typeof BaseTool)[]
): ExtensionType {
  return {
    setup: (di: Container) => {
      toolCtors.forEach(Ctor => {
        if (!Ctor.toolName) {
          throw new BlockSuiteError(
            ErrorCode.ValueNotExists,
            'The tool must have a static property `toolName`'
          );
        }

        di.addImpl(ToolIdentifier(Ctor.toolName), Ctor, [
          GfxControllerIdentifier,
        ]);
      });
    },
  };
}

declare global {
  namespace BlockSuite {
    interface GfxToolsMap {}
  }
}
