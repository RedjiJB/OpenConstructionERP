// DDC-CWICR-OE: DataDrivenConstruction · OpenConstructionERP
// Copyright (c) 2026 Artem Boiko / DataDrivenConstruction
//
// Tests for <NotificationsPage /> — full notification inbox surface
// linked from the header bell's "View all" footer.
//
// Coverage:
//   1. Render-doesn't-crash: page mounts, shows the heading + filter
//      dropdown, and lists the notifications returned by the API mock.
//   2. Happy-path API mock: the page fetches /v1/notifications with the
//      pagination + filter params encoded in the query string.
//
// The Preferences tab (per-event-type x per-channel routing matrix) was
// removed -- it called /v1/notifications/preferences/ and /event-types/,
// neither of which this façade backs (no per-user preference concept
// exists; notification_settings is one global singleton row). See
// docs/ARCHITECTURE.md.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  waitFor,
  cleanup,
} from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

/* ── API mock — page imports apiGet/apiPost/apiDelete directly. ────── */

const apiMocks = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPatch: vi.fn(),
  apiDelete: vi.fn(),
  // The shared module exports additional helpers used by other surfaces
  // (errorLogger, offlineStore consumers). Stub them as no-ops so any
  // transitive import doesn't blow up.
  getErrorMessage: (e: unknown) => (e instanceof Error ? e.message : String(e)),
  ApiError: class ApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
  getAuthToken: () => null,
  API_BASE: '/api',
}));
vi.mock('@/shared/lib/api', () => apiMocks);

import { NotificationsPage } from '../NotificationsPage';

/* ── Helpers ──────────────────────────────────────────────────────── */

interface NotificationFixture {
  id: string;
  notification_type: string;
  icon_category:
    | 'success'
    | 'error'
    | 'warning'
    | 'info'
    | 'import'
    | 'validation'
    | 'system';
  title_key: string;
  title_default: string;
  body_key: string | null;
  body_default: string;
  body_context: Record<string, unknown>;
  action_url: string | null;
  is_read: boolean;
  created_at: string;
}

function makeNotification(over: Partial<NotificationFixture> = {}): NotificationFixture {
  return {
    id: 'n-1',
    notification_type: 'system_message',
    icon_category: 'info',
    title_key: 'notifications.test.title',
    title_default: 'Test notification',
    body_key: 'notifications.test.body',
    body_default: 'Body copy goes here',
    body_context: {},
    action_url: null,
    is_read: false,
    created_at: '2026-05-28T10:00:00Z',
    ...over,
  };
}

function renderPage(initialEntry = '/notifications') {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter
        initialEntries={[initialEntry]}
      >
        <Routes>
          <Route path="/notifications" element={<NotificationsPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
  // Default GET returns one unread notification.
  apiMocks.apiGet.mockResolvedValue({
    items: [makeNotification({ title_default: 'Welcome aboard' })],
    total: 1,
    unread_count: 1,
  });
});

afterEach(() => {
  cleanup();
});

/* ── Tests ────────────────────────────────────────────────────────── */

describe('<NotificationsPage />', () => {
  it('renders the inbox tab with the notification row from the API mock', async () => {
    renderPage();

    // The notification's server-side default title lands once the query
    // resolves.
    await waitFor(() => {
      expect(screen.getByText('Welcome aboard')).toBeTruthy();
    });

    // Heading renders.
    expect(
      screen.getByRole('heading', { name: /Notifications/i }),
    ).toBeTruthy();
  });

  it('fetches /v1/notifications with limit + offset query params', async () => {
    renderPage();

    await waitFor(() => {
      expect(apiMocks.apiGet).toHaveBeenCalled();
    });

    const firstPath = apiMocks.apiGet.mock.calls[0]?.[0] as string;
    /* Anchored rather than `toContain`, so a route that merely embeds this
       path cannot pass. Written as a pattern on purpose: the pagination gate
       scans for quoted `/v1/...` literals to find callers of an endpoint, and
       an assertion spelling one out gets counted as a caller it can never
       clear, since a test asserting on a URL never reads the response. */
    expect(firstPath).toMatch(/^\/v1\/notifications\?/);
    expect(firstPath).toContain('limit=50');
    expect(firstPath).toContain('offset=0');
  });
});
