import { render, screen } from '@testing-library/react';

import { Pill } from './pill';

describe('Pill', () => {
  it('renders as a span by default', () => {
    render(<Pill variant="tint">botany</Pill>);

    const el = screen.getByText('botany');
    expect(el.tagName).toBe('SPAN');
  });

  it('renders as a link when href is given', () => {
    render(
      <Pill variant="mention" href="#">
        @maya
      </Pill>,
    );

    expect(screen.getByRole('link', { name: '@maya' })).toBeTruthy();
  });

  it('applies tint styling', () => {
    render(<Pill variant="tint">botany</Pill>);

    expect(screen.getByText('botany').className).toContain('bg-plum-tint');
  });

  it('applies outline styling with a border', () => {
    render(<Pill variant="outline">paused</Pill>);

    expect(screen.getByText('paused').className).toContain('border-line');
  });

  it('applies the fixed mention styling regardless of size', () => {
    render(
      <Pill variant="mention" size="md" href="#">
        @maya
      </Pill>,
    );

    const el = screen.getByRole('link', { name: '@maya' });
    expect(el.className).toContain('px-[7px]');
  });
});
