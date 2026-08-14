import { render } from '@testing-library/react';

import InsulaUi from './ui';

describe('InsulaUi', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<InsulaUi />);
    expect(baseElement).toBeTruthy();
  });
});
