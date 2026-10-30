import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Icon } from '../src/ui/Icon';

describe('Icon size', () => {
  it('a CSS size is applied by style only, never as a width/height attribute (the browser rejects var() there)', () => {
    const html = renderToStaticMarkup(<Icon name="check" size="var(--s-22)" />);
    expect(html).not.toMatch(/\swidth="/);
    expect(html).not.toMatch(/\sheight="/);
    expect(html).toContain('width:var(--s-22)');
    expect(html).toContain('height:var(--s-22)');
  });
  it('a number is a size in pixels in both the attributes and the style', () => {
    const html = renderToStaticMarkup(<Icon name="check" size={30} />);
    expect(html).toMatch(/\swidth="30"/);
    expect(html).toContain('width:30px');
  });
  it('the default size is 24 px', () => {
    expect(renderToStaticMarkup(<Icon name="check" />)).toContain('width:24px');
  });
});
