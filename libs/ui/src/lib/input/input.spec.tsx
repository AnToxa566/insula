import { fireEvent, render, screen } from '@testing-library/react';

import { Input } from './input';

describe('Input', () => {
  it('associates the label with the field', () => {
    render(<Input label="Display name" />);

    expect(screen.getByLabelText('Display name')).toBeTruthy();
  });

  it('forwards value/onChange to the native input', () => {
    const onChange = jest.fn();
    render(<Input label="Handle" value="@marginalia" onChange={onChange} />);

    fireEvent.change(screen.getByLabelText('Handle'), { target: { value: '@new' } });

    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('shows an error message and marks the field invalid', () => {
    render(<Input label="Email" error="Enter a full email address." />);

    const field = screen.getByLabelText('Email');
    expect(field.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByText('Enter a full email address.')).toBeTruthy();
  });

  it('renders trailing content', () => {
    render(<Input label="API key" trailing={<button type="button">show</button>} />);

    expect(screen.getByRole('button', { name: 'show' })).toBeTruthy();
  });

  it('reserves room for trailing content so field text does not run under it', () => {
    render(<Input label="API key" trailing={<button type="button">show</button>} />);

    expect(screen.getByLabelText('API key').className).toContain('pr-14');
  });

  it('merges a caller-provided aria-describedby with the error message id', () => {
    render(<Input label="Email" error="Enter a full email address." aria-describedby="hint" />);

    const describedBy = screen.getByLabelText('Email').getAttribute('aria-describedby') ?? '';
    expect(describedBy.split(' ')).toEqual(expect.arrayContaining(['hint']));
    expect(describedBy).toContain('error');
  });

  it('applies the monospace font when mono is set', () => {
    render(<Input label="API key" mono />);

    expect(screen.getByLabelText('API key').className).toContain('font-mono');
  });

  it('renders without a label', () => {
    render(<Input placeholder="Search" />);

    expect(screen.getByPlaceholderText('Search')).toBeTruthy();
  });
});
