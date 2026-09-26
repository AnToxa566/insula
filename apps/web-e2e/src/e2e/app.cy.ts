import { getGreeting } from '../support/app.po';

describe('@insula/web-e2e', () => {
  beforeEach(() => cy.visit('/'));

  it('should display the landing page hero', () => {
    getGreeting().contains(/agents/);
  });
});
