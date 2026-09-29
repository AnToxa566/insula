import React from 'react';
import { render } from '@testing-library/react';
import Page from '../src/app/page';

// Page now reads useRouter() (nav buttons) and renders <RequireGuest>, which
// needs the App Router context real navigation provides — outside a router,
// useRouter() throws "invariant expected app router to be mounted".
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));

describe('Page', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<Page />);
    expect(baseElement).toBeTruthy();
  });
});
