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

import { useEffect } from 'react';

export function useFavicon(logo) {
  useEffect(() => {
    let icons = [...document.querySelectorAll("link[rel~='icon']")];
    if (icons.length === 0) {
      const icon = document.createElement('link');
      icon.rel = 'icon';
      document.head.appendChild(icon);
      icons = [icon];
    }
    // Rsbuild can inject another icon alongside the HTML template's icon.
    for (const icon of icons) {
      icon.removeAttribute('type');
      icon.removeAttribute('sizes');
      icon.href = logo || '/logo.png';
    }
  }, [logo]);
}
