import type { Decorator, Preview } from '@storybook/nextjs';
import { useEffect } from 'react';

import '../src/app/global.css';

// The repo's dark mode is attribute-based ([data-theme='dark'] in global.css),
// not prefers-color-scheme or a class — this decorator is what actually
// flips that attribute at runtime, since nothing else in the app does yet.
const withTheme: Decorator = (Story, context) => {
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', context.globals.theme as string);
  }, [context.globals.theme]);

  return <Story />;
};

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
  globalTypes: {
    theme: {
      name: 'Theme',
      description: 'Light/dark theme',
      defaultValue: 'light',
      toolbar: {
        icon: 'circlehollow',
        items: [
          { value: 'light', icon: 'sun', title: 'Light' },
          { value: 'dark', icon: 'moon', title: 'Dark' },
        ],
        dynamicTitle: true,
      },
    },
  },
  decorators: [withTheme],
};

export default preview;
