/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import React from 'react';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { useNavigation } from '../../../hooks/common/useNavigation';
import Navigation from '../headerbar/Navigation';
import SiderBar from '../SiderBar';
import { StatusContext } from '../../../context/Status';
import { API } from '../../../helpers';

// Provider branding is an external asset dependency, unrelated to gateway navigation.
vi.mock(
  '@lobehub/icons',
  () =>
    new Proxy(
      {},
      { get: (_, key) => (key === 'then' ? undefined : () => null) },
    ),
);

function HeaderFixture({ user, modules, mobile = false }) {
  const links = useNavigation(
    (key) => key,
    'https://example.com/docs',
    modules,
    user,
  );
  return (
    <Navigation
      {...links}
      isMobile={mobile}
      isLoading={false}
      userState={{ user }}
      pricingRequireAuth={false}
    />
  );
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('enable_data_export', 'true');
  localStorage.setItem('enable_drawing', 'true');
  localStorage.setItem('enable_task', 'true');
  vi.spyOn(API, 'get').mockResolvedValue({ data: { success: true, data: {} } });
});
afterEach(cleanup);

it('shows marketplace before console and marks console active on nested routes', () => {
  render(
    <MemoryRouter initialEntries={['/console/model-grants']}>
      <HeaderFixture user={{ role: 100 }} />
    </MemoryRouter>,
  );
  const links = screen.getAllByRole('link');
  expect(links[0]).toHaveTextContent('模型广场');
  expect(links[1]).toHaveTextContent('Management console');
  expect(links[1]).toHaveAttribute('aria-current', 'page');
  expect(screen.queryByRole('link', { name: '首页' })).not.toBeInTheDocument();
});

it('does not expose console navigation to ordinary users or guests', () => {
  const { rerender } = render(
    <MemoryRouter>
      <HeaderFixture user={{ role: 1 }} />
    </MemoryRouter>,
  );
  expect(
    screen.queryByRole('link', { name: 'Management console' }),
  ).not.toBeInTheDocument();
  rerender(
    <MemoryRouter>
      <HeaderFixture user={null} />
    </MemoryRouter>,
  );
  expect(
    screen.queryByRole('link', { name: 'Management console' }),
  ).not.toBeInTheDocument();
});

it('honors disabled primary and support navigation modules', () => {
  render(
    <MemoryRouter>
      <HeaderFixture
        user={{ role: 100 }}
        modules={{
          pricing: { enabled: false },
          console: false,
          docs: false,
          about: false,
        }}
      />
    </MemoryRouter>,
  );
  expect(screen.queryAllByRole('link')).toHaveLength(0);
  expect(
    screen.queryByRole('button', { name: 'Help' }),
  ).not.toBeInTheDocument();
});

it('opens documentation and about from the mobile help menu', async () => {
  render(
    <MemoryRouter>
      <HeaderFixture user={{ role: 100 }} mobile />
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Help' }));
  expect(
    await screen.findByRole('link', { name: 'Integration docs' }),
  ).toHaveAttribute('href', 'https://example.com/docs');
  expect(screen.getByRole('link', { name: '关于' })).toHaveAttribute(
    'href',
    '/about',
  );
});

it('groups administrator navigation and retains route selection and collapse', async () => {
  localStorage.setItem('user', JSON.stringify({ role: 100 }));
  render(
    <MemoryRouter initialEntries={['/console/model-sets']}>
      <StatusContext.Provider value={[{ status: {} }, vi.fn()]}>
        <SiderBar />
      </StatusContext.Provider>
    </MemoryRouter>,
  );
  const selected = await screen.findByRole('link', { name: '模型集管理' });
  expect(selected).toHaveAttribute('aria-current', 'page');
  for (const title of [
    'Operations overview',
    'Model resources',
    'Access governance',
    'Logs and audit',
    'System configuration',
  ])
    expect(screen.getByText(title)).toBeInTheDocument();
  expect(
    screen.queryByRole('link', { name: '个人设置' }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole('link', { name: '操练场' }),
  ).toHaveAttribute('href', '/console/playground');
  fireEvent.click(screen.getByRole('button', { name: '收起侧边栏' }));
  await waitFor(() =>
    expect(screen.queryByText('Model resources')).not.toBeInTheDocument(),
  );
});

it('hides empty groups and respects existing saved module switches', async () => {
  localStorage.setItem('user', JSON.stringify({ role: 10 }));
  const status = {
    SidebarModulesAdmin: JSON.stringify({
      admin: { enabled: false },
      console: {
        enabled: true,
        detail: false,
        token: false,
        log: true,
        midjourney: false,
        task: false,
      },
    }),
  };
  render(
    <MemoryRouter>
      <StatusContext.Provider value={[{ status }, vi.fn()]}>
        <SiderBar />
      </StatusContext.Provider>
    </MemoryRouter>,
  );
  await screen.findByRole('link', { name: 'Invocation logs' });
  expect(screen.queryByText('Model resources')).not.toBeInTheDocument();
  expect(screen.queryByText('Operations overview')).not.toBeInTheDocument();
  expect(screen.queryByText('Access governance')).not.toBeInTheDocument();
  expect(screen.queryByText('System configuration')).not.toBeInTheDocument();
});

it('respects the 5-group enterprise sidebar module switches including playground', async () => {
  localStorage.setItem('user', JSON.stringify({ role: 100 }));
  const status = {
    SidebarModulesAdmin: JSON.stringify({
      resources: {
        enabled: true,
        channel: true,
        models: false,
        model_set: true,
        deployment: false,
        playground: false,
      },
      governance: {
        enabled: true,
        model_grant: true,
        user: false,
        user_group: false,
        token: true,
      },
      audit: {
        enabled: false,
      },
    }),
  };
  render(
    <MemoryRouter>
      <StatusContext.Provider value={[{ status }, vi.fn()]}>
        <SiderBar />
      </StatusContext.Provider>
    </MemoryRouter>,
  );
  await screen.findByRole('link', { name: '渠道管理' });
  expect(screen.getByRole('link', { name: '模型集管理' })).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: '模型管理' })).not.toBeInTheDocument();
  expect(screen.queryByRole('link', { name: '操练场' })).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: '授权管理' })).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: '用户管理' })).not.toBeInTheDocument();
  expect(screen.queryByText('Logs and audit')).not.toBeInTheDocument();
});

it('renders sidebar sections in configured sectionOrder', async () => {
  localStorage.setItem('user', JSON.stringify({ role: 100 }));
  const status = {
    SidebarModulesAdmin: JSON.stringify({
      sectionOrder: ['governance', 'resources', 'overview', 'audit', 'system'],
    }),
  };
  render(
    <MemoryRouter>
      <StatusContext.Provider value={[{ status }, vi.fn()]}>
        <SiderBar />
      </StatusContext.Provider>
    </MemoryRouter>,
  );
  await screen.findByRole('link', { name: '授权管理' });
  const titles = screen.getAllByText(/Access governance|Model resources|Operations overview/);
  expect(titles[0]).toHaveTextContent('Access governance');
  expect(titles[1]).toHaveTextContent('Model resources');
  expect(titles[2]).toHaveTextContent('Operations overview');
});

it('renders menu items in configured itemOrders within a section', async () => {
  localStorage.setItem('user', JSON.stringify({ role: 100 }));
  const status = {
    SidebarModulesAdmin: JSON.stringify({
      itemOrders: {
        resources: ['playground', 'model_set', 'channel', 'models', 'deployment'],
      },
    }),
  };
  render(
    <MemoryRouter>
      <StatusContext.Provider value={[{ status }, vi.fn()]}>
        <SiderBar />
      </StatusContext.Provider>
    </MemoryRouter>,
  );
  await screen.findByRole('link', { name: '操练场' });
  const resourceLinks = screen
    .getAllByRole('link')
    .map((el) => el.getAttribute('href'));
  const playgroundIdx = resourceLinks.indexOf('/console/playground');
  const modelSetIdx = resourceLinks.indexOf('/console/model-sets');
  const channelIdx = resourceLinks.indexOf('/console/channel');
  expect(playgroundIdx).toBeLessThan(modelSetIdx);
  expect(modelSetIdx).toBeLessThan(channelIdx);
});


