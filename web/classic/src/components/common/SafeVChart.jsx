/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/

import React from 'react';
import { VChart } from '@visactor/react-vchart';

class ChartErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    console.warn('[SafeVChart] Chart render skipped due to error:', error?.message);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || <div className='w-full h-full flex items-center justify-center text-gray-400 text-xs'>暂无图表数据</div>;
    }
    return this.props.children;
  }
}

export const SafeVChart = ({ spec, option, fallback, ...props }) => {
  if (!spec) {
    return fallback || null;
  }

  return (
    <ChartErrorBoundary fallback={fallback}>
      <VChart spec={spec} option={option} {...props} />
    </ChartErrorBoundary>
  );
};

export default SafeVChart;
