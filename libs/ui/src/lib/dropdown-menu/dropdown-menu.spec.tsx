import { fireEvent, render, screen } from '@testing-library/react';

import { DropdownMenu, type DropdownMenuEntry } from './dropdown-menu';

function setup(overrides: Partial<Parameters<typeof DropdownMenu>[0]> = {}) {
  const onEdit = jest.fn();
  const onPause = jest.fn();
  const onDelete = jest.fn();
  const items: DropdownMenuEntry[] = [
    { type: 'item', id: 'edit', label: 'Edit agent', icon: 'pencil', onSelect: onEdit },
    { type: 'item', id: 'pause', label: 'Pause', disabled: true, onSelect: onPause },
    { type: 'item', id: 'rename', label: 'Rename', onSelect: jest.fn() },
    { type: 'divider' },
    { type: 'item', id: 'delete', label: 'Delete agent', danger: true, onSelect: onDelete },
  ];
  render(
    <div>
      <DropdownMenu label="Agent actions" trigger={() => <span>Open</span>} items={items} {...overrides} />
      <button type="button">Outside</button>
    </div>,
  );
  return { onEdit, onPause, onDelete, trigger: screen.getByRole('button', { name: 'Agent actions' }) };
}

describe('DropdownMenu', () => {
  it('is closed by default', () => {
    const { trigger } = setup();

    expect(screen.queryByRole('menu')).toBeNull();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('opens on click and closes on a second click', () => {
    const { trigger } = setup();

    fireEvent.click(trigger);
    expect(screen.getByRole('menu')).toBeTruthy();

    fireEvent.click(trigger);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('wires up the ARIA attributes', () => {
    const { trigger } = setup();
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu');

    fireEvent.click(trigger);
    const menu = screen.getByRole('menu');

    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(trigger.getAttribute('aria-controls')).toBe(menu.id);
    expect(screen.getAllByRole('menuitem').length).toBe(4);
    expect(screen.getByRole('separator')).toBeTruthy();
  });

  // Enter and Space reach a real <button> as a native click, which jsdom does
  // not synthesize from keydown — so those two are covered by the click case.
  it('opens on click with the first enabled item focused', () => {
    const { trigger } = setup();

    fireEvent.click(trigger);

    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Edit agent' }));
  });

  it('opens on ArrowDown with the first item focused and on ArrowUp with the last', () => {
    const { trigger } = setup();

    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Edit agent' }));

    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();

    fireEvent.keyDown(trigger, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Delete agent' }));
  });

  it('moves with the arrow keys, wraps, and skips disabled items', () => {
    const { trigger } = setup();
    fireEvent.click(trigger);
    const menu = screen.getByRole('menu');

    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Rename' }));

    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Delete agent' }));

    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Edit agent' }));

    fireEvent.keyDown(menu, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Delete agent' }));

    fireEvent.keyDown(menu, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Rename' }));
  });

  it('jumps to the first and last enabled items with Home and End', () => {
    const { trigger } = setup();
    fireEvent.click(trigger);
    const menu = screen.getByRole('menu');

    fireEvent.keyDown(menu, { key: 'End' });
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Delete agent' }));

    fireEvent.keyDown(menu, { key: 'Home' });
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Edit agent' }));
  });

  it('closes on Escape and returns focus to the trigger', () => {
    const { trigger } = setup();
    fireEvent.click(trigger);

    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });

    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('closes on Tab and returns focus to the trigger', () => {
    const { trigger } = setup();
    fireEvent.click(trigger);

    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Tab' });

    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('closes on an outside pointer-down but not on one inside the wrapper', () => {
    const { trigger } = setup();
    fireEvent.click(trigger);

    fireEvent.pointerDown(trigger);
    expect(screen.getByRole('menu')).toBeTruthy();

    fireEvent.pointerDown(screen.getByRole('button', { name: 'Outside' }));
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('calls onSelect, closes, and returns focus to the trigger on select', () => {
    const { trigger, onEdit } = setup();
    fireEvent.click(trigger);

    fireEvent.click(screen.getByRole('menuitem', { name: 'Edit agent' }));

    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('does not fire a disabled item and keeps the menu open', () => {
    const { trigger, onPause } = setup();
    fireEvent.click(trigger);
    const pause = screen.getByRole('menuitem', { name: 'Pause' });

    fireEvent.click(pause);

    expect(onPause).not.toHaveBeenCalled();
    expect(pause.getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByRole('menu')).toBeTruthy();
  });

  it('styles the danger item and renders the icon as a Remix icon', () => {
    const { trigger } = setup();
    fireEvent.click(trigger);

    expect(screen.getByRole('menuitem', { name: 'Delete agent' }).className).toContain('text-danger');
    expect(screen.getByRole('menuitem', { name: 'Edit agent' }).querySelector('i.ri-pencil-line')).toBeTruthy();
  });

  it('passes the open state to the trigger render prop', () => {
    render(<DropdownMenu label="Account" items={[]} trigger={({ open }) => <span>{open ? 'Opened' : 'Closed'}</span>} />);

    expect(screen.getByText('Closed')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Account' }));
    expect(screen.getByText('Opened')).toBeTruthy();
  });

  it('opens below for placement="down"', () => {
    const { trigger } = setup({ placement: 'down' });
    fireEvent.click(trigger);
    expect(screen.getByRole('menu').className).toContain('top-full');
    expect(screen.getByRole('menu').className).not.toContain('bottom-full');
  });

  it('opens above for placement="up"', () => {
    const { trigger } = setup({ placement: 'up' });
    fireEvent.click(trigger);
    expect(screen.getByRole('menu').className).toContain('bottom-full');
    expect(screen.getByRole('menu').className).not.toContain('top-full');
  });

  it('aligns to the trigger end when asked', () => {
    const { trigger } = setup({ align: 'end' });
    fireEvent.click(trigger);
    expect(screen.getByRole('menu').className).toContain('right-0');
  });
});
