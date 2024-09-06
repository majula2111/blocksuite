import { ArrowRightIcon, EnterIcon } from '@blocksuite/affine-components/icons';
import {
  EditorHost,
  PropTypes,
  requiredProperties,
  WithDisposable,
} from '@blocksuite/block-std';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, query } from 'lit/decorators.js';

import type { AIItemConfig } from './types.js';

import './ai-sub-item-list.js';
import { menuItemStyles } from './styles.js';

@requiredProperties({
  host: PropTypes.instanceOf(EditorHost),
  item: PropTypes.object,
})
@customElement('ai-item')
export class AIItem extends WithDisposable(LitElement) {
  static override styles = css`
    ${menuItemStyles}
  `;

  override render() {
    const { item } = this;
    const className = item.name.split(' ').join('-').toLocaleLowerCase();

    return html`<div
      class="menu-item ${className}"
      @pointerdown=${(e: MouseEvent) => e.stopPropagation()}
      @click=${() => {
        if (typeof item.handler === 'function') {
          item.handler(this.host);
        }
        this.onClick?.();
      }}
    >
      <span class="item-icon">${item.icon}</span>
      <div class="item-name">
        ${item.name}${item.beta
          ? html`<div class="item-beta">(Beta)</div>`
          : nothing}
      </div>
      ${item.subItem
        ? html`<span class="arrow-right-icon">${ArrowRightIcon}</span>`
        : html`<span class="enter-icon">${EnterIcon}</span>`}
    </div>`;
  }

  @property({ attribute: false })
  accessor host!: EditorHost;

  @property({ attribute: false })
  accessor item!: AIItemConfig;

  @query('.menu-item')
  accessor menuItem: HTMLDivElement | null = null;

  @property({ attribute: false })
  accessor onClick: (() => void) | undefined;
}

declare global {
  interface HTMLElementTagNameMap {
    'ai-item': AIItem;
  }
}
