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
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
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
            description={t ? t('页面渲染出错，请刷新页面重试') : '页面渲染出错，请刷新页面重试'}
          />
          <Button
            theme='solid'
            type='primary'
            style={{ marginTop: 16 }}
            onClick={() => {
              this.setState({ hasError: false });
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
