import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

/**
 * Unmount between tests.
 *
 * Testing Library's automatic cleanup does not register reliably under this
 * Vitest configuration, which leaves previous renders in the document and makes
 * `getByText` fail with "multiple elements found" — but only when more than one
 * test file runs, which is a horrible way to find out. Registering it here is
 * explicit and order-independent.
 */
afterEach(cleanup);
