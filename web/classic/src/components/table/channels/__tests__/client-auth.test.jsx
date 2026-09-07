import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeAll, afterAll, beforeEach, expect, it, vi } from 'vitest';
import { API } from '../../../../helpers/api';
import ClientChannels, { ClientAuthorization } from '../ClientChannels';

vi.mock('../../../../helpers/api', () => ({
  API: { get: vi.fn(), post: vi.fn() },
}));
const providers = [
  { slug: 'kimi', name: 'Kimi Code', endpoint: '/v1/chat/completions' },
  { slug: 'codex', name: 'ChatGPT / Codex', endpoint: '/v1/responses' },
  { slug: 'claude', name: 'Claude Code', endpoint: '/v1/messages' },
  {
    slug: 'antigravity',
    name: 'Antigravity',
    endpoint: '/v1/chat/completions',
  },
];
const success = (data) => ({ data: { success: true, data } });

beforeEach(() => {
  API.get.mockImplementation((url) =>
    Promise.resolve(
      success(url.endsWith('/providers') ? providers : { items: [], total: 0 }),
    ),
  );
  API.post.mockReset();
});

it('shows all four direct authorization entries and an empty account list', async () => {
  render(<ClientChannels />);
  expect(
    await screen.findAllByRole('button', { name: 'Authorize account' }),
  ).toHaveLength(4);
  expect(screen.getByText('No client accounts connected')).toBeInTheDocument();
  expect(screen.queryByText('Server URL')).not.toBeInTheDocument();
});

it('creates a channel from a completed session without sending credentials', async () => {
  API.post.mockImplementation((url) =>
    Promise.resolve(
      success(
        url.endsWith('/init')
          ? {
              session_id: 'session',
              auth_type: 'oauth_pkce',
              auth_url: 'https://claude.ai/oauth/authorize',
              expires_in: 600,
            }
          : { status: 'success', id: 42 },
      ),
    ),
  );
  const onCreated = vi.fn();
  render(
    <ClientAuthorization
      provider={providers[2]}
      groupOptions={[]}
      onClose={vi.fn()}
      onCreated={onCreated}
    />,
  );
  expect(
    await screen.findByRole('link', { name: 'Open authorization page' }),
  ).toHaveAttribute('href', 'https://claude.ai/oauth/authorize');
  fireEvent.change(screen.getByRole('textbox', { name: 'Callback URL' }), {
    target: {
      value: 'http://localhost:54545/callback?code=code&state=session',
    },
  });
  fireEvent.click(
    screen.getByRole('button', { name: 'Complete authorization' }),
  );
  const models = await screen.findByRole('textbox', { name: 'Models' });
  const create = screen.getByRole('button', { name: 'Create client channel' });
  expect(create).toBeDisabled();
  fireEvent.change(models, { target: { value: 'model-a, model-b' } });
  fireEvent.click(create);
  await waitFor(() => expect(onCreated).toHaveBeenCalledOnce());
  expect(API.post).toHaveBeenCalledWith(
    '/api/channel/client_auth/create_channel',
    {
      session_id: 'session',
      channel_name: 'Claude Code',
      group: 'default',
      models: ['model-a', 'model-b'],
    },
  );
});

it('shows authorization failure without allowing channel creation', async () => {
  API.post.mockResolvedValue({
    data: { success: false, message: 'Authorization unavailable' },
  });
  render(
    <ClientAuthorization
      provider={providers[0]}
      groupOptions={[]}
      onClose={vi.fn()}
      onCreated={vi.fn()}
    />,
  );
  expect(
    await screen.findByText('Authorization unavailable'),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Create client channel' }),
  ).not.toBeInTheDocument();
});

it('aborts a pending authorization when the dialog is unmounted', async () => {
  API.post.mockImplementation(() => new Promise(() => {}));
  const view = render(
    <ClientAuthorization
      provider={providers[0]}
      groupOptions={[]}
      onClose={vi.fn()}
      onCreated={vi.fn()}
    />,
  );
  const signal = API.post.mock.calls[0][2].signal;
  view.unmount();
  expect(signal.aborted).toBe(true);
});

it('auto-fills name and models when returned from exchange', async () => {
  API.post.mockImplementation((url) =>
    Promise.resolve(
      success(
        url.endsWith('/init')
          ? {
              session_id: 'session-ag',
              auth_type: 'oauth_pkce',
              auth_url: 'https://accounts.google.com/o/oauth2/v2/auth',
              expires_in: 600,
              default_models: ['gemini-2.5-pro', 'gemini-2.5-flash'],
            }
          : {
              status: 'success',
              default_name: 'Antigravity (user@example.com)',
              default_models: ['gemini-2.5-pro', 'gemini-2.5-flash', 'claude-3-7-sonnet'],
              email: 'user@example.com',
            },
      ),
    ),
  );
  render(
    <ClientAuthorization
      provider={providers[3]}
      groupOptions={[]}
      onClose={vi.fn()}
      onCreated={vi.fn()}
    />,
  );
  fireEvent.change(await screen.findByRole('textbox', { name: 'Callback URL' }), {
    target: {
      value: 'http://localhost:8085/oauth/callback?code=abc&state=session-ag',
    },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Complete authorization' }));
  const nameInput = await screen.findByRole('textbox', { name: 'Channel name' });
  const modelsInput = screen.getByRole('textbox', { name: 'Models' });
  expect(nameInput).toHaveValue('Antigravity (user@example.com)');
  expect(modelsInput).toHaveValue('gemini-2.5-pro, gemini-2.5-flash, claude-3-7-sonnet');
});

it('opens quota modal and displays quota buckets and remaining fraction', async () => {
  const account = {
    id: 101,
    name: 'Antigravity Pro',
    provider: 'antigravity',
    models: 'gemini-2.5-pro',
    status: 1,
  };
  API.get.mockImplementation((url) => {
    if (url.endsWith('/providers')) return Promise.resolve(success(providers));
    if (url.endsWith('/channels')) return Promise.resolve(success({ items: [account], total: 1 }));
    if (url.includes('/quota/101')) {
      return Promise.resolve({
        data: {
          success: true,
          provider: 'antigravity',
          email: 'test@gmail.com',
          data: {
            groups: [
              {
                displayName: 'Antigravity Models',
                buckets: [
                  {
                    bucketId: 'gemini-2.5-pro',
                    displayName: 'Gemini 2.5 Pro',
                    remainingFraction: 0.85,
                    window: '5h',
                  },
                ],
              },
            ],
          },
        },
      });
    }
    return Promise.resolve(success({ items: [], total: 0 }));
  });

  render(<ClientChannels />);
  const quotaButton = await screen.findByRole('button', { name: '额度' });
  fireEvent.click(quotaButton);

  expect(await screen.findByText('test@gmail.com')).toBeInTheDocument();
  expect(screen.getByText('Antigravity Models')).toBeInTheDocument();
  expect(screen.getByText('Gemini 2.5 Pro')).toBeInTheDocument();
  expect(screen.getByText('85% 剩余')).toBeInTheDocument();
  expect(screen.getByText('5h')).toBeInTheDocument();
});

// jsdom does not implement Range geometry used by Semi typography.
beforeAll(() => {
  Range.prototype.getBoundingClientRect = () => ({ width: 0, height: 0, top: 0, left: 0, bottom: 0, right: 0 });
});
afterAll(() => { delete Range.prototype.getBoundingClientRect; });
