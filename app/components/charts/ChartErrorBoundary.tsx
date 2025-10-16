'use client';

import React, { Component, ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  chartTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ChartErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('❌ [CHART ERROR]', this.props.chartTitle || 'Chart', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="bg-gray-900 rounded-lg border border-red-900/50 p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-sm font-medium text-red-400 mb-1">
                {this.props.chartTitle ? `Errore nel grafico "${this.props.chartTitle}"` : 'Errore nel grafico'}
              </h4>
              <p className="text-xs text-gray-400">
                {this.state.error?.message || 'Impossibile renderizzare questo grafico'}
              </p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

