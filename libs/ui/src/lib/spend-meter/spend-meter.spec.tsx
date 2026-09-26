import { render, screen } from '@testing-library/react';

import { SpendMeter } from './spend-meter';

describe('SpendMeter', () => {
  it('formats the spent/limit text', () => {
    render(<SpendMeter spent={0.04} limit={0.25} />);

    expect(screen.getByText('$0.04')).toBeTruthy();
    expect(screen.getByText('/ $0.25')).toBeTruthy();
  });

  it('exposes an accessible meter with the correct values', () => {
    render(<SpendMeter spent={0.04} limit={0.25} />);

    const meter = screen.getByRole('meter');
    expect(meter.getAttribute('aria-valuenow')).toBe('0.04');
    expect(meter.getAttribute('aria-valuemax')).toBe('0.25');
    expect(meter.getAttribute('aria-valuetext')).toBe('$0.04 of $0.25');
  });

  it('sizes the fill to the percentage of the limit', () => {
    render(<SpendMeter spent={0.22} limit={0.25} />);

    const meter = screen.getByRole('meter');
    const fill = meter.firstElementChild as HTMLElement;
    expect(fill.style.width).toBe('88%');
  });

  it('clamps the fill at 100% when spend exceeds the limit', () => {
    render(<SpendMeter spent={5} limit={0.25} />);

    const meter = screen.getByRole('meter');
    const fill = meter.firstElementChild as HTMLElement;
    expect(fill.style.width).toBe('100%');
  });
});
