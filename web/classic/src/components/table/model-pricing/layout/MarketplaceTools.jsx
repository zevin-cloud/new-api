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
import { Link } from 'react-router-dom';
import { Button, Dropdown } from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import { useSidebar } from '../../../../hooks/common/useSidebar';

export default function MarketplaceTools() {
  const { t } = useTranslation();
  const { isModuleVisible } = useSidebar();
  let chatLinks = [];
  try {
    const chats = JSON.parse(localStorage.getItem('chats') || '[]');
    if (Array.isArray(chats)) {
      chatLinks = chats.flatMap((chat, index) =>
        Object.entries(chat)
          .filter(
            ([, url]) => typeof url === 'string' && /^https?:\/\//.test(url),
          )
          .map(([name]) => ({ name, to: `/console/chat/${index}` })),
      );
    }
  } catch {
    /* Invalid optional chat configuration has no navigation entries. */
  }

  return (
    <div className='flex flex-wrap justify-end gap-2 pb-2'>
      {isModuleVisible('chat', 'playground') && (
        <Link to='/console/playground'>
          <Button theme='light'>{t('Online playground')}</Button>
        </Link>
      )}
      {isModuleVisible('chat', 'chat') && chatLinks.length > 0 && (
        <Dropdown
          trigger='click'
          render={
            <Dropdown.Menu>
              {chatLinks.map((chat) => (
                <Dropdown.Item key={chat.to}>
                  <Link to={chat.to}>{chat.name}</Link>
                </Dropdown.Item>
              ))}
            </Dropdown.Menu>
          }
        >
          <Button theme='borderless'>{t('聊天')}</Button>
        </Dropdown>
      )}
    </div>
  );
}
