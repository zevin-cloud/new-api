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
import { Empty, Button } from '@douyinfe/semi-ui';
import {
  IllustrationFailure,
  IllustrationFailureDark,
} from '@douyinfe/semi-illustrations';
import { withTranslation } from 'react-i18next';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      const { t, fallback } = this.props;
      if (fallback) {
        return fallback;
      }
      return (
        <div className='flex flex-col justify-center items-center min-h-[400px] p-8'>
          <Empty
            image={
              <IllustrationFailure style={{ width: 200, height: 200 }} />
            }
            darkModeImage={
              <IllustrationFailureDark style={{ width: 200, height: 200 }} />
            }
            description={
              <div>
                <p>{t ? t('页面渲染出错，请刷新页面重试') : '页面渲染出错，请刷新页面重试'}</p>
                {this.state.error && (
                  <pre className='mt-2 p-3 bg-red-50 dark:bg-gray-800 text-red-600 dark:text-red-400 text-xs text-left max-w-2xl overflow-auto max-h-60 rounded border border-red-200 dark:border-red-900 whitespace-pre-wrap font-mono select-text'>
                    {this.state.error.toString()}
                    {'\n\n'}
                    {this.state.error.stack}
                  </pre>
                )}
              </div>
            }
          />
          <Button
            theme='solid'
            type='primary'
            style={{ marginTop: 16 }}
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
          >
            {t ? t('刷新页面') : '刷新页面'}
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default withTranslation()(ErrorBoundary);
